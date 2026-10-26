import assert from "node:assert/strict";
import test from "node:test";
import { AiCoachService } from "../src/application/ai-coach/ai-coach-service";
import { AI_COACH_SYSTEM_PROMPT } from "../src/application/ai-coach/coach-policy";
import { createInitialAiCoachViewState } from "../src/application/ai-coach/ai-coach-view-state";
import { AiProviderError, type AiProvider } from "../src/application/ports/ai-provider";
import {
  parseAiCoachGuidance,
  parseAiCoachRequest,
  type AiCoachGuidance,
  type AiCoachRequest,
} from "../src/domain/ai-coach/ai-coach";
import { resolveAiCoachEndpoint } from "../src/infrastructure/ai/ai-coach-endpoint";
import {
  FixedWindowRateLimiter,
  isOriginAllowed,
  logAiCoachEvent,
  parseAllowedOrigins,
} from "../src/infrastructure/ai/ai-coach-backend-security";
import { RemoteAiCoachClient } from "../src/infrastructure/ai/remote-ai-coach-client";

const VALID_GUIDANCE: AiCoachGuidance = {
  bottleneckType: "Process",
  reasoningSummary: "The next useful step is to name which dimension feels unclear before changing the song.",
  suggestedSkill: "Arrangement",
  reflectionQuestions: ["Which change are you trying to hear more clearly?"],
  exercise: {
    title: "Describe one contrast",
    purpose: "Practice separating observation from a creative decision.",
    steps: ["Choose two unrelated everyday scenes.", "Describe one contrast between them without turning it into song material."],
  },
  returnToCreationPrompt: "Return to your song and choose the single dimension you want to investigate next.",
};

const VALID_REQUEST: AiCoachRequest = {
  projectId: "project-a",
  stage: "Arrangement",
  stuckDescription: "I know something should change between sections, but I do not know what dimension to examine.",
};

class FakeProvider implements AiProvider {
  readonly requests: AiCoachRequest[] = [];

  constructor(
    private readonly result: AiCoachGuidance = VALID_GUIDANCE,
    private readonly error?: AiProviderError,
  ) {}

  async requestCoaching(request: AiCoachRequest, systemPrompt: string): Promise<AiCoachGuidance> {
    this.requests.push(structuredClone(request));
    assert.equal(systemPrompt, AI_COACH_SYSTEM_PROMPT);
    if (this.error) throw this.error;
    return structuredClone(this.result);
  }
}

test("AI Coach is closed by default and makes no provider request before explicit use", () => {
  assert.deepEqual(createInitialAiCoachViewState(), { isOpen: false, status: "idle" });
  const provider = new FakeProvider();
  new AiCoachService(provider);
  assert.equal(provider.requests.length, 0);
});

test("valid structured coaching response is parsed and scoped to the request project", async () => {
  const provider = new FakeProvider();
  const result = await new AiCoachService(provider).requestCoaching(VALID_REQUEST);
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.equal(result.response.projectId, "project-a");
  assert.equal(result.response.suggestedSkill, "Arrangement");
  assert.equal(provider.requests.length, 1);
});

test("request validation accepts only minimum context and rejects project content fields", () => {
  assert.ok(parseAiCoachRequest(VALID_REQUEST));
  assert.equal(parseAiCoachRequest({ ...VALID_REQUEST, lyrics: "user lyrics" }), null);
  assert.equal(parseAiCoachRequest({ ...VALID_REQUEST, projectId: "" }), null);
});

test("suggestedSkill must map to an existing Skill Map value", () => {
  assert.ok(parseAiCoachGuidance(VALID_GUIDANCE));
  assert.equal(parseAiCoachGuidance({ ...VALID_GUIDANCE, suggestedSkill: "SongwritingMastery" }), null);
});

