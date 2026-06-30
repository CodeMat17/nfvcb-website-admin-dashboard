import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function titleFromMonth(month: string): string {
  return `Approved Movies - ${month}`;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listPosts = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db.query("approvedMovies").order("desc").collect();
    const counts = await Promise.all(
      posts.map((post) =>
        ctx.db
          .query("approvedMovieItems")
          .withIndex("by_postId", (q) => q.eq("postId", post._id))
          .collect()
          .then((items) => items.length)
      )
    );
    return posts.map((post, i) => ({ ...post, movieCount: counts[i] }));
  },
});

export const getPost = query({
  args: { id: v.id("approvedMovies") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const listItems = query({
  args: { postId: v.id("approvedMovies") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("approvedMovieItems")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .collect();
    return items.sort((a, b) => a.order - b.order);
  },
});

// ─── Public site shape ───────────────────────────────────────────────────────
// Mirrors the old hardcoded `ApprovedMoviesPost`/`Movie` shape from the
// frontend's lib/approved-movies-data.ts so its pages/components don't change.
// Kept in sync with the nfvcb frontend repo's convex/approvedMovies.ts since
// both repos deploy to the same Convex backend.

async function postWithMovies(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  post: {
    _id: import("./_generated/dataModel").Id<"approvedMovies">;
    _creationTime: number;
    slug: string;
    month: string;
    author: string;
    date?: string;
  }
) {
  const items = await ctx.db
    .query("approvedMovieItems")
    .withIndex("by_postId", (q) => q.eq("postId", post._id))
    .collect();
  items.sort((a, b) => a.order - b.order);

  return {
    slug: post.slug,
    month: post.month,
    date: post.date ?? new Date(post._creationTime).toISOString().slice(0, 10),
    publishedBy: post.author,
    image: undefined as string | undefined,
    movies: items.map((item) => ({
      title: item.title,
      month: post.month,
      duration: item.duration,
      producer: item.producer,
      director: item.director,
      majorCast: item.majorCast,
      rating: item.rating,
      previewLocation: item.previewLocation,
      language: item.language,
      consumerAdvice: item.consumerAdvice,
      dateOfApproval: item.dateOfApproval,
      productionCompany: item.productionCompany,
      featured: item.featured,
      trailerUrl: item.trailerUrl,
      juryNote: item.juryNote,
    })),
  };
}

export const listPostsWithMovies = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db.query("approvedMovies").order("desc").collect();
    return await Promise.all(posts.map((post) => postWithMovies(ctx, post)));
  },
});

export const getPostBySlugWithMovies = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("approvedMovies")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!post) return null;
    return await postWithMovies(ctx, post);
  },
});

// ─── Approved Movie Posts ────────────────────────────────────────────────────

export const createPost = mutation({
  args: {
    month: v.string(),
    author: v.string(),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const title = titleFromMonth(args.month);
    const slug = toSlug(title);
    const existing = await ctx.db
      .query("approvedMovies")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) {
      throw new Error(`An approved movies post for "${args.month}" already exists.`);
    }

    return await ctx.db.insert("approvedMovies", {
      title,
      slug,
      month: args.month,
      author: args.author,
      date: args.date,
    });
  },
});

export const updatePost = mutation({
  args: {
    id: v.id("approvedMovies"),
    month: v.optional(v.string()),
    author: v.optional(v.string()),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const { id, ...fields } = args;

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Approved movies post not found.");

    const patch: Record<string, unknown> = { ...fields };

    if (fields.month !== undefined) {
      const title = titleFromMonth(fields.month);
      const slug = toSlug(title);
      const conflict = await ctx.db
        .query("approvedMovies")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (conflict && conflict._id !== id) {
        throw new Error(`An approved movies post for "${fields.month}" already exists.`);
      }
      patch.title = title;
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

    const items = await ctx.db
      .query("approvedMovieItems")
      .withIndex("by_postId", (q) => q.eq("postId", args.id))
      .collect();
    await Promise.all(items.map((item) => ctx.db.delete(item._id)));

    await ctx.db.delete(args.id);
  },
});

// ─── Bulk import (Excel upload) ──────────────────────────────────────────────

const movieInput = v.object({
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
});

export const bulkImport = mutation({
  args: {
    month: v.string(),
    author: v.string(),
    date: v.optional(v.string()),
    movies: v.array(movieInput),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");
    if (args.movies.length === 0) throw new Error("No movies found to import.");

    const title = titleFromMonth(args.month);
    const slug = toSlug(title);
    const existing = await ctx.db
      .query("approvedMovies")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) {
      throw new Error(
        `An approved movies post for "${args.month}" already exists. Delete it first or choose a different month.`
      );
    }

    const postId = await ctx.db.insert("approvedMovies", {
      title,
      slug,
      month: args.month,
      author: args.author,
      date: args.date,
    });

    await Promise.all(
      args.movies.map((movie, order) =>
        ctx.db.insert("approvedMovieItems", { ...movie, postId, order })
      )
    );

    return postId;
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
