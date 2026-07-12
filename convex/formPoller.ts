import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { buildCertEmailHtml } from "./_utils/email";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

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

export const pollAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const automations = await ctx.runQuery(internal.formAutomations.listActive, {});

    for (const auto of automations) {
      try {
        const template = auto.templateId as any;
        if (!template || !template._id) continue;

        // Fetch sheet rows using Node.js action
        const { data: rows } = await ctx.runAction(internal.nodeActions.parseGoogleSheet, {
          sheetUrl: auto.sheetUrl,
        });

        if (!rows || !rows.length) continue;

        const templateBase64 = await getTemplateBytesBase64(ctx, template);
        let newlyGenerated = 0;

        const now = new Date();
        const runTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const pollBatchId = `${auto.batchId} [Run ${runTime}]`;

        for (const row of rows) {
          const name = String(row[auto.nameColumn] || "").trim();
          const email = String(row[auto.emailColumn] || "").trim().toLowerCase();
          if (!name || !email) continue;

          const uniqueHash = await calculateUniqueHash(template._id, name, email, auto.batchId);
          const existing = await ctx.runQuery(internal.certificates.findByHash, { uniqueHash });
          if (existing) continue;

          let certId = generateCertId();
          while (await ctx.runQuery(internal.certificates.findByCertId, { certificateId: certId })) {
            certId = generateCertId();
          }

          const itemData = { ...row, name, email, certificateId: certId };

          let pdfBase64: string;
          try {
            pdfBase64 = await ctx.runAction(internal.nodeActions.generatePdf, {
              templateBase64,
              layoutConfig: template.layoutConfig,
              qrCode: template.qrCode,
              showId: template.showId,
              showQr: template.showQr,
              data: itemData,
              certId,
              frontendUrl: FRONTEND_URL,
            });
          } catch (pdfErr: any) {
            console.error(`[Poll] PDF gen failed for ${name}:`, pdfErr.message);
            continue;
          }

          const certDocId = await ctx.runMutation(internal.certificates.create, {
            certificateId: certId,
            name,
            email,
            course: row.course || row.Course || auto.emailSubject || "Achievement",
            templateId: template._id,
            status: "Pending",
            createdBy: auto.userId,
            batchId: pollBatchId,
            isAutomation: true,
            uniqueHash,
            metadata: row,
          });

          const html = buildCertEmailHtml(name, certId, auto.emailMessage, "DigiCertify");

          try {
            await ctx.runAction(internal.nodeActions.sendEmail, {
              to: email,
              name,
              subject: auto.emailSubject,
              htmlContent: html,
              pdfBase64,
              certId,
            });
            await ctx.runMutation(internal.certificates.updateStatus, { id: certDocId, status: "Sent" });
            await ctx.runMutation(internal.emailLogs.create, { certificateId: certId, recipient: email, status: "Sent" });
            console.log(`[Poll] ✅ Cert sent to ${email}`);
          } catch (mailErr: any) {
            await ctx.runMutation(internal.certificates.updateStatus, { id: certDocId, status: "Failed" });
            await ctx.runMutation(internal.emailLogs.create, { certificateId: certId, recipient: email, status: "Failed", error: mailErr.message });
            console.error(`[Poll] ❌ Email failed for ${email}:`, mailErr.message);
          }

          newlyGenerated++;
        }

        await ctx.runMutation(internal.formAutomations.updateStats, { id: auto._id, newlyGenerated });
        if (newlyGenerated > 0) {
          console.log(`[Poll] "${auto.batchId}": ${newlyGenerated} new certs generated.`);
        }
      } catch (err: any) {
        console.error(`[Poll] Error for automation ${auto._id}:`, err.message);
      }
    }
  },
});
