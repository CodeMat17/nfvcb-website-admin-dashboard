"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  ImagePickerField,
  Notice,
  errorMessage,
  textareaClass,
  useImagePicker,
} from "./shared";

type Form = {
  title: string;
  fullName: string;
  edition: string;
  theme: string;
  description: string;
  startDate: string;
  endDate: string;
  venue: string;
  address: string;
  registrationUrl: string;
  videoUrl: string;
  published: boolean;
  featured: boolean;
};

const EMPTY: Form = {
  title: "",
  fullName: "",
  edition: "",
  theme: "",
  description: "",
  startDate: "",
  endDate: "",
  venue: "",
  address: "",
  registrationUrl: "",
  videoUrl: "",
  published: false,
  featured: true,
};

function fromDoc(e: Doc<"events">): Form {
  return {
    title: e.title,
    fullName: e.fullName ?? "",
    edition: e.edition ?? "",
    theme: e.theme ?? "",
    description: e.description ?? "",
    startDate: e.startDate,
    endDate: e.endDate,
    venue: e.venue,
    address: e.address ?? "",
    registrationUrl: e.registrationUrl ?? "",
    videoUrl: e.videoUrl ?? "",
    published: e.published,
    featured: e.featured,
  };
}

export function EventForm({
  event,
  onSaved,
  onCancel,
}: {
  event?: Doc<"events">;
  onSaved?: (id: Id<"events">) => void;
  onCancel?: () => void;
}) {
  const create = useMutation(api.events.create);
  const update = useMutation(api.events.update);
  const [form, setForm] = useState<Form>(event ? fromDoc(event) : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const banner = useImagePicker({ maxSide: 1800, maxKB: 450, initialUrl: event?.bannerUrl });

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.title.trim() || !form.venue.trim() || !form.startDate || !form.endDate) {
      setError("Title, dates and venue are required.");
      return;
    }
    setSaving(true);
    try {
      const uploaded = await banner.upload();
      const payload = { ...form, banner: uploaded };
      if (event) {
        await update({ id: event._id, ...payload, removeBanner: banner.removed });
        setSuccess("Event saved.");
        onSaved?.(event._id);
      } else {
        const id = await create(payload);
        onSaved?.(id);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const checkbox = "h-4 w-4 accent-[var(--color-nfvcb-green,#15803d)]";

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Title" required hint="Short name, e.g. PAO-NDCRC 2026. Sets the page address.">
          <Input value={form.title} maxLength={150} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Edition" hint="e.g. 6th Edition">
          <Input value={form.edition} maxLength={60} onChange={(e) => set("edition", e.target.value)} />
        </Field>
      </div>

      <Field label="Full name" hint="What the title stands for, shown under it.">
        <Input
          value={form.fullName}
          maxLength={250}
          placeholder="e.g. Peace Anyiam-Osigwe …"
          onChange={(e) => set("fullName", e.target.value)}
        />
      </Field>

      <Field label="Theme">
        <Input value={form.theme} maxLength={300} onChange={(e) => set("theme", e.target.value)} />
      </Field>

      <Field label="About the event" hint="Leave a blank line between paragraphs.">
        <textarea
          rows={6}
          className={textareaClass}
          value={form.description}
          maxLength={6000}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Start date" required>
          <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </Field>
        <Field label="End date" required>
          <Input
            type="date"
            value={form.endDate}
            min={form.startDate || undefined}
            onChange={(e) => set("endDate", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Venue" required>
          <Input
            value={form.venue}
            maxLength={200}
            placeholder="e.g. Shell Hall, MUSON Centre"
            onChange={(e) => set("venue", e.target.value)}
          />
        </Field>
        <Field label="Address / city">
          <Input
            value={form.address}
            maxLength={300}
            placeholder="e.g. Onikan, Lagos"
            onChange={(e) => set("address", e.target.value)}
          />
        </Field>
      </div>

      <Field
        label="Registration link"
        hint="The Register button is hidden automatically once the event has ended."
      >
        <Input
          type="url"
          value={form.registrationUrl}
          maxLength={600}
          placeholder="https://"
          onChange={(e) => set("registrationUrl", e.target.value)}
        />
      </Field>

      <Field
        label="YouTube video link"
        hint="Optional. Plays in the homepage event banner. Paste the link from YouTube's Share button."
      >
        <Input
          type="url"
          value={form.videoUrl}
          maxLength={600}
          placeholder="https://youtu.be/…"
          onChange={(e) => set("videoUrl", e.target.value)}
        />
      </Field>

      <ImagePickerField
        picker={banner}
        label="Event flyer / banner"
        aspect="landscape"
        hint="Shown at the top of the event page and when the link is shared. Any shape; nothing is cropped."
      />

      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className={checkbox + " mt-0.5"}
            checked={form.published}
            onChange={(e) => set("published", e.target.checked)}
          />
          <span>
            <span className="font-medium">Published</span>
            <span className="block text-xs text-muted-foreground">
              Visible on the website at /events. Leave off while you prepare it.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className={checkbox + " mt-0.5"}
            checked={form.featured}
            onChange={(e) => set("featured", e.target.checked)}
          />
          <span>
            <span className="font-medium">Promote on the homepage</span>
            <span className="block text-xs text-muted-foreground">
              Shows a banner on the homepage until the event ends.
            </span>
          </span>
        </label>
      </div>

      <Notice error={error ?? banner.error} success={success} />

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={saving || banner.busy}
          className="bg-nfvcb-green hover:bg-nfvcb-green/90"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : event ? "Save changes" : "Create event"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
