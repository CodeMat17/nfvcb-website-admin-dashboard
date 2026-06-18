import { v } from "convex/values";
import { mutation } from "./_generated/server";

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ─── Approved Movie Posts ────────────────────────────────────────────────────

export const createPost = mutation({
  args: {
    title: v.string(),
    month: v.string(),
    author: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const slug = toSlug(args.title);
    const existing = await ctx.db
      .query("approvedMovies")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) {
      throw new Error(`An approved movies post with slug "${slug}" already exists.`);
    }

    return await ctx.db.insert("approvedMovies", {
      title: args.title,
      slug,
      month: args.month,
      author: args.author,
    });
  },
});

export const updatePost = mutation({
  args: {
    id: v.id("approvedMovies"),
    title: v.optional(v.string()),
    month: v.optional(v.string()),
    author: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const { id, ...fields } = args;

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Approved movies post not found.");

    const patch: Record<string, unknown> = { ...fields };

    if (fields.title !== undefined) {
      const slug = toSlug(fields.title);
      const conflict = await ctx.db
        .query("approvedMovies")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (conflict && conflict._id !== id) {
        throw new Error(`An approved movies post with slug "${slug}" already exists.`);
      }
      patch.slug = slug;
    }

    await ctx.db.patch(id, patch);
  },
});

export const removePost = mutation({
  args: { id: v.id("approvedMovies") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Approved movies post not found.");
    await ctx.db.delete(args.id);
  },
});

// ─── Approved Movie Items ────────────────────────────────────────────────────

export const createItem = mutation({
  args: {
    postId: v.id("approvedMovies"),
    title: v.string(),
    duration: v.string(),
    producer: v.string(),
    director: v.string(),
    majorCast: v.string(),
    rating: v.string(),
    previewLocation: v.string(),
    language: v.string(),
    consumerAdvice: v.string(),
    dateOfApproval: v.string(),
    productionCompany: v.string(),
    featured: v.optional(v.boolean()),
    trailerUrl: v.optional(v.string()),
    juryNote: v.optional(v.string()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Approved movies post not found.");

    return await ctx.db.insert("approvedMovieItems", { ...args });
  },
});

export const updateItem = mutation({
  args: {
    id: v.id("approvedMovieItems"),
    title: v.optional(v.string()),
    duration: v.optional(v.string()),
    producer: v.optional(v.string()),
    director: v.optional(v.string()),
    majorCast: v.optional(v.string()),
    rating: v.optional(v.string()),
    previewLocation: v.optional(v.string()),
    language: v.optional(v.string()),
    consumerAdvice: v.optional(v.string()),
    dateOfApproval: v.optional(v.string()),
    productionCompany: v.optional(v.string()),
    featured: v.optional(v.boolean()),
    trailerUrl: v.optional(v.string()),
    juryNote: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Approved movie item not found.");
    await ctx.db.patch(id, fields);
  },
});

export const removeItem = mutation({
  args: { id: v.id("approvedMovieItems") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Approved movie item not found.");
    await ctx.db.delete(args.id);
  },
});
