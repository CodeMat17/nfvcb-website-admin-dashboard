"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import Image from "next/image";
import { Loader2, Pencil, Send, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Field, ImagePickerField, Notice, errorMessage, textareaClass, useImagePicker } from "./shared";

export function UpdatesPanel({
  eventId,
  updates,
}: {
  eventId: Id<"events">;
  updates: Doc<"eventUpdates">[];
}) {
  const save = useMutation(api.events.saveUpdate);
  const remove = useMutation(api.events.removeUpdate);
  const [editing, setEditing] = useState<Doc<"eventUpdates"> | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const photo = useImagePicker({ maxSide: 1600, maxKB: 350 });

  function clearForm() {
    setEditing(null);
    setTitle("");
    setBody("");
    photo.reset(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!body.trim()) {
      setError("Write something to post.");
      return;
    }
    setSaving(true);
    try {
      const image = await photo.upload();
      await save({
        eventId,
        id: editing?._id,
        title,
        body,
        image,
        removeImage: editing ? photo.removed : undefined,
      });
      setSuccess(editing ? "Update saved." : "Posted. It appears on the event page within about a minute.");
      clearForm();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-5">
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <p className="font-semibold">{editing ? "Edit update" : "Post a live update"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Short announcements, speaker highlights or photos. Newest is shown first.
              </p>
            </div>
            <Field label="Headline">
              <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Text" required>
              <textarea
                rows={4}
                className={textareaClass}
                value={body}
                maxLength={3000}
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>
            <ImagePickerField picker={photo} label="Photo" aspect="landscape" />
            <Notice error={error ?? photo.error} success={success} />
            <div className="flex gap-2">
              <Button type="submit" disabled={saving || photo.busy} className="bg-nfvcb-green hover:bg-nfvcb-green/90">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1.5" /> {editing ? "Save changes" : "Post update"}
                  </>
                )}
              </Button>
              {editing && (
                <Button type="button" variant="ghost" onClick={clearForm}>
                  Cancel edit
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {updates.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">No updates posted yet.</p>
      )}

      {updates.map((u) => (
        <Card key={u._id} className={editing?._id === u._id ? "border-nfvcb-green" : ""}>
          <CardContent className="flex items-start gap-4 py-3">
            {u.imageUrl && (
              <Image
                src={u.imageUrl}
                alt=""
                width={80}
                height={56}
                unoptimized
                className="w-20 h-14 rounded object-cover border shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground">
                {new Date(u.postedAt).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              {u.title && <p className="font-medium text-sm">{u.title}</p>}
              <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-line">{u.body}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                title="Edit"
                onClick={() => {
                  setEditing(u);
                  setTitle(u.title ?? "");
                  setBody(u.body);
                  photo.reset(u.imageUrl);
                  setError(null);
                  setSuccess(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                disabled={busyId === u._id}
                title="Delete"
                onClick={async () => {
                  if (!window.confirm("Delete this update?")) return;
                  setBusyId(u._id);
                  try {
                    await remove({ id: u._id });
                    if (editing?._id === u._id) clearForm();
                  } catch (err) {
                    setError(errorMessage(err));
                  } finally {
                    setBusyId(null);
                  }
                }}
              >
                {busyId === u._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
