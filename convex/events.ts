import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { deleteMediaLater, mediaFields } from "./lib/media";
import { notifySite, scheduleEventDateRefresh } from "./lib/site";

// ─── Events ──────────────────────────────────────────────────────────────────
// An event (e.g. PAO-NDCRC 2026) plus its guests, programme and live updates.
// The public site reads only published events through `getBySlug`, `list`,
// `allSlugs` and `featured`; everything else is for the dashboard.

/** Guest categories, in the order the public page lists them. */
export const EVENT_ROLES = [
  "Special Guest",
  "Keynote Speaker",
  "Speaker",
  "Panelist",
  "Moderator",
  "Host",
] as const;

const LIMITS = {
  title: 150,
  fullName: 250,
  edition: 60,
  theme: 300,
  description: 6000,
  venue: 200,
  address: 300,
  url: 600,
  name: 150,
  personTitle: 250,
  sessionTitle: 250,
  sessionDescription: 1500,
  speakers: 600,
  updateTitle: 200,
  updateBody: 3000,
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Uploaded image reference from the dashboard (public ID + pixel size).
const imageArg = v.object({
  publicId: v.string(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
});

async function requireAdmin(ctx: { auth: QueryCtx["auth"] }) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw new Error("Not authenticated");
}

/** Strips tags and trims; keeps line breaks for multi-line fields. */
function clean(value: string | undefined, maxLen: number): string | undefined {
  if (value === undefined) return undefined;
  const out = value
    .replace(/<[^>]*>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLen);
  return out || undefined;
}

function required(value: string, maxLen: number, label: string): string {
  const out = clean(value, maxLen);
  if (!out) throw new Error(`${label} is required.`);
  return out;
}

function cleanUrl(value: string | undefined): string | undefined {
  const url = clean(value, LIMITS.url);
  if (!url) return undefined;
  if (!/^https?:\/\/\S+$/i.test(url)) throw new Error("Links must start with http:// or https://");
  return url;
}

/** 11-char YouTube video ID from any common link form, or null. */
function youtubeId(url: string | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id =
      u.searchParams.get("v") ??
      u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)?.[1] ??
      null;
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

function cleanVideoUrl(value: string | undefined): string | undefined {
  const url = cleanUrl(value);
  if (url && !youtubeId(url)) {
    throw new Error("Video link must be a YouTube video link, e.g. https://youtu.be/…");
  }
  return url;
}

function checkDate(value: string, label: string): string {
  if (!DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be a valid date.`);
  }
  return value;
}

function checkTime(value: string | undefined, label: string): string | undefined {
  if (!value) return undefined;
  if (!TIME_RE.test(value)) throw new Error(`${label} must be a time like 09:30.`);
  return value;
}

function checkRole(value: string): string {
  if (!(EVENT_ROLES as readonly string[]).includes(value)) throw new Error("Unknown guest role.");
  return value;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function image(arg: { publicId: string; width?: number; height?: number }) {
  const media = mediaFields(arg.publicId, "events");
  const dim = (n?: number) => (n && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined);
  return { ...media, width: dim(arg.width), height: dim(arg.height) };
}

async function slugTaken(ctx: { db: QueryCtx["db"] }, slug: string, except?: Id<"events">) {
  const row = await ctx.db
    .query("events")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  return row !== null && row._id !== except;
}

async function children(ctx: { db: QueryCtx["db"] }, eventId: Id<"events">) {
  const [people, sessions, updates] = await Promise.all([
    ctx.db
      .query("eventPeople")
      .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
      .take(300),
    ctx.db
      .query("eventSessions")
      .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
      .take(300),
    ctx.db
      .query("eventUpdates")
      .withIndex("by_eventId_postedAt", (q) => q.eq("eventId", eventId))
      .order("desc")
      .take(300),
  ]);
  const roleRank = (r: string) => {
    const i = (EVENT_ROLES as readonly string[]).indexOf(r);
    return i === -1 ? EVENT_ROLES.length : i;
  };
  people.sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.order - b.order);
  sessions.sort(
    (a, b) => a.day.localeCompare(b.day) || a.startTime.localeCompare(b.startTime)
  );
  return { people, sessions, updates };
}

/** Public shape of an event (drops Cloudinary IDs). */
function publicEvent(e: Doc<"events">) {
  return {
    _id: e._id,
    title: e.title,
    slug: e.slug,
    fullName: e.fullName ?? null,
    edition: e.edition ?? null,
    theme: e.theme ?? null,
    description: e.description ?? null,
    startDate: e.startDate,
    endDate: e.endDate,
    venue: e.venue,
    address: e.address ?? null,
    registrationUrl: e.registrationUrl ?? null,
    youtubeId: youtubeId(e.videoUrl),
    bannerUrl: e.bannerUrl ?? null,
    bannerWidth: e.bannerWidth ?? null,
    bannerHeight: e.bannerHeight ?? null,
  };
}

// ─── Public queries ──────────────────────────────────────────────────────────

/** Published events, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("events").withIndex("by_startDate").order("desc").take(100);
    return rows.filter((e) => e.published).map(publicEvent);
  },
});

export const allSlugs = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("events").take(200);
    return rows.filter((e) => e.published).map((e) => e.slug);
  },
});

/**
 * Published, featured events, soonest first. The site decides which are still
 * current (queries avoid Date.now() so results stay cacheable).
 */
export const featured = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("events").withIndex("by_startDate").order("desc").take(20);
    return rows
      .filter((e) => e.published && e.featured)
      .reverse()
      .map(publicEvent);
  },
});

/** A published event with its guests, programme and updates. */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!event?.published) return null;
    const { people, sessions, updates } = await children(ctx, event._id);
    return {
      event: publicEvent(event),
      people: people.map((p) => ({
        _id: p._id,
        name: p.name,
        role: p.role,
        title: p.title ?? null,
        posterUrl: p.posterUrl ?? null,
        posterWidth: p.posterWidth ?? null,
        posterHeight: p.posterHeight ?? null,
      })),
      sessions: sessions.map((s) => ({
        _id: s._id,
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime ?? null,
        title: s.title,
        description: s.description ?? null,
        speakers: s.speakers ?? null,
      })),
      updates: updates.map((u) => ({
        _id: u._id,
        title: u.title ?? null,
        body: u.body,
        imageUrl: u.imageUrl ?? null,
        imageWidth: u.imageWidth ?? null,
        imageHeight: u.imageHeight ?? null,
        postedAt: u.postedAt,
      })),
    };
  },
});

// ─── Dashboard queries ───────────────────────────────────────────────────────

export const adminList = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("events").withIndex("by_startDate").order("desc").take(100);
  },
});

export const adminGet = query({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const event = await ctx.db.get(args.id);
    if (!event) return null;
    return { event, ...(await children(ctx, event._id)) };
  },
});

// ─── Event mutations ─────────────────────────────────────────────────────────

const eventFields = {
  title: v.string(),
  fullName: v.optional(v.string()),
  edition: v.optional(v.string()),
  theme: v.optional(v.string()),
  description: v.optional(v.string()),
  startDate: v.string(),
  endDate: v.string(),
  venue: v.string(),
  address: v.optional(v.string()),
  registrationUrl: v.optional(v.string()),
  videoUrl: v.optional(v.string()),
  published: v.boolean(),
  featured: v.boolean(),
};

function cleanEvent(args: {
  title: string;
  fullName?: string;
  edition?: string;
  theme?: string;
  description?: string;
  startDate: string;
  endDate: string;
  venue: string;
  address?: string;
  registrationUrl?: string;
  videoUrl?: string;
  published: boolean;
  featured: boolean;
}) {
  const startDate = checkDate(args.startDate, "Start date");
  const endDate = checkDate(args.endDate, "End date");
  if (endDate < startDate) throw new Error("End date can't be before the start date.");
  return {
    title: required(args.title, LIMITS.title, "Title"),
    fullName: clean(args.fullName, LIMITS.fullName),
    edition: clean(args.edition, LIMITS.edition),
    theme: clean(args.theme, LIMITS.theme),
    description: clean(args.description, LIMITS.description),
    startDate,
    endDate,
    venue: required(args.venue, LIMITS.venue, "Venue"),
    address: clean(args.address, LIMITS.address),
    registrationUrl: cleanUrl(args.registrationUrl),
    videoUrl: cleanVideoUrl(args.videoUrl),
    published: args.published,
    featured: args.featured,
  };
}

export const create = mutation({
  args: { ...eventFields, banner: v.optional(imageArg) },
  handler: async (ctx, args) => {
    await notifySite(ctx, "events");
    await requireAdmin(ctx);
    const { banner, ...rest } = args;
    const fields = cleanEvent(rest);
    await scheduleEventDateRefresh(ctx, fields);
    const slug = toSlug(fields.title);
    if (!slug) throw new Error("Title must contain letters or numbers.");
    if (await slugTaken(ctx, slug)) {
      throw new Error(`An event with the address "/events/${slug}" already exists.`);
    }
    const img = banner ? image(banner) : undefined;
    return await ctx.db.insert("events", {
      ...fields,
      slug,
      bannerUrl: img?.url,
      bannerPublicId: img?.publicId,
      bannerWidth: img?.width,
      bannerHeight: img?.height,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("events"),
    ...eventFields,
    // New banner; omit to keep the current one.
    banner: v.optional(imageArg),
    removeBanner: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await notifySite(ctx, "events");
    await requireAdmin(ctx);
    const { id, banner, removeBanner, ...rest } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Event not found.");

    const fields = cleanEvent(rest);
    await scheduleEventDateRefresh(ctx, fields);
    // The slug is the public URL; keep it stable once the event is live.
    let slug = existing.slug;
    if (!existing.published && fields.title !== existing.title) {
      const next = toSlug(fields.title);
      if (next && next !== slug) {
        if (await slugTaken(ctx, next, id)) {
          throw new Error(`An event with the address "/events/${next}" already exists.`);
        }
        slug = next;
      }
    }

    const patch: Partial<Doc<"events">> = { ...fields, slug };
    if (banner) {
      const img = image(banner);
      if (existing.bannerPublicId !== img.publicId) {
        await deleteMediaLater(ctx, [existing.bannerPublicId]);
      }
      Object.assign(patch, {
        bannerUrl: img.url,
        bannerPublicId: img.publicId,
        bannerWidth: img.width,
        bannerHeight: img.height,
      });
    } else if (removeBanner) {
      await deleteMediaLater(ctx, [existing.bannerPublicId]);
      Object.assign(patch, {
        bannerUrl: undefined,
        bannerPublicId: undefined,
        bannerWidth: undefined,
        bannerHeight: undefined,
      });
    }
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    await notifySite(ctx, "events");
    await requireAdmin(ctx);
    const event = await ctx.db.get(args.id);
    if (!event) return;
    const { people, sessions, updates } = await children(ctx, event._id);
    await deleteMediaLater(ctx, [
      event.bannerPublicId,
      ...people.map((p) => p.posterPublicId),
      ...updates.map((u) => u.imagePublicId),
    ]);
    for (const row of [...people, ...sessions, ...updates]) await ctx.db.delete(row._id);
    await ctx.db.delete(event._id);
  },
});

// ─── Guests ──────────────────────────────────────────────────────────────────

async function requireEvent(ctx: MutationCtx, id: Id<"events">) {
  const event = await ctx.db.get(id);
  if (!event) throw new Error("Event not found.");
  return event;
}

export const savePerson = mutation({
  args: {
    eventId: v.id("events"),
    // Omit to add a new guest.
    id: v.optional(v.id("eventPeople")),
    name: v.string(),
    role: v.string(),
    title: v.optional(v.string()),
    // New poster; omit to keep the current one.
    poster: v.optional(imageArg),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await notifySite(ctx, "events");
    await requireAdmin(ctx);
    await requireEvent(ctx, args.eventId);
    const fields = {
      name: required(args.name, LIMITS.name, "Name"),
      role: checkRole(args.role),
      title: clean(args.title, LIMITS.personTitle),
    };
    const img = args.poster ? image(args.poster) : undefined;
    const posterFields = img
      ? {
          posterUrl: img.url,
          posterPublicId: img.publicId,
          posterWidth: img.width,
          posterHeight: img.height,
        }
      : {};

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing || existing.eventId !== args.eventId) throw new Error("Guest not found.");
      if (img && existing.posterPublicId !== img.publicId) {
        await deleteMediaLater(ctx, [existing.posterPublicId]);
      }
      await ctx.db.patch(args.id, {
        ...fields,
        ...posterFields,
        ...(args.order !== undefined && { order: args.order }),
      });
      return args.id;
    }
    return await ctx.db.insert("eventPeople", {
      eventId: args.eventId,
      ...fields,
      ...posterFields,
      order: args.order ?? Date.now(),
    });
  },
});

/** Swaps a guest's position with its neighbour in the same role. */
export const movePerson = mutation({
  args: { id: v.id("eventPeople"), direction: v.union(v.literal("up"), v.literal("down")) },
  handler: async (ctx, args) => {
    await notifySite(ctx, "events");
    await requireAdmin(ctx);
    const person = await ctx.db.get(args.id);
    if (!person) return;
    const peers = (
      await ctx.db
        .query("eventPeople")
        .withIndex("by_eventId", (q) => q.eq("eventId", person.eventId))
        .take(300)
    )
      .filter((p) => p.role === person.role)
      .sort((a, b) => a.order - b.order);
    const i = peers.findIndex((p) => p._id === person._id);
    const j = args.direction === "up" ? i - 1 : i + 1;
    if (i === -1 || j < 0 || j >= peers.length) return;
    const other = peers[j];
    // Equal orders would make the swap a no-op, so nudge apart.
    const a = person.order;
    const b = other.order === a ? a + (j > i ? 1 : -1) : other.order;
    await ctx.db.patch(person._id, { order: b });
    await ctx.db.patch(other._id, { order: a });
  },
});

export const removePerson = mutation({
  args: { id: v.id("eventPeople") },
  handler: async (ctx, args) => {
    await notifySite(ctx, "events");
    await requireAdmin(ctx);
    const person = await ctx.db.get(args.id);
    if (!person) return;
    await deleteMediaLater(ctx, [person.posterPublicId]);
    await ctx.db.delete(args.id);
  },
});

// ─── Programme ───────────────────────────────────────────────────────────────

export const saveSession = mutation({
  args: {
    eventId: v.id("events"),
    id: v.optional(v.id("eventSessions")),
    day: v.string(),
    startTime: v.string(),
    endTime: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    speakers: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await notifySite(ctx, "events");
    await requireAdmin(ctx);
    const event = await requireEvent(ctx, args.eventId);
    const day = checkDate(args.day, "Day");
    if (day < event.startDate || day > event.endDate) {
      throw new Error("The session day must fall within the event dates.");
    }
    const startTime = checkTime(args.startTime, "Start time");
    if (!startTime) throw new Error("Start time is required.");
    const endTime = checkTime(args.endTime, "End time");
    if (endTime && endTime <= startTime) throw new Error("End time must be after the start time.");
    const fields = {
      day,
      startTime,
      endTime,
      title: required(args.title, LIMITS.sessionTitle, "Session title"),
      description: clean(args.description, LIMITS.sessionDescription),
      speakers: clean(args.speakers, LIMITS.speakers),
    };
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing || existing.eventId !== args.eventId) throw new Error("Session not found.");
      await ctx.db.patch(args.id, fields);
      return args.id;
    }
    return await ctx.db.insert("eventSessions", { eventId: args.eventId, ...fields });
  },
});

export const removeSession = mutation({
  args: { id: v.id("eventSessions") },
  handler: async (ctx, args) => {
    await notifySite(ctx, "events");
    await requireAdmin(ctx);
    if (await ctx.db.get(args.id)) await ctx.db.delete(args.id);
  },
});

// ─── Live updates ────────────────────────────────────────────────────────────

export const saveUpdate = mutation({
  args: {
    eventId: v.id("events"),
    id: v.optional(v.id("eventUpdates")),
    title: v.optional(v.string()),
    body: v.string(),
    image: v.optional(imageArg),
    removeImage: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await notifySite(ctx, "events");
    await requireAdmin(ctx);
    await requireEvent(ctx, args.eventId);
    const fields = {
      title: clean(args.title, LIMITS.updateTitle),
      body: required(args.body, LIMITS.updateBody, "Update text"),
    };
    const img = args.image ? image(args.image) : undefined;
    const imageFields = img
      ? {
          imageUrl: img.url,
          imagePublicId: img.publicId,
          imageWidth: img.width,
          imageHeight: img.height,
        }
      : {};

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing || existing.eventId !== args.eventId) throw new Error("Update not found.");
      if ((img || args.removeImage) && existing.imagePublicId !== img?.publicId) {
        await deleteMediaLater(ctx, [existing.imagePublicId]);
      }
      await ctx.db.patch(args.id, {
        ...fields,
        ...(img
          ? imageFields
          : args.removeImage
            ? { imageUrl: undefined, imagePublicId: undefined, imageWidth: undefined, imageHeight: undefined }
            : {}),
      });
      return args.id;
    }
    return await ctx.db.insert("eventUpdates", {
      eventId: args.eventId,
      ...fields,
      ...imageFields,
      postedAt: Date.now(),
    });
  },
});

export const removeUpdate = mutation({
  args: { id: v.id("eventUpdates") },
  handler: async (ctx, args) => {
    await notifySite(ctx, "events");
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) return;
    await deleteMediaLater(ctx, [row.imagePublicId]);
    await ctx.db.delete(args.id);
  },
});
