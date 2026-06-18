import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const MAX_NAME = 150;
const MAX_DESIGNATION = 200;
const MAX_IMAGE_BYTES = 30 * 1024; // 30 KB

function sanitizeField(value: string, maxLen: number, label: string): string {
  const clean = value
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .trim()
    .slice(0, maxLen);
  if (!clean) throw new Error(`${label} is required.`);
  return clean;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");
    return ctx.storage.generateUploadUrl();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const staff = await ctx.db
      .query("managementStaff")
      .withIndex("by_order")
      .order("asc")
      .take(500);
    return await Promise.all(
      staff.map(async (s) => ({
        ...s,
        imageUrl: await ctx.storage.getUrl(s.imageId),
      }))
    );
  },
});

export const getById = query({
  args: { id: v.id("managementStaff") },
  handler: async (ctx, args) => {
    const staff = await ctx.db.get(args.id);
    if (!staff) return null;
    return { ...staff, imageUrl: await ctx.storage.getUrl(staff.imageId) };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    designation: v.string(),
    imageId: v.id("_storage"),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const name = sanitizeField(args.name, MAX_NAME, "Name");
    const designation = sanitizeField(args.designation, MAX_DESIGNATION, "Designation");

    const meta = await ctx.db.system.get(args.imageId);
    if (!meta) throw new Error("Image not found in storage.");
    if (meta.size > MAX_IMAGE_BYTES)
      throw new Error("Image must be 300 KB or smaller.");

    return await ctx.db.insert("managementStaff", {
      name,
      designation,
      imageId: args.imageId,
      order: args.order,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("managementStaff"),
    name: v.optional(v.string()),
    designation: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Staff member not found.");

    const patch: Record<string, unknown> = {};

    if (fields.name !== undefined)
      patch.name = sanitizeField(fields.name, MAX_NAME, "Name");
    if (fields.designation !== undefined)
      patch.designation = sanitizeField(fields.designation, MAX_DESIGNATION, "Designation");
    if (fields.order !== undefined)
      patch.order = fields.order;

    if (fields.imageId !== undefined) {
      const meta = await ctx.db.system.get(fields.imageId);
      if (!meta) throw new Error("Image not found in storage.");
      if (meta.size > MAX_IMAGE_BYTES)
        throw new Error("Image must be 300 KB or smaller.");
      await ctx.storage.delete(existing.imageId);
      patch.imageId = fields.imageId;
    }

    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("managementStaff") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Staff member not found.");
    await ctx.storage.delete(existing.imageId);
    await ctx.db.delete(args.id);
  },
});
