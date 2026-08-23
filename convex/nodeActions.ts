"use node";
/**
 * nodeActions.ts — All Node.js-specific operations.
 * Called from V8 httpActions via ctx.runAction(internal.nodeActions.xxx, args).
 * This is the ONLY "use node" file. All httpActions in http.ts are V8.
 */
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import archiver from "archiver";
import axios from "axios";
import xlsx from "xlsx";

// ── Parse Excel ───────────────────────────────────────────────────────────
export const parseExcel = internalAction({
  args: { base64Data: v.string() },
  handler: async (_ctx, { base64Data }) => {
    const buffer = Buffer.from(base64Data, "base64");
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    return { data, headers: Object.keys((data[0] as any) || {}) };
  },
});

// ── Parse Google Sheet ───────────────────────────────────────────────────
export const parseGoogleSheet = internalAction({
  args: { sheetUrl: v.string() },
  handler: async (_ctx, { sheetUrl }) => {
    if (!sheetUrl) throw new Error("No Google Sheet URL provided.");
    const trimmedUrl = sheetUrl.trim();

    if (trimmedUrl.includes("docs.google.com/forms") || trimmedUrl.includes("forms.gle")) {
      throw new Error("This is a Google Form link. Please open the Form responses in Google Sheets (click the green Sheets icon in the form), then copy and paste that Sheets link here.");
    }

    let docId = "";
    let isWebPublished = false;

    const webPubMatch = trimmedUrl.match(/\/d\/e\/([a-zA-Z0-9-_]+)/);
    const standardMatch = trimmedUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);

    if (webPubMatch) {
      docId = webPubMatch[1];
      isWebPublished = true;
    } else if (standardMatch) {
      docId = standardMatch[1];
    } else if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmedUrl)) {
      docId = trimmedUrl;
    } else {
      throw new Error("Invalid Google Sheets URL format. Copy the URL from your browser address bar while the sheet is open.");
    }

    const gidMatch = trimmedUrl.match(/[#&?]gid=([0-9]+)/);
    const preferredGid = gidMatch ? gidMatch[1] : null;

    const candidateUrls: string[] = [];
    if (isWebPublished) {
      candidateUrls.push(`https://docs.google.com/spreadsheets/d/e/${docId}/pub?output=csv`);
      if (preferredGid) candidateUrls.push(`https://docs.google.com/spreadsheets/d/e/${docId}/pub?gid=${preferredGid}&single=true&output=csv`);
    } else {
      if (preferredGid) candidateUrls.push(`https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${preferredGid}`);
      candidateUrls.push(`https://docs.google.com/spreadsheets/d/${docId}/export?format=csv`);
      candidateUrls.push(`https://docs.google.com/spreadsheets/d/${docId}/gviz/tq?tqx=out:csv`);
      if (preferredGid) candidateUrls.push(`https://docs.google.com/spreadsheets/d/${docId}/gviz/tq?tqx=out:csv&gid=${preferredGid}`);
      for (const g of ["0", "1", "2", "3"]) {
        if (g !== preferredGid) candidateUrls.push(`https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${g}`);
      }
    }

    const uniqueUrls = [...new Set(candidateUrls)];
    let privateDetected = false;
    let notFoundDetected = false;
    let lastErrorMsg = "";

    for (const url of uniqueUrls) {
      try {
        const response = await axios.get(url, {
          responseType: "arraybuffer",
          timeout: 15000,
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        });

        const text = Buffer.from(response.data).toString("utf8", 0, 300);
        if (text.includes("<html") && (text.includes("accounts.google.com") || text.includes("ServiceLogin") || text.includes("Sign in"))) {
          privateDetected = true;
          continue;
        }

        const wb = xlsx.read(response.data, { type: "buffer" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(ws, { raw: false, defval: "" });
        const headers = ((xlsx.utils.sheet_to_json(ws, { header: 1, raw: false }) as any[][])[0] || []).map(String).filter(Boolean);

        if (headers.length > 0 || data.length > 0) {
          return { data, headers };
        }
      } catch (e: any) {
        if (e.response?.status === 401 || e.response?.status === 403) privateDetected = true;
        else if (e.response?.status === 404) notFoundDetected = true;
        lastErrorMsg = e.message;
      }
    }

    if (privateDetected || notFoundDetected) {
      throw new Error("Access denied or sheet not found. Ensure sheet sharing is set to 'Anyone with the link can view' (Share -> General Access -> Anyone with the link).");
    }

    throw new Error(`Failed to access Google Sheet: ${lastErrorMsg || "Check sheet link & sharing permissions."}`);
  },
});

// ── PDF Generation ────────────────────────────────────────────────────────
export const generatePdf = internalAction({
  args: {
    templateBase64: v.string(),
    layoutConfig: v.any(),
    qrCode: v.optional(v.any()),
    showId: v.optional(v.boolean()),
    showQr: v.optional(v.boolean()),
    data: v.any(),
    certId: v.string(),
    frontendUrl: v.string(),
  },
  handler: async (_ctx, args): Promise<string> => {
    const templateBytes = Buffer.from(args.templateBase64, "base64");
    let pdfDoc: PDFDocument, page: any, width: number, height: number;

    try {
      pdfDoc = await PDFDocument.load(templateBytes);
      page = pdfDoc.getPages()[0];
      ({ width, height } = page.getSize());
    } catch {
      try {
        pdfDoc = await PDFDocument.create();
        const img = await pdfDoc.embedPng(templateBytes);
        const d = img.scale(1);
        page = pdfDoc.addPage([d.width, d.height]);
        page.drawImage(img, { x: 0, y: 0, width: d.width, height: d.height });
        width = d.width; height = d.height;
      } catch {
        pdfDoc = await PDFDocument.create();
        const img = await pdfDoc.embedJpg(templateBytes);
        const d = img.scale(1);
        page = pdfDoc.addPage([d.width, d.height]);
        page.drawImage(img, { x: 0, y: 0, width: d.width, height: d.height });
        width = d.width; height = d.height;
      }
    }

    const layout = args.layoutConfig || {};
    const fields = Array.isArray(layout) ? layout : (layout.fields || []);
    const qrSettings = args.qrCode || layout.qrCode;
    const data: Record<string, any> = args.data;

    for (const field of fields) {
      if (field.key === "certificateId" && args.showId === false) continue;
      const dataKeys = Object.keys(data);
      const actualKey = dataKeys.find((k) => k.toLowerCase() === field.key.toLowerCase());
      let textValue = "";
      if (actualKey && data[actualKey]) textValue = String(data[actualKey]);
      else if (field.key.toLowerCase().includes("name") && data.name) textValue = String(data.name);
      else if (field.staticValue) textValue = String(field.staticValue);
      else if (field.key.toLowerCase() === "certificateid") textValue = args.certId;
      if (field.key.toLowerCase() === "certificateid" && !textValue.startsWith("Certificate id : ")) {
        textValue = `Certificate id : ${textValue}`;
      }
      if (field.textTransform === "uppercase") textValue = textValue.toUpperCase();

      const rgbColor = field.color || { r: 0, g: 0, b: 0 };
      const fontSize = Number(field.fontSize) || 24;
      const boxHeight = Number(field.height) || 40;
      const finalY = height - Number(field.y) - boxHeight + (boxHeight - fontSize * 0.8) / 2;
      const family = (field.fontFamily || "sans").toLowerCase();
      const isBold = field.fontWeight === "bold";
      const isItalic = field.fontStyle === "italic";
      let fontToUse: any;
      try {
        if (family === "serif") {
          if (isBold && isItalic) fontToUse = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
          else if (isBold) fontToUse = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
          else if (isItalic) fontToUse = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
          else fontToUse = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        } else if (family === "mono") {
          if (isBold && isItalic) fontToUse = await pdfDoc.embedFont(StandardFonts.CourierBoldOblique);
          else if (isBold) fontToUse = await pdfDoc.embedFont(StandardFonts.CourierBold);
          else if (isItalic) fontToUse = await pdfDoc.embedFont(StandardFonts.CourierOblique);
          else fontToUse = await pdfDoc.embedFont(StandardFonts.Courier);
        } else {
          if (isBold && isItalic) fontToUse = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
          else if (isBold) fontToUse = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          else if (isItalic) fontToUse = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
          else fontToUse = await pdfDoc.embedFont(StandardFonts.Helvetica);
        }
      } catch { fontToUse = await pdfDoc.embedFont(StandardFonts.Helvetica); }

      const textWidth = fontToUse.widthOfTextAtSize(textValue, fontSize);
      const boxWidth = Number(field.width) || 200;
      let finalX = Number(field.x);
      if (field.textAlign === "center") finalX = Number(field.x) + (boxWidth - textWidth) / 2;
      else if (field.textAlign === "right") finalX = Number(field.x) + (boxWidth - textWidth);
      const color = rgb(Number(rgbColor.r || 0) / 255, Number(rgbColor.g || 0) / 255, Number(rgbColor.b || 0) / 255);
      page.drawText(textValue, { x: finalX, y: finalY, size: fontSize, font: fontToUse, color });
      if (field.textDecoration === "underline") {
        page.drawLine({ start: { x: finalX, y: finalY - 2 }, end: { x: finalX + textWidth, y: finalY - 2 }, thickness: 1, color });
      }
    }

    if (qrSettings && args.showQr !== false) {
      const qrData = `${args.frontendUrl}/verify/${args.certId}`;
      const qrBuf: Buffer = await (QRCode as any).toBuffer(qrData);
      const qrImg = await pdfDoc.embedPng(qrBuf);
      page.drawImage(qrImg, {
        x: Number(qrSettings.x), y: height - Number(qrSettings.y) - Number(qrSettings.height),
        width: Number(qrSettings.width), height: Number(qrSettings.height),
      });
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes).toString("base64");
  },
});

// ── Bulk ZIP ──────────────────────────────────────────────────────────────
export const createBulkZip = internalAction({
  args: {
    certs: v.array(v.object({
      certId: v.string(),
      batchId: v.optional(v.string()),
      pdfBase64: v.string(),
    })),
  },
  handler: async (_ctx, { certs }): Promise<string> => {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      archive.on("end", resolve);
      archive.on("error", reject);
      for (const cert of certs) {
        const folder = (cert.batchId || "Manual").replace(/[<>:"/\\|?*]/g, "_").trim();
        archive.append(Buffer.from(cert.pdfBase64, "base64"), { name: `${folder}/${cert.certId}.pdf` });
      }
      archive.finalize();
    });
    return Buffer.concat(chunks).toString("base64");
  },
});

// ── Send email via Brevo ──────────────────────────────────────────────────
export const sendEmail = internalAction({
  args: {
    to: v.string(),
    name: v.string(),
    subject: v.string(),
    htmlContent: v.string(),
    pdfBase64: v.string(),
    certId: v.string(),
    senderName: v.optional(v.string()),
    senderEmail: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<void> => {
    const brevoApiKey = process.env.BREVO_API_KEY;
    const payload = {
      sender: { name: args.senderName || "DigiCertify", email: args.senderEmail || "digicertify00@gmail.com" },
      to: [{ email: args.to }],
      subject: args.subject,
      htmlContent: args.htmlContent,
      attachment: [{ content: args.pdfBase64, name: `${args.certId}.pdf` }],
    };
    const resp = await axios.post("https://api.brevo.com/v3/smtp/email", payload, {
      headers: { "api-key": brevoApiKey, "Content-Type": "application/json" },
    });
    if (resp.status >= 400) throw new Error(`Brevo error: ${JSON.stringify(resp.data)}`);
  },
});
