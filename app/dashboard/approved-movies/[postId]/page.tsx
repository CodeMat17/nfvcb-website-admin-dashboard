"use client";

import { use, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { NfvcbPickPanel } from "@/components/nfvcb-pick-panel";
import {
  ArrowLeft,
  Check,
  Loader2,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";

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
  featured?: boolean;
  trailerUrl?: string;
  juryNote?: string;
  order: number;
};

/** Ratings the public site knows how to colour — keep in sync with ratingColor. */
const RATINGS = ["G", "PG", "12", "12A", "15", "18"] as const;

type FieldKind = "text" | "select" | "textarea";

const FIELDS: { key: string; label: string; kind: FieldKind }[] = [
  { key: "title", label: "Title", kind: "text" },
  { key: "duration", label: "Duration", kind: "text" },
  { key: "rating", label: "Rating", kind: "select" },
  { key: "producer", label: "Producer", kind: "text" },
  { key: "director", label: "Director", kind: "text" },
  { key: "majorCast", label: "Major Cast", kind: "text" },
  { key: "previewLocation", label: "Preview Location", kind: "text" },
  { key: "language", label: "Language", kind: "text" },
  { key: "consumerAdvice", label: "Consumer Advice", kind: "text" },
  { key: "dateOfApproval", label: "Date of Approval", kind: "text" },
  { key: "productionCompany", label: "Production Company", kind: "text" },
  { key: "trailerUrl", label: "Trailer URL", kind: "text" },
  { key: "juryNote", label: "Jury Note", kind: "textarea" },
];

/** Fields that must be non-empty before a film can be created. */
const REQUIRED_KEYS = [
  "title",
  "duration",
  "rating",
  "producer",
  "director",
  "majorCast",
  "previewLocation",
  "language",
  "consumerAdvice",
  "dateOfApproval",
  "productionCompany",
];

const EMPTY_FORM: Record<string, string> = Object.fromEntries(
  FIELDS.map((f) => [f.key, ""])
);

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

function sanitizeText(value: string, maxLen: number): string {
  return value.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

export default function ApprovedMoviesPostPage({
  params,
}: {
  params: Promise<{ postId: Id<"approvedMovies"> }>;
}) {
  const { postId } = use(params);

  const post = useQuery(api.approvedMovies.getPost, { id: postId });
  const items = useQuery(api.approvedMovies.listItems, { postId }) as ItemDoc[] | undefined;
  const createItem = useMutation(api.approvedMovies.createItem);
  const updateItem = useMutation(api.approvedMovies.updateItem);
  const removeItem = useMutation(api.approvedMovies.removeItem);

  const [editingId, setEditingId] = useState<Id<"approvedMovieItems"> | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [featured, setFeatured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"approvedMovieItems"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<Record<string, string>>(EMPTY_FORM);
  const [addFeatured, setAddFeatured] = useState(false);
  const [adding, setAdding] = useState(false);

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!items) return undefined;
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [
        item.title,
        item.director,
        item.producer,
        item.productionCompany,
        item.majorCast,
        item.language,
        item.rating,
        item.dateOfApproval,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [items, search]);

  function startEdit(item: ItemDoc) {
    setEditingId(item._id);
    setShowAdd(false);
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
      trailerUrl: item.trailerUrl ?? "",
      juryNote: item.juryNote ?? "",
    });
    setFeatured(item.featured ?? false);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({});
    setFeatured(false);
  }

  async function saveEdit(id: Id<"approvedMovieItems">) {
    const missing = REQUIRED_KEYS.filter((k) => !form[k]?.trim());
    if (missing.length > 0) {
      return setError(
        `${FIELDS.filter((f) => missing.includes(f.key)).map((f) => f.label).join(", ")} cannot be empty.`
      );
    }

    setSaving(true);
    setError(null);
    try {
      const clean = Object.fromEntries(
        FIELDS.map(({ key }) => [key, sanitizeText(form[key] ?? "", 2000)])
      );
      await updateItem({
        id,
        ...clean,
        featured,
        trailerUrl: clean.trailerUrl || undefined,
        juryNote: clean.juryNote || undefined,
      });
      cancelEdit();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const missing = REQUIRED_KEYS.filter((k) => !addForm[k]?.trim());
    if (missing.length > 0) {
      return setError(
        `${FIELDS.filter((f) => missing.includes(f.key)).map((f) => f.label).join(", ")} ${
          missing.length === 1 ? "is" : "are"
        } required.`
      );
    }

    setAdding(true);
    setError(null);
    try {
      const clean = Object.fromEntries(
        FIELDS.map(({ key }) => [key, sanitizeText(addForm[key] ?? "", 2000)])
      ) as Record<string, string>;

      // Append after the current last film so ordering stays stable.
      const nextOrder = items?.length
        ? Math.max(...items.map((i) => i.order)) + 1
        : 0;

      await createItem({
        postId,
        title: clean.title,
        duration: clean.duration,
        producer: clean.producer,
        director: clean.director,
        majorCast: clean.majorCast,
        rating: clean.rating,
        previewLocation: clean.previewLocation,
        language: clean.language,
        consumerAdvice: clean.consumerAdvice,
        dateOfApproval: clean.dateOfApproval,
        productionCompany: clean.productionCompany,
        featured: addFeatured,
        trailerUrl: clean.trailerUrl || undefined,
        juryNote: clean.juryNote || undefined,
        order: nextOrder,
      });
      setAddForm(EMPTY_FORM);
      setAddFeatured(false);
      setShowAdd(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not add film.");
    } finally {
      setAdding(false);
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

  /** Shared field renderer for both the add and edit forms. */
  function renderFields(
    values: Record<string, string>,
    setValues: (updater: (f: Record<string, string>) => Record<string, string>) => void,
    isFeatured: boolean,
    setIsFeatured: (v: boolean) => void,
    idPrefix: string
  ) {
    return (
      <>
        {FIELDS.map(({ key, label, kind }) => (
          <div key={key} className="space-y-1">
            <label htmlFor={`${idPrefix}-${key}`} className="text-[11px] font-medium text-muted-foreground">
              {label}
              {REQUIRED_KEYS.includes(key) && <span className="text-destructive"> *</span>}
            </label>

            {kind === "select" ? (
              <Select
                value={values[key] || undefined}
                onValueChange={(v) => setValues((f) => ({ ...f, [key]: v }))}
              >
                <SelectTrigger id={`${idPrefix}-${key}`} className="w-full">
                  <SelectValue placeholder="Select a rating" />
                </SelectTrigger>
                <SelectContent>
                  {/* An imported rating outside the known set is kept as an
                      option so editing another field can't silently drop it. */}
                  {(values[key] && !RATINGS.includes(values[key] as (typeof RATINGS)[number])
                    ? [values[key], ...RATINGS]
                    : [...RATINGS]
                  ).map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : kind === "textarea" ? (
              <textarea
                id={`${idPrefix}-${key}`}
                rows={3}
                value={values[key] ?? ""}
                onChange={(e) => setValues((f) => ({ ...f, [key]: e.target.value }))}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
              />
            ) : (
              <Input
                id={`${idPrefix}-${key}`}
                value={values[key] ?? ""}
                onChange={(e) => setValues((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={key === "trailerUrl" ? "https://…" : undefined}
              />
            )}
          </div>
        ))}

        <label className="flex items-center gap-2 pt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-nfvcb-green"
          />
          <span className="text-[11px] font-medium text-muted-foreground">
            Featured film
          </span>
        </label>
      </>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
      <div className="flex items-start justify-between gap-4">
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
        {!showAdd && (
          <Button
            onClick={() => {
              setAddForm(EMPTY_FORM);
              setAddFeatured(false);
              setShowAdd(true);
              setEditingId(null);
              setError(null);
            }}
            className="bg-nfvcb-green hover:bg-nfvcb-green/90 shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add film
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
      )}

      {items !== undefined && items.length > 0 && (
        <NfvcbPickPanel postId={postId} films={items} />
      )}

      {showAdd && (
        <Card className="border-nfvcb-green">
          <CardContent className="py-5">
            <form onSubmit={handleAdd} className="space-y-3" noValidate>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Add a film to this batch
              </p>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
                {renderFields(addForm, setAddForm, addFeatured, setAddFeatured, "add")}
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  type="submit"
                  size="sm"
                  disabled={adding}
                  className="bg-nfvcb-green hover:bg-nfvcb-green/90"
                >
                  {adding ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Check className="h-3.5 w-3.5 mr-1" />
                  )}
                  Add film
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAdd(false);
                    setError(null);
                  }}
                  disabled={adding}
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {items !== undefined && items.length > 0 && (
        <div className="relative">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, director, producer, cast, company…"
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {items === undefined && (
        <div className="py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {search && filtered !== undefined && (
        <p className="text-xs text-muted-foreground -mt-4">
          {filtered.length} of {items?.length} films match &quot;{search}&quot;.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {filtered?.map((item) => (
          <Card key={item._id} className={editingId === item._id ? "border-nfvcb-green" : ""}>
            <CardContent className="py-5 space-y-3">
              {editingId === item._id ? (
                <div className="space-y-3">
                  {renderFields(form, setForm, featured, setFeatured, String(item._id))}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      disabled={saving}
                      onClick={() => saveEdit(item._id)}
                      className="bg-nfvcb-green hover:bg-nfvcb-green/90"
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      )}
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
                      <X className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm flex items-center gap-1.5">
                        {item.featured && (
                          <Star className="h-3.5 w-3.5 text-[#fea600] fill-[#fea600] shrink-0" />
                        )}
                        {item.title}
                      </p>
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
                    {item.trailerUrl && (
                      <div className="col-span-2 min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase">Trailer</p>
                        <a
                          href={item.trailerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline-offset-2 hover:underline truncate block"
                        >
                          {item.trailerUrl}
                        </a>
                      </div>
                    )}
                    {item.juryNote && (
                      <div className="col-span-2">
                        <p className="text-[10px] text-muted-foreground uppercase">Jury Note</p>
                        <p className="line-clamp-3">{item.juryNote}</p>
                      </div>
                    )}
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

      {items?.length === 0 && !showAdd && (
        <p className="text-sm text-muted-foreground text-center py-10">
          No films in this batch. Click &quot;Add film&quot; to create one.
        </p>
      )}

      {items !== undefined && items.length > 0 && filtered?.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">
          No films match &quot;{search}&quot;.
        </p>
      )}
    </div>
  );
}
