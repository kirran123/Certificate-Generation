import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./httpAuth";
import { jsonResponse, errorResponse } from "./_utils/httpHelpers";
import { buildCertEmailHtml } from "./_utils/email";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// ── Helpers ───────────────────────────────────────────────────────────────
function generateCertId(): string {
  return `CERT${Math.floor(100000 + Math.random() * 900000)}`;
}

async function calculateUniqueHash(templateId: string, name: string, email: string, batchId: string): Promise<string> {
  const msg = `${templateId}_${name}_${email}_${batchId}`;
  const msgBuffer = new TextEncoder().encode(msg);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getTemplateBytesBase64(ctx: any, template: any): Promise<string> {
  if (template.imageStorageId) {
    const blob = await ctx.storage.get(template.imageStorageId);
    if (blob) {
      const buffer = await blob.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }
  }
  const fullTemplate = await ctx.runQuery(internal.templates.findById, { id: template._id });
  if (fullTemplate?.imageBase64) return fullTemplate.imageBase64;

  if (template.imageBase64) return template.imageBase64;
  if (template.imageUrl?.startsWith("http")) {
    const resp = await fetch(template.imageUrl);
    if (resp.ok) {
      const buffer = await resp.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }
  }
  throw new Error("No template image available.");
}

// ── Parse Excel ───────────────────────────────────────────────────────────
const uploadData = httpAction(async (ctx, req) => {
  try {
    await requireAuth(ctx, req);
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return errorResponse("No file uploaded", 400);
    const buffer = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);
    const result = await ctx.runAction(internal.nodeActions.parseExcel, { base64Data });
    return jsonResponse(result);
  } catch (e: any) {
    return errorResponse(e.message);
  }
});

// ── Import Google Sheet ───────────────────────────────────────────────────
const uploadSheet = httpAction(async (ctx, req) => {
  try {
    await requireAuth(ctx, req);
    const { sheetUrl } = await req.json();
    if (!sheetUrl) return errorResponse("No Google Sheet URL provided.", 400);
    const result = await ctx.runAction(internal.nodeActions.parseGoogleSheet, { sheetUrl });
    return jsonResponse(result);
  } catch (e: any) {
    return errorResponse(e.message);
  }
});

// ── Preview certificate ───────────────────────────────────────────────────
const preview = httpAction(async (ctx, req) => {
  try {
    await requireAuth(ctx, req);
    const { templateId, sampleData, layoutConfig, imageUrl, showId, showQr } = await req.json();

    let template: any;
    if (imageUrl && layoutConfig) {
      template = { imageUrl, layoutConfig: layoutConfig.fields || [], qrCode: layoutConfig.qrCode, showId, showQr };
    } else if (templateId) {
      template = await ctx.runQuery(internal.templates.findById, { id: templateId });
      if (!template) return errorResponse("Template not found", 404);
      if (layoutConfig) template = { ...template, layoutConfig };
    }
    if (!template) return errorResponse("No template image detected.", 400);

    const templateBase64 = await getTemplateBytesBase64(ctx, template);
    const pdfBase64 = await ctx.runAction(internal.nodeActions.generatePdf, {
      templateBase64,
      layoutConfig: template.layoutConfig,
      qrCode: template.qrCode,
      showId: template.showId,
      showQr: template.showQr,
      data: sampleData || {},
      certId: "CERT000000",
      frontendUrl: FRONTEND_URL,
    });

    const pdfBytes = new Uint8Array(
      atob(pdfBase64)
        .split("")
        .map((c) => c.charCodeAt(0))
    );

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
      },
    });
  } catch (e: any) {
    return errorResponse("CRITICAL: " + e.message);
  }
});

