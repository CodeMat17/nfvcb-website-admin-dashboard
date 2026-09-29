import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { deleteProfileImage, mediaFields } from "./lib/media";

const MAX_NAME = 150;
const MAX_ROLE = 200;
const MAX_OFFICE = 200;

function sanitizeField(value: string, maxLen: number, label: string): string {
  const clean = value
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .trim()
    .slice(0, maxLen);
  if (!clean) throw new Error(`${label} is required.`);
  return clean;
}

function sanitizeSeniority(value: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new Error("Seniority must be a whole number of 1 or greater.");
  }
  return value;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const leaders = await ctx.db.query("leadership").withIndex("by_seniority").take(100);
    return await Promise.all(
      leaders.map(async (l) => ({
        ...l,
        imageUrl: l.imageUrl ?? (l.imageId ? await ctx.storage.getUrl(l.imageId) : null),
      }))
    );
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    office: v.string(),
    // Cloudinary public ID from an upload signed by cloudinary.signUpload.
    imagePublicId: v.optional(v.string()),
    order: v.number(),
    seniority: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const image = args.imagePublicId
      ? mediaFields(args.imagePublicId, "leadership")
      : undefined;

    return await ctx.db.insert("leadership", {
      name: sanitizeField(args.name, MAX_NAME, "Name"),
      role: sanitizeField(args.role, MAX_ROLE, "Role"),
      office: sanitizeField(args.office, MAX_OFFICE, "Office"),
      imageUrl: image?.url,
      imagePublicId: image?.publicId,
      order: args.order,
      seniority: sanitizeSeniority(args.seniority),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("leadership"),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    office: v.optional(v.string()),
    // Cloudinary public ID from an upload signed by cloudinary.signUpload.
    imagePublicId: v.optional(v.string()),
    seniority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Leader not found.");

    const patch: Record<string, unknown> = {};

    if (fields.name !== undefined) patch.name = sanitizeField(fields.name, MAX_NAME, "Name");
    if (fields.role !== undefined) patch.role = sanitizeField(fields.role, MAX_ROLE, "Role");
    if (fields.office !== undefined)
      patch.office = sanitizeField(fields.office, MAX_OFFICE, "Office");
    if (fields.seniority !== undefined) patch.seniority = sanitizeSeniority(fields.seniority);

    if (fields.imagePublicId !== undefined) {
      const image = mediaFields(fields.imagePublicId, "leadership");
      if (image.publicId !== existing.imagePublicId) await deleteProfileImage(ctx, existing);
      patch.imageUrl = image.url;
      patch.imagePublicId = image.publicId;
      patch.imageId = undefined;
    }

    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("leadership") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Leader not found.");
    await deleteProfileImage(ctx, existing);
    await ctx.db.delete(args.id);
  },
});

/**
 * One-off: fills the table with the content the public site used to hardcode.
 * Run with `npx convex run leadership:seed`. Does nothing if rows already exist.
 */
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (await ctx.db.query("leadership").first()) return "leadership already has rows; skipped.";

    const rows = [
      {
        name: "President of the Federal Republic of Nigeria",
        role: "President & Commander-in-Chief",
        office: "Federal Republic of Nigeria",
      },
      {
        name: "Vice President of the Federal Republic of Nigeria",
        role: "Vice President",
        office: "Federal Republic of Nigeria",
      },
      {
        name: "Honourable Minister",
        role: "Minister of Art, Culture, Tourism and the Creative Economy",
        office: "Supervising Ministry",
      },
    ];
    const now = Date.now();
    for (const [i, row] of rows.entries()) {
      await ctx.db.insert("leadership", { ...row, order: now + i, seniority: i + 1 });
    }
    return `Inserted ${rows.length} leaders.`;
  },
});
