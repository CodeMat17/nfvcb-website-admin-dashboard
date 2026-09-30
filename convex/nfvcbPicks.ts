import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { deleteMediaLater, mediaFields } from "./lib/media";

// ─── NFVCB Pick ──────────────────────────────────────────────────────────────
// One recommended film per monthly approved-movies batch. The pick stores only
// what the batch doesn't already have (poster, note, trailer override); the
// film's details are always read from its approvedMovieItems row.

const MAX_NOTE = 600;
const MAX_URL = 500;

function cleanText(value: string | undefined, maxLen: number): string | undefined {
  if (value === undefined) return undefined;
  const clean = value.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
  return clean || undefined;
}

function cleanUrl(value: string | undefined): string | undefined {
  const url = cleanText(value, MAX_URL);
  if (!url) return undefined;
  if (!/^https?:\/\//i.test(url)) throw new Error("Trailer URL must start with http:// or https://");
  return url;
}

async function pickForPost(ctx: { db: QueryCtx["db"] }, postId: Id<"approvedMovies">) {
  return await ctx.db
    .query("nfvcbPicks")
    .withIndex("by_postId", (q) => q.eq("postId", postId))
    .unique();
}

/** Deletes a pick and its poster. Used when its film or batch is removed. */
export async function removePick(ctx: MutationCtx, pick: Doc<"nfvcbPicks">) {
  await deleteMediaLater(ctx, [pick.posterPublicId]);
  await ctx.db.delete(pick._id);
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** The pick for one batch, for the dashboard (published or not). */
export const getForPost = query({
  args: { postId: v.id("approvedMovies") },
  handler: async (ctx, args) => await pickForPost(ctx, args.postId),
});

/**
 * Public: the published pick from the most recent batch that has one, joined
 * with the film's details. Null when there is none.
 */
export const current = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db.query("approvedMovies").order("desc").take(24);
    for (const post of posts) {
      const pick = await pickForPost(ctx, post._id);
      if (!pick?.published) continue;
      const film = await ctx.db.get(pick.itemId);
      if (!film) continue;
      return {
        month: post.month,
        slug: post.slug,
        posterUrl: pick.posterUrl ?? null,
        note: pick.note ?? null,
        trailerUrl: pick.trailerUrl ?? film.trailerUrl ?? null,
        title: film.title,
        rating: film.rating,
        duration: film.duration,
        language: film.language,
        director: film.director,
        producer: film.producer,
        majorCast: film.majorCast,
        productionCompany: film.productionCompany,
        consumerAdvice: film.consumerAdvice,
      };
    }
    return null;
  },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

/** Creates or updates the pick for a batch. */
export const save = mutation({
  args: {
    postId: v.id("approvedMovies"),
    itemId: v.id("approvedMovieItems"),
    // Cloudinary public ID from an upload signed by cloudinary.signUpload.
    // Omit to keep the current poster.
    posterPublicId: v.optional(v.string()),
    note: v.optional(v.string()),
    trailerUrl: v.optional(v.string()),
    published: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.itemId);
    if (!item || item.postId !== args.postId) {
      throw new Error("That film is not part of this batch.");
    }

    const existing = await pickForPost(ctx, args.postId);
    const poster = args.posterPublicId ? mediaFields(args.posterPublicId, "picks") : undefined;
    const posterUrl = poster?.url ?? existing?.posterUrl;
    if (args.published && !posterUrl) {
      throw new Error("Upload a poster before publishing the pick.");
    }

    const fields = {
      itemId: args.itemId,
      posterUrl,
      posterPublicId: poster?.publicId ?? existing?.posterPublicId,
      note: cleanText(args.note, MAX_NOTE),
      trailerUrl: cleanUrl(args.trailerUrl),
      published: args.published,
    };

    if (existing) {
      if (poster && existing.posterPublicId && existing.posterPublicId !== poster.publicId) {
        await deleteMediaLater(ctx, [existing.posterPublicId]);
      }
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("nfvcbPicks", { postId: args.postId, ...fields });
  },
});

export const remove = mutation({
  args: { postId: v.id("approvedMovies") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const pick = await pickForPost(ctx, args.postId);
    if (pick) await removePick(ctx, pick);
  },
});