// ── Generate certificates ─────────────────────────────────────────────────
const generate = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    const body = await req.json();
    const { templateId, mappings, rawData, showId, showQr, layoutConfig, batchId: bodyBatchId } = body;

    if (!rawData?.length) return errorResponse("No data provided for generation", 400);

    const template = await ctx.runQuery(internal.templates.findById, { id: templateId });
    if (!template) return errorResponse("Template not found", 404);

    const templateBase64 = await getTemplateBytesBase64(ctx, template);
    const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const batchId = bodyBatchId || `Batch ${timestamp}`;

    let generatedCount = 0, skippedCount = 0;
    const generatedIds: string[] = [];

    for (const row of rawData) {
      const itemData: Record<string, any> = { ...row };
      Object.keys(mappings || {}).forEach((key) => {
        let value = row[mappings[key]] || "";
        if (key === "email" && typeof value === "string") value = value.trim().toLowerCase();
        itemData[key] = value;
      });
      if (!itemData.name) itemData.name = "Unknown Recipient";

      const uniqueHash = await calculateUniqueHash(template._id, itemData.name, itemData.email || "", batchId);
      const existing = await ctx.runQuery(internal.certificates.findByHash, { uniqueHash });
      if (existing) { skippedCount++; continue; }

      let certId = generateCertId();
      while (await ctx.runQuery(internal.certificates.findByCertId, { certificateId: certId })) {
        certId = generateCertId();
      }
      itemData.certificateId = certId;

      try {
        // Validate generation
        await ctx.runAction(internal.nodeActions.generatePdf, {
          templateBase64,
          layoutConfig: layoutConfig || template.layoutConfig,
          qrCode: template.qrCode,
          showId: showId !== undefined ? showId : template.showId,
          showQr: showQr !== undefined ? showQr : template.showQr,
          data: itemData,
          certId,
          frontendUrl: FRONTEND_URL,
        });

        await ctx.runMutation(internal.certificates.create, {
          certificateId: certId,
          name: String(itemData.name),
          email: String(itemData.email || ""),
          course: String(itemData.course || body.subject || "Achievement"),
          templateId: template._id,
          status: "Pending",
          createdBy: user._id,
          batchId,
          uniqueHash,
          metadata: row,
        });
        generatedIds.push(certId);
        generatedCount++;
      } catch (err: any) {
        console.error("Failed to generate certificate:", err.message);
      }
    }

    return jsonResponse({ message: `Success: ${generatedCount} generated.`, generatedCount, skippedCount, generatedIds, batchId });
  } catch (e: any) {
    return errorResponse(e.message);
  }
});

// ── Send bulk emails ──────────────────────────────────────────────────────
const sendBulk = httpAction(async (ctx, req) => {
  try {
    await requireAuth(ctx, req);
    const { certificateIds, subject, message, senderName, senderEmail } = await req.json();

    const certs = await ctx.runQuery(internal.certificates.listByIds, { certificateIds });
    let sentCount = 0;

    for (const cert of certs) {
      if (!cert.email) continue;
      const template = await ctx.runQuery(internal.templates.findById, { id: cert.templateId });
      if (!template) continue;

      try {
        const templateBase64 = await getTemplateBytesBase64(ctx, template);
        const itemData = { name: cert.name, email: cert.email, course: cert.course, certificateId: cert.certificateId, ...(cert.metadata || {}) };
        const pdfBase64 = await ctx.runAction(internal.nodeActions.generatePdf, {
          templateBase64,
          layoutConfig: template.layoutConfig,
          qrCode: template.qrCode,
          showId: template.showId,
          showQr: template.showQr,
          data: itemData,
          certId: cert.certificateId,
          frontendUrl: FRONTEND_URL,
        });

        const html = buildCertEmailHtml(cert.name, cert.certificateId, message || "Congratulations! Your certificate is attached.", senderName || "DigiCertify");

        await ctx.runAction(internal.nodeActions.sendEmail, {
          to: cert.email,
          name: cert.name,
          subject: subject || "Your Certificate of Achievement",
          htmlContent: html,
          pdfBase64,
          certId: cert.certificateId,
          senderName,
          senderEmail,
        });

        await ctx.runMutation(internal.certificates.updateStatus, { id: cert._id, status: "Sent" });
        await ctx.runMutation(internal.emailLogs.create, { certificateId: cert.certificateId, recipient: cert.email, status: "Sent" });
        sentCount++;
      } catch (err: any) {
        await ctx.runMutation(internal.certificates.updateStatus, { id: cert._id, status: "Failed" });
        await ctx.runMutation(internal.emailLogs.create, { certificateId: cert.certificateId, recipient: cert.email, status: "Failed", error: err.message });
      }
    }

    return jsonResponse({ message: `Successfully sent ${sentCount} emails.` });
  } catch (e: any) {
    return errorResponse(e.message);
  }
});

