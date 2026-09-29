import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { mediaFields, publicIdsInHtml, type MediaFolder } from "./lib/media";

// ─── Migration support (used by cloudinary.migrate*) ─────────────────────────

const imageTables = v.union(
  v.literal("managementStaff"),
  v.literal("leadership"),
  v.literal("executiveDirector")
);

/** Rows whose photo is still in Convex file storage. */
export const pendingStorageImages = internalQuery({
  args: {},
  handler: async (ctx) => {
    const pending: {
      table: "news" | "managementStaff" | "leadership" | "executiveDirector";
      id: string;
      storageId: Id<"_storage">;
    }[] = [];
    for (const row of await ctx.db.query("news").collect()) {
      if (row.coverImageId) {
        pending.push({ table: "news", id: row._id, storageId: row.coverImageId });
      }
    }
    for (const table of ["managementStaff", "leadership", "executiveDirector"] as const) {
      for (const row of await ctx.db.query(table).collect()) {
        if (row.imageId) pending.push({ table, id: row._id, storageId: row.imageId });
      }
    }
    return pending;
  },
});

/** Points a row at its migrated Cloudinary photo and frees the storage file. */
export const applyMigratedImage = internalMutation({
  args: {
    table: v.union(v.literal("news"), imageTables),
    id: v.string(),
    publicId: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.table === "news") {
      const id = ctx.db.normalizeId("news", args.id);
      const row = id && (await ctx.db.get(id));
      if (!row?.coverImageId) return;
      const media = mediaFields(args.publicId, "news");
      await ctx.db.patch(row._id, {
        coverImageUrl: media.url,
        coverImagePublicId: media.publicId,
        coverImageId: undefined,
      });
      await ctx.storage.delete(row.coverImageId);
      return;
    }
    const folder: MediaFolder =
      args.table === "managementStaff"
        ? "staff"
        : args.table === "leadership"
          ? "leadership"
          : "executive-director";
    const id = ctx.db.normalizeId(args.table, args.id);
    const row = id && (await ctx.db.get(id));
    if (!row?.imageId) return;
    const media = mediaFields(args.publicId, folder);
    await ctx.db.patch(row._id, {
      imageUrl: media.url,
      imagePublicId: media.publicId,
      imageId: undefined,
    });
    await ctx.storage.delete(row.imageId);
  },
});

/** A page of article bodies, for moving inline base64 images to Cloudinary. */
export const bodiesPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("newsBodies")
      .paginate({ cursor: args.cursor, numItems: 2 });
    return {
      page: page.page
        .filter((b) => b.body.includes("data:image/"))
        .map((b) => ({ _id: b._id, body: b.body })),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const setMigratedBody = internalMutation({
  args: { id: v.id("newsBodies"), body: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      body: args.body,
      mediaPublicIds: publicIdsInHtml(args.body),
    });
  },
});
