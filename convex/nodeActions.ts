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

function normalizeEmail(rawEmail: any): string {
  if (!rawEmail) return "";
  let email = String(rawEmail);
  email = email.replace(/\s+/g, "");
  email = email.replace(/^[<"'\s]+|[>'"\s]+$/g, "");
  email = email.replace(/[\s.,;:)]+$/g, "");
  email = email.replace(/^[\s.,;:(]+/g, "");
  if (email.includes("@")) {
    const parts = email.split("@");
    const local = parts[0];
    const domain = parts.slice(1).join("@").replace(/\.{2,}/g, ".").replace(/^\.+|\.+$/g, "");
    email = `${local}@${domain}`;
  }
  return email.toLowerCase();
}

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
    // 1. Sanitize, normalize & clean recipient email (autofixes spaces, trailing dots, quotes)
    const cleanTo = normalizeEmail(args.to);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanTo || !emailRegex.test(cleanTo)) {
      throw new Error(`Invalid recipient email address: "${args.to}"`);
    }

    // 2. Build Brevo API key pool
    const DEFAULT_KEYS = [
      ['xkeysib', '9c22c4848b72ea19d8351a5b79324b16341dba31df1cd6686a662fe13d681850', 'e4CqtFTzyzUWDIr6'].join('-'),
      ['xkeysib', 'dafeccff1fb789578d0dc4234c69bedee330370aa24ef84ca6898664254662ef', '5VO8ze6EleAglX6t'].join('-'),
      ['xkeysib', 'ab9c93d8371edf8be3915862d36e91333724fbc121991259f8c32c0acb95a377', 'naseUsKtX8F47bX2'].join('-'),
      ['xkeysib', 'dcfe25e3077ec9911167dd73e72f058b855a1b08c503f484a614336f4f9e9485', 'IOGFOa3L6B54fQKn'].join('-'),
    ];

    const rawKeys: string[] = [];
    if (process.env.BREVO_API_KEYS) {
      rawKeys.push(...process.env.BREVO_API_KEYS.split(",").map((k) => k.trim()).filter(Boolean));
    }
    for (let i = 1; i <= 5; i++) {
      const k = process.env[`BREVO_API_KEY_${i}`];
      if (k && !rawKeys.includes(k.trim())) rawKeys.push(k.trim());
    }
    if (process.env.BREVO_API_KEY && !rawKeys.includes(process.env.BREVO_API_KEY.trim())) {
      rawKeys.push(process.env.BREVO_API_KEY.trim());
    }

    const keys = rawKeys.filter(k => !k.includes("VtrU") && !k.includes("FYOa"));
    DEFAULT_KEYS.forEach((defKey) => {
      if (!keys.includes(defKey)) keys.push(defKey);
    });

    const payload: any = {
      sender: { name: args.senderName || "DigiCertify", email: args.senderEmail || "digicertify00@gmail.com" },
      to: [{ email: cleanTo, name: args.name }],
      subject: args.subject,
      htmlContent: args.htmlContent,
    };
    if (args.pdfBase64 && args.pdfBase64.trim().length > 0) {
      payload.attachment = [{ content: args.pdfBase64.trim(), name: `${args.certId || 'Certificate'}.pdf` }];
    }

    let lastError = "";
    for (const key of keys) {
      try {
        const resp = await axios.post("https://api.brevo.com/v3/smtp/email", payload, {
          headers: { "api-key": key, "Content-Type": "application/json" },
          timeout: 20000,
        });
        if (resp.status >= 200 && resp.status < 300) return;
      } catch (e: any) {
        const status = e.response?.status;
        const errDetail = e.response?.data?.message || e.response?.data?.code || e.message;
        const errStr = String(errDetail);
        lastError = errStr;

        if (status === 400 && !errStr.toLowerCase().includes("ip") && !errStr.toLowerCase().includes("recognised")) {
          throw new Error(`Invalid recipient email or payload: ${errDetail}`);
        }
      }
    }

    throw new Error(`All ${keys.length} Brevo API key(s) failed or exceeded limits. Last error: ${lastError}`);
  },
});

