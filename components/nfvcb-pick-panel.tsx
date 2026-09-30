"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import imageCompression from "browser-image-compression";
import { Award, Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NOTE_MAX = 600;

type Film = { _id: Id<"approvedMovieItems">; title: string; rating: string };

/**
 * Chooses this batch's NFVCB Pick: one film, its poster, and a short note.
 * The homepage shows the published pick from the most recent batch.
 */
export function NfvcbPickPanel({
  postId,
  films,
}: {
  postId: Id<"approvedMovies">;
  films: Film[];
}) {
  const pick = useQuery(api.nfvcbPicks.getForPost, { postId });
  const save = useMutation(api.nfvcbPicks.save);
  const remove = useMutation(api.nfvcbPicks.remove);
  const signUpload = useAction(api.cloudinary.signUpload);

  const [itemId, setItemId] = useState<string>("");
  const [note, setNote] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [published, setPublished] = useState(false);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<"compress" | "save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load the stored pick into the form once it arrives (or changes elsewhere).
  useEffect(() => {
    if (pick === undefined) return;
    setItemId(pick?.itemId ?? "");
    setNote(pick?.note ?? "");
    setTrailerUrl(pick?.trailerUrl ?? "");
    setPublished(pick?.published ?? false);
    setPosterFile(null);
    setPosterPreview(null);
  }, [pick]);

  useEffect(() => () => {
    if (posterPreview) URL.revokeObjectURL(posterPreview);
  }, [posterPreview]);

  async function choosePoster(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file.");
    setError(null);
    setBusy("compress");
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: "image/webp",
      });
      setPosterFile(compressed);
      setPosterPreview(URL.createObjectURL(compressed));
    } catch {
      setError("Image compression failed. Please try a different image.");
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!itemId) return setError("Choose a film from this batch.");
    if (published && !posterFile && !pick?.posterUrl) {
      return setError("Upload a poster before publishing the pick.");
    }
    setError(null);
    setBusy("save");
    try {
      const posterPublicId = posterFile
        ? (await uploadToCloudinary(posterFile, await signUpload({ folder: "picks" }))).publicId
        : undefined;
      await save({
        postId,
        itemId: itemId as Id<"approvedMovieItems">,
        posterPublicId,
        note: note || undefined,
        trailerUrl: trailerUrl || undefined,
        published,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save the pick.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    if (!window.confirm("Remove this month's NFVCB Pick and its poster?")) return;
    setBusy("remove");
    try {
      await remove({ postId });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not remove the pick.");
    } finally {
      setBusy(null);
    }
  }

  const poster = posterPreview ?? pick?.posterUrl ?? null;

  return (
    <Card className="border-nfvcb-gold/40">
      <CardContent className="py-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold flex items-center gap-2">
              <Award className="h-4 w-4 text-nfvcb-gold" /> NFVCB Pick
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              One recommended film from this batch, shown on the homepage with its poster.
              The most recent published pick is the one displayed.
            </p>
          </div>
          {pick && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                pick.published
                  ? "bg-nfvcb-green/10 text-nfvcb-green"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {pick.published ? "Published" : "Draft"}
            </span>
          )}
        </div>

        {pick === undefined ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-[9rem_1fr]">
            {/* Poster */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy !== null}
                className="relative grid aspect-[2/3] w-full place-items-center overflow-hidden rounded-md border border-dashed border-input bg-muted/40 text-muted-foreground hover:border-nfvcb-gold"
              >
                {busy === "compress" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster} alt="Poster preview" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-[11px]">
                    <ImagePlus className="h-5 w-5" /> Upload poster
                  </span>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => choosePoster(e.target.files?.[0])}
              />
              <p className="text-[10px] leading-snug text-muted-foreground">
                Portrait, 2:3. Only use a poster the producer has cleared for use.
              </p>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Film<span className="text-destructive"> *</span>
                </label>
                <Select value={itemId || undefined} onValueChange={setItemId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a film from this batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {films.map((f) => (
                      <SelectItem key={f._id} value={f._id}>
                        {f.title} ({f.rating})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label htmlFor="pick-note" className="text-[11px] font-medium text-muted-foreground">
                  Why the Board recommends it
                </label>
                <textarea
                  id="pick-note"
                  rows={3}
                  maxLength={NOTE_MAX}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
                />
                <p className="text-right text-[10px] text-muted-foreground">
                  {note.length}/{NOTE_MAX}
                </p>
              </div>

              <div className="space-y-1">
                <label htmlFor="pick-trailer" className="text-[11px] font-medium text-muted-foreground">
                  Trailer URL (optional — defaults to the film&apos;s own)
                </label>
                <Input
                  id="pick-trailer"
                  value={trailerUrl}
                  onChange={(e) => setTrailerUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-nfvcb-green"
                />
                <span className="text-[11px] font-medium text-muted-foreground">
                  Publish on the homepage
                </span>
              </label>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={busy !== null}
                  className="bg-nfvcb-green hover:bg-nfvcb-green/90"
                >
                  {busy === "save" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Check className="h-3.5 w-3.5 mr-1" />
                  )}
                  {saved ? "Saved" : pick ? "Save changes" : "Save pick"}
                </Button>
                {pick && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRemove}
                    disabled={busy !== null}
                    className="text-destructive hover:text-destructive"
                  >
                    {busy === "remove" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                    )}
                    Remove pick
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
