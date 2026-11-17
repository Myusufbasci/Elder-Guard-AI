import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Mail service with two transport strategies:
 *
 * 1. **Resend HTTP API** (preferred) — uses HTTPS (port 443), bypasses the
 *    DigitalOcean default SMTP port block (465/587). Activated when
 *    `RESEND_API_KEY` is set. No npm dependency — Node 22 native `fetch()`.
 *
 * 2. **Nodemailer SMTP** (fallback) — classic Gmail SMTP. Only works when
 *    SMTP ports are open (local dev, non-DO hosts). Activated when
 *    `SMTP_USER` + `SMTP_PASS` are set and `RESEND_API_KEY` is absent.
 *
 * If neither is configured, the mailer runs in NO-OP mode: it logs a warning
 * and returns without throwing. Registration is never blocked.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  /** Which transport is active: 'resend' | 'smtp' | 'noop'. */
  private readonly mode: 'resend' | 'smtp' | 'noop';
  private readonly resendApiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.resendApiKey = this.config.get<string>('RESEND_API_KEY');

    if (this.resendApiKey) {
      this.mode = 'resend';
      this.logger.log('Mail transport: Resend HTTP API (HTTPS, no SMTP port needed).');
      return;
    }

    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (user && pass) {
      this.mode = 'smtp';
      const host = this.config.get<string>('SMTP_HOST', 'smtp.gmail.com');
      const port = Number(this.config.get<string>('SMTP_PORT', '465'));
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
        auth: { user, pass },
        // Fail fast — cloud VMs with blocked SMTP ports hang for minutes.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
      this.logger.log(`Mail transport: SMTP ${host}:${port}.`);
      return;
    }

    this.mode = 'noop';
    this.logger.warn(
      'Neither RESEND_API_KEY nor SMTP_USER/SMTP_PASS configured — verification emails will be skipped (no-op mode).',
    );
  }

  /** True when at least one mail transport is configured. */
  isEnabled(): boolean {
    return this.mode !== 'noop';
  }

  /**
   * Send the account-verification email containing the one-time link.
   * Never throws — failures are logged so a flaky transport can't break
   * registration. Returns true if the message was accepted by the transport.
   */
  async sendVerificationEmail(to: string, firstName: string, token: string): Promise<boolean> {
    const webUrl = this.config.get<string>('WEB_APP_URL', 'http://localhost:3001');
    const link = `${webUrl.replace(/\/+$/, '')}/verify-email?token=${encodeURIComponent(token)}`;

    if (this.mode === 'noop') {
      this.logger.warn(`[mail no-op] Verification link for ${to}: ${link}`);
      return false;
    }

    if (this.mode === 'resend') {
      return this.sendViaResend(to, firstName, link);
    }

    return this.sendViaSmtp(to, firstName, link);
  }

  // ─── Resend HTTP API ───────────────────────────────────────────────

  private async sendViaResend(to: string, firstName: string, link: string): Promise<boolean> {
    const from = this.config.get<string>('MAIL_FROM', 'ElderCare <onboarding@resend.dev>');
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: 'ElderCare — E-postanı doğrula',
          html: this.buildHtml(firstName, link),
          text:
            `Merhaba ${firstName},\n\n` +
            `ElderCare hesabını doğrulamak için aşağıdaki bağlantıya tıkla:\n${link}\n\n` +
            `Bu bağlantı 24 saat geçerlidir. Bu işlemi sen yapmadıysan bu e-postayı yok sayabilirsin.`,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Resend API error ${res.status} for ${to}: ${body}`);
        return false;
      }

      this.logger.log(`Verification email sent via Resend to ${to}`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send verification email via Resend to ${to}: ${message}`);
      return false;
    }
  }

  // ─── Nodemailer SMTP ───────────────────────────────────────────────

  private async sendViaSmtp(to: string, firstName: string, link: string): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    const from = this.config.get<string>('MAIL_FROM', this.config.getOrThrow<string>('SMTP_USER'));
    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: 'ElderCare — E-postanı doğrula',
        text:
          `Merhaba ${firstName},\n\n` +
          `ElderCare hesabını doğrulamak için aşağıdaki bağlantıya tıkla:\n${link}\n\n` +
          `Bu bağlantı 24 saat geçerlidir. Bu işlemi sen yapmadıysan bu e-postayı yok sayabilirsin.`,
        html: this.buildHtml(firstName, link),
      });
      this.logger.log(`Verification email sent via SMTP to ${to}`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send verification email via SMTP to ${to}: ${message}`);
      return false;
    }
  }

  // ─── HTML template ─────────────────────────────────────────────────

  private buildHtml(firstName: string, link: string): string {
    return `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
  <h2 style="margin:0 0 8px">ElderCare</h2>
  <p>Merhaba ${this.escape(firstName)},</p>
  <p>Hesabını doğrulamak için aşağıdaki butona tıkla:</p>
  <p style="margin:24px 0">
    <a href="${link}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">
      E-postamı doğrula
    </a>
  </p>
  <p style="font-size:13px;color:#64748b">Buton çalışmazsa bu bağlantıyı tarayıcına yapıştır:<br>
    <a href="${link}" style="color:#4f46e5;word-break:break-all">${link}</a>
  </p>
  <p style="font-size:13px;color:#64748b">Bu bağlantı 24 saat geçerlidir. Bu işlemi sen yapmadıysan e-postayı yok sayabilirsin.</p>
</div>`;
  }

  private escape(s: string): string {
    return s.replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
    );
  }
}
