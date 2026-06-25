import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── News ───────────────────────────────────────────────────────────────────
  news: defineTable({
    title: v.string(),
    slug: v.string(),
    excerpt: v.string(),
    body: v.string(),
    coverImageUrl: v.optional(v.string()),
    coverImageId: v.optional(v.id("_storage")),
    category: v.optional(v.string()),
    author: v.optional(v.string()),
    featured: v.optional(v.boolean()),
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["category"])
    .index("by_featured", ["featured"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["category", "featured"],
    }),

  // ─── Management Staff ───────────────────────────────────────────────────────
  managementStaff: defineTable({
    name: v.string(),
    designation: v.string(),
    imageId: v.optional(v.id("_storage")),
    order: v.number(),
  }).index("by_order", ["order"]),

  // ─── Approved Movies ────────────────────────────────────────────────────────
  // Each "post" groups a monthly batch of approved films.
  approvedMovies: defineTable({
    title: v.string(),
    slug: v.string(),
    month: v.string(),
    author: v.string(),
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
  }).index("by_postId", ["postId"]),
});
