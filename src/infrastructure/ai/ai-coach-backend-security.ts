const DEFAULT_WINDOW_MS = 10 * 60 * 1_000;
const DEFAULT_REQUEST_LIMIT = 20;
const MAX_TRACKED_CLIENTS = 10_000;

function parsePositiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function normalizeOrigin(value: string): string | null {
  if (value.trim() === "tauri://localhost") return "tauri://localhost";
  try {
    const url = new URL(value.trim());
    if (url.origin === "null" || (url.pathname !== "/" && url.pathname !== "") || url.search || url.hash || url.username || url.password) return null;
    if (url.protocol !== "https:" && url.origin !== "http://tauri.localhost" && url.origin !== "http://localhost:3000") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function parseAllowedOrigins(value: string | undefined): ReadonlySet<string> {
  return new Set((value ?? "").split(",").map(normalizeOrigin).filter((origin): origin is string => origin !== null));
}

export function isOriginAllowed(request: Request, allowedOrigins: ReadonlySet<string>): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin || allowedOrigins.has(origin);
}

export function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

interface RateLimitEntry {
  count: number;
  resetsAt: number;
}

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(
    private readonly limit = parsePositiveInteger(process.env.AI_COACH_RATE_LIMIT, DEFAULT_REQUEST_LIMIT, 1_000),
    private readonly windowMs = parsePositiveInteger(process.env.AI_COACH_RATE_WINDOW_MS, DEFAULT_WINDOW_MS, 60 * 60 * 1_000),
  ) {}

  take(clientKey: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    const current = this.entries.get(clientKey);
    if (!current || current.resetsAt <= now) {
      if (this.entries.size >= MAX_TRACKED_CLIENTS) this.prune(now);
      this.entries.set(clientKey, { count: 1, resetsAt: now + this.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (current.count >= this.limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetsAt - now) / 1_000)) };
    }
    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private prune(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.resetsAt <= now) this.entries.delete(key);
    }
    if (this.entries.size >= MAX_TRACKED_CLIENTS) this.entries.delete(this.entries.keys().next().value as string);
  }
}

export function clientRateLimitKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown-client";
}

export function logAiCoachEvent(event: {
  requestId: string;
  outcome: string;
  durationMs: number;
  originAllowed: boolean;
}): void {
  console.info(JSON.stringify({ scope: "ai-coach", ...event }));
}
