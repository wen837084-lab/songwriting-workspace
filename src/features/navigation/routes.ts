export const WORKSPACE_ROUTES = {
  projects: "/",
  archived: "/archived",
  learning: "/learning",
  skills: "/skills",
  settings: "/settings",
} as const;

export type AppRoute =
  | { kind: "dashboard"; status: "active" | "archived" }
  | { kind: "learning" }
  | { kind: "skills" }
  | { kind: "settings" }
  | { kind: "project"; projectId: string }
  | { kind: "create"; projectId: string; stageSlug: string }
  | { kind: "review"; projectId: string }
  | { kind: "tools"; projectId: string; toolSlug?: string }
  | { kind: "not-found" };

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function routeSegment(value: string): string {
  return encodeURIComponent(value);
}

export function parseAppRoute(pathname: string): AppRoute {
  const rawSegments = pathname.split("/").filter(Boolean);
  const segments = rawSegments.map(decodeSegment);
  if (segments.some((segment) => segment === null)) return { kind: "not-found" };

  const [first, second, third, fourth] = segments as (string | undefined)[];
  if (!first) return { kind: "dashboard", status: "active" };
  if (!second) {
    if (first === "archived") return { kind: "dashboard", status: "archived" };
    if (first === "learning") return { kind: "learning" };
    if (first === "skills") return { kind: "skills" };
    if (first === "settings") return { kind: "settings" };
  }

  if (first !== "projects" || !second) return { kind: "not-found" };
  if (!third) return { kind: "project", projectId: second };
  if (third === "review" && !fourth) return { kind: "review", projectId: second };
  if (third === "create" && fourth && segments.length === 4) {
    return { kind: "create", projectId: second, stageSlug: fourth };
  }
  if (third === "tools" && segments.length <= 4) {
    return { kind: "tools", projectId: second, toolSlug: fourth };
  }
  return { kind: "not-found" };
}

export function projectRoute(projectId: string): string {
  return `/projects/${routeSegment(projectId)}`;
}

export function projectCreateRoute(projectId: string, stageSlug: string): string {
  return `${projectRoute(projectId)}/create/${routeSegment(stageSlug)}`;
}

export function projectReviewRoute(projectId: string): string {
  return `${projectRoute(projectId)}/review`;
}

export function projectToolsRoute(projectId: string, toolSlug?: string): string {
  const baseRoute = `${projectRoute(projectId)}/tools`;
  return toolSlug ? `${baseRoute}/${routeSegment(toolSlug)}` : baseRoute;
}
