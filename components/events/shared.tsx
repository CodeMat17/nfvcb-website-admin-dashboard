"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import imageCompression from "browser-image-compression";
import Image from "next/image";
import { Check, ImagePlus, Loader2, XCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const EVENT_ROLES = [
  "Special Guest",
  "Keynote Speaker",
  "Speaker",
  "Panelist",
  "Moderator",
  "Host",
] as const;

export type ImageRef = { publicId: string; width?: number; height?: number };

export const textareaClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

export function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Notice({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) {
    return (
      <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
    );
  }
  if (success) {
    return (
      <p className="text-sm text-nfvcb-green bg-nfvcb-green/10 px-3 py-2 rounded-md flex items-center gap-1.5">
        <Check className="h-4 w-4" /> {success}
      </p>
    );
  }
  return null;
}

export function errorMessage(err: unknown, fallback = "Something went wrong.") {
  if (!(err instanceof Error)) return fallback;
  // Convex wraps server errors as "[CONVEX M(...)] ... Uncaught Error: <msg>".
  const match = err.message.match(/Uncaught Error: (.+?)(\n|$)/);
  return match ? match[1] : err.message;
}

/** Formats YYYY-MM-DD as e.g. "Wed, 18 Nov 2026". */
export function formatDay(day: string) {
  const d = new Date(`${day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Every YYYY-MM-DD from start to end inclusive (max 31). */
export function daysBetween(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (d <= last && out.length < 31) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * One compressible image with a preview. Posters carry text, so they are kept
 * larger than profile photos.
 */
export function useImagePicker({
  maxSide,
  maxKB,
  initialUrl,
}: {
  maxSide: number;
  maxKB: number;
  initialUrl?: string | null;
}) {
  const signUpload = useAction(api.cloudinary.signUpload);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Free the object URL of a picked file when it is replaced or unmounted.
  useEffect(() => {
    if (!file || !preview?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(preview);
  }, [file, preview]);

  const pick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files?.[0];
      if (inputRef.current) inputRef.current.value = "";
      if (!picked) return;
      if (!picked.type.startsWith("image/")) {
        setError("Please select an image file.");
        return;
      }
      setError(null);
      setBusy(true);
      try {
        const compressed = await imageCompression(picked, {
          maxSizeMB: maxKB / 1024,
          maxWidthOrHeight: maxSide,
          useWebWorker: true,
          fileType: "image/webp",
          initialQuality: 0.85,
        });
        setFile(compressed);
        setPreview(URL.createObjectURL(compressed));
        setRemoved(false);
      } catch {
        setError("Image compression failed. Please try a different image.");
      } finally {
        setBusy(false);
      }
    },
    [maxKB, maxSide]
  );

  const reset = useCallback((url?: string | null) => {
    setFile(null);
    setPreview(url ?? null);
    setRemoved(false);
    setError(null);
  }, []);

  const clear = useCallback(() => {
    setFile(null);
    setPreview(null);
    setRemoved(true);
  }, []);

  /** Uploads the picked file, if any; the preview then shows the hosted copy. */
  const upload = useCallback(async (): Promise<ImageRef | undefined> => {
    if (!file) return undefined;
    const signed = await signUpload({ folder: "events" });
    const res = await uploadToCloudinary(file, signed);
    setFile(null);
    setPreview(res.url);
    return { publicId: res.publicId, width: res.width, height: res.height };
  }, [file, signUpload]);

  return { file, preview, removed, busy, error, inputRef, pick, reset, clear, upload };
}

export function ImagePickerField({
  picker,
  label,
  hint,
  aspect = "portrait",
}: {
  picker: ReturnType<typeof useImagePicker>;
  label: string;
  hint?: string;
  aspect?: "portrait" | "landscape";
}) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">
        {label} <span className="text-muted-foreground font-normal">(optional)</span>
      </span>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {picker.preview && (
        <div
          className={cn(
            "relative rounded-lg overflow-hidden border bg-muted",
            aspect === "portrait" ? "w-40 aspect-[4/5]" : "w-full max-w-md aspect-video"
          )}
        >
          <Image src={picker.preview} alt="Preview" fill unoptimized className="object-contain" />
          <button
            type="button"
            onClick={picker.clear}
            className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 hover:bg-destructive hover:text-white transition-colors"
            title="Remove image"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={picker.inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={picker.pick}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={picker.busy}
          onClick={() => picker.inputRef.current?.click()}
        >
          {picker.busy ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Compressing…
            </>
          ) : (
            <>
              <ImagePlus className="h-4 w-4 mr-1.5" />
              {picker.preview ? "Change image" : "Select image"}
            </>
          )}
        </Button>
        {picker.file && (
          <span className="text-xs text-muted-foreground">
            {(picker.file.size / 1024).toFixed(0)} KB
          </span>
        )}
      </div>
      {picker.error && <p className="text-xs text-destructive">{picker.error}</p>}
    </div>
  );
}
