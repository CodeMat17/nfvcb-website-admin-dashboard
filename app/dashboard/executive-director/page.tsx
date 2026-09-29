"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import imageCompression from "browser-image-compression";

const MAX_IMAGE_KB = 100;

const textareaClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

type Entry = { title: string; org: string; note?: string };
type Row = Record<string, string | undefined>;

type FormState = {
  name: string;
  shortName: string;
  role: string;
  office: string;
  postNominals: string;
  email: string;
  headOffice: string;
  vision: string;
  foreword: string;
  // Edited as plain text: one item per line (bio: one paragraph per blank-line block).
  highlights: string;
  expertise: string;
  bio: string;
  appointment: { label: string; value: string }[];
  achievements: { title: string; body: string }[];
  education: Entry[];
  career: Entry[];
  industryRoles: Entry[];
  programmes: Entry[];
  awards: Entry[];
  publications: Entry[];
  quotes: { text: string; context: string }[];
};

const EMPTY_FORM: FormState = {
  name: "",
  shortName: "",
  role: "",
  office: "",
  postNominals: "",
  email: "",
  headOffice: "",
  vision: "",
  foreword: "",
  highlights: "",
  expertise: "",
  bio: "",
  appointment: [],
  achievements: [],
  education: [],
  career: [],
  industryRoles: [],
  programmes: [],
  awards: [],
  publications: [],
  quotes: [],
};

const ENTRY_COLUMNS = [
  { key: "title", label: "Title" },
  { key: "org", label: "Organisation" },
  { key: "note", label: "Note / dates", optional: true },
];

const ENTRY_SECTIONS = [
  ["career", "Career"],
  ["industryRoles", "Film industry leadership"],
  ["education", "Education"],
  ["programmes", "International leadership programmes"],
  ["awards", "Awards & honours"],
  ["publications", "Publications"],
] as const;

function lines(value: string): string[] {
  return value.split("\n").map((s) => s.trim()).filter(Boolean);
}

