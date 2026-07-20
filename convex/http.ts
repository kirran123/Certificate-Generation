// http.ts — HTTP router for Convex HTTP Actions
// NO "use node" directive — this file must run in V8.
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Auth
import { signupHandler, loginHandler, meHandler } from "./httpAuth";

// Admin
import {
  getUsersHandler,
  deleteUserHandler,
  getAdminCertificatesHandler,
  deleteAdminCertificateHandler,
  getEmailLogsHandler,
  cleanupDbHandler,
  getAdminStatsHandler,
} from "./httpAdmin";

// Template
import { uploadImageHandler, saveLayoutHandler, getTemplateHandler } from "./httpTemplate";

// Certificate
import {
  uploadData,
  uploadSheet,
  preview,
  generate,
  sendBulk,
  downloadCert,
  downloadBulk,
  myGenerations,
  updateBatchEmails,
  deleteCert,
  deleteBatchSecure,
  resendBatch,
  createAutomation,
  listAutomations,
  toggleAutomation,
  deleteAutomation,
  myCertificatesHandler,
  cleanupAutomations,
  userStatsHandler,
} from "./httpCertificate";

// Verify
import { verifyCertHandler } from "./httpVerify";

// Feedback
import {
  feedbackTestHandler,
  submitFeedbackHandler,
  getFeedbackHandler,
  deleteFeedbackHandler,
} from "./httpFeedback";

const http = httpRouter();

/**
 * Helper wrapper to automatically attach CORS headers to all HTTP Action responses.
 * This guarantees preflights and actual requests work with any client origin,
 * resolving wildcard CORS and authorization header issues.
 */
