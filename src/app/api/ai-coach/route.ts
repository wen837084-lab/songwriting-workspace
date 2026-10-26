import { AiCoachService } from "../../../application/ai-coach/ai-coach-service";
import { parseAiCoachRequest } from "../../../domain/ai-coach/ai-coach";
import {
  clientRateLimitKey,
  corsHeaders,
  FixedWindowRateLimiter,
  isOriginAllowed,
  logAiCoachEvent,
  parseAllowedOrigins,
} from "../../../infrastructure/ai/ai-coach-backend-security";
import { createAiProviderFromEnvironment } from "../../../infrastructure/ai/create-ai-provider";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 8 * 1_024;
const allowedOrigins = parseAllowedOrigins(process.env.AI_COACH_ALLOWED_ORIGINS);
const rateLimiter = new FixedWindowRateLimiter();
const securityHeaders: HeadersInit = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function responseHeaders(origin: string): HeadersInit {
  return { ...securityHeaders, ...corsHeaders(origin) };
}

function json(body: unknown, status: number, origin: string, additionalHeaders: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { ...responseHeaders(origin), ...additionalHeaders } });
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  if (!isOriginAllowed(request, allowedOrigins)) return new Response(null, { status: 403, headers: securityHeaders });
  return new Response(null, { status: 204, headers: responseHeaders(origin) });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const origin = request.headers.get("origin") ?? "";
  const originAllowed = isOriginAllowed(request, allowedOrigins);
  let outcome = "rejected";

  try {
    if (!originAllowed) return Response.json({ error: "Origin is not allowed." }, { status: 403, headers: securityHeaders });
    if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
      return json({ error: "Content-Type must be application/json." }, 415, origin);
    }

    const declaredLength = Number.parseInt(request.headers.get("content-length") ?? "", 10);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return json({ error: "Request body is too large." }, 413, origin);
    }

    const limit = rateLimiter.take(clientRateLimitKey(request));
    if (!limit.allowed) {
      outcome = "rate-limited";
      return json(
        { status: "unavailable", reason: "rate-limit", message: "AI Coach is currently unavailable." },
        429,
        origin,
        { "Retry-After": String(limit.retryAfterSeconds) },
      );
    }

    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
      return json({ error: "Request body is too large." }, 413, origin);
    }

    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      return json({ error: "Invalid request body." }, 400, origin);
    }

    const parsedRequest = parseAiCoachRequest(input);
    if (!parsedRequest) return json({ error: "Invalid AI Coach request." }, 400, origin);

    const service = new AiCoachService(createAiProviderFromEnvironment());
    const result = await service.requestCoaching(parsedRequest);
    outcome = result.status === "available" ? "available" : result.reason;
    return json(result, 200, origin, { "X-Request-Id": requestId });
  } finally {
    logAiCoachEvent({ requestId, outcome, durationMs: Date.now() - startedAt, originAllowed });
  }
}
