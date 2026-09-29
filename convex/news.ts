import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { deleteMediaLater, mediaFields, publicIdsInHtml } from "./lib/media";

const MAX_TITLE = 200;
const MAX_AUTHOR = 100;
const MAX_BODY = 500_000;
const MAX_CATEGORY = 50;
const ALLOWED_CATEGORIES = ["news", "press-release", "announcement"];

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function toExcerpt(body: string): string {
  const plain = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return plain.length <= 150 ? plain : plain.slice(0, 147) + "...";
}

function validateFields(args: {
  title?: string;
  body?: string;
  author?: string;
  category?: string;
}) {
  if (args.title !== undefined) {
    if (!args.title.trim()) throw new Error("Title is required.");
    if (args.title.length > MAX_TITLE)
      throw new Error(`Title must be ${MAX_TITLE} characters or fewer.`);
  }
  if (args.body !== undefined) {
    if (!args.body.trim()) throw new Error("Body is required.");
    if (args.body.length > MAX_BODY)
      throw new Error("Body content is too large.");
  }
  if (args.author !== undefined && args.author.length > MAX_AUTHOR) {
    throw new Error(`Author must be ${MAX_AUTHOR} characters or fewer.`);
  }
  if (args.category !== undefined && args.category.length > MAX_CATEGORY) {
    throw new Error("Invalid category.");
  }
  if (
    args.category !== undefined &&
    !ALLOWED_CATEGORIES.includes(args.category)
  ) {
    throw new Error("Invalid category.");
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolveCoverUrl(ctx: QueryCtx, row: Doc<"news">) {
  if (!row.coverImageId) return row.coverImageUrl ?? null;
  try {
    return await ctx.storage.getUrl(row.coverImageId);
  } catch {
    return null;
  }
}

// Listing shape: everything except the body, which can be very large.
async function toSummary(ctx: QueryCtx, row: Doc<"news">) {
  const { body: _legacyBody, ...rest } = row;
  return { ...rest, coverImageUrl: await resolveCoverUrl(ctx, row) };
}

async function getBodyDoc(ctx: QueryCtx, newsId: Id<"news">) {
  return await ctx.db
    .query("newsBodies")
    .withIndex("by_newsId", (q) => q.eq("newsId", newsId))
    .unique();
}

async function withBody(ctx: QueryCtx, row: Doc<"news">) {
  const bodyDoc = await getBodyDoc(ctx, row._id);
  return {
    ...(await toSummary(ctx, row)),
    body: bodyDoc?.body ?? row.body ?? "",
  };
}

// Saves the body and deletes Cloudinary images it no longer references.
async function writeBody(ctx: MutationCtx, newsId: Id<"news">, body: string) {
  const mediaPublicIds = publicIdsInHtml(body);
  const existing = await getBodyDoc(ctx, newsId);
  if (existing) {
    await ctx.db.patch(existing._id, { body, mediaPublicIds });
    await deleteMediaLater(
      ctx,
      (existing.mediaPublicIds ?? []).filter((id) => !mediaPublicIds.includes(id))
    );
  } else {
    await ctx.db.insert("newsBodies", { newsId, body, mediaPublicIds });
  }
}

// Removes a row's current cover, wherever it is stored.
async function deleteCover(ctx: MutationCtx, row: Doc<"news">) {
  if (row.coverImageId) {
    try { await ctx.storage.delete(row.coverImageId); } catch { /* ignore */ }
  }
  await deleteMediaLater(ctx, [row.coverImagePublicId]);
}

// ─── Queries ─────────────────────────────────────────────────────────────────

// Public: published articles, newest first, without bodies.
export const list = query({
  args: {
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const base = args.category
      ? ctx.db
          .query("news")
          .withIndex("by_category", (q) => q.eq("category", args.category))
      : ctx.db.query("news");
    const published = base
      .order("desc")
      .filter((q) => q.eq(q.field("publish"), true));
    const rows =
      args.limit !== undefined
        ? await published.take(Math.max(1, Math.min(args.limit, 100)))
        : await published.collect();
    return await Promise.all(rows.map((row) => toSummary(ctx, row)));
  },
});

// Public: distinct categories that have at least one published article.
export const categories = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("news")
      .filter((q) => q.eq(q.field("publish"), true))
      .collect();
    return Array.from(
      new Set(rows.map((r) => r.category).filter((c): c is string => !!c))
    ).sort();
  },
});

// Public: slugs of published articles (for static params / sitemaps).
export const allSlugs = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("news")
      .filter((q) => q.eq(q.field("publish"), true))
      .collect();
    return rows.map((r) => r.slug);
  },
});

// Admin dashboard: every article, published or not, without bodies.
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const rows = await ctx.db.query("news").order("desc").collect();
    return await Promise.all(rows.map((row) => toSummary(ctx, row)));
  },
});