// ── Download single certificate ───────────────────────────────────────────
const downloadCert = httpAction(async (ctx, req) => {
  try {
    const url = new URL(req.url);
    const certId = url.pathname.split("/").pop()!;
    const cert = await ctx.runQuery(internal.certificates.findByCertId, { certificateId: certId });
    if (!cert) return errorResponse("Certificate not found.", 404);

    const template = await ctx.runQuery(internal.templates.findById, { id: cert.templateId });
    if (!template) return errorResponse("Template not found.", 404);

    const templateBase64 = await getTemplateBytesBase64(ctx, template);
    const itemData = { name: cert.name, email: cert.email, course: cert.course, certificateId: cert.certificateId, ...(cert.metadata || {}) };
    const pdfBase64 = await ctx.runAction(internal.nodeActions.generatePdf, {
      templateBase64,
      layoutConfig: template.layoutConfig,
      qrCode: template.qrCode,
      showId: template.showId,
      showQr: template.showQr,
      data: itemData,
      certId: cert.certificateId,
      frontendUrl: FRONTEND_URL,
    });

    const pdfBytes = new Uint8Array(
      atob(pdfBase64)
        .split("")
        .map((c) => c.charCodeAt(0))
    );

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${cert.certificateId}.pdf"`,
        "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
      },
    });
  } catch (e: any) {
    return errorResponse(e.message);
  }
});

// ── Download bulk as ZIP ──────────────────────────────────────────────────
const downloadBulk = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    const url = new URL(req.url);
    const batchIdParam = url.searchParams.get("batchId");

    let certs;
    if (batchIdParam) {
      certs = await ctx.runQuery(internal.certificates.listByBatchId, { batchId: batchIdParam });
      if (user.role !== "admin") {
        certs = certs.filter((c: any) => c.createdBy === user._id);
      }
    } else {
      certs = user.role === "admin"
        ? await ctx.runQuery(internal.certificates.listAll, {})
        : await ctx.runQuery(internal.certificates.listForUser, { userId: user._id });
    }

    if (!certs.length) return errorResponse("No certificates found", 404);

    const certPayloads: any[] = [];
    for (const cert of certs) {
      try {
        const template = await ctx.runQuery(internal.templates.findById, { id: cert.templateId });
        if (!template) continue;
        const templateBase64 = await getTemplateBytesBase64(ctx, template);
        const itemData = { name: cert.name, email: cert.email, course: cert.course, certificateId: cert.certificateId, ...(cert.metadata || {}) };
        const pdfBase64 = await ctx.runAction(internal.nodeActions.generatePdf, {
          templateBase64,
          layoutConfig: template.layoutConfig,
          qrCode: template.qrCode,
          showId: template.showId,
          showQr: template.showQr,
          data: itemData,
          certId: cert.certificateId,
          frontendUrl: FRONTEND_URL,
        });
        certPayloads.push({
          certId: cert.certificateId,
          batchId: cert.batchId,
          pdfBase64,
        });
      } catch (e) { /* skip */ }
    }

    const zipBase64 = await ctx.runAction(internal.nodeActions.createBulkZip, { certs: certPayloads });
    const zipBytes = new Uint8Array(
      atob(zipBase64)
        .split("")
        .map((c) => c.charCodeAt(0))
    );

    const safeFilename = batchIdParam 
      ? `${batchIdParam.replace(/[\s\/:*?"<>|]/g, "_")}.zip` 
      : "certificates.zip";

    return new Response(zipBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
      },
    });
  } catch (e: any) {
    return errorResponse(e.message);
  }
});