function paragraphs(value: string): string[] {
  return value.split(/\n\s*\n/).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function RowsEditor<T extends Row>({
  rows,
  columns,
  onChange,
  addLabel,
}: {
  rows: T[];
  columns: { key: string; label: string; optional?: boolean; multiline?: boolean }[];
  onChange: (rows: T[]) => void;
  addLabel: string;
}) {
  function setCell(i: number, key: string, value: string) {
    onChange(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  }
  function move(i: number, dir: -1 | 1) {
    const next = [...rows];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange(next);
  }
  function add() {
    onChange([...rows, Object.fromEntries(columns.map((c) => [c.key, ""])) as T]);
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-start rounded-lg border p-2">
          <div className="flex-1 grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
            {columns.map((c) =>
              c.multiline ? (
                <textarea
                  key={c.key}
                  rows={2}
                  className={textareaClass}
                  value={row[c.key] ?? ""}
                  placeholder={c.label + (c.optional ? " (optional)" : "")}
                  onChange={(e) => setCell(i, c.key, e.target.value)}
                />
              ) : (
                <Input
                  key={c.key}
                  value={row[c.key] ?? ""}
                  placeholder={c.label + (c.optional ? " (optional)" : "")}
                  onChange={(e) => setCell(i, c.key, e.target.value)}
                />
              )
            )}
          </div>
          <div className="flex shrink-0">
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={i === rows.length - 1} onClick={() => move(i, 1)} title="Move down">
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              title="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4 mr-1" /> {addLabel}
      </Button>
    </div>
  );
}

export default function ExecutiveDirectorPage() {
  const profile = useQuery(api.executiveDirector.get);
  const saveProfile = useMutation(api.executiveDirector.save);
  const signUpload = useAction(api.cloudinary.signUpload);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageCompressing, setImageCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fill the form once, when the profile first arrives, so live updates don't
  // overwrite in-progress edits.
  useEffect(() => {
    if (loaded || profile === undefined) return;
    if (profile) {
      setForm({
        name: profile.name,
        shortName: profile.shortName,
        role: profile.role,
        office: profile.office,
        postNominals: profile.postNominals,
        email: profile.email,
        headOffice: profile.headOffice,
        vision: profile.vision,
        foreword: profile.foreword,
        highlights: profile.highlights.join("\n"),
        expertise: profile.expertise.join("\n"),
        bio: profile.bio.join("\n\n"),
        appointment: profile.appointment,
        achievements: profile.achievements,
        education: profile.education,
        career: profile.career,
        industryRoles: profile.industryRoles,
        programmes: profile.programmes,
        awards: profile.awards,
        publications: profile.publications,
        quotes: profile.quotes,
      });
      setImagePreview(profile.imageUrl);
    }
    setLoaded(true);
  }, [profile, loaded]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    setError(null);
    setImageCompressing(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: MAX_IMAGE_KB / 1024,
        maxWidthOrHeight: 900,
        useWebWorker: true,
        fileType: "image/webp",
      });
      if (imagePreview && imageFile) URL.revokeObjectURL(imagePreview);
      setImageFile(compressed);
      setImagePreview(URL.createObjectURL(compressed));
    } catch {
      setError("Image compression failed. Please try a different image.");
    } finally {
      setImageCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.shortName.trim() || !form.role.trim()) {
      setError("Name, short name and role are required.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let imagePublicId: string | undefined;
      if (imageFile) {
        imagePublicId = (await uploadToCloudinary(imageFile, await signUpload({ folder: "executive-director" }))).publicId;
      }

      await saveProfile({
        ...form,
        highlights: lines(form.highlights),
        expertise: lines(form.expertise),
        bio: paragraphs(form.bio),
        // Empty optional notes are sent as undefined rather than "".
        ...Object.fromEntries(
          ENTRY_SECTIONS.map(([key]) => [
            key,
            form[key].map((r) => ({ title: r.title, org: r.org, note: r.note?.trim() || undefined })),
          ])
        ),
        imagePublicId,
      } as Parameters<typeof saveProfile>[0]);

      setImageFile(null);
      setSuccess("Profile saved. The public site picks up changes within 5 minutes.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!loaded) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Executive Director</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Profile shown on the Management page and the Executive Director page.
          </p>
        </div>
      </div>

      {success && (
        <p className="text-sm text-nfvcb-green bg-nfvcb-green/10 px-3 py-2 rounded-md flex items-center gap-1.5">
          <Check className="h-4 w-4" /> {success}
        </p>
      )}
      {profile === null && (
        <p className="text-sm bg-muted px-3 py-2 rounded-md">
          No profile exists yet. Fill in the form and save to create it.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full name" required>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Dr. Jane Doe, PhD" />
              </Field>
              <Field label="Short name" required hint="Used in captions and quote attributions.">
                <Input value={form.shortName} onChange={(e) => set("shortName", e.target.value)} placeholder="e.g. Dr. Jane Doe" />
              </Field>
              <Field label="Role" required>
                <Input value={form.role} onChange={(e) => set("role", e.target.value)} placeholder="Executive Director / Director-General" />
              </Field>
              <Field label="Office">
                <Input value={form.office} onChange={(e) => set("office", e.target.value)} />
              </Field>
              <Field label="Post-nominals">
                <Input value={form.postNominals} onChange={(e) => set("postNominals", e.target.value)} placeholder="PhD, MNIPR, …" />
              </Field>
              <Field label="Correspondence email">
                <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
            </div>
            <Field label="Head office address">
              <Input value={form.headOffice} onChange={(e) => set("headOffice", e.target.value)} />
            </Field>
            <Field label="Highlights" hint="One per line. Shown as tags under the name.">
              <textarea rows={3} className={textareaClass} value={form.highlights} onChange={(e) => set("highlights", e.target.value)} />
            </Field>
            <Field label="Appointment details">
              <RowsEditor
                rows={form.appointment}
                columns={[
                  { key: "label", label: "Label (e.g. Appointed)" },
                  { key: "value", label: "Value" },
                ]}
                onChange={(rows) => set("appointment", rows)}
                addLabel="Add detail"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Photo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Portrait orientation works best. Compressed to ≤{MAX_IMAGE_KB} KB and converted to WebP.
            </p>
            {imagePreview ? (
              <div className="relative w-40 aspect-[4/5] rounded-lg overflow-hidden border bg-muted">
                <Image src={imagePreview} alt="Photo preview" fill unoptimized className="object-cover object-top" />
              </div>
            ) : (
              <div className="w-40 aspect-[4/5] rounded-lg border bg-muted flex items-center justify-center">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            <Button type="button" variant="outline" size="sm" disabled={imageCompressing} onClick={() => fileInputRef.current?.click()}>
              {imageCompressing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Compressing…
                </>
              ) : (
                <>
                  <ImagePlus className="h-4 w-4 mr-1.5" /> {imagePreview ? "Change Photo" : "Select Photo"}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Biography</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Biography" hint="Separate paragraphs with a blank line. The first paragraph is also shown on the Management page.">
              <textarea rows={12} className={textareaClass} value={form.bio} onChange={(e) => set("bio", e.target.value)} />
            </Field>
            <Field label="Vision statement" hint="Shown as a pull quote on the profile.">
              <textarea rows={4} className={textareaClass} value={form.vision} onChange={(e) => set("vision", e.target.value)} />
            </Field>
            <Field label="Areas of expertise" hint="One per line.">
              <textarea rows={6} className={textareaClass} value={form.expertise} onChange={(e) => set("expertise", e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Key achievements</CardTitle>
          </CardHeader>
          <CardContent>
            <RowsEditor
              rows={form.achievements}
              columns={[
                { key: "title", label: "Title" },
                { key: "body", label: "Description", multiline: true },
              ]}
              onChange={(rows) => set("achievements", rows)}
              addLabel="Add achievement"
            />
          </CardContent>
        </Card>

        {ENTRY_SECTIONS.map(([key, title]) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <RowsEditor
                rows={form[key]}
                columns={ENTRY_COLUMNS}
                onChange={(rows) => set(key, rows)}
                addLabel="Add entry"
              />
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quotes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RowsEditor
              rows={form.quotes}
              columns={[
                { key: "text", label: "Quote", multiline: true },
                { key: "context", label: "Context (e.g. On assuming office)" },
              ]}
              onChange={(rows) => set("quotes", rows)}
              addLabel="Add quote"
            />
            <Field label="Service Charter foreword">
              <textarea rows={5} className={textareaClass} value={form.foreword} onChange={(e) => set("foreword", e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
        )}

        <div className="sticky bottom-4">
          <Button
            type="submit"
            disabled={loading || imageCompressing}
            className="bg-nfvcb-green hover:bg-nfvcb-green/90 shadow-lg"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Profile"}
          </Button>
        </div>
      </form>
    </div>
  );
}
