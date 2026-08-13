import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const isConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

class EmailService {
  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    const subject = 'Reset your LUMINA password';
    const text = `We received a request to reset your LUMINA password.\n\nReset it here (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`;
    const html = `
      <p>We received a request to reset your LUMINA password.</p>
      <p><a href="${resetUrl}">Reset your password</a> (valid for 1 hour)</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `;

    if (!transporter) {
      // No SMTP configured — log instead of failing the request outright,
      // so local development and environments without email set up don't
      // break the forgot-password flow entirely. Anyone relying on this in
      // production needs SMTP_* set in the environment.
      console.warn(
        `[emailService] SMTP not configured — would have sent password reset email to ${to}:\n${resetUrl}`
      );
      return;
    }

    await transporter.sendMail({
      from: SMTP_USER,
      to,
      subject,
      text,
      html,
    });
  }
}

export default new EmailService();