// ── My generations ────────────────────────────────────────────────────────
const myGenerations = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    const certs = await ctx.runQuery(internal.certificates.listForUser, { userId: user._id });
    return jsonResponse(certs);
  } catch (e: any) {
    return errorResponse(e.message, e.status || 500);
  }
});

// ── Update batch emails ───────────────────────────────────────────────────
const updateBatchEmails = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    const { updates } = await req.json();
    if (!Array.isArray(updates)) return errorResponse("Invalid updates format", 400);
    let updatedCount = 0;
    for (const u of updates) {
      if (!u.certificateId || !u.email) continue;
      const cert = await ctx.runQuery(internal.certificates.findByCertId, { certificateId: u.certificateId });
      if (cert && (user.role === "admin" || cert.createdBy === user._id)) {
        await ctx.runMutation(internal.certificates.updateEmail, { id: cert._id, email: u.email.trim().toLowerCase() });
        updatedCount++;
      }
    }
    return jsonResponse({ message: `Successfully updated ${updatedCount} certificates.` });
  } catch (e: any) {
    return errorResponse(e.message);
  }
});

// ── Delete single certificate ─────────────────────────────────────────────
const deleteCert = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    const url = new URL(req.url);
    const certId = url.pathname.split("/").pop()!;
    const cert = await ctx.runQuery(internal.certificates.findByCertId, { certificateId: certId });
    if (!cert) return errorResponse("Certificate not found or unauthorized", 404);
    if (user.role !== "admin" && cert.createdBy !== user._id) return errorResponse("Unauthorized", 403);
    await ctx.runMutation(internal.certificates.remove, { id: cert._id });
    return jsonResponse({ message: `Successfully deleted certificate "${certId}".` });
  } catch (e: any) {
    return errorResponse(e.message);
  }
});

// ── Delete batch (secure) ─────────────────────────────────────────────────
const deleteBatchSecure = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    const { batchId } = await req.json();
    if (!batchId) return errorResponse("Batch ID is required", 400);
    const count = await ctx.runMutation(internal.certificates.archiveBatch, { batchId, userId: user._id, isAdmin: user.role === "admin" });
    return jsonResponse({ message: `Successfully archived batch "${batchId}"`, count });
  } catch (e: any) {
    return errorResponse(e.message);
  }
});

// ── Resend batch ──────────────────────────────────────────────────────────
const resendBatch = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    const url = new URL(req.url);
    const batchId = decodeURIComponent(url.pathname.split("/resend-batch/")[1]);
    const certs = await ctx.runQuery(internal.certificates.listByBatchId, { batchId });
    let sentCount = 0;

    for (const cert of certs) {
      if (!cert.email) continue;
      const template = await ctx.runQuery(internal.templates.findById, { id: cert.templateId });
      if (!template) continue;
      try {
        const templateBase64 = await getTemplateBytesBase64(ctx, template);
        const itemData = { name: cert.name, email: cert.email, course: cert.course, certificateId: cert.certificateId, ...(cert.metadata || {}) };
        const pdfBase64 = await ctx.runAction(internal.nodeActions.generatePdf, {
          templateBase64,
          layoutConfig: template.layoutConfig,
          qrCode: template.qrCode,
          showId: template.showId,
          showQr: template.showQr,
          data: itemData,
          certId: cert.certificateId,
          frontendUrl: FRONTEND_URL,
        });

        await ctx.runAction(internal.nodeActions.sendEmail, {
          to: cert.email, name: cert.name,
          subject: "Your Certificate of Achievement",
          htmlContent: buildCertEmailHtml(cert.name, cert.certificateId, "Congratulations! Your certificate is attached.", "DigiCertify"),
          pdfBase64,
          certId: cert.certificateId,
        });
        await ctx.runMutation(internal.certificates.updateStatus, { id: cert._id, status: "Sent" });
        sentCount++;
      } catch (e) { /* skip */ }
    }
    return jsonResponse({ message: `Successfully resent ${sentCount} emails for batch "${batchId}".` });
  } catch (e: any) {
    return errorResponse(e.message);
  }
});

