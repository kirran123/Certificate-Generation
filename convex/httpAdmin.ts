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
