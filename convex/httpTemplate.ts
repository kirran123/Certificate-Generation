import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./httpAuth";
import { jsonResponse, errorResponse } from "./_utils/httpHelpers";

export const uploadImageHandler = httpAction(async (ctx, req) => {
  try {
    await requireAuth(ctx, req);
    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    if (!file) return errorResponse("No file uploaded", 400);
    const allowed = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowed.includes(file.type)) return errorResponse("Images only! (jpg, jpeg, png)", 400);
    const storageId = await ctx.storage.store(file);
    const imageUrl = await ctx.storage.getUrl(storageId);
    return jsonResponse({ imageUrl, storageId });
  } catch (e: any) { return errorResponse(e.message, e.status || 500); }
});

export const saveLayoutHandler = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    const body = (await req.json()) as any;
    const { name, imageUrl, imageStorageId, layoutConfig, showId, showQr, templateId } = body;

    let base64Data: string | undefined;
    if (!imageStorageId && imageUrl?.startsWith("http")) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(imageUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (resp.ok) {
          const arrayBuffer = await resp.arrayBuffer();
          base64Data = Buffer.from(arrayBuffer).toString("base64");
        }
      } catch (err: any) {
        console.warn("Failed to fetch legacy template image:", err.message);
      }
    }

    const templateData = {
      name: name || "Untitled Template",
      imageUrl: imageUrl || "",
      imageStorageId: imageStorageId || undefined,
      imageBase64: base64Data,
      layoutConfig,
      showId: showId !== undefined ? showId : true,
      showQr: showQr !== undefined ? showQr : true,
      createdBy: user._id,
    };

    let result;
    if (templateId) {
      result = await ctx.runMutation(internal.templates.update, { id: templateId, ...templateData });
    } else {
      const newId = await ctx.runMutation(internal.templates.create, templateData);
      result = await ctx.runQuery(internal.templates.findById, { id: newId });
    }
    return jsonResponse(result, 201);
  } catch (e: any) { return errorResponse(e.message, e.status || 500); }
});

export const getTemplateHandler = httpAction(async (ctx, req) => {
  try {
    await requireAuth(ctx, req);
    const id = new URL(req.url).pathname.split("/").pop() as any;
    const template = await ctx.runQuery(internal.templates.findById, { id });
    if (!template) return errorResponse("Template not found", 404);
    return jsonResponse(template);
  } catch (e: any) { return errorResponse(e.message, e.status || 500); }
});
