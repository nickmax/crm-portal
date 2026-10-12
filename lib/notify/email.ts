// Resend email capability. Works without new dependencies (plain fetch).
// Without RESEND_API_KEY, sends are reported as queued so the UI never dead-ends.

export function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function resendFrom(): string {
  return process.env.RESEND_FROM ?? "BDP CRM <updates@mathengeinc.com>";
}

export interface EmailResult {
  ok: boolean;
  sent: number;
  queued: boolean;
  error?: string;
}

export async function sendBulkEmail(opts: {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailResult> {
  const to = [...new Set(opts.to.filter(Boolean))];
  if (!to.length) return { ok: false, sent: 0, queued: false, error: "No recipients with email addresses." };
  if (!resendConfigured()) return { ok: true, sent: 0, queued: true };

  const errors: string[] = [];
  let sent = 0;
  // Resend accepts up to 50 recipients per call; batch for safety.
  for (let i = 0; i < to.length; i += 50) {
    const batch = to.slice(i, i + 50);
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFrom(),
          to: batch,
          subject: opts.subject,
          html: opts.html,
          text: opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
        }),
      });
      if (!r.ok) errors.push(`HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`);
      else sent += batch.length;
    } catch (e) {
      errors.push(e instanceof Error ? e.message.slice(0, 160) : "send failed");
    }
  }
  return { ok: errors.length === 0, sent, queued: false, error: errors.join(" · ") || undefined };
}

export function announcementHtml(title: string, body: string): string {
  const safeTitle = title.replace(/</g, "&lt;");
  const safe = body.replace(/</g, "&lt;").replace(/\n/g, "<br/>");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f2ed;font-family:Georgia,'Times New Roman',serif;color:#1c1a16">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px">
    <p style="font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:3px;color:#8a867c;margin:0 0 8px">MATHENGE INC. · BDP CRM</p>
    <img src="https://crm.mathengeinc.com/logo.png" alt="Mathenge Inc" width="120" style="display:block;margin:0 0 20px"/>
    <div style="background:#fffdf9;border:1px solid #e7e2d6;border-radius:14px;padding:32px">
      <h1 style="font-size:30px;font-weight:400;line-height:1.15;margin:0 0 16px">${safeTitle}</h1>
      <p style="font-size:15px;line-height:1.75;margin:0">${safe}</p>
      <a href="https://crm.mathengeinc.com" style="display:inline-block;margin-top:24px;background:#1c1a16;color:#faf9f7;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;padding:12px 28px;border-radius:999px">Open the CRM</a>
    </div>
    <p style="font-family:Arial,sans-serif;font-size:12px;color:#8a867c;margin:20px 0 0">Nairobi, Kenya · Dubai, UAE · info@mathengeinc.com</p>
  </div></body></html>`;
}
