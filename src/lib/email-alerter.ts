/**
 * Email Alerter — send email alerts for high-urgency changes via Resend
 */

import { Resend } from "resend";
import type { ClassifiedChange } from "./ai-classifier";

/**
 * Send email alert for changes with urgency ≥ 7 or breaking change_type.
 * Includes detailed logging for debugging.
 */
export async function sendAlertEmail(
  providerName: string,
  changes: ClassifiedChange[]
): Promise<{ sent: boolean; count: number; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.ALERT_EMAIL_TO;

  console.log(`[email-alerter] 📧 Called for "${providerName}" with ${changes.length} total changes`);
  console.log(`[email-alerter] 🔑 RESEND_API_KEY present: ${!!apiKey}`);
  console.log(`[email-alerter] 📬 ALERT_EMAIL_TO: ${toEmail ? "***@" + toEmail.split("@")[1] : "(not set)"}`);

  if (!apiKey || !toEmail) {
    console.error("[email-alerter] ❌ Missing RESEND_API_KEY or ALERT_EMAIL_TO — skipping email");
    return { sent: false, count: 0, error: "Missing RESEND_API_KEY or ALERT_EMAIL_TO" };
  }

  // Filter: breaking changes OR urgency >= 7
  const criticalChanges = changes.filter(
    (c) => c.urgency >= 7 || c.change_type === "breaking"
  );

  console.log(`[email-alerter] 🔍 Critical changes (urgency≥7 or breaking): ${criticalChanges.length}`);

  if (criticalChanges.length > 0) {
    criticalChanges.forEach((c, i) => {
      console.log(`[email-alerter]   ${i + 1}. [${c.change_type}] urgency=${c.urgency} — "${c.title}"`);
    });
  }

  if (criticalChanges.length === 0) {
    console.log("[email-alerter] ℹ️ No critical changes — no email needed");
    return { sent: false, count: 0 };
  }

  const resend = new Resend(apiKey);

  const changeRows = criticalChanges
    .map(
      (c) =>
        `<tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #333;">${c.title}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #333; text-align: center;">
            <span style="background: ${c.urgency >= 9 ? '#dc2626' : c.urgency >= 7 ? '#f59e0b' : '#22c55e'}; color: white; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600;">
              ${c.urgency}/10
            </span>
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #333; color: #d4d4d8;">${c.impact}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #333; color: #fbbf24;">${c.action_required}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; background: #0a0a0a; color: #fafafa; padding: 28px; border-radius: 12px; border: 1px solid #27272a;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
        <h2 style="margin: 0; font-size: 20px;">🐤 Canary Alert</h2>
      </div>
      <p style="color: #a1a1aa; margin: 0 0 20px; font-size: 14px;">
        ${criticalChanges.length} critical change${criticalChanges.length > 1 ? "s" : ""} detected for <strong style="color: #818cf8;">${providerName}</strong>
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="border-bottom: 2px solid #333;">
            <th style="padding: 8px; text-align: left; color: #71717a; font-weight: 600;">Change</th>
            <th style="padding: 8px; text-align: center; color: #71717a; font-weight: 600;">Urgency</th>
            <th style="padding: 8px; text-align: left; color: #71717a; font-weight: 600;">Impact</th>
            <th style="padding: 8px; text-align: left; color: #71717a; font-weight: 600;">Action</th>
          </tr>
        </thead>
        <tbody>${changeRows}</tbody>
      </table>
      ${criticalChanges[0]?.suggested_fix ? `
        <div style="margin-top: 16px; padding: 12px; background: #18181b; border-radius: 8px; border: 1px solid #27272a;">
          <p style="margin: 0 0 4px; font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Suggested Fix</p>
          <p style="margin: 0; font-size: 13px; color: #d4d4d8;">${criticalChanges[0].suggested_fix}</p>
        </div>
      ` : ""}
      <p style="color: #3f3f46; font-size: 11px; margin-top: 24px; border-top: 1px solid #27272a; padding-top: 12px;">
        Sent by Canary — Autonomous API Change Monitor
      </p>
    </div>
  `;

  const subject = `🐤 Canary: ${criticalChanges.length} critical change${criticalChanges.length > 1 ? "s" : ""} — ${providerName}`;

  console.log(`[email-alerter] 📤 Sending email to ${toEmail} | Subject: "${subject}"`);

  try {
    const result = await resend.emails.send({
      from: "Canary <onboarding@resend.dev>",
      to: toEmail,
      subject,
      html,
    });

    console.log(`[email-alerter] ✅ Email sent successfully!`, JSON.stringify(result));
    return { sent: true, count: criticalChanges.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[email-alerter] ❌ Email send FAILED:`, msg);
    console.error(`[email-alerter] ❌ Full error:`, err);
    return { sent: false, count: criticalChanges.length, error: msg };
  }
}