test("boundary validation rejects creative fields, chain-of-thought fields, and song-ready labels", () => {
  assert.equal(parseAiCoachGuidance({ ...VALID_GUIDANCE, lyrics: "A generated line" }), null);
  assert.equal(parseAiCoachGuidance({ ...VALID_GUIDANCE, hook: "A generated hook" }), null);
  assert.equal(parseAiCoachGuidance({ ...VALID_GUIDANCE, songTitle: "A generated title" }), null);
  assert.equal(parseAiCoachGuidance({ ...VALID_GUIDANCE, melody: "A melodic phrase" }), null);
  assert.equal(parseAiCoachGuidance({ ...VALID_GUIDANCE, chordProgression: ["C", "G"] }), null);
  assert.equal(parseAiCoachGuidance({ ...VALID_GUIDANCE, arrangementChoice: "Add drums" }), null);
  assert.equal(parseAiCoachGuidance({ ...VALID_GUIDANCE, bestTake: "Take 2" }), null);
  assert.equal(parseAiCoachGuidance({ ...VALID_GUIDANCE, chainOfThought: "private reasoning" }), null);
  assert.equal(parseAiCoachGuidance({ ...VALID_GUIDANCE, reasoningSummary: "Lyrics: copy this line into the song" }), null);
});

test("invalid provider output safely falls back instead of displaying a normal response", async () => {
  const invalid = { ...VALID_GUIDANCE, reflectionQuestions: [] } as AiCoachGuidance;
  const result = await new AiCoachService(new FakeProvider(invalid)).requestCoaching(VALID_REQUEST);
  assert.deepEqual(result, {
    status: "unavailable",
    reason: "invalid-response",
    message: "AI Coach is currently unavailable. You can keep creating with Learning Support, your Skill Map, and Reflection.",
  });
});

test("missing provider, timeout, rate limit, and provider failure all return non-destructive fallback", async () => {
  const missing = await new AiCoachService(null).requestCoaching(VALID_REQUEST);
  assert.equal(missing.status, "unavailable");
  if (missing.status === "unavailable") assert.equal(missing.reason, "unavailable");

  for (const code of ["timeout", "rate-limit", "authentication", "unavailable"] as const) {
    const result = await new AiCoachService(
      new FakeProvider(VALID_GUIDANCE, new AiProviderError(code, "provider detail")),
    ).requestCoaching(VALID_REQUEST);
    assert.equal(result.status, "unavailable");
    if (result.status === "unavailable") assert.equal(result.reason, code);
  }
});

test("Project A and B requests remain stateless and never exchange context", async () => {
  const provider = new FakeProvider();
  const service = new AiCoachService(provider);
  const projectA = { ...VALID_REQUEST, projectId: "project-a", stuckDescription: "A-only context" };
  const projectB = { ...VALID_REQUEST, projectId: "project-b", stuckDescription: "B-only context" };
  const resultA = await service.requestCoaching(projectA);
  const resultB = await service.requestCoaching(projectB);

  assert.equal(resultA.status === "available" ? resultA.response.projectId : null, "project-a");
  assert.equal(resultB.status === "available" ? resultB.response.projectId : null, "project-b");
  assert.deepEqual(provider.requests.map((request) => request.stuckDescription), ["A-only context", "B-only context"]);
  assert.equal(JSON.stringify(provider.requests[0]).includes("B-only"), false);
  assert.equal(JSON.stringify(provider.requests[1]).includes("A-only"), false);
});

test("AI Coach service does not mutate request or SongProject-like source data", async () => {
  const sourceProject = {
    projectId: "project-a",
    lyrics: { sections: [{ userLyrics: "User-owned words" }] },
    melody: { takes: [{ name: "User take" }] },
    harmony: { progressions: [{ chords: ["C"] }] },
    arrangement: { cells: [{ notes: "User choice" }] },
    songIntent: { coreIdea: "User intent" },
  };
  const before = structuredClone(sourceProject);
  const request = { ...VALID_REQUEST, projectId: sourceProject.projectId };
  await new AiCoachService(new FakeProvider()).requestCoaching(request);
  assert.deepEqual(sourceProject, before);
  assert.deepEqual(request, { ...VALID_REQUEST, projectId: "project-a" });
});

test("coach policy contains the permanent product boundary and hides internal reasoning", () => {
  for (const phrase of [
    "Never provide creative material that could be directly inserted",
    "Do not write, continue, rewrite, or propose lyrics",
    "melodic phrases",
    "chord progressions",
    "arrangement choices",
    "best-take selections",
    "Always return creative agency to the user",
    "never hidden reasoning or chain-of-thought",
  ]) {
    assert.equal(AI_COACH_SYSTEM_PROMPT.includes(phrase), true, `Missing policy phrase: ${phrase}`);
  }
});

