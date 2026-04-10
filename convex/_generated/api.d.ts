/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions from "../actions.js";
import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as deviceReports from "../deviceReports.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as lib_platformioScan from "../lib/platformioScan.js";
import type * as lib_r2 from "../lib/r2.js";
import type * as repoBranches from "../repoBranches.js";
import type * as repoBuildDownloads from "../repoBuildDownloads.js";
import type * as repoBuilds from "../repoBuilds.js";
import type * as repoScans from "../repoScans.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  admin: typeof admin;
  auth: typeof auth;
  deviceReports: typeof deviceReports;
  helpers: typeof helpers;
  http: typeof http;
  "lib/platformioScan": typeof lib_platformioScan;
  "lib/r2": typeof lib_r2;
  repoBranches: typeof repoBranches;
  repoBuildDownloads: typeof repoBuildDownloads;
  repoBuilds: typeof repoBuilds;
  repoScans: typeof repoScans;
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
