"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import Image from "next/image";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  EVENT_ROLES,
  Field,
  ImagePickerField,
  Notice,
  errorMessage,
  useImagePicker,
} from "./shared";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function GuestsPanel({
  eventId,
  people,
}: {
  eventId: Id<"events">;
  people: Doc<"eventPeople">[];
}) {
  const save = useMutation(api.events.savePerson);
  const move = useMutation(api.events.movePerson);
  const remove = useMutation(api.events.removePerson);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Doc<"eventPeople"> | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>(EVENT_ROLES[2]);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const poster = useImagePicker({ maxSide: 1400, maxKB: 400 });

  function startAdd() {
    setEditing(null);
    setName("");
    setTitle("");
    poster.reset(null);
    setError(null);
    setSuccess(null);
    setOpen(true);
  }

  function startEdit(p: Doc<"eventPeople">) {
    setEditing(p);
    setName(p.name);
    setRole(p.role);
    setTitle(p.title ?? "");
    poster.reset(p.posterUrl);
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
      const uploaded = await poster.upload();
      await save({
        eventId,
        id: editing?._id,
        name,
        role,
        title,
        poster: uploaded,
      });
      setSuccess(editing ? `${name.trim()} updated.` : `${name.trim()} added.`);
      if (addAnother) {
        // Keep the role: posters usually arrive in batches per category.
        setEditing(null);
        setName("");
        setTitle("");
        poster.reset(null);
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

  const groups = EVENT_ROLES.map((r) => ({
    role: r,
    items: people.filter((p) => p.role === r),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Special guests, speakers and panelists, each with their poster. Grouped by role on the
          website in the order below.
        </p>
        {!open && (
          <Button onClick={startAdd} className="bg-nfvcb-green hover:bg-nfvcb-green/90 shrink-0">
            <Plus className="h-4 w-4 mr-1.5" /> Add guest
          </Button>
        )}
      </div>

      {!open && <Notice error={error} success={success} />}

      {open && (
        <Card>
          <CardContent className="py-5">
            <form onSubmit={(e) => submit(e, false)} className="space-y-4" noValidate>
              <p className="font-semibold">{editing ? `Edit ${editing.name}` : "Add guest"}</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Name" required>
                  <Input value={name} maxLength={150} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Role" required>
                  <select className={selectClass} value={role} onChange={(e) => setRole(e.target.value)}>
                    {EVENT_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Designation / organisation" hint="e.g. Honourable Minister, Federal Ministry of …">
                <Input value={title} maxLength={250} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <ImagePickerField
                picker={poster}
                label="Poster"
                hint="Upload the poster as designed; it is shown whole, not cropped."
              />
              <Notice error={error ?? poster.error} success={success} />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={saving || poster.busy}
                  className="bg-nfvcb-green hover:bg-nfvcb-green/90"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Add"}
                </Button>
                {!editing && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving || poster.busy}
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
        <p className="text-sm text-muted-foreground text-center py-10">No guests yet.</p>
      )}

      {groups.map((g) => (
        <div key={g.role} className="space-y-2">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            {g.role} ({g.items.length})
          </h3>
          {g.items.map((p, i) => (
            <Card key={p._id} className={editing?._id === p._id && open ? "border-nfvcb-green" : ""}>
              <CardContent className="flex items-center gap-4 py-3">
                {p.posterUrl ? (
                  <Image
                    src={p.posterUrl}
                    alt={p.name}
                    width={48}
                    height={60}
                    unoptimized
                    className="w-12 h-15 rounded object-cover border shrink-0"
                  />
                ) : (
                  <div className="w-12 h-15 rounded bg-muted grid place-items-center border shrink-0">
                    <UserRound className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{p.name}</p>
                  {p.title && <p className="text-xs text-muted-foreground mt-0.5">{p.title}</p>}
                  {!p.posterUrl && <p className="text-xs text-amber-600 mt-0.5">No poster yet</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={i === 0 || busyId === p._id}
                    onClick={() => act(p._id, () => move({ id: p._id, direction: "up" }))}
                    title="Move up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={i === g.items.length - 1 || busyId === p._id}
                    onClick={() => act(p._id, () => move({ id: p._id, direction: "down" }))}
                    title="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(p)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    disabled={busyId === p._id}
                    onClick={() => {
                      if (window.confirm(`Remove ${p.name}?`)) act(p._id, () => remove({ id: p._id }));
                    }}
                    title="Remove"
                  >
                    {busyId === p._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
