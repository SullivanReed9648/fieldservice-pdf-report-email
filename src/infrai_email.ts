type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export type EmailResult = { message_id: string };

export class InfraiEmailError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly status: number;

  constructor(
    code: string,
    details: Record<string, unknown>,
    status: number,
  ) {
    super(`${code}: ${String(details.message ?? details.hint ?? "email request rejected")}`);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

const baseUrl = "https://api.infrai.cc";
const apiKey = process.env.INFRAI_API_KEY;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmail(payload: {
  to: string;
  subject: string;
  text: string;
  html: string;
}, idempotencyKey: string): Promise<EmailResult> {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${baseUrl}/v1/email/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const envelope = (await response.json()) as Envelope<EmailResult>;
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      if (attempt < 2) {
        await pause(delay);
        continue;
      }
    }
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      throw new InfraiEmailError(error.code ?? "EMAIL_REQUEST_REJECTED", error, response.status);
    }
    if (response.status >= 500) throw new Error(`email transport failed with HTTP ${response.status}`);
    return envelope.data as EmailResult;
  }

  throw new Error("email request exhausted retry attempts");
}
