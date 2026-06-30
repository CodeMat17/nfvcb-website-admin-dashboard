"use client";

import { use, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Pencil, Trash2, X } from "lucide-react";

type ItemDoc = {
  _id: Id<"approvedMovieItems">;
  title: string;
  duration: string;
  producer: string;
  director: string;
  majorCast: string;
  rating: string;
  previewLocation: string;
  language: string;
  consumerAdvice: string;
  dateOfApproval: string;
  productionCompany: string;
  order: number;
};

const FIELDS: { key: keyof ItemDoc; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "duration", label: "Duration" },
  { key: "rating", label: "Rating" },
  { key: "producer", label: "Producer" },
  { key: "director", label: "Director" },
  { key: "majorCast", label: "Major Cast" },
  { key: "previewLocation", label: "Preview Location" },
  { key: "language", label: "Language" },
  { key: "consumerAdvice", label: "Consumer Advice" },
  { key: "dateOfApproval", label: "Date of Approval" },
  { key: "productionCompany", label: "Production Company" },
];

function ratingColor(r: string) {
  switch (r) {
    case "G": return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
    case "PG": return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    case "12": return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20";
    case "12A": return "bg-orange-400/10 text-orange-500 border-orange-400/20";
    case "15": return "bg-red-400/10 text-red-500 border-red-400/20";
    case "18": return "bg-red-700/10 text-red-700 dark:text-red-400 border-red-700/20";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function ApprovedMoviesPostPage({
  params,
}: {
  params: Promise<{ postId: Id<"approvedMovies"> }>;
}) {
  const { postId } = use(params);

  const post = useQuery(api.approvedMovies.getPost, { id: postId });
  const items = useQuery(api.approvedMovies.listItems, { postId }) as ItemDoc[] | undefined;
  const updateItem = useMutation(api.approvedMovies.updateItem);
  const removeItem = useMutation(api.approvedMovies.removeItem);

  const [editingId, setEditingId] = useState<Id<"approvedMovieItems"> | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"approvedMovieItems"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startEdit(item: ItemDoc) {
    setEditingId(item._id);
    setForm({
      title: item.title,
      duration: item.duration,
      rating: item.rating,
      producer: item.producer,
      director: item.director,
      majorCast: item.majorCast,
      previewLocation: item.previewLocation,
      language: item.language,
      consumerAdvice: item.consumerAdvice,
      dateOfApproval: item.dateOfApproval,
      productionCompany: item.productionCompany,
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({});
  }

  async function saveEdit(id: Id<"approvedMovieItems">) {
    setSaving(true);
    setError(null);
    try {
      await updateItem({ id, ...form });
      cancelEdit();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: Id<"approvedMovieItems">) {
    if (!window.confirm("Remove this film from the batch?")) return;
    setDeletingId(id);
    try {
      await removeItem({ id });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/approved-movies">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{post?.title ?? "Approved Movies"}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {items?.length ?? "…"} films · {post?.month}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
      )}

      {items === undefined && (
        <div className="py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {items?.map((item) => (
          <Card key={item._id} className={editingId === item._id ? "border-nfvcb-green" : ""}>
            <CardContent className="py-5 space-y-3">
              {editingId === item._id ? (
                <div className="space-y-2">
                  {FIELDS.map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
                      <Input
                        value={form[key] ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      disabled={saving}
                      onClick={() => saveEdit(item._id)}
                      className="bg-nfvcb-green hover:bg-nfvcb-green/90"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>
                      <X className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.productionCompany}</p>
                    </div>
                    <Badge className={`font-bold shrink-0 ${ratingColor(item.rating)}`}>{item.rating}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Duration</p>
                      <p>{item.duration}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Language</p>
                      <p>{item.language}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Director</p>
                      <p>{item.director}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Producer</p>
                      <p>{item.producer}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] text-muted-foreground uppercase">Date of Approval</p>
                      <p>{item.dateOfApproval}</p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-1 pt-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item._id)}
                      disabled={deletingId === item._id}
                    >
                      {deletingId === item._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {items?.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">No films in this batch.</p>
      )}
    </div>
  );
}