// Public: only published articles.
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("news")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!row || row.publish !== true) return null;
    return await withBody(ctx, row);
  },
});

// Admin: fetch any article by id, including drafts.
export const getById = query({
  args: { id: v.id("news") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const row = await ctx.db.get(args.id);
    if (!row) return null;
    return await withBody(ctx, row);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    // Cloudinary public ID from an upload signed by cloudinary.signUpload.
    coverImagePublicId: v.optional(v.string()),
    category: v.optional(v.string()),
    author: v.optional(v.string()),
    featured: v.optional(v.boolean()),
    publishedAt: v.optional(v.string()),
    publish: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    validateFields({
      title: args.title,
      body: args.body,
      author: args.author,
      category: args.category,
    });

    const cover = args.coverImagePublicId
      ? mediaFields(args.coverImagePublicId, "news")
      : undefined;

    const slug = toSlug(args.title);
    const existing = await ctx.db
      .query("news")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) {
      throw new Error(`A news article with slug "${slug}" already exists.`);
    }

    const newsId = await ctx.db.insert("news", {
      title: args.title.trim(),
      slug,
      excerpt: toExcerpt(args.body),
      coverImageUrl: cover?.url,
      coverImagePublicId: cover?.publicId,
      category: args.category,
      author: args.author?.trim() || undefined,
      featured: args.featured,
      publishedAt: args.publishedAt,
      publish: args.publish ?? false,
    });
    await writeBody(ctx, newsId, args.body);
    return newsId;
  },
});

export const update = mutation({
  args: {
    id: v.id("news"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    coverImagePublicId: v.optional(v.string()),
    clearCoverImage: v.optional(v.boolean()),
    category: v.optional(v.string()),
    author: v.optional(v.string()),
    featured: v.optional(v.boolean()),
    publishedAt: v.optional(v.string()),
    publish: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const { id, clearCoverImage, body, coverImagePublicId, ...fields } = args;

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("News article not found.");

    validateFields({
      title: fields.title,
      body,
      author: fields.author,
      category: fields.category,
    });

    const patch: Record<string, unknown> = { ...fields };

    if (coverImagePublicId) {
      // Replacing: point at the new upload and delete the old one.
      const cover = mediaFields(coverImagePublicId, "news");
      if (cover.publicId !== existing.coverImagePublicId) await deleteCover(ctx, existing);
      patch.coverImageUrl = cover.url;
      patch.coverImagePublicId = cover.publicId;
      patch.coverImageId = undefined;
    } else if (clearCoverImage) {
      await deleteCover(ctx, existing);
      patch.coverImageId = undefined;
      patch.coverImageUrl = undefined;
      patch.coverImagePublicId = undefined;
    }

    if (fields.title !== undefined) {
      const slug = toSlug(fields.title);
      const conflict = await ctx.db
        .query("news")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (conflict && conflict._id !== id) {
        throw new Error(`A news article with slug "${slug}" already exists.`);
      }
      patch.slug = slug;
      patch.title = fields.title.trim();
    }

    if (body !== undefined) {
      patch.excerpt = toExcerpt(body);
      patch.body = undefined; // drop any legacy inline copy
      await writeBody(ctx, id, body);
    }

    if (fields.author !== undefined) {
      patch.author = fields.author.trim() || undefined;
    }

    await ctx.db.patch(id, patch);
  },
});

export const togglePublish = mutation({
  args: { id: v.id("news"), publish: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("News article not found.");

    await ctx.db.patch(args.id, { publish: args.publish });
  },
});

export const remove = mutation({
  args: { id: v.id("news") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("News article not found.");
    await deleteCover(ctx, existing);
    const bodyDoc = await getBodyDoc(ctx, args.id);
    if (bodyDoc) {
      await deleteMediaLater(ctx, bodyDoc.mediaPublicIds ?? []);
      await ctx.db.delete(bodyDoc._id);
    }
    await ctx.db.delete(args.id);
  },
});

// ─── Migration ───────────────────────────────────────────────────────────────
// One-off: moves legacy `news.body` values into `newsBodies`, a few rows per
// run (bodies can be large), rescheduling itself until done. Run with:
//   npx convex run news:migrateBodies
export const migrateBodies = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("news")
      .paginate({ cursor: args.cursor ?? null, numItems: 5 });
    for (const row of page.page) {
      if (row.body === undefined) continue;
      if (!(await getBodyDoc(ctx, row._id))) {
        await ctx.db.insert("newsBodies", { newsId: row._id, body: row.body });
      }
      await ctx.db.patch(row._id, { body: undefined });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.news.migrateBodies, {
        cursor: page.continueCursor,
      });
    }
  },
});
