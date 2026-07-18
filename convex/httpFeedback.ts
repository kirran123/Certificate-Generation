import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./httpAuth";
import { jsonResponse, errorResponse } from "./_utils/httpHelpers";

export const feedbackTestHandler = httpAction(async () =>
  jsonResponse({ message: "Feedback Router is online and reachable" })
);

export const submitFeedbackHandler = httpAction(async (ctx, req) => {
  try {
    const { name, email, message, certificateId, type } = (await req.json()) as any;
    if (!name || !message) return errorResponse("Name and message are required", 400);
    await ctx.runMutation(internal.feedback.create, {
      name, email, type: type || "Suggestion", message, certificateId,
    });
    return jsonResponse({ message: "Feedback submitted successfully" });
  } catch (e: any) { return errorResponse(e.message); }
});

export const getFeedbackHandler = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    if (user.role !== "admin") return errorResponse("Access denied", 403);
    const feedbacks = await ctx.runQuery(internal.feedback.listAll, {});
    return jsonResponse(feedbacks);
  } catch (e: any) { return errorResponse(e.message, e.status || 500); }
});

export const deleteFeedbackHandler = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    if (user.role !== "admin") return errorResponse("Access denied", 403);
    const id = new URL(req.url).pathname.split("/").pop() as any;
    await ctx.runMutation(internal.feedback.remove, { id });
    return jsonResponse({ message: "Feedback deleted" });
  } catch (e: any) { return errorResponse(e.message, e.status || 500); }
});
