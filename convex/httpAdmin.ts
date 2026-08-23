import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./httpAuth";
import { jsonResponse, errorResponse } from "./_utils/httpHelpers";

export const getUsersHandler = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    if (user.role !== "admin") return errorResponse("Forbidden", 403);
    const users = await ctx.runQuery(internal.users.listAll, {});
    const safeUsers = users.map(({ passwordHash, ...u }: any) => u);
    return jsonResponse(safeUsers);
  } catch (e: any) { return errorResponse(e.message, e.status || 500); }
});

export const deleteUserHandler = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    if (user.role !== "admin") return errorResponse("Forbidden", 403);
    const id = new URL(req.url).pathname.split("/").pop() as any;
    const target = await ctx.runQuery(internal.users.findById, { id });
    if (!target) return errorResponse("User not found", 404);
    if (target.role === "admin") return errorResponse("Cannot delete the admin account", 400);
    await ctx.runMutation(internal.users.remove, { id });
    return jsonResponse({ message: "User removed" });
  } catch (e: any) { return errorResponse(e.message, e.status || 500); }
});

export const getAdminCertificatesHandler = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    if (user.role !== "admin") return errorResponse("Forbidden", 403);
    const certs = await ctx.runQuery(internal.certificates.listAll, {});
    return jsonResponse(certs);
  } catch (e: any) { return errorResponse(e.message, e.status || 500); }
});

export const deleteAdminCertificateHandler = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    if (user.role !== "admin") return errorResponse("Forbidden", 403);
    const id = new URL(req.url).pathname.split("/").pop() as any;
    await ctx.runMutation(internal.certificates.remove, { id });
    return jsonResponse({ message: "Certificate removed" });
  } catch (e: any) { return errorResponse(e.message, e.status || 500); }
});

export const getEmailLogsHandler = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    if (user.role !== "admin") return errorResponse("Forbidden", 403);
    const logs = await ctx.runQuery(internal.emailLogs.listAll, {});
    return jsonResponse(logs);
  } catch (e: any) { return errorResponse(e.message, e.status || 500); }
});

export const cleanupDbHandler = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    if (user.role !== "admin") return errorResponse("Forbidden", 403);

    let cursor = undefined;
    let isDone = false;
    let totalUpdated = 0;

    while (!isDone) {
      const res: any = await ctx.runMutation(internal.migrations.splitBatch, {
        cursor,
        limit: 5,
      });
      cursor = res.continueCursor;
      isDone = res.isDone;
      totalUpdated += res.updated;
      if (!isDone) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return jsonResponse({ message: `Successfully cleaned up ${totalUpdated} templates` });
  } catch (e: any) {
    return errorResponse(e.message, e.status || 500);
  }
});

export const getAdminStatsHandler = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    if (user.role !== "admin") return errorResponse("Forbidden", 403);
    
    const certStats = await ctx.runQuery(internal.certificates.getStats, {});
    const logs = await ctx.runQuery(internal.emailLogs.listAll, {});
    const recentLogs = logs.slice(0, 20);
    const feedbacks = await ctx.runQuery(internal.feedback.listAll, {});
    const recentFeedbacks = feedbacks.slice(0, 8);

    return jsonResponse({
      ...certStats,
      recentLogs,
      recentFeedbacks,
    });
  } catch (e: any) { return errorResponse(e.message, e.status || 500); }
});

export const getBrevoStatusHandler = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    if (user.role !== "admin") return errorResponse("Forbidden", 403);
    const status = await ctx.runAction(internal.nodeActions.getBrevoPoolStatusAction, {});
    return jsonResponse(status);
  } catch (e: any) { return errorResponse(e.message, e.status || 500); }
});
