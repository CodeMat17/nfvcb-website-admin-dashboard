/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as approvedMovies from "../approvedMovies.js";
import type * as cloudinary from "../cloudinary.js";
import type * as events from "../events.js";
import type * as executiveDirector from "../executiveDirector.js";
import type * as leadership from "../leadership.js";
import type * as lib_media from "../lib/media.js";
import type * as lib_site from "../lib/site.js";
import type * as managementStaff from "../managementStaff.js";
import type * as media from "../media.js";
import type * as news from "../news.js";
import type * as nfvcbPicks from "../nfvcbPicks.js";
import type * as site from "../site.js";
import type * as storage from "../storage.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  approvedMovies: typeof approvedMovies;
  cloudinary: typeof cloudinary;
  events: typeof events;
  executiveDirector: typeof executiveDirector;
  leadership: typeof leadership;
  "lib/media": typeof lib_media;
  "lib/site": typeof lib_site;
  managementStaff: typeof managementStaff;
  media: typeof media;
  news: typeof news;
  nfvcbPicks: typeof nfvcbPicks;
  site: typeof site;
  storage: typeof storage;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