function withCors(handler: any) {
  return httpAction(async (ctx, req) => {
    try {
      const response = await handler(ctx, req);
      const origin = req.headers.get("origin") || "*";

      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", origin);
      newHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      newHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      newHeaders.set("Access-Control-Allow-Credentials", "true");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (err: any) {
      const origin = req.headers.get("origin") || "*";
      return new Response(JSON.stringify({ message: err.message || "Internal error" }), {
        status: err.status || 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }
  });
}

// ── Auth ──────────────────────────────────────────────────────────────────
http.route({ path: "/api/auth/signup", method: "POST", handler: withCors(signupHandler) });
http.route({ path: "/api/auth/login",  method: "POST", handler: withCors(loginHandler) });
http.route({ path: "/api/auth/me",     method: "GET",  handler: withCors(meHandler) });

// ── Admin ─────────────────────────────────────────────────────────────────
http.route({ path: "/api/admin/users",               method: "GET",    handler: withCors(getUsersHandler) });
http.route({ pathPrefix: "/api/admin/users/",        method: "DELETE", handler: withCors(deleteUserHandler) });
http.route({ path: "/api/admin/certificates",        method: "GET",    handler: withCors(getAdminCertificatesHandler) });
http.route({ pathPrefix: "/api/admin/certificates/", method: "DELETE", handler: withCors(deleteAdminCertificateHandler) });
http.route({ path: "/api/admin/emaillogs",           method: "GET",    handler: withCors(getEmailLogsHandler) });
http.route({ path: "/api/admin/cleanup-db",          method: "POST",   handler: withCors(cleanupDbHandler) });
http.route({ path: "/api/admin/stats",               method: "GET",    handler: withCors(getAdminStatsHandler) });

// ── Template ──────────────────────────────────────────────────────────────
http.route({ path: "/api/template/upload-image", method: "POST", handler: withCors(uploadImageHandler) });
http.route({ path: "/api/template/save-layout",  method: "POST", handler: withCors(saveLayoutHandler) });
http.route({ pathPrefix: "/api/template/",       method: "GET",  handler: withCors(getTemplateHandler) });

// ── Certificate ───────────────────────────────────────────────────────────
http.route({ path: "/api/certificate/upload-data",         method: "POST",   handler: withCors(uploadData) });
http.route({ path: "/api/certificate/upload-sheet",        method: "POST",   handler: withCors(uploadSheet) });
http.route({ path: "/api/certificate/preview",             method: "POST",   handler: withCors(preview) });
http.route({ path: "/api/certificate/generate",            method: "POST",   handler: withCors(generate) });
http.route({ path: "/api/certificate/send-bulk",           method: "POST",   handler: withCors(sendBulk) });
http.route({ path: "/api/certificate/my-generations",      method: "GET",    handler: withCors(myGenerations) });
http.route({ path: "/api/certificate/update-batch-emails", method: "POST",   handler: withCors(updateBatchEmails) });
http.route({ path: "/api/certificate/delete-batch-secure", method: "POST",   handler: withCors(deleteBatchSecure) });
http.route({ path: "/api/certificate/download-bulk",       method: "GET",    handler: withCors(downloadBulk) });
http.route({ path: "/api/certificate/form-automation",     method: "POST",   handler: withCors(createAutomation) });
http.route({ path: "/api/certificate/form-automations",    method: "GET",    handler: withCors(listAutomations) });
http.route({ pathPrefix: "/api/certificate/download/",           method: "GET",    handler: withCors(downloadCert) });
http.route({ pathPrefix: "/api/certificate/delete-certificate/",  method: "DELETE", handler: withCors(deleteCert) });
http.route({ pathPrefix: "/api/certificate/resend-batch/",       method: "POST",   handler: withCors(resendBatch) });
http.route({ pathPrefix: "/api/certificate/form-automation/",    method: "PATCH",  handler: withCors(toggleAutomation) });
http.route({ pathPrefix: "/api/certificate/form-automation/",    method: "DELETE", handler: withCors(deleteAutomation) });
http.route({ path: "/api/certificate/form-automations/cleanup",  method: "DELETE", handler: withCors(cleanupAutomations) });

// ── User Certificates ─────────────────────────────────────────────────────
http.route({ path: "/api/user/my-certificates", method: "GET", handler: withCors(myCertificatesHandler) });
http.route({ path: "/api/user/stats",           method: "GET", handler: withCors(userStatsHandler) });

// ── Verify (public) ───────────────────────────────────────────────────────
http.route({ pathPrefix: "/api/verify/", method: "GET", handler: withCors(verifyCertHandler) });

// ── Feedback ──────────────────────────────────────────────────────────────
http.route({ path: "/api/user-feedback/test",         method: "GET",    handler: withCors(feedbackTestHandler) });
http.route({ path: "/api/user-feedback",              method: "POST",   handler: withCors(submitFeedbackHandler) });
http.route({ path: "/api/user-feedback/admin",        method: "GET",    handler: withCors(getFeedbackHandler) });
http.route({ pathPrefix: "/api/user-feedback/admin/", method: "DELETE", handler: withCors(deleteFeedbackHandler) });

// ── Temporary public cleanup endpoint ─────────────────────────────────────
http.route({
  path: "/api/cleanup-db-public",
  method: "GET",
  handler: withCors(httpAction(async (ctx, req) => {
    try {
      let cursor = undefined;
      let isDone = false;
      let totalUpdated = 0;

      while (!isDone) {
        const res: any = await ctx.runMutation(internal.migrations.splitBatch, {
          cursor,
          limit: 10,
        });
        cursor = res.continueCursor;
        isDone = res.isDone;
        totalUpdated += res.updated;
      }

      return new Response(JSON.stringify({ success: true, message: `Successfully cleaned up ${totalUpdated} templates` }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }))
});

// ── CORS preflight ────────────────────────────────────────────────────────
http.route({
  pathPrefix: "/api/",
  method: "OPTIONS",
  handler: httpAction(async (ctx, req) => {
    const origin = req.headers.get("origin") || "*";
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
      },
    });
  }),
});

export default http;
