import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, errorResponse } from "./_utils/httpHelpers";

export const verifyCertHandler = httpAction(async (ctx, req) => {
  try {
    const certId = new URL(req.url).pathname.split("/").pop()!;
    const cert = await ctx.runQuery(internal.certificates.findByCertId, { certificateId: certId });
    if (!cert) return jsonResponse({ valid: false, message: "Certificate not found or invalid" }, 404);
    const template = cert.templateId ? await ctx.runQuery(internal.templates.findMetadataById, { id: cert.templateId }) : null;
    return jsonResponse({
      valid: true,
      certificate: {
        certificateId: cert.certificateId,
        name: cert.name,
        course: cert.course,
        date: cert._creationTime,
        templateName: (template as any)?.name,
        status: cert.status,
        pdfUrl: `/api/certificate/download/${cert.certificateId}`,
      },
    });
  } catch (e: any) { return errorResponse(e.message); }
});
