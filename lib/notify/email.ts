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
  const safe = body.replace(/</g, "&lt;").replace(/\n/g, "<br/>");
  return `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <p style="font-family:monospace;font-size:11px;letter-spacing:2px;color:#888">MATHENGE INC. · BDP CRM</p>
    <h1 style="font-size:28px;font-weight:400">${title.replace(/</g, "&lt;")}</h1>
    <p style="font-size:15px;line-height:1.7">${safe}</p>
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/>
    <p style="font-size:12px;color:#888">Nairobi, Kenya · Dubai, UAE</p></div>`;
}