test("desktop AI endpoint never falls back to a relative API route", () => {
  assert.equal(resolveAiCoachEndpoint({ desktopBuild: true }), null);
  assert.equal(resolveAiCoachEndpoint({ desktopBuild: false }), "/api/ai-coach");
  assert.equal(resolveAiCoachEndpoint({ desktopBuild: true, configuredEndpoint: "http://remote.example/api/ai-coach" }), null);
  assert.equal(
    resolveAiCoachEndpoint({ desktopBuild: true, configuredEndpoint: "https://coach.example/api/ai-coach" }),
    "https://coach.example/api/ai-coach",
  );
});

test("remote AI client validates the response and preserves offline fallback", async () => {
  const offline = await new RemoteAiCoachClient({ endpoint: null }).requestCoaching(VALID_REQUEST);
  assert.equal(offline.status, "unavailable");

  const disconnected = await new RemoteAiCoachClient({
    endpoint: "https://coach.example/api/ai-coach",
    fetchImplementation: async () => { throw new TypeError("network unavailable"); },
  }).requestCoaching(VALID_REQUEST);
  assert.equal(disconnected.status, "unavailable");
  if (disconnected.status === "unavailable") assert.equal(disconnected.reason, "unavailable");

  const client = new RemoteAiCoachClient({
    endpoint: "https://coach.example/api/ai-coach",
    fetchImplementation: async () => Response.json({
      status: "available",
      response: { projectId: VALID_REQUEST.projectId, ...VALID_GUIDANCE },
    }),
  });
  const result = await client.requestCoaching(VALID_REQUEST);
  assert.equal(result.status, "available");

  const mismatched = new RemoteAiCoachClient({
    endpoint: "https://coach.example/api/ai-coach",
    fetchImplementation: async () => Response.json({
      status: "available",
      response: { projectId: "another-project", ...VALID_GUIDANCE },
    }),
  });
  assert.equal((await mismatched.requestCoaching(VALID_REQUEST)).status, "unavailable");
});

test("remote AI client times out into the non-destructive fallback", async () => {
  const client = new RemoteAiCoachClient({
    endpoint: "https://coach.example/api/ai-coach",
    timeoutMs: 5,
    fetchImplementation: (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }),
  });
  const result = await client.requestCoaching(VALID_REQUEST);
  assert.equal(result.status, "unavailable");
  if (result.status === "unavailable") assert.equal(result.reason, "timeout");
});

test("backend CORS is exact and rate limiting is bounded per client", () => {
  const origins = parseAllowedOrigins("https://coach.example,tauri://localhost,http://tauri.localhost,https://coach.example/path");
  assert.deepEqual([...origins], ["https://coach.example", "tauri://localhost", "http://tauri.localhost"]);
  assert.equal(isOriginAllowed(new Request("https://api.example/api/ai-coach", { headers: { Origin: "tauri://localhost" } }), origins), true);
  assert.equal(isOriginAllowed(new Request("https://api.example/api/ai-coach", { headers: { Origin: "https://evil.example" } }), origins), false);

  const limiter = new FixedWindowRateLimiter(2, 1_000);
  assert.equal(limiter.take("client-a", 0).allowed, true);
  assert.equal(limiter.take("client-a", 1).allowed, true);
  assert.equal(limiter.take("client-a", 2).allowed, false);
  assert.equal(limiter.take("client-b", 2).allowed, true);
  assert.equal(limiter.take("client-a", 1_001).allowed, true);
});

test("backend operational log contains metadata only", () => {
  const originalInfo = console.info;
  let logged = "";
  console.info = (value?: unknown) => { logged = String(value); };
  try {
    logAiCoachEvent({ requestId: "request-1", outcome: "available", durationMs: 42, originAllowed: true });
  } finally {
    console.info = originalInfo;
  }
  assert.equal(logged.includes("request-1"), true);
  assert.equal(logged.includes(VALID_REQUEST.projectId), false);
  assert.equal(logged.includes(VALID_REQUEST.stuckDescription), false);
});
