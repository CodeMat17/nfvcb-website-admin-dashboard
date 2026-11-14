"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import Image from "next/image";
import { ArrowDown, ArrowUp, Building2, ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  ImagePickerField,
  Notice,
  SPONSOR_KINDS,
  errorMessage,
  useImagePicker,
} from "./shared";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const PLURAL: Record<string, string> = { Sponsor: "Sponsors", Partner: "Partners" };

export function SponsorsPanel({
  eventId,
  sponsors,
}: {
  eventId: Id<"events">;
  sponsors: Doc<"eventSponsors">[];
}) {
  const save = useMutation(api.events.saveSponsor);
  const move = useMutation(api.events.moveSponsor);
  const remove = useMutation(api.events.removeSponsor);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Doc<"eventSponsors"> | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>(SPONSOR_KINDS[0]);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const logo = useImagePicker({ maxSide: 1200, maxKB: 300 });

  function startAdd() {
    setEditing(null);
    setName("");
    setWebsiteUrl("");
    logo.reset(null);
    setError(null);
    setSuccess(null);
    setOpen(true);
  }

  function startEdit(s: Doc<"eventSponsors">) {
    setEditing(s);
    setName(s.name);
    setKind(s.kind);
    setWebsiteUrl(s.websiteUrl ?? "");
    logo.reset(s.logoUrl);
    setError(null);
    setSuccess(null);
    setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e: React.FormEvent, addAnother: boolean) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      const uploaded = await logo.upload();
      await save({
        eventId,
        id: editing?._id,
        name,
        kind,
        websiteUrl,
        logo: uploaded,
        removeLogo: !uploaded && logo.removed ? true : undefined,
      });
      setSuccess(editing ? `${name.trim()} updated.` : `${name.trim()} added.`);
      if (addAnother) {
        // Keep the type: logos usually arrive in batches.
        setEditing(null);
        setName("");
        setWebsiteUrl("");
        logo.reset(null);
      } else {
        setOpen(false);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const groups = SPONSOR_KINDS.map((k) => ({
    kind: k,
    items: sponsors.filter((s) => s.kind === k),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Sponsors and partners, each with their logo or photo. Grouped by type on the website in
          the order below.
        </p>
        {!open && (
          <Button onClick={startAdd} className="bg-nfvcb-green hover:bg-nfvcb-green/90 shrink-0">
            <Plus className="h-4 w-4 mr-1.5" /> Add sponsor / partner
          </Button>
        )}
      </div>

      {!open && <Notice error={error} success={success} />}

      {open && (
        <Card>
          <CardContent className="py-5">
            <form onSubmit={(e) => submit(e, false)} className="space-y-4" noValidate>
              <p className="font-semibold">
                {editing ? `Edit ${editing.name}` : "Add sponsor / partner"}
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Name" required>
                  <Input value={name} maxLength={150} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Type" required>
                  <select className={selectClass} value={kind} onChange={(e) => setKind(e.target.value)}>
                    {SPONSOR_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Website" hint="Optional. The logo links here on the website.">
                <Input
                  type="url"
                  value={websiteUrl}
                  maxLength={600}
                  placeholder="https://"
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
              </Field>
              <ImagePickerField
                picker={logo}
                label="Logo / photo"
                aspect="landscape"
                hint="PNG with a transparent background works best for logos; it is shown whole, not cropped."
              />
              <Notice error={error ?? logo.error} success={success} />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={saving || logo.busy}
                  className="bg-nfvcb-green hover:bg-nfvcb-green/90"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Add"}
                </Button>
                {!editing && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving || logo.busy}
                    onClick={(e) => submit(e, true)}
                  >
                    Add &amp; add another
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">
          No sponsors or partners yet.
        </p>
      )}

      {groups.map((g) => (
        <div key={g.kind} className="space-y-2">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            {PLURAL[g.kind] ?? g.kind} ({g.items.length})
          </h3>
          {g.items.map((s, i) => (
            <Card key={s._id} className={editing?._id === s._id && open ? "border-nfvcb-green" : ""}>
              <CardContent className="flex items-center gap-4 py-3">
                {s.logoUrl ? (
                  <div className="relative w-20 h-12 rounded border bg-white shrink-0">
                    <Image src={s.logoUrl} alt={s.name} fill unoptimized className="object-contain p-1" />
                  </div>
                ) : (
                  <div className="w-20 h-12 rounded bg-muted grid place-items-center border shrink-0">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{s.name}</p>
                  {s.websiteUrl && (
                    <a
                      href={s.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1 mt-0.5 max-w-full"
                    >
                      <span className="truncate">{s.websiteUrl}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  )}
                  {!s.logoUrl && <p className="text-xs text-amber-600 mt-0.5">No logo yet</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={i === 0 || busyId === s._id}
                    onClick={() => act(s._id, () => move({ id: s._id, direction: "up" }))}
                    title="Move up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={i === g.items.length - 1 || busyId === s._id}
                    onClick={() => act(s._id, () => move({ id: s._id, direction: "down" }))}
                    title="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(s)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    disabled={busyId === s._id}
                    onClick={() => {
                      if (window.confirm(`Remove ${s.name}?`)) act(s._id, () => remove({ id: s._id }));
                    }}
                    title="Remove"
                  >
                    {busyId === s._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}
