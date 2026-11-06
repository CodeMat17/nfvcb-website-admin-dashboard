import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Public-site revalidation ────────────────────────────────────────────────
// The public site (nfvcb2) serves static pages and rebuilds them only when told
// to. Mutations call `notifySite` (convex/lib/site.ts), which schedules this
// action after the write commits. It POSTs the changed tags to the site's
// /api/revalidate route.
//
// Convex environment variables (Dashboard → Settings → Environment Variables):
//   PUBLIC_SITE_URL    e.g. https://www.nfvcb.gov.ng (no trailing slash)
//   REVALIDATE_SECRET  must match REVALIDATE_SECRET on the public site's host
// If either is missing, the action logs and does nothing, and the site falls
// back to its daily refresh.

const MAX_ATTEMPTS = 4;

export const revalidate = internalAction({
  args: { tags: v.array(v.string()), attempt: v.optional(v.number()) },
  handler: async (ctx, { tags, attempt = 1 }) => {
    const siteUrl = process.env.PUBLIC_SITE_URL?.replace(/\/+$/, "");
    const secret = process.env.REVALIDATE_SECRET;
    if (!siteUrl || !secret) {
      console.warn("[site] PUBLIC_SITE_URL or REVALIDATE_SECRET not set; skipping revalidation", tags);
      return;
    }

    let problem: string;
    try {
      const res = await fetch(`${siteUrl}/api/revalidate`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
        body: JSON.stringify({ tags }),
      });
      if (res.ok) return;
      problem = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
      // A bad secret or bad tags won't fix themselves; don't retry.
      if (res.status === 400 || res.status === 401) {
        console.error("[site] revalidation rejected", tags, problem);
        return;
      }
    } catch (error) {
      problem = String(error);
    }

    if (attempt >= MAX_ATTEMPTS) {
      console.error("[site] revalidation failed, giving up", tags, problem);
      return;
    }
    // Back off 15s, 60s, 4min.
    const delay = 15_000 * 4 ** (attempt - 1);
    console.warn(`[site] revalidation attempt ${attempt} failed; retrying in ${delay / 1000}s`, problem);
    await ctx.scheduler.runAfter(delay, internal.site.revalidate, { tags, attempt: attempt + 1 });
  },
});