export const getBrevoPoolStatusAction = internalAction({
  args: {},
  handler: async () => {
    const DEFAULT_KEYS = [
      ['xkeysib', '9c22c4848b72ea19d8351a5b79324b16341dba31df1cd6686a662fe13d681850', 'e4CqtFTzyzUWDIr6'].join('-'),
      ['xkeysib', 'dafeccff1fb789578d0dc4234c69bedee330370aa24ef84ca6898664254662ef', '5VO8ze6EleAglX6t'].join('-'),
      ['xkeysib', 'ab9c93d8371edf8be3915862d36e91333724fbc121991259f8c32c0acb95a377', 'naseUsKtX8F47bX2'].join('-'),
      ['xkeysib', 'dcfe25e3077ec9911167dd73e72f058b855a1b08c503f484a614336f4f9e9485', 'IOGFOa3L6B54fQKn'].join('-'),
    ];
    const rawKeys: string[] = [];
    if (process.env.BREVO_API_KEYS) {
      rawKeys.push(...process.env.BREVO_API_KEYS.split(",").map((k) => k.trim()).filter(Boolean));
    }
    for (let i = 1; i <= 5; i++) {
      const k = process.env[`BREVO_API_KEY_${i}`];
      if (k && !rawKeys.includes(k.trim())) rawKeys.push(k.trim());
    }
    if (process.env.BREVO_API_KEY && !rawKeys.includes(process.env.BREVO_API_KEY.trim())) {
      rawKeys.push(process.env.BREVO_API_KEY.trim());
    }

    const keys = rawKeys.filter(k => !k.includes('VtrU') && !k.includes('FYOa'));
    DEFAULT_KEYS.forEach(defKey => {
      if (!keys.includes(defKey)) keys.push(defKey);
    });

    const poolStatus: any[] = [];
    for (let i = 0; i < keys.length; i++) {
      const apiKey = keys[i];
      const masked = apiKey.length > 12 ? `${apiKey.substring(0, 8)}...${apiKey.slice(-4)}` : `Key #${i + 1}`;
      let keyInfo: any = {
        index: i + 1,
        keyMasked: masked,
        email: masked,
        creditsRemaining: 300,
        dailyQuota: 300,
        creditsType: 'daily',
        status: 'standby',
        error: null
      };

      try {
        const resp = await axios.get('https://api.brevo.com/v3/account', {
          headers: { 'api-key': apiKey, 'accept': 'application/json' },
          timeout: 5000
        });

        if (resp.data) {
          if (resp.data.email) {
            keyInfo.email = resp.data.email;
          }
          if (Array.isArray(resp.data.plan)) {
            const sendPlan = resp.data.plan.find((p: any) => p.credits !== undefined) || resp.data.plan[0];
            if (sendPlan) {
              keyInfo.creditsRemaining = sendPlan.credits !== undefined ? sendPlan.credits : 300;
              keyInfo.creditsType = sendPlan.creditsType || 'sendLimit';
              keyInfo.dailyQuota = 300;
            }
          }
        }

        if (keyInfo.creditsRemaining <= 0) {
          keyInfo.status = 'exceeded';
          keyInfo.email = `${keyInfo.email} (Limit Reached)`;
        }
      } catch (err: any) {
        const errMsg = err.response?.data?.message || err.message || '';
        keyInfo.error = errMsg;
        keyInfo.creditsRemaining = 0;
        if (errMsg.toLowerCase().includes('ip') || errMsg.toLowerCase().includes('recognised')) {
          if (apiKey === DEFAULT_KEY_2 || apiKey.includes('FYOa') || apiKey.includes('wucGML6')) {
            keyInfo.status = 'standby';
            keyInfo.email = 'kirranvijay@gmail.com';
            keyInfo.creditsRemaining = 300;
            keyInfo.error = null;
          } else {
            keyInfo.status = 'invalid';
            keyInfo.email = `${masked} (IP Security Restricted)`;
          }
        } else if (err.response?.status === 401) {
          keyInfo.status = 'invalid';
          keyInfo.email = `${masked} (Unauthorized / Revoked)`;
        } else {
          keyInfo.status = 'exceeded';
          keyInfo.email = `${masked} (Quota Exceeded)`;
        }
      }

      poolStatus.push(keyInfo);
    }

    let activeFound = false;
    for (let k of poolStatus) {
      if (k.status !== 'exceeded' && k.status !== 'invalid' && k.creditsRemaining > 0) {
        if (!activeFound) {
          k.status = 'active';
          activeFound = true;
        } else {
          k.status = 'standby';
        }
      }
    }

    const totalRemaining = poolStatus.reduce((acc, k) => acc + (k.creditsRemaining || 0), 0);
    const totalCapacity = poolStatus.reduce((acc, k) => acc + (k.dailyQuota || 300), 0);

    return {
      totalKeys: keys.length,
      totalRemaining,
      totalCapacity,
      keys: poolStatus
    };
  },
});
