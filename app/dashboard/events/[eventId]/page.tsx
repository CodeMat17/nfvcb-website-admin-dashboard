"use client";

import { use, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EventForm } from "@/components/events/event-form";
import { GuestsPanel } from "@/components/events/guests-panel";
import { ProgrammePanel } from "@/components/events/programme-panel";
import { UpdatesPanel } from "@/components/events/updates-panel";
import { errorMessage } from "@/components/events/shared";
import { cn } from "@/lib/utils";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nfvcb.gov.ng";

const TABS = ["Details", "Guests", "Programme", "Live updates"] as const;
type Tab = (typeof TABS)[number];

export default function EventEditorPage({
  params,
}: {
  params: Promise<{ eventId: Id<"events"> }>;
}) {
  const { eventId } = use(params);
  const data = useQuery(api.events.adminGet, { id: eventId });
  const removeEvent = useMutation(api.events.remove);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Details");
  const [deleting, setDeleting] = useState(false);

  if (data === undefined) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-4">
        <p>Event not found.</p>
        <Link href="/dashboard/events" className="text-sm underline">
          Back to events
        </Link>
      </div>
    );
  }

  const { event, people, sessions, updates } = data;
  const counts: Record<Tab, number | null> = {
    Details: null,
    Guests: people.length,
    Programme: sessions.length,
    "Live updates": updates.length,
  };

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete "${event.title}" with all its guests, programme and updates? This cannot be undone.`
      )
    )
      return;
    setDeleting(true);
    try {
      await removeEvent({ id: event._id });
      router.replace("/dashboard/events");
    } catch (err) {
      window.alert(errorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/events">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{event.title}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {event.published ? "Published" : "Draft — not visible on the website"} · /events/{event.slug}
            </p>
          </div>
        </div>
        {event.published && (
          <a href={`${SITE_URL}/events/${event.slug}`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              View page <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </a>
        )}
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              tab === t
                ? "border-nfvcb-green text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
            {counts[t] !== null && (
              <span className="ml-1.5 text-xs text-muted-foreground">{counts[t]}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "Details" && (
        <>
          <Card>
            <CardContent className="py-5">
              <EventForm key={event._id} event={event} />
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              Delete event
            </Button>
          </div>
        </>
      )}
      {tab === "Guests" && <GuestsPanel eventId={event._id} people={people} />}
      {tab === "Programme" && <ProgrammePanel event={event} sessions={sessions} />}
      {tab === "Live updates" && <UpdatesPanel eventId={event._id} updates={updates} />}
    </div>
  );
}
