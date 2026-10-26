import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CREATION_STAGES,
  getAdjacentCreationStages,
} from "../src/features/creation-journey/stages";
import {
  getCurrentProjectHref,
  getProjectNavigation,
  PROJECT_TOOL_DEFINITIONS,
  WORKSPACE_NAV_ITEMS,
} from "../src/features/navigation/navigation";
import {
  parseAppRoute,
  projectCreateRoute,
  projectReviewRoute,
  projectRoute,
  projectToolsRoute,
  WORKSPACE_ROUTES,
} from "../src/features/navigation/routes";

test("PHASE 20 workspace navigation exposes stable workspace-level destinations", () => {
  assert.deepEqual(
    WORKSPACE_NAV_ITEMS.map((item) => [item.label, item.href]),
    [
      ["项目", "/"],
      ["学习资料库", "/learning"],
      ["Skill Map", "/skills"],
      ["设置", "/settings"],
    ],
  );
});

test("PHASE 20 project navigation keeps projectId in every destination", () => {
  const projectId = "project-a";
  const navigation = getProjectNavigation(projectId, "Harmony");
  assert.deepEqual(navigation.map((item) => item.id), ["overview", "create", "tools", "review"]);
  assert.ok(navigation.every((item) => item.href.includes(`/projects/${projectId}`)));
  assert.equal(getCurrentProjectHref(projectId, "Harmony"), "/projects/project-a/create/harmony");
  assert.equal(getCurrentProjectHref(projectId, "Review"), "/projects/project-a/review");
  assert.equal(
    getProjectNavigation(projectId, "Review").find((item) => item.id === "create")?.href,
    "/projects/project-a/create/idea",
  );
});

test("PHASE 20 Create remains non-linear while Review and Tools are separate areas", () => {
  assert.equal(CREATION_STAGES.length, 9);
  assert.equal(CREATION_STAGES.some((item) => item.stage === "Review"), false);
  assert.deepEqual(getAdjacentCreationStages("Arrangement"), {
    previous: CREATION_STAGES[7],
    next: null,
  });
  assert.deepEqual(
    PROJECT_TOOL_DEFINITIONS.map((tool) => tool.slug),
    ["learning", "ai-coach", "garageband", "experiments", "versions"],
  );
});

test("Desktop Step 3 route model preserves every existing workspace and project path", () => {
  assert.deepEqual(parseAppRoute(WORKSPACE_ROUTES.projects), { kind: "dashboard", status: "active" });
  assert.deepEqual(parseAppRoute(WORKSPACE_ROUTES.archived), { kind: "dashboard", status: "archived" });
  assert.deepEqual(parseAppRoute(WORKSPACE_ROUTES.learning), { kind: "learning" });
  assert.deepEqual(parseAppRoute(WORKSPACE_ROUTES.skills), { kind: "skills" });
  assert.deepEqual(parseAppRoute(WORKSPACE_ROUTES.settings), { kind: "settings" });

  assert.deepEqual(parseAppRoute("/projects/project-a"), { kind: "project", projectId: "project-a" });
  assert.deepEqual(parseAppRoute("/projects/project-a/create/harmony"), {
    kind: "create",
    projectId: "project-a",
    stageSlug: "harmony",
  });
  assert.deepEqual(parseAppRoute("/projects/project-a/tools/versions"), {
    kind: "tools",
    projectId: "project-a",
    toolSlug: "versions",
  });
  assert.deepEqual(parseAppRoute("/projects/project-a/review"), { kind: "review", projectId: "project-a" });
});

test("Desktop Step 3 route builders encode ids and invalid deep paths stay invalid", () => {
  const projectId = "project / 中文";
  assert.equal(projectRoute(projectId), "/projects/project%20%2F%20%E4%B8%AD%E6%96%87");
  assert.equal(projectCreateRoute("project-a", "song-structure"), "/projects/project-a/create/song-structure");
  assert.equal(projectToolsRoute("project-a"), "/projects/project-a/tools");
  assert.equal(projectToolsRoute("project-a", "ai-coach"), "/projects/project-a/tools/ai-coach");
  assert.equal(projectReviewRoute("project-a"), "/projects/project-a/review");
  assert.deepEqual(parseAppRoute("/projects/project-a/create/not-a-stage/extra"), { kind: "not-found" });
  assert.deepEqual(parseAppRoute("/projects/project-a/unknown"), { kind: "not-found" });
  assert.deepEqual(parseAppRoute("/%E0%A4%A"), { kind: "not-found" });
});

test("Desktop Step 3 client router listens for history traversal without direct Feature Link imports", () => {
  const desktopRouterSource = readFileSync("src/features/desktop/desktop-router.tsx", "utf8");
  assert.match(desktopRouterSource, /addEventListener\("popstate"/);

  const sharedFeatureFiles = [
    "src/features/projects/projects-dashboard.tsx",
    "src/features/projects/project-page.tsx",
    "src/features/creation-journey/journey-page.tsx",
    "src/features/navigation/project-frame.tsx",
    "src/features/navigation/workspace-navigation.tsx",
  ];
  for (const file of sharedFeatureFiles) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /from ["']next\/link["']/);
  }
});

test("Final Audit keeps Lyrics heading ids unique and mobile progression actions usable", () => {
  const lyricsSource = readFileSync("src/features/lyrics/lyrics-workspace.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");

  assert.equal(lyricsSource.match(/id="current-stage-heading"/g)?.length, 1);
  assert.match(lyricsSource, /aria-labelledby={`lyrics-section-heading-\${section\.sectionId}`}/);
  assert.match(css, /\.progression-card > header \.danger-button\s*{[^}]*min-height:\s*40px;/);
  assert.doesNotMatch(
    css,
    /\.arrangement-matrix-scroll\s*{\s*margin-left:\s*-20px;\s*margin-right:\s*-20px;\s*}\s*\.arrangement-matrix-scroll\s*{\s*width:\s*100%;/,
  );
});
