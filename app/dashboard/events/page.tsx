"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, ChevronRight, Loader2, MapPin, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventForm } from "@/components/events/event-form";
import { formatDay } from "@/components/events/shared";

export default function EventsPage() {
  const events = useQuery(api.events.adminList);
  const router = useRouter();
  const [creating, setCreating] = useState(false);

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
            <h1 className="text-2xl font-bold">Events</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Event pages with guests, programme and live updates.
            </p>
          </div>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)} className="bg-nfvcb-green hover:bg-nfvcb-green/90 shrink-0">
            <Plus className="h-4 w-4 mr-1.5" /> New event
          </Button>
        )}
      </div>

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New event</CardTitle>
          </CardHeader>
          <CardContent>
            <EventForm
              onSaved={(id) => router.push(`/dashboard/events/${id}`)}
              onCancel={() => setCreating(false)}
            />
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {events === undefined && (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {events?.length === 0 && !creating && (
          <p className="text-sm text-muted-foreground text-center py-10">
            No events yet. Click &quot;New event&quot; to create one.
          </p>
        )}
        {events?.map((e) => (
          <Link key={e._id} href={`/dashboard/events/${e._id}`} className="block">
            <Card className="hover:border-nfvcb-green transition-colors">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{e.title}</p>
                    <span
                      className={
                        "text-[10px] font-medium px-1.5 py-0.5 rounded " +
                        (e.published ? "text-nfvcb-green bg-nfvcb-green/10" : "text-muted-foreground bg-muted")
                      }
                    >
                      {e.published ? "Published" : "Draft"}
                    </span>
                    {e.featured && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-amber-700 bg-amber-500/10">
                        On homepage
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDay(e.startDate)}
                      {e.endDate !== e.startDate && ` – ${formatDay(e.endDate)}`}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {e.venue}
                    </span>
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
