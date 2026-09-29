import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// ─── Cloudinary media helpers ────────────────────────────────────────────────
// Photos live in Cloudinary; Convex stores only each asset's public ID and
// delivery URL. Uploads are signed by `cloudinary.signUpload` and deletions go
// through `cloudinary.deleteMedia`, so the API secret stays on the backend.

export const MEDIA_FOLDERS = [
  "news",
  "staff",
  "leadership",
  "executive-director",
] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

export const ROOT_FOLDER = "nfvcb";

const PUBLIC_ID_RE = /^nfvcb\/[a-z-]+\/[A-Za-z0-9_-]+$/;

function cloudName(): string {
  const name = process.env.CLOUDINARY_CLOUD_NAME;
  if (!name) throw new Error("CLOUDINARY_CLOUD_NAME is not set on the Convex deployment.");
  return name;
}

/** Validates an uploaded asset's public ID and returns its fields to store. */
export function mediaFields(publicId: string, folder: MediaFolder) {
  if (!PUBLIC_ID_RE.test(publicId) || !publicId.startsWith(`${ROOT_FOLDER}/${folder}/`)) {
    throw new Error("Invalid image reference.");
  }
  return { publicId, url: deliveryUrl(publicId) };
}

/** Auto format + quality keeps delivered bytes (and Cloudinary credits) low. */
export function deliveryUrl(publicId: string): string {
  return `https://res.cloudinary.com/${cloudName()}/image/upload/f_auto,q_auto/${publicId}`;
}

/** Public IDs of this app's Cloudinary images referenced in article HTML. */
export function publicIdsInHtml(html: string): string[] {
  const ids = new Set<string>();
  const re = /res\.cloudinary\.com\/[^/]+\/image\/upload\/[^"'\s]*?(nfvcb\/[a-z-]+\/[A-Za-z0-9_-]+)/g;
  for (const match of html.matchAll(re)) ids.add(match[1]);
  return [...ids];
}

/** Deletes assets from Cloudinary after the current mutation commits. */
export async function deleteMediaLater(
  ctx: MutationCtx,
  publicIds: (string | undefined)[]
) {
  const ids = publicIds.filter((id): id is string => !!id);
  if (ids.length === 0) return;
  await ctx.scheduler.runAfter(0, internal.cloudinary.deleteMedia, { publicIds: ids });
}

/** Deletes a profile row's current photo, whether in Cloudinary or legacy storage. */
export async function deleteProfileImage(
  ctx: MutationCtx,
  row: { imageId?: Id<"_storage">; imagePublicId?: string }
) {
  if (row.imageId) {
    try {
      await ctx.storage.delete(row.imageId);
    } catch {
      /* already gone */
    }
  }
  await deleteMediaLater(ctx, [row.imagePublicId]);
}
