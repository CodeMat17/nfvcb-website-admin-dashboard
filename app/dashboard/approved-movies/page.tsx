"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Film,
  Loader2,
  Pencil,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  parseApprovedMoviesWorkbook,
  type ParsedMovie,
} from "@/lib/parseApprovedMoviesExcel";
import { MonthYearPicker } from "@/components/month-year-picker";
import { format } from "date-fns";

type PostDoc = {
  _id: Id<"approvedMovies">;
  title: string;
  slug: string;
  month: string;
  author: string;
  date?: string;
  movieCount: number;
};

function sanitizeText(value: string, maxLen: number): string {
  return value
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, maxLen);
}

export default function ApprovedMoviesDashboardPage() {
  const posts = useQuery(api.approvedMovies.listPosts) as PostDoc[] | undefined;
  const bulkImport = useMutation(api.approvedMovies.bulkImport);
  const updatePost = useMutation(api.approvedMovies.updatePost);
  const removePost = useMutation(api.approvedMovies.removePost);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [monthDate, setMonthDate] = useState<Date | null>(null);
  const [author, setAuthor] = useState("FCC");
  const [parsedMovies, setParsedMovies] = useState<ParsedMovie[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [editingId, setEditingId] = useState<Id<"approvedMovies"> | null>(null);
  const [editMonthDate, setEditMonthDate] = useState<Date | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"approvedMovies"> | null>(null);

  function resetUploadForm() {
    setMonthDate(null);
    setParsedMovies(null);
    setFileName(null);
    setWarnings([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const { movies, warnings: w } = parseApprovedMoviesWorkbook(buffer);
      setParsedMovies(movies);
      setWarnings(w);

      const monthGuess = file.name.match(
        /(January|February|March|April|May|June|July|August|September|October|November|December)\D*(\d{4})/i
      );
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      if (monthGuess && !monthDate) {
        const idx = monthNames.findIndex(
          (m) => m.toLowerCase() === monthGuess[1].toLowerCase()
        );
        if (idx !== -1) setMonthDate(new Date(Number(monthGuess[2]), idx, 1));
      }
    } catch {
      setError("Could not read this file. Please upload a valid .xlsx workbook.");
      setParsedMovies(null);
    } finally {
      setParsing(false);
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanAuthor = sanitizeText(author, 100) || "FCC";

    if (!monthDate) return setError("Month is required.");
    if (!parsedMovies || parsedMovies.length === 0)
      return setError("Please upload an Excel file with at least one movie row.");

    const cleanMonth = format(monthDate, "MMMM yyyy");

    setSubmitting(true);
    try {
      await bulkImport({
        month: cleanMonth,
        author: cleanAuthor,
        date: new Date().toISOString().slice(0, 10),
        movies: parsedMovies,
      });
      setSuccess(`Imported ${parsedMovies.length} movies for ${cleanMonth}.`);
      resetUploadForm();
      setShowUpload(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(post: PostDoc) {
    setEditingId(post._id);
    const parsed = new Date(`1 ${post.month}`);
    setEditMonthDate(isNaN(parsed.getTime()) ? null : parsed);
    setError(null);
    setSuccess(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditMonthDate(null);
  }

  async function saveEdit(id: Id<"approvedMovies">) {
    if (!editMonthDate) return setError("Month is required.");
    try {
      await updatePost({
        id,
        month: format(editMonthDate, "MMMM yyyy"),
      });
      setSuccess("Post updated.");
      cancelEdit();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  async function handleDelete(id: Id<"approvedMovies">) {
    if (!window.confirm("Delete this batch and all its movies? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await removePost({ id });
      setSuccess("Batch deleted.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Approved Movies</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Upload monthly Excel lists, then update or delete batches.
            </p>
          </div>
        </div>
        {!showUpload && (
          <Button
            onClick={() => {
              resetUploadForm();
              setShowUpload(true);
            }}
            className="bg-nfvcb-green hover:bg-nfvcb-green/90 shrink-0"
          >
            <UploadCloud className="h-4 w-4 mr-1.5" /> Upload Excel
          </Button>
        )}
      </div>

      {success && !showUpload && (
        <p className="text-sm text-nfvcb-green bg-nfvcb-green/10 px-3 py-2 rounded-md flex items-center gap-1.5">
          <Check className="h-4 w-4" /> {success}
        </p>
      )}

      {showUpload && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload Approved Movies Excel</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleImport} className="space-y-5" noValidate>
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Excel file (.xlsx) <span className="text-destructive">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFile}
                  className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-nfvcb-green/10 file:text-nfvcb-green file:font-medium"
                />
                {parsing && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading {fileName}…
                  </p>
                )}
                {parsedMovies && !parsing && (
                  <p className="text-xs text-nfvcb-green">
                    Found {parsedMovies.length} movies in {fileName}.
                  </p>
                )}
                {warnings.map((w) => (
                  <p key={w} className="text-xs text-amber-600">{w}</p>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Month <span className="text-destructive">*</span>
                  </label>
                  <MonthYearPicker value={monthDate} onChange={setMonthDate} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Published by</label>
                  <Input
                    value={author}
                    onChange={(e) => setAuthor(e.target.value.slice(0, 100))}
                    placeholder="FCC"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  type="submit"
                  disabled={submitting || parsing || !parsedMovies}
                  className="bg-nfvcb-green hover:bg-nfvcb-green/90"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <UploadCloud className="h-4 w-4 mr-1.5" /> Import Movies
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetUploadForm();
                    setShowUpload(false);
                  }}
                >
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
          All Batches ({posts?.length ?? "…"})
        </h2>

        {posts === undefined && (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          {posts?.map((post) => (
            <Card key={post._id} className={editingId === post._id ? "border-nfvcb-green" : ""}>
              <CardContent className="py-5 space-y-3">
                {editingId === post._id ? (
                  <div className="space-y-2">
                    <MonthYearPicker value={editMonthDate} onChange={setEditMonthDate} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveEdit(post._id)} className="bg-nfvcb-green hover:bg-nfvcb-green/90">
                        <Check className="h-3.5 w-3.5 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-lg bg-nfvcb-green/10 shrink-0">
                          <Film className="h-4 w-4 text-nfvcb-green" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{post.title}</p>
                          <p className="text-xs text-muted-foreground">{post.month}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-[#fea600] bg-[#fea600]/10 px-2 py-1 rounded-full shrink-0">
                        {post.movieCount} films
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">Published by {post.author}</p>

                    <div className="flex items-center justify-between pt-1">
                      <Link
                        href={`/dashboard/approved-movies/${post._id}`}
                        className="text-xs text-primary font-medium underline-offset-2 hover:underline"
                      >
                        View / edit films
                      </Link>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => startEdit(post)}
                          title="Rename batch"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(post._id)}
                          disabled={deletingId === post._id}
                          title="Delete batch"
                        >
                          {deletingId === post._id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {posts?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">
            No batches yet. Click &quot;Upload Excel&quot; to import a monthly list.
          </p>
        )}
      </div>
    </div>
  );
}
