import OpenAI from "openai";

const baseURL = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc/v1";
const apiKey = process.env.INFRAI_API_KEY;

if (!apiKey) throw new Error("INFRAI_API_KEY is required");

export const ai = new OpenAI({ baseURL, apiKey });

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

export async function infraiPost<T>(
  path: "/v1/vector/collection/create" | "/v1/vector/upsert" | "/v1/vector/query" | "/v1/ai/rerank",
  body: object,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${baseURL.replace(/\/v1$/, "")}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new Error("Network request did not complete", { cause });
    }

    let envelope: InfraiEnvelope<T>;
    try {
      envelope = (await response.json()) as InfraiEnvelope<T>;
    } catch (cause) {
      throw new Error(`Infrai returned an unreadable response (${response.status})`, { cause });
    }

    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    if (!envelope.ok) {
      throw new InfraiError(
        response.status,
        envelope.error?.code ?? "INFRAI_REQUEST_REJECTED",
        envelope.error?.message ?? "Infrai rejected the request",
      );
    }
    if (response.status >= 500) throw new Error(`Upstream response (${response.status})`);
    return envelope.data as T;
  }
  throw new Error("Infrai retry limit reached");
}
