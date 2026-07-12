// V8-compatible email HTML generator
export function buildCertEmailHtml(
  name: string,
  certId: string,
  message: string,
  senderName: string
): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eee;border-radius:10px;">
      <h2 style="color:#4f46e5;">Your Certificate is Ready! 🎉</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>${message}</p>
      <div style="margin:20px 0;padding:15px;background:#f9fafb;border-radius:8px;">
        <p style="margin:0;font-size:12px;color:#6b7280;">Certificate ID:</p>
        <p style="margin:0;font-weight:bold;font-family:monospace;">${certId}</p>
      </div>
      <p style="font-size:14px;color:#374151;">Best Regards,<br/><strong>${senderName} Team</strong></p>
    </div>`;
}
