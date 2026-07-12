/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _utils_auth from "../_utils/auth.js";
import type * as _utils_email from "../_utils/email.js";
import type * as _utils_httpHelpers from "../_utils/httpHelpers.js";
import type * as _utils_pdfGenerator from "../_utils/pdfGenerator.js";
import type * as certificates from "../certificates.js";
import type * as crons from "../crons.js";
import type * as emailLogs from "../emailLogs.js";
import type * as feedback from "../feedback.js";
import type * as formAutomations from "../formAutomations.js";
import type * as formPoller from "../formPoller.js";
import type * as http from "../http.js";
import type * as httpAdmin from "../httpAdmin.js";
import type * as httpAuth from "../httpAuth.js";
import type * as httpCertificate from "../httpCertificate.js";
import type * as httpFeedback from "../httpFeedback.js";
import type * as httpTemplate from "../httpTemplate.js";
import type * as httpVerify from "../httpVerify.js";
import type * as migrations from "../migrations.js";
import type * as nodeActions from "../nodeActions.js";
import type * as seed from "../seed.js";
import type * as templates from "../templates.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_utils/auth": typeof _utils_auth;
  "_utils/email": typeof _utils_email;
  "_utils/httpHelpers": typeof _utils_httpHelpers;
  "_utils/pdfGenerator": typeof _utils_pdfGenerator;
  certificates: typeof certificates;
  crons: typeof crons;
  emailLogs: typeof emailLogs;
  feedback: typeof feedback;
  formAutomations: typeof formAutomations;
  formPoller: typeof formPoller;
  http: typeof http;
  httpAdmin: typeof httpAdmin;
  httpAuth: typeof httpAuth;
  httpCertificate: typeof httpCertificate;
  httpFeedback: typeof httpFeedback;
  httpTemplate: typeof httpTemplate;
  httpVerify: typeof httpVerify;
  migrations: typeof migrations;
  nodeActions: typeof nodeActions;
  seed: typeof seed;
  templates: typeof templates;
  users: typeof users;
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
