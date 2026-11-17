import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

function makeConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((k: string, d?: unknown) => values[k] ?? d),
    getOrThrow: jest.fn((k: string) => {
      const v = values[k];
      if (v === undefined) throw new Error(`missing ${k}`);
      return v;
    }),
  } as unknown as ConfigService;
}

describe('MailService', () => {
  it('runs in no-op mode when neither Resend nor SMTP creds are set and never throws', async () => {
    const service = new MailService(makeConfig({ WEB_APP_URL: 'http://localhost:3001' }));
    expect(service.isEnabled()).toBe(false);
    await expect(service.sendVerificationEmail('a@b.c', 'A', 'tok')).resolves.toBe(false);
  });

  it('reports enabled when RESEND_API_KEY is present (preferred transport)', () => {
    const service = new MailService(
      makeConfig({ RESEND_API_KEY: 're_test_123' }),
    );
    expect(service.isEnabled()).toBe(true);
  });

  it('reports enabled when SMTP creds are present (fallback transport)', () => {
    const service = new MailService(
      makeConfig({ SMTP_USER: 'x@gmail.com', SMTP_PASS: 'app-pass' }),
    );
    expect(service.isEnabled()).toBe(true);
  });

  it('prefers Resend over SMTP when both are configured', () => {
    // Resend takes priority — SMTP transporter should NOT be created
    const service = new MailService(
      makeConfig({
        RESEND_API_KEY: 're_test_123',
        SMTP_USER: 'x@gmail.com',
        SMTP_PASS: 'app-pass',
      }),
    );
    expect(service.isEnabled()).toBe(true);
    // The private 'transporter' should be null since Resend is used
    expect((service as unknown as { transporter: unknown }).transporter).toBeNull();
  });
});
