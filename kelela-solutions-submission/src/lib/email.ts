import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || "Kelela Solutions <no-reply@kelelasolutions.com>";

const isConfigured = !!(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASSWORD);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    })
  : null;

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends an email if SMTP_* env vars are configured; otherwise logs it to
 * the server console instead of failing. This means password-reset and
 * invite flows work end-to-end in local dev with zero email setup — you
 * just read the link out of the terminal — and switch to real delivery
 * the moment SMTP credentials are added to .env, with no code changes.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!transporter) {
    console.log(
      `\n[email:dev-fallback] SMTP not configured — would have sent:\n` +
        `  To:      ${input.to}\n` +
        `  Subject: ${input.subject}\n` +
        `  ${input.text}\n`
    );
    return;
  }

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

export function passwordResetEmail(resetUrl: string) {
  return {
    subject: "Reset your Kelela Solutions password",
    text: `Reset your password: ${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <p>You requested a password reset for your Kelela Solutions account.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Reset password</a></p>
        <p style="color:#666;font-size:13px;">This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  };
}

export function teammateInviteEmail(params: { orgName: string; loginUrl: string; email: string; tempPassword: string }) {
  return {
    subject: `You've been added to ${params.orgName} on Kelela Solutions`,
    text: `You've been added to ${params.orgName}'s compliance workspace.\n\nLogin: ${params.loginUrl}\nEmail: ${params.email}\nTemporary password: ${params.tempPassword}\n\nYou'll be asked to change this password after signing in.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <p>You've been added to <strong>${params.orgName}</strong>'s compliance workspace on Kelela Solutions.</p>
        <p><a href="${params.loginUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Sign in</a></p>
        <p style="font-family: monospace; font-size: 13px; background:#f4f4f4; padding:10px; border-radius:6px;">
          Email: ${params.email}<br/>
          Temporary password: ${params.tempPassword}
        </p>
        <p style="color:#666;font-size:13px;">Please change this password after you sign in.</p>
      </div>
    `,
  };
}
