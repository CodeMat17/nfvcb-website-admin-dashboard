import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// A line in the Executive Director's CV (education, career, awards, …).
export const profileEntry = v.object({
  title: v.string(),
  org: v.string(),
  note: v.optional(v.string()),
});

export default defineSchema({
  // ─── News ───────────────────────────────────────────────────────────────────
  news: defineTable({
    title: v.string(),
    slug: v.string(),
    excerpt: v.string(),
    // Legacy: bodies now live in `newsBodies` so list queries don't read them.
    // Cleared by `news.migrateBodies`; remove once every row is migrated.
    body: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    // Cloudinary asset behind coverImageUrl.
    coverImagePublicId: v.optional(v.string()),
    // Legacy Convex storage file; moved by cloudinary:migrateStorageImages.
    coverImageId: v.optional(v.id("_storage")),
    category: v.optional(v.string()),
    author: v.optional(v.string()),
    featured: v.optional(v.boolean()),
    publishedAt: v.optional(v.string()),
    publish: v.optional(v.boolean()),
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["category"])
    .index("by_featured", ["featured"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["category", "featured"],
    }),

  // Article bodies are kept apart from `news` because they can be large
  // (inline images), and every list query would otherwise read them in full.
  newsBodies: defineTable({
    newsId: v.id("news"),
    body: v.string(),
    // Cloudinary images referenced in the body, so removed ones get deleted.
    mediaPublicIds: v.optional(v.array(v.string())),
  }).index("by_newsId", ["newsId"]),

  // ─── Management Staff ───────────────────────────────────────────────────────
  managementStaff: defineTable({
    name: v.string(),
    designation: v.string(),
    // Cloudinary photo; imageId is the legacy Convex storage file.
    imageUrl: v.optional(v.string()),
    imagePublicId: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    order: v.number(),
    // Seniority rank: 1 = most senior. Lower numbers are listed first.
    seniority: v.optional(v.number()),
  })
    .index("by_order", ["order"])
    .index("by_seniority", ["seniority"]),

  // ─── Supervisory Leadership ─────────────────────────────────────────────────
  // Federal Government tier shown above the Executive Director on the site.
  leadership: defineTable({
    name: v.string(),
    role: v.string(),
    office: v.string(),
    // Cloudinary photo; imageId is the legacy Convex storage file.
    imageUrl: v.optional(v.string()),
    imagePublicId: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    order: v.number(),
    // 1 = listed first.
    seniority: v.number(),
  }).index("by_seniority", ["seniority"]),

  // ─── Executive Director ─────────────────────────────────────────────────────
  // Single document holding the Executive Director's full profile.
  executiveDirector: defineTable({
    name: v.string(),
    shortName: v.string(),
    role: v.string(),
    office: v.string(),
    postNominals: v.string(),
    // Cloudinary photo; imageId is the legacy Convex storage file.
    imageUrl: v.optional(v.string()),
    imagePublicId: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    email: v.string(),
    headOffice: v.string(),
    highlights: v.array(v.string()),
    appointment: v.array(v.object({ label: v.string(), value: v.string() })),
    vision: v.string(),
    bio: v.array(v.string()),
    expertise: v.array(v.string()),
    achievements: v.array(v.object({ title: v.string(), body: v.string() })),
    education: v.array(profileEntry),
    career: v.array(profileEntry),
    industryRoles: v.array(profileEntry),
    programmes: v.array(profileEntry),
    awards: v.array(profileEntry),
    publications: v.array(profileEntry),
    quotes: v.array(v.object({ text: v.string(), context: v.string() })),
    foreword: v.string(),
  }),

  // ─── Approved Movies ────────────────────────────────────────────────────────
  // Each "post" groups a monthly batch of approved films.
  approvedMovies: defineTable({
    title: v.string(),
    slug: v.string(),
    month: v.string(),
    author: v.string(),
    date: v.optional(v.string()),
    // Denormalised from approvedMovieItems so listings don't read every film.
    movieCount: v.optional(v.number()),
    ratingCounts: v.optional(
      v.array(v.object({ rating: v.string(), count: v.number() }))
    ),
  }).index("by_slug", ["slug"]),

  // Individual films stored separately to avoid the 1 MB document limit.
  approvedMovieItems: defineTable({
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
  })
    .index("by_postId", ["postId"])
    .index("by_featured", ["featured"]),
});
