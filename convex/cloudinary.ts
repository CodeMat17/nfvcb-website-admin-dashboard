"use node";

import { createHash, randomBytes } from "node:crypto";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { MEDIA_FOLDERS, ROOT_FOLDER, deliveryUrl, type MediaFolder } from "./lib/media";

// Requires these environment variables on the Convex deployment
// (Dashboard → Settings → Environment Variables, or `npx convex env set`):
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

function config() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary environment variables are not set on the Convex deployment.");
  }
  return { cloudName, apiKey, apiSecret };
}

// https://cloudinary.com/documentation/authentication_signatures
function sign(params: Record<string, string | number>, apiSecret: string) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(payload + apiSecret).digest("hex");
}

// Explicit public IDs (rather than the `folder` param) behave the same in
// fixed- and dynamic-folder Cloudinary accounts.
function newPublicId(folder: MediaFolder) {
  return `${ROOT_FOLDER}/${folder}/${randomBytes(10).toString("hex")}`;
}

const folderArg = v.union(...MEDIA_FOLDERS.map((f) => v.literal(f)));

/** Signs a direct browser → Cloudinary upload of one new image. */
export const signUpload = action({
  args: { folder: folderArg },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const { cloudName, apiKey, apiSecret } = config();
    const publicId = newPublicId(args.folder);
    const timestamp = Math.floor(Date.now() / 1000);
    return {
      cloudName,
      apiKey,
      publicId,
      timestamp,
      signature: sign({ public_id: publicId, timestamp }, apiSecret),
    };
  },
});

export const deleteMedia = internalAction({
  args: { publicIds: v.array(v.string()) },
  handler: async (_ctx, args) => {
    const { cloudName, apiKey, apiSecret } = config();
    for (const publicId of args.publicIds) {
      const timestamp = Math.floor(Date.now() / 1000);
      const params = { invalidate: "true", public_id: publicId, timestamp };
      const body = new URLSearchParams({
        ...Object.fromEntries(Object.entries(params).map(([k, val]) => [k, String(val)])),
        api_key: apiKey,
        signature: sign(params, apiSecret),
      });
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
        { method: "POST", body }
      );
      if (!res.ok) {
        console.error(`Cloudinary delete failed for ${publicId}: ${await res.text()}`);
      }
    }
  },
});

/** Server-side upload from a URL or data URI (used by the migrations). */
async function uploadFromSource(source: string, folder: MediaFolder) {
  const { cloudName, apiKey, apiSecret } = config();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id: newPublicId(folder), timestamp };
  const body = new URLSearchParams({
    file: source,
    public_id: params.public_id,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature: sign(params, apiSecret),
  });
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body,
  });
  if (!res.ok) throw new Error(`Cloudinary upload failed: ${await res.text()}`);
  const data = (await res.json()) as { public_id: string };
  return data.public_id;
}

// ─── Migrations ──────────────────────────────────────────────────────────────

const TABLE_FOLDER: Record<string, MediaFolder> = {
  news: "news",
  managementStaff: "staff",
  leadership: "leadership",
  executiveDirector: "executive-director",
};

/**
 * One-off: copies every cover/profile photo from Convex file storage to
 * Cloudinary, repoints the row and deletes the storage file.
 * Run with: npx convex run cloudinary:migrateStorageImages
 */
export const migrateStorageImages = internalAction({
  args: {},
  handler: async (ctx): Promise<string> => {
    const pending = await ctx.runQuery(internal.media.pendingStorageImages, {});
    let moved = 0;
    for (const item of pending) {
      const url = await ctx.storage.getUrl(item.storageId);
      if (!url) continue;
      try {
        const publicId = await uploadFromSource(url, TABLE_FOLDER[item.table]);
        await ctx.runMutation(internal.media.applyMigratedImage, {
          table: item.table,
          id: item.id,
          publicId,
        });
        moved++;
      } catch (err) {
        console.error(`Could not migrate ${item.table} ${item.id}:`, err);
      }
    }
    return `Moved ${moved} of ${pending.length} images.`;
  },
});

/**
 * One-off: uploads base64 images embedded in article bodies to Cloudinary and
 * swaps in their URLs. Run AFTER news:migrateBodies has finished, with:
 *   npx convex run cloudinary:migrateInlineImages
 */
export const migrateInlineImages = internalAction({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args): Promise<void> => {
    const page = await ctx.runQuery(internal.media.bodiesPage, {
      cursor: args.cursor ?? null,
    });
    for (const doc of page.page) {
      let body = doc.body;
      const dataUris = new Set(
        [...body.matchAll(/src=["'](data:image\/[^"']+)["']/g)].map((m) => m[1])
      );
      for (const dataUri of dataUris) {
        try {
          const publicId = await uploadFromSource(dataUri, "news");
          body = body.split(dataUri).join(deliveryUrl(publicId));
        } catch (err) {
          console.error(`Could not migrate an inline image in ${doc._id}:`, err);
        }
      }
      if (body !== doc.body) {
        await ctx.runMutation(internal.media.setMigratedBody, { id: doc._id, body });
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.cloudinary.migrateInlineImages, {
        cursor: page.continueCursor,
      });
    }
  },
});
