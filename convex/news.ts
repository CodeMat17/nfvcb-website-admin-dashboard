import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
  coverImageUrl?: string;
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
  if (args.coverImageUrl !== undefined && args.coverImageUrl !== "") {
    try {
      const url = new URL(args.coverImageUrl);
      if (!["https:", "http:"].includes(url.protocol))
        throw new Error("Cover image URL must use http or https.");
    } catch {
      throw new Error("Cover image URL is not valid.");
    }
  }
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("news").order("desc").collect();
    return await Promise.all(
      rows.map(async (row) => {
        let coverImageUrl: string | null = row.coverImageUrl ?? null;
        if (row.coverImageId) {
          try {
            coverImageUrl = await ctx.storage.getUrl(row.coverImageId);
          } catch {
            coverImageUrl = null;
          }
        }
        return { ...row, coverImageUrl };
      })
    );
  },
});

export const getById = query({
  args: { id: v.id("news") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    let coverImageUrl: string | null = row.coverImageUrl ?? null;
    if (row.coverImageId) {
      try {
        coverImageUrl = await ctx.storage.getUrl(row.coverImageId);
      } catch {
        coverImageUrl = null;
      }
    }
    return { ...row, coverImageUrl };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    coverImageUrl: v.optional(v.string()),
    coverImageId: v.optional(v.id("_storage")),
    category: v.optional(v.string()),
    author: v.optional(v.string()),
    featured: v.optional(v.boolean()),
    publishedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    validateFields({
      title: args.title,
      body: args.body,
      author: args.author,
      category: args.category,
      coverImageUrl: args.coverImageUrl,
    });

    if (args.coverImageId) {
      const meta = await ctx.db.system.get(args.coverImageId);
      if (meta && meta.size > 300 * 1024) {
        throw new Error("Cover image must be 300 KB or smaller.");
      }
    }

    const slug = toSlug(args.title);
    const existing = await ctx.db
      .query("news")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) {
      throw new Error(`A news article with slug "${slug}" already exists.`);
    }

    return await ctx.db.insert("news", {
      title: args.title.trim(),
      slug,
      excerpt: toExcerpt(args.body),
      body: args.body,
      coverImageUrl: args.coverImageUrl || undefined,
      coverImageId: args.coverImageId,
      category: args.category,
      author: args.author?.trim() || undefined,
      featured: args.featured,
      publishedAt: args.publishedAt,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("news"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    coverImageId: v.optional(v.id("_storage")),
    clearCoverImage: v.optional(v.boolean()),
    category: v.optional(v.string()),
    author: v.optional(v.string()),
    featured: v.optional(v.boolean()),
    publishedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const { id, clearCoverImage, ...fields } = args;

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("News article not found.");

    validateFields({
      title: fields.title,
      body: fields.body,
      author: fields.author,
      category: fields.category,
    });

    const patch: Record<string, unknown> = { ...fields };

    if (fields.coverImageId) {
      const meta = await ctx.db.system.get(fields.coverImageId);
      if (meta && meta.size > 300 * 1024) {
        throw new Error("Cover image must be 300 KB or smaller.");
      }
      // Delete old storage file when replacing with a new one
      if (existing.coverImageId) {
        try { await ctx.storage.delete(existing.coverImageId); } catch { /* ignore */ }
      }
    } else if (clearCoverImage) {
      // Explicit image removal
      if (existing.coverImageId) {
        try { await ctx.storage.delete(existing.coverImageId); } catch { /* ignore */ }
      }
      patch.coverImageId = undefined;
      patch.coverImageUrl = undefined;
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

    if (fields.body !== undefined) {
      patch.excerpt = toExcerpt(fields.body);
    }

    if (fields.author !== undefined) {
      patch.author = fields.author.trim() || undefined;
    }

    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("news") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("News article not found.");
    // Delete associated storage file if present
    if (existing.coverImageId) {
      await ctx.storage.delete(existing.coverImageId);
    }
    await ctx.db.delete(args.id);
  },
});
