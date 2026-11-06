"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Clock, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Notice, daysBetween, errorMessage, formatDay, textareaClass } from "./shared";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type Form = {
  day: string;
  startTime: string;
  endTime: string;
  title: string;
  description: string;
  speakers: string;
};

export function ProgrammePanel({
  event,
  sessions,
}: {
  event: Doc<"events">;
  sessions: Doc<"eventSessions">[];
}) {
  const save = useMutation(api.events.saveSession);
  const remove = useMutation(api.events.removeSession);
  const days = daysBetween(event.startDate, event.endDate);
  const empty: Form = { day: days[0] ?? "", startTime: "", endTime: "", title: "", description: "", speakers: "" };

  const [form, setForm] = useState<Form | null>(null);
  const [editingId, setEditingId] = useState<Doc<"eventSessions">["_id"] | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const set = <K extends keyof Form>(k: K, val: string) => setForm((f) => (f ? { ...f, [k]: val } : f));

  function startEdit(s: Doc<"eventSessions">) {
    setEditingId(s._id);
    setForm({
      day: s.day,
      startTime: s.startTime,
      endTime: s.endTime ?? "",
      title: s.title,
      description: s.description ?? "",
      speakers: s.speakers ?? "",
    });
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setSuccess(null);
    if (!form.title.trim() || !form.startTime) {
      setError("Title and start time are required.");
      return;
    }
    setSaving(true);
    try {
      await save({
        eventId: event._id,
        id: editingId ?? undefined,
        day: form.day,
        startTime: form.startTime,
        endTime: form.endTime || undefined,
        title: form.title,
        description: form.description,
        speakers: form.speakers,
      });
      setSuccess(editingId ? "Session updated." : "Session added.");
      // Keep the day and roll the start time on, for quick entry of a full day.
      setForm(editingId ? null : { ...empty, day: form.day, startTime: form.endTime });
      setEditingId(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">The programme, shown day by day on the event page.</p>
        {!form && (
          <Button
            onClick={() => {
              setEditingId(null);
              setForm(empty);
              setError(null);
              setSuccess(null);
            }}
            className="bg-nfvcb-green hover:bg-nfvcb-green/90 shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add session
          </Button>
        )}
      </div>

      {!form && <Notice error={error} success={success} />}

      {form && (
        <Card>
          <CardContent className="py-5">
            <form onSubmit={submit} className="space-y-4" noValidate>
              <p className="font-semibold">{editingId ? "Edit session" : "Add session"}</p>
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="Day" required>
                  <select className={selectClass} value={form.day} onChange={(e) => set("day", e.target.value)}>
                    {days.map((d, i) => (
                      <option key={d} value={d}>
                        Day {i + 1} — {formatDay(d)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Start time" required>
                  <Input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
                </Field>
                <Field label="End time">
                  <Input type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
                </Field>
              </div>
              <Field label="Session title" required hint="e.g. Opening Ceremony, Panel: Regulating Streaming">
                <Input value={form.title} maxLength={250} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Field label="Speakers / panel" hint="Free text, e.g. Moderator: … · Panelists: …, …">
                <Input value={form.speakers} maxLength={600} onChange={(e) => set("speakers", e.target.value)} />
              </Field>
              <Field label="Description">
                <textarea
                  rows={3}
                  className={textareaClass}
                  value={form.description}
                  maxLength={1500}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
              <Notice error={error} success={success} />
              <div className="flex gap-2">
                <Button type="submit" disabled={saving} className="bg-nfvcb-green hover:bg-nfvcb-green/90">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Save changes" : "Add"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setForm(null); setEditingId(null); }}>
                  Close
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {sessions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">No sessions yet.</p>
      )}

      {days.map((d, i) => {
        const items = sessions.filter((s) => s.day === d);
        if (items.length === 0) return null;
        return (
          <div key={d} className="space-y-2">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Day {i + 1} · {formatDay(d)}
            </h3>
            {items.map((s) => (
              <Card key={s._id} className={editingId === s._id ? "border-nfvcb-green" : ""}>
                <CardContent className="flex items-start gap-4 py-3">
                  <span className="text-xs font-semibold tabular-nums text-nfvcb-green flex items-center gap-1 w-24 shrink-0 pt-0.5">
                    <Clock className="h-3.5 w-3.5" />
                    {s.startTime}
                    {s.endTime && `–${s.endTime}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{s.title}</p>
                    {s.speakers && <p className="text-xs text-muted-foreground mt-0.5">{s.speakers}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(s)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      disabled={busyId === s._id}
                      title="Remove"
                      onClick={async () => {
                        if (!window.confirm(`Remove "${s.title}"?`)) return;
                        setBusyId(s._id);
                        try {
                          await remove({ id: s._id });
                        } catch (err) {
                          setError(errorMessage(err));
                        } finally {
                          setBusyId(null);
                        }
                      }}
                    >
                      {busyId === s._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })}
    </div>
  );
}
