export interface AiCoachEndpointOptions {
  configuredEndpoint?: string;
  desktopBuild: boolean;
}

export function resolveAiCoachEndpoint(options: AiCoachEndpointOptions): string | null {
  const configured = options.configuredEndpoint?.trim();
  if (!configured) return options.desktopBuild ? null : "/api/ai-coach";

  let endpoint: URL;
  try {
    endpoint = new URL(configured);
  } catch {
    return null;
  }

  const isSecure = endpoint.protocol === "https:";
  const isLocalDevelopment = endpoint.protocol === "http:" && ["localhost", "127.0.0.1"].includes(endpoint.hostname);
  if ((!isSecure && !isLocalDevelopment) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    return null;
  }

  return endpoint.toString();
}

export function getAiCoachEndpoint(): string | null {
  return resolveAiCoachEndpoint({
    configuredEndpoint: process.env.NEXT_PUBLIC_AI_COACH_ENDPOINT,
    desktopBuild: process.env.NEXT_PUBLIC_DESKTOP_STATIC === "true",
  });
}