// ── Form Automations ──────────────────────────────────────────────────────
const createAutomation = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    const { sheetUrl, templateId, nameColumn, emailColumn, batchId, emailSubject, emailMessage } = await req.json();
    if (!sheetUrl || !templateId || !nameColumn || !emailColumn) {
      return errorResponse("sheetUrl, templateId, nameColumn and emailColumn are required.", 400);
    }
    const idMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!idMatch) return errorResponse("Invalid Google Sheets URL.", 400);
    const sheetId = idMatch[1];
    const gidMatch = sheetUrl.match(/[#&]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : "0";
    const finalBatchId = batchId || `Form Auto – ${new Date().toLocaleDateString("en-GB")}`;
    const automation = await ctx.runMutation(internal.formAutomations.create, {
      userId: user._id, templateId, sheetUrl, sheetId, gid,
      nameColumn, emailColumn, batchId: finalBatchId,
      emailSubject: emailSubject || "Your Certificate of Achievement",
      emailMessage: emailMessage || "Congratulations! Your certificate is attached.",
    });
    return jsonResponse({ message: "Automation created. Poller will check every minute.", automation }, 201);
  } catch (e: any) {
    return errorResponse(e.message);
  }
});

const listAutomations = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    const list = await ctx.runQuery(internal.formAutomations.listForUser, { userId: user._id, isAdmin: user.role === "admin" });
    const enriched = await Promise.all(
      list.map(async (auto: any) => {
        const sentCount = await ctx.runQuery(internal.certificates.countByBatchAndStatus, { batchIdPrefix: auto.batchId });
        return { ...auto, certCount: sentCount };
      })
    );
    return jsonResponse(enriched);
  } catch (e: any) {
    return errorResponse(e.message, e.status || 500);
  }
});

const toggleAutomation = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop() as any;
    const { active } = await req.json();
    const auto = await ctx.runQuery(internal.formAutomations.findById, { id });
    if (!auto) return errorResponse("Automation not found.", 404);
    if (user.role !== "admin" && auto.userId !== user._id) return errorResponse("Forbidden", 403);
    const updated = await ctx.runMutation(internal.formAutomations.toggle, { id, active: active !== undefined ? active : !auto.active });
    return jsonResponse({ message: `Automation ${updated?.active ? "resumed" : "paused"}.`, automation: updated });
  } catch (e: any) {
    return errorResponse(e.message);
  }
});

const deleteAutomation = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop() as any;
    const auto = await ctx.runQuery(internal.formAutomations.findById, { id });
    if (!auto) return errorResponse("Automation not found.", 404);
    if (user.role !== "admin" && auto.userId !== user._id) return errorResponse("Forbidden", 403);
    await ctx.runMutation(internal.formAutomations.remove, { id });
    return jsonResponse({ message: "Automation deleted." });
  } catch (e: any) {
    return errorResponse(e.message);
  }
});

const myCertificatesHandler = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    const certs = await ctx.runQuery(internal.certificates.listMyCertificates, {
      userId: user._id,
      email: user.email,
    });
    return jsonResponse(certs);
  } catch (e: any) {
    return errorResponse(e.message, e.status || 500);
  }
});

const cleanupAutomations = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    const deletedCount = await ctx.runMutation(internal.formAutomations.removeStale, {
      userId: user._id,
      isAdmin: user.role === "admin",
    });
    return jsonResponse({ message: `Cleaned up ${deletedCount} stale automation records.` });
  } catch (e: any) {
    return errorResponse(e.message, e.status || 500);
  }
});

export {
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
};
