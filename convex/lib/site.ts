import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Cache tags the public site (nfvcb2) understands: one per Convex module it
 * reads. Keep in sync with CONTENT_TAGS in nfvcb2/lib/revalidation.ts.
 */
export type SiteTag =
  | "news"
  | "approvedMovies"
  | "nfvcbPicks"
  | "events"
  | "managementStaff"
  | "leadership"
  | "executiveDirector";

/**
 * Tells the public site to rebuild pages that show these tags. Scheduling is
 * part of the mutation's transaction: it only fires if the write commits, and
 * runs after it, so the site reads the new data.
 */
export async function notifySite(ctx: MutationCtx, ...tags: SiteTag[]) {
  await ctx.scheduler.runAfter(0, internal.site.revalidate, { tags });
}

/** Same as `notifySite`, but at a future moment (ignored if it has passed). */
export async function notifySiteAt(ctx: MutationCtx, when: number, ...tags: SiteTag[]) {
  if (when <= Date.now()) return;
  await ctx.scheduler.runAt(when, internal.site.revalidate, { tags });
}

/** Midnight Lagos time (UTC+1, no DST) at the start of a YYYY-MM-DD day. */
function lagosDayStart(day: string): number {
  return Date.parse(`${day}T00:00:00+01:00`);
}

/**
 * Event pages and the homepage banner change on dates, not just on edits:
 * "Upcoming" becomes "Happening now" on the start day, and the banner drops
 * off the day after the event ends. Schedule a refresh for both moments.
 * Re-scheduling on every save leaves harmless duplicate refreshes.
 */
export async function scheduleEventDateRefresh(
  ctx: MutationCtx,
  event: { startDate: string; endDate: string },
) {
  await notifySiteAt(ctx, lagosDayStart(event.startDate), "events");
  await notifySiteAt(ctx, lagosDayStart(event.endDate) + 24 * 60 * 60 * 1000, "events");
}
