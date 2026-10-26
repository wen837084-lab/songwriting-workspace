import assert from "node:assert/strict";
import test from "node:test";
import {
  GARAGEBAND_EXPERIMENT_TYPES,
  sortProjects,
  type ChordSymbol,
} from "../src/domain/project/project";
import { MelodyService } from "../src/application/melody/melody-service";
import { VersionService } from "../src/application/versions/version-service";
import { compareVersions } from "../src/domain/project/versions";
import { recordingErrorMessage } from "../src/application/melody/recording-errors";
import { recordTempoTap } from "../src/application/rhythm/tap-tempo";
import { getSongMapSectionStatuses } from "../src/application/song-map/section-status";
import type { AudioAsset, AudioAssetRepository } from "../src/application/ports/audio-asset-repository";
import {
  getAdjacentStages,
  getStageFromSlug,
  JOURNEY_STAGES,
} from "../src/features/creation-journey/stages";
import { countRepeatedTerms } from "../src/features/reflection/repetition";
import {
  getAllLearningStageContent,
  getLearningStageContent,
  LEARNING_TABS,
} from "../src/domain/learning/learning";
import {
  CURRENT_SCHEMA_VERSION,
  LocalProjectRepository,
} from "../src/infrastructure/persistence/local-project-repository";
import { LocalWorkspaceRepository } from "../src/infrastructure/persistence/local-workspace-repository";
import type { KeyValueStorage } from "../src/infrastructure/persistence/storage";

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

class MemoryAudioAssetRepository implements AudioAssetRepository {
  readonly assets = new Map<string, AudioAsset>();

  async put(asset: AudioAsset): Promise<void> {
    this.assets.set(asset.audioAssetId, structuredClone(asset));
  }

  async get(projectId: string, audioAssetId: string): Promise<AudioAsset | null> {
    const asset = this.assets.get(audioAssetId);
    if (!asset) return null;
    if (asset.projectId !== projectId) throw new Error("Recorded audio does not belong to this project.");
    return structuredClone(asset);
  }

  async listByProject(projectId: string): Promise<AudioAsset[]> {
    return [...this.assets.values()].filter((asset) => asset.projectId === projectId).map((asset) => structuredClone(asset));
  }

  async listBySection(projectId: string, sectionId: string): Promise<AudioAsset[]> {
    return [...this.assets.values()].filter((asset) => asset.projectId === projectId && asset.sectionId === sectionId).map((asset) => structuredClone(asset));
  }

  async delete(projectId: string, audioAssetId: string): Promise<void> {
    const asset = this.assets.get(audioAssetId);
    if (asset && asset.projectId !== projectId) throw new Error("Recorded audio does not belong to this project.");
    this.assets.delete(audioAssetId);
  }

  async deleteByProject(projectId: string): Promise<void> {
    for (const asset of await this.listByProject(projectId)) this.assets.delete(asset.audioAssetId);
  }

  async deleteBySection(projectId: string, sectionId: string): Promise<void> {
    for (const asset of await this.listBySection(projectId, sectionId)) this.assets.delete(asset.audioAssetId);
  }
}

function createHarness() {
  const storage = new MemoryStorage();
  let time = Date.parse("2026-09-19T00:00:00.000Z");
  let id = 0;
  const options = {
    now: () => new Date((time += 1_000)).toISOString(),
    createId: () => `id-${++id}`,
  };
  return {
    storage,
    options,
    repository: new LocalProjectRepository(storage, options),
  };
}

test("PHASE 1 project lifecycle preserves project isolation", () => {
  const { storage, options, repository } = createHarness();

  const projectA = repository.create({
    title: "Project A",
    projectNote: "Only A owns this note",
  });
  const projectB = repository.create({ title: "Project B" });
  assert.equal(projectA.creationMode, "Guided");
  assert.equal(projectA.currentStage, "Idea");
  assert.notEqual(projectA.projectId, projectB.projectId);
  assert.equal(projectB.projectNote, "");
  assert.equal(repository.get(projectB.projectId)?.projectNote, "");

  assert.equal(
    repository.get(projectA.projectId)?.projectNote,
    "Only A owns this note",
  );

  const duplicate = repository.duplicate(projectA.projectId);
  assert.notEqual(duplicate.projectId, projectA.projectId);
  repository.update(duplicate.projectId, {
    title: "Project A alternate",
    projectNote: "Duplicate-only note",
  });
  assert.equal(repository.get(projectA.projectId)?.title, "Project A");
  assert.equal(
    repository.get(projectA.projectId)?.projectNote,
    "Only A owns this note",
  );

  repository.update(projectA.projectId, { projectNote: "A changed later" });
  assert.equal(
    repository.get(duplicate.projectId)?.projectNote,
    "Duplicate-only note",
  );

  const refreshedRepository = new LocalProjectRepository(storage, options);
  assert.equal(refreshedRepository.list("active").length, 3);
  assert.equal(
    refreshedRepository.get(projectA.projectId)?.projectNote,
    "A changed later",
  );
  assert.equal(
    refreshedRepository.get(duplicate.projectId)?.projectNote,
    "Duplicate-only note",
  );

  refreshedRepository.archive(projectA.projectId);
  assert.equal(
    refreshedRepository.list("active").some((item) => item.projectId === projectA.projectId),
    false,
  );
  assert.equal(
    refreshedRepository.list("archived").some(
      (item) => item.projectId === projectA.projectId,
    ),
    true,
  );
  assert.equal(
    refreshedRepository.get(projectA.projectId)?.projectNote,
    "A changed later",
  );

  refreshedRepository.delete(projectB.projectId);
  assert.equal(refreshedRepository.get(projectB.projectId), null);
  assert.equal(
    refreshedRepository.get(projectA.projectId)?.projectNote,
    "A changed later",
  );
  assert.equal(
    refreshedRepository.get(duplicate.projectId)?.projectNote,
    "Duplicate-only note",
  );
});

test("schema version 1 projects migrate without losing PHASE 1 data", () => {
  const storage = new MemoryStorage();
  const projectId = "phase-1-project";
  const createdAt = "2026-09-01T00:00:00.000Z";
  const updatedAt = "2026-09-02T00:00:00.000Z";
  const summary = {
    projectId,
    title: "Existing song",
    createdAt,
    updatedAt,
    currentStage: "Idea",
    status: "archived",
  };
  storage.setItem("songwriting-workspace:meta", JSON.stringify({
    schemaVersion: 1,
    appDataCreatedAt: createdAt,
    lastMigratedAt: createdAt,
  }));
  storage.setItem("songwriting-workspace:workspace", JSON.stringify({
    schemaVersion: 1,
    data: { workspaceId: "workspace-1", projectIndex: [summary] },
  }));
  storage.setItem(`songwriting-workspace:project:${projectId}`, JSON.stringify({
    schemaVersion: 1,
    data: { ...summary, projectNote: "Keep this note" },
  }));

  const repository = new LocalProjectRepository(storage, {
    now: () => "2026-09-19T00:00:00.000Z",
  });
  const migrated = repository.get(projectId);

  assert.equal(migrated?.title, "Existing song");
  assert.equal(migrated?.projectNote, "Keep this note");
  assert.equal(migrated?.status, "archived");
  assert.equal(migrated?.creationMode, "Guided");
  assert.equal(migrated?.currentStage, "Idea");
  assert.equal(
    JSON.parse(storage.getItem("songwriting-workspace:meta") ?? "{}").schemaVersion,
    CURRENT_SCHEMA_VERSION,
  );
});

test("creation mode is isolated by project and persists after refresh", () => {
  const { storage, options, repository } = createHarness();
  const projectA = repository.create({ title: "Project A" });
  const projectB = repository.create({ title: "Project B" });

  const updatedA = repository.setCreationMode(projectA.projectId, "Guided");
  const updatedB = repository.setCreationMode(projectB.projectId, "Free");

  assert.notEqual(updatedA.updatedAt, projectA.updatedAt);
  assert.notEqual(updatedB.updatedAt, projectB.updatedAt);

  const refreshed = new LocalProjectRepository(storage, options);
  assert.equal(refreshed.get(projectA.projectId)?.creationMode, "Guided");
  assert.equal(refreshed.get(projectB.projectId)?.creationMode, "Free");
});

test("current stage is isolated by project and persists after refresh", () => {
  const { storage, options, repository } = createHarness();
  const projectA = repository.create({ title: "Project A", projectNote: "A note" });
  const projectB = repository.create({ title: "Project B", projectNote: "B note" });

  const updatedA = repository.setCurrentStage(projectA.projectId, "Lyrics");
  const updatedB = repository.setCurrentStage(projectB.projectId, "Harmony");

  assert.notEqual(updatedA.updatedAt, projectA.updatedAt);
  assert.notEqual(updatedB.updatedAt, projectB.updatedAt);

  const refreshed = new LocalProjectRepository(storage, options);
  assert.equal(refreshed.get(projectA.projectId)?.currentStage, "Lyrics");
  assert.equal(refreshed.get(projectB.projectId)?.currentStage, "Harmony");
  assert.equal(refreshed.get(projectA.projectId)?.projectNote, "A note");
  assert.equal(refreshed.get(projectB.projectId)?.projectNote, "B note");
});

test("journey navigation exposes every stage without locking free or guided mode", () => {
  assert.equal(JOURNEY_STAGES.length, 10);
  assert.deepEqual(
    JOURNEY_STAGES.map((item) => getStageFromSlug(item.slug)),
    JOURNEY_STAGES.map((item) => item.stage),
  );
  assert.equal(getStageFromSlug("not-a-stage"), null);

  const lyricsNavigation = getAdjacentStages("Lyrics");
  assert.equal(lyricsNavigation.previous?.stage, "Define");
  assert.equal(lyricsNavigation.next?.stage, "Melody");
});

test("PHASE 12 learning support is static, stage-related, and separate from project data", () => {
  const content = getAllLearningStageContent();

  assert.equal(content.length, JOURNEY_STAGES.length);
  assert.deepEqual(
    content.map((item) => item.stage),
    JOURNEY_STAGES.map((item) => item.stage),
  );
  assert.deepEqual(LEARNING_TABS, [
    "quick-understanding",
    "practice",
    "deeper-learning",
  ]);

  for (const stage of JOURNEY_STAGES.map((item) => item.stage)) {
    const stageContent = getLearningStageContent(stage);
    assert.equal("projectId" in stageContent, false);
    assert.ok(stageContent.quickUnderstanding.points.length > 0);
    assert.ok(stageContent.practice.points.length > 0);
    assert.ok(stageContent.deeperLearning.points.length > 0);
  }
});

test("an invalid project lookup and journey update never create a project", () => {
  const { repository } = createHarness();
  assert.equal(repository.get("missing"), null);
  assert.throws(
    () => repository.setCurrentStage("missing", "Lyrics"),
    /was not found/i,
  );
  assert.equal(repository.list().length, 0);
});

test("sorting returns a new array and never mutates project data", () => {
  const { repository } = createHarness();
  repository.create({ title: "Zulu" });
  repository.create({ title: "Alpha" });
  const original = repository.list("active");
  const sorted = sortProjects(original, "title");

  assert.deepEqual(
    sorted.map((project) => project.title),
    ["Alpha", "Zulu"],
  );
  assert.deepEqual(
    original.map((project) => project.title),
    ["Zulu", "Alpha"],
  );
});

test("an unsupported schema version is rejected without overwriting data", () => {
  const storage = new MemoryStorage();
  const futureMeta = JSON.stringify({
    schemaVersion: CURRENT_SCHEMA_VERSION + 1,
    appDataCreatedAt: "future",
    lastMigratedAt: "future",
  });
  storage.setItem("songwriting-workspace:meta", futureMeta);
  const repository = new LocalProjectRepository(storage);

  assert.throws(() => repository.list(), /unsupported schema version/i);
  assert.equal(storage.getItem("songwriting-workspace:meta"), futureMeta);
  assert.equal(storage.getItem("songwriting-workspace:workspace"), null);
});

test("PHASE 3 materials are isolated by project and persist after refresh", () => {
  const { storage, options, repository } = createHarness();
  const projectA = repository.create({ title: "Project A" });
  const projectB = repository.create({ title: "Project B" });

  const materialA = repository.addMaterial(projectA.projectId, {
    type: "scene",
    content: "Material A",
  });
  const materialB = repository.addMaterial(projectB.projectId, {
    type: "sound",
    content: "Material B",
  });

  assert.equal(materialA.projectId, projectA.projectId);
  assert.equal(materialB.projectId, projectB.projectId);
  assert.deepEqual(repository.get(projectA.projectId)?.materials.map((item) => item.content), ["Material A"]);
  assert.deepEqual(repository.get(projectB.projectId)?.materials.map((item) => item.content), ["Material B"]);

  const refreshed = new LocalProjectRepository(storage, options);
  assert.deepEqual(refreshed.get(projectA.projectId)?.materials.map((item) => item.content), ["Material A"]);
  assert.deepEqual(refreshed.get(projectB.projectId)?.materials.map((item) => item.content), ["Material B"]);
});

test("explore answer, skip, and back preserve prior responses after refresh", () => {
  const { storage, options, repository } = createHarness();
  const project = repository.create({ title: "Explore persistence" });

  repository.answerExplore(project.projectId, {
    promptId: "question-1",
    promptIndex: 0,
    content: "First answer",
  });
  repository.answerExplore(project.projectId, {
    promptId: "question-2",
    promptIndex: 1,
    content: "Second answer",
  });
  repository.skipExplore(project.projectId, "question-3", 2);
  repository.setExplorePromptIndex(project.projectId, 1);

  const refreshed = new LocalProjectRepository(storage, options).get(project.projectId);
  assert.equal(refreshed?.explore.currentPromptIndex, 1);
  assert.equal(refreshed?.explore.responses.find((item) => item.promptId === "question-1")?.content, "First answer");
  assert.equal(refreshed?.explore.responses.find((item) => item.promptId === "question-2")?.content, "Second answer");
  assert.equal(refreshed?.explore.responses.find((item) => item.promptId === "question-3")?.status, "skipped");
});

test("manual Add Note, material edit, type change, and delete affect only the target material", () => {
  const { storage, options, repository } = createHarness();
  const project = repository.create({ title: "Materials" });
  const first = repository.addMaterial(project.projectId, {
    type: "other",
    content: "A note from Explore",
    note: "Keep the uncertainty",
  });
  const second = repository.addMaterial(project.projectId, {
    type: "object",
    content: "Old key",
  });

  repository.updateMaterial(project.projectId, first.materialId, {
    type: "memory",
    content: "Edited note from Explore",
  });
  let refreshed = new LocalProjectRepository(storage, options).get(project.projectId);
  assert.equal(refreshed?.materials.find((item) => item.materialId === first.materialId)?.type, "memory");
  assert.equal(refreshed?.materials.find((item) => item.materialId === first.materialId)?.content, "Edited note from Explore");

  repository.deleteMaterial(project.projectId, first.materialId);
  refreshed = new LocalProjectRepository(storage, options).get(project.projectId);
  assert.equal(refreshed?.materials.some((item) => item.materialId === first.materialId), false);
  assert.equal(refreshed?.materials.find((item) => item.materialId === second.materialId)?.content, "Old key");
});

test("an Explore answer becomes a material only when the user explicitly chooses it", () => {
  const { repository } = createHarness();
  const project = repository.create({ title: "No automatic creation" });

  repository.answerExplore(project.projectId, {
    promptId: "question-1",
    promptIndex: 0,
    content: "Answer only",
  });
  assert.equal(repository.get(project.projectId)?.materials.length, 0);

  repository.answerExplore(project.projectId, {
    promptId: "question-2",
    promptIndex: 1,
    content: "User chose to keep this",
    saveAsMaterial: "phrase",
  });
  const updated = repository.get(project.projectId);
  assert.equal(updated?.materials.length, 1);
  assert.equal(updated?.materials[0].origin, "explore-response");
  assert.equal(updated?.materials[0].sourcePromptId, "question-2");
});

test("duplicating a PHASE 3 project rebuilds ownership and child IDs without shared changes", () => {
  const { repository } = createHarness();
  const original = repository.create({ title: "Original" });
  repository.setIdeaStartingPoint(original.projectId, "emotion");
  repository.answerExplore(original.projectId, {
    promptId: "question-1",
    promptIndex: 0,
    content: "Original response",
    saveAsMaterial: "emotion",
  });
  repository.addMaterial(original.projectId, { type: "scene", content: "Second material" });

  const duplicate = repository.duplicate(original.projectId);
  const originalAfterDuplicate = repository.get(original.projectId)!;
  assert.notEqual(duplicate.projectId, original.projectId);
  assert.equal(duplicate.idea.startingPoint, "emotion");
  assert.deepEqual(duplicate.materials.map((item) => item.content), originalAfterDuplicate.materials.map((item) => item.content));
  assert.ok(duplicate.materials.every((item) => item.projectId === duplicate.projectId));
  assert.ok(duplicate.explore.responses.every((item) => item.projectId === duplicate.projectId));
  assert.notDeepEqual(duplicate.materials.map((item) => item.materialId), originalAfterDuplicate.materials.map((item) => item.materialId));
  assert.notDeepEqual(duplicate.explore.responses.map((item) => item.responseId), originalAfterDuplicate.explore.responses.map((item) => item.responseId));

  repository.updateMaterial(duplicate.projectId, duplicate.materials[0].materialId, { content: "Duplicate changed" });
  repository.deleteMaterial(original.projectId, originalAfterDuplicate.materials[1].materialId);
  assert.equal(repository.get(original.projectId)?.materials[0].content, "Original response");
  assert.equal(repository.get(duplicate.projectId)?.materials[0].content, "Duplicate changed");
  assert.equal(repository.get(duplicate.projectId)?.materials.length, 2);
});

test("schema version 2 projects migrate to empty PHASE 3 fields without losing data", () => {
  const storage = new MemoryStorage();
  const projectId = "phase-2-project";
  const createdAt = "2026-09-10T00:00:00.000Z";
  const updatedAt = "2026-09-11T00:00:00.000Z";
  const summary = {
    projectId,
    title: "Existing phase 2 song",
    createdAt,
    updatedAt,
    currentStage: "Explore",
    status: "archived",
  };
  storage.setItem("songwriting-workspace:meta", JSON.stringify({
    schemaVersion: 2,
    appDataCreatedAt: createdAt,
    lastMigratedAt: createdAt,
  }));
  storage.setItem("songwriting-workspace:workspace", JSON.stringify({
    schemaVersion: 2,
    data: { workspaceId: "workspace-2", projectIndex: [summary] },
  }));
  storage.setItem(`songwriting-workspace:project:${projectId}`, JSON.stringify({
    schemaVersion: 2,
    data: {
      ...summary,
      creationMode: "Free",
      projectNote: "Preserve this note",
    },
  }));

  const repository = new LocalProjectRepository(storage, {
    now: () => "2026-09-19T00:00:00.000Z",
  });
  const migrated = repository.get(projectId);
  assert.equal(migrated?.title, "Existing phase 2 song");
  assert.equal(migrated?.projectNote, "Preserve this note");
  assert.equal(migrated?.creationMode, "Free");
  assert.equal(migrated?.currentStage, "Explore");
  assert.equal(migrated?.status, "archived");
  assert.deepEqual(migrated?.idea, { startingPoint: null });
  assert.deepEqual(migrated?.explore, { currentPromptIndex: 0, responses: [] });
  assert.deepEqual(migrated?.materials, []);
  assert.deepEqual(migrated?.songIntent, {
    projectId,
    coreIdea: "",
    desiredFeeling: "",
    coreImage: "",
    centralConflict: "",
    selectedMaterialIds: [],
    updatedAt: "2026-09-19T00:00:00.000Z",
  });
  assert.deepEqual(migrated?.lyrics, { sections: [] });
  assert.equal(JSON.parse(storage.getItem("songwriting-workspace:meta") ?? "{}").schemaVersion, CURRENT_SCHEMA_VERSION);
});

test("deleting a project removes its nested PHASE 3 data without affecting another project", () => {
  const { storage, repository } = createHarness();
  const deletedProject = repository.create({ title: "Delete me" });
  const keptProject = repository.create({ title: "Keep me" });
  repository.addMaterial(deletedProject.projectId, { type: "phrase", content: "Nested material" });
  repository.answerExplore(deletedProject.projectId, {
    promptId: "question-1",
    promptIndex: 0,
    content: "Nested response",
  });
  repository.addMaterial(keptProject.projectId, { type: "sound", content: "Keep this" });

  repository.delete(deletedProject.projectId);

  assert.equal(repository.get(deletedProject.projectId), null);
  assert.equal(storage.getItem(`songwriting-workspace:project:${deletedProject.projectId}`), null);
  assert.deepEqual(repository.get(keptProject.projectId)?.materials.map((item) => item.content), ["Keep this"]);
});

test("PHASE 4 Song Intent persists exact user wording, edits, and clearing", () => {
  const { storage, options, repository } = createHarness();
  const project = repository.create({ title: "Intent persistence" });

  repository.updateSongIntent(project.projectId, {
    coreIdea: "我也不知道，可能就是回去以后发现什么都不一样了。",
    desiredFeeling: " 复杂，但不是悲伤。 ",
    coreImage: "空着的站台",
    centralConflict: "想回去，同时又不想回去",
  });
  repository.updateSongIntent(project.projectId, {
    coreIdea: "后来我改变了想法",
    coreImage: "",
  });

  const refreshed = new LocalProjectRepository(storage, options).get(project.projectId)!;
  assert.equal(refreshed.songIntent.coreIdea, "后来我改变了想法");
  assert.equal(refreshed.songIntent.desiredFeeling, " 复杂，但不是悲伤。 ");
  assert.equal(refreshed.songIntent.coreImage, "");
  assert.equal(refreshed.songIntent.centralConflict, "想回去，同时又不想回去");
});

test("Song Intent is isolated between projects and starts empty without automatic choices", () => {
  const { storage, options, repository } = createHarness();
  const projectA = repository.create({ title: "Project A" });
  const projectB = repository.create({ title: "Project B" });
  repository.addMaterial(projectA.projectId, { type: "scene", content: "A scene" });
  repository.addMaterial(projectB.projectId, { type: "object", content: "B object" });

  assert.deepEqual(repository.get(projectA.projectId)?.songIntent.selectedMaterialIds, []);
  assert.deepEqual(repository.get(projectB.projectId)?.songIntent.selectedMaterialIds, []);
  assert.equal(repository.get(projectA.projectId)?.songIntent.coreIdea, "");
  assert.equal(repository.get(projectB.projectId)?.songIntent.coreIdea, "");

  repository.updateSongIntent(projectA.projectId, { coreIdea: "Only A" });
  repository.updateSongIntent(projectB.projectId, { coreIdea: "Only B" });
  const refreshed = new LocalProjectRepository(storage, options);
  assert.equal(refreshed.get(projectA.projectId)?.songIntent.coreIdea, "Only A");
  assert.equal(refreshed.get(projectB.projectId)?.songIntent.coreIdea, "Only B");
});

test("selected materials persist and reject automatic, cross-project, duplicate, or excessive references", () => {
  const { storage, options, repository } = createHarness();
  const projectA = repository.create({ title: "Project A" });
  const projectB = repository.create({ title: "Project B" });
  const materialsA = [
    repository.addMaterial(projectA.projectId, { type: "scene", content: "Scene" }),
    repository.addMaterial(projectA.projectId, { type: "phrase", content: "Phrase" }),
    repository.addMaterial(projectA.projectId, { type: "sound", content: "Sound" }),
    repository.addMaterial(projectA.projectId, { type: "object", content: "Object" }),
  ];
  const materialB = repository.addMaterial(projectB.projectId, { type: "memory", content: "B" });

  repository.updateSongIntent(projectA.projectId, {
    selectedMaterialIds: [materialsA[0].materialId, materialsA[2].materialId],
  });
  assert.deepEqual(
    new LocalProjectRepository(storage, options).get(projectA.projectId)?.songIntent.selectedMaterialIds,
    [materialsA[0].materialId, materialsA[2].materialId],
  );
  assert.throws(
    () => repository.updateSongIntent(projectA.projectId, {
      selectedMaterialIds: [materialB.materialId],
    }),
    /only select materials from this project/i,
  );
  assert.throws(
    () => repository.updateSongIntent(projectA.projectId, {
      selectedMaterialIds: [materialsA[0].materialId, materialsA[0].materialId],
    }),
    /only select materials from this project/i,
  );
  assert.throws(
    () => repository.updateSongIntent(projectA.projectId, {
      selectedMaterialIds: materialsA.map((material) => material.materialId),
    }),
    /at most three/i,
  );
});

test("duplicating Song Intent remaps selected materials to independent copied IDs", () => {
  const { repository } = createHarness();
  const original = repository.create({ title: "Original" });
  const first = repository.addMaterial(original.projectId, { type: "scene", content: "Scene" });
  const second = repository.addMaterial(original.projectId, { type: "phrase", content: "Phrase" });
  repository.updateSongIntent(original.projectId, {
    coreIdea: "User-written intent",
    selectedMaterialIds: [first.materialId],
  });

  const duplicate = repository.duplicate(original.projectId);
  const copiedFirst = duplicate.materials.find((material) => material.content === "Scene")!;
  assert.notEqual(duplicate.projectId, original.projectId);
  assert.equal(duplicate.songIntent.projectId, duplicate.projectId);
  assert.equal(duplicate.songIntent.coreIdea, "User-written intent");
  assert.deepEqual(duplicate.songIntent.selectedMaterialIds, [copiedFirst.materialId]);
  assert.notEqual(copiedFirst.materialId, first.materialId);
  assert.ok(duplicate.songIntent.selectedMaterialIds.every((selectedId) =>
    duplicate.materials.some((material) => material.materialId === selectedId)
  ));

  repository.deleteMaterial(duplicate.projectId, copiedFirst.materialId);
  repository.updateMaterial(duplicate.projectId, duplicate.materials.find((item) => item.content === "Phrase")!.materialId, {
    content: "Duplicate-only change",
  });
  const originalAfterChanges = repository.get(original.projectId)!;
  assert.equal(originalAfterChanges.materials.find((item) => item.materialId === first.materialId)?.content, "Scene");
  assert.equal(originalAfterChanges.materials.find((item) => item.materialId === second.materialId)?.content, "Phrase");
  assert.deepEqual(originalAfterChanges.songIntent.selectedMaterialIds, [first.materialId]);
});

test("deleting a selected material removes only its Song Intent reference", () => {
  const { repository } = createHarness();
  const project = repository.create({ title: "Reference cleanup" });
  const selected = repository.addMaterial(project.projectId, { type: "scene", content: "Selected" });
  const unselected = repository.addMaterial(project.projectId, { type: "sound", content: "Unselected" });
  repository.updateSongIntent(project.projectId, { selectedMaterialIds: [selected.materialId] });

  repository.deleteMaterial(project.projectId, selected.materialId);
  const updated = repository.get(project.projectId)!;
  assert.deepEqual(updated.songIntent.selectedMaterialIds, []);
  assert.equal(updated.materials.some((item) => item.materialId === selected.materialId), false);
  assert.equal(updated.materials.some((item) => item.materialId === unselected.materialId), true);
});

test("schema version 3 migrates through v5 without losing PHASE 1–3 data", () => {
  const storage = new MemoryStorage();
  const projectId = "phase-3-project";
  const createdAt = "2026-09-10T00:00:00.000Z";
  const updatedAt = "2026-09-11T00:00:00.000Z";
  const summary = {
    projectId,
    title: "Existing phase 3 song",
    createdAt,
    updatedAt,
    currentStage: "Define",
    status: "active",
  };
  const response = {
    responseId: "response-1",
    projectId,
    promptId: "question-1",
    status: "answered",
    content: "Keep the response",
    updatedAt,
  };
  const material = {
    materialId: "material-1",
    projectId,
    type: "scene",
    content: "Keep the material",
    note: "Keep the note",
    origin: "manual",
    createdAt,
    updatedAt,
  };
  storage.setItem("songwriting-workspace:meta", JSON.stringify({
    schemaVersion: 3,
    appDataCreatedAt: createdAt,
    lastMigratedAt: createdAt,
  }));
  storage.setItem("songwriting-workspace:workspace", JSON.stringify({
    schemaVersion: 3,
    data: { workspaceId: "workspace-3", projectIndex: [summary] },
  }));
  storage.setItem(`songwriting-workspace:project:${projectId}`, JSON.stringify({
    schemaVersion: 3,
    data: {
      ...summary,
      creationMode: "Free",
      projectNote: "Keep the project note",
      idea: { startingPoint: "story" },
      explore: { currentPromptIndex: 1, responses: [response] },
      materials: [material],
    },
  }));

  const repository = new LocalProjectRepository(storage, {
    now: () => "2026-09-19T00:00:00.000Z",
  });
  const migrated = repository.get(projectId)!;
  assert.equal(migrated.title, "Existing phase 3 song");
  assert.equal(migrated.projectNote, "Keep the project note");
  assert.equal(migrated.status, "active");
  assert.equal(migrated.creationMode, "Free");
  assert.equal(migrated.currentStage, "Define");
  assert.deepEqual(migrated.idea, { startingPoint: "story" });
  assert.deepEqual(migrated.explore, { currentPromptIndex: 1, responses: [response] });
  assert.deepEqual(migrated.materials, [material]);
  assert.deepEqual(migrated.songIntent, {
    projectId,
    coreIdea: "",
    desiredFeeling: "",
    coreImage: "",
    centralConflict: "",
    selectedMaterialIds: [],
    updatedAt: "2026-09-19T00:00:00.000Z",
  });
  assert.deepEqual(migrated.lyrics, { sections: [] });
  assert.equal(JSON.parse(storage.getItem("songwriting-workspace:meta") ?? "{}").schemaVersion, CURRENT_SCHEMA_VERSION);
});

test("PHASE 5 add, rename, lyrics, and notes persist by stable section ID", () => {
  const { storage, options, repository } = createHarness();
  const project = repository.create({ title: "Lyrics persistence" });
  const verse = repository.addLyricsSection(project.projectId, { type: "verse", name: "Verse 1" });
  const chorus = repository.addLyricsSection(project.projectId, { type: "chorus", name: "Chorus" });
  const originalUpdatedAt = verse.updatedAt;

  repository.updateLyricsSection(project.projectId, verse.sectionId, {
    name: "Opening Verse",
    userLyrics: "User-written verse\nSecond user-written line",
    notes: "Keep the opening quiet",
  });
  repository.updateLyricsSection(project.projectId, chorus.sectionId, {
    userLyrics: "User-written chorus",
  });

  const refreshed = new LocalProjectRepository(storage, options).get(project.projectId)!;
  assert.deepEqual(refreshed.lyrics.sections.map((section) => section.order), [0, 1]);
  assert.deepEqual(refreshed.lyrics.sections.map((section) => section.sectionId), [verse.sectionId, chorus.sectionId]);
  assert.equal(refreshed.lyrics.sections[0].name, "Opening Verse");
  assert.equal(refreshed.lyrics.sections[0].userLyrics, "User-written verse\nSecond user-written line");
  assert.equal(refreshed.lyrics.sections[0].notes, "Keep the opening quiet");
  assert.equal(refreshed.lyrics.sections[1].userLyrics, "User-written chorus");
  assert.notEqual(refreshed.lyrics.sections[0].updatedAt, originalUpdatedAt);
});

test("PHASE 5 lyrics remain isolated between projects and creation modes share one data set", () => {
  const { storage, options, repository } = createHarness();
  const projectA = repository.create({ title: "Project A" });
  const projectB = repository.create({ title: "Project B" });
  const sectionA = repository.addLyricsSection(projectA.projectId, { type: "verse", name: "A Verse" });
  const sectionB = repository.addLyricsSection(projectB.projectId, { type: "custom", name: "B Section" });
  repository.updateLyricsSection(projectA.projectId, sectionA.sectionId, { userLyrics: "Only project A" });
  repository.updateLyricsSection(projectB.projectId, sectionB.sectionId, { userLyrics: "Only project B" });

  repository.setCreationMode(projectA.projectId, "Free");
  assert.equal(repository.get(projectA.projectId)?.lyrics.sections[0].userLyrics, "Only project A");
  repository.setCreationMode(projectA.projectId, "Guided");
  const refreshed = new LocalProjectRepository(storage, options);
  assert.equal(refreshed.get(projectA.projectId)?.lyrics.sections[0].userLyrics, "Only project A");
  assert.equal(refreshed.get(projectB.projectId)?.lyrics.sections[0].userLyrics, "Only project B");
  assert.notEqual(sectionA.sectionId, sectionB.sectionId);
});

test("guided starting structure is explicit, editable, and contains no generated lyrics", () => {
  const { repository } = createHarness();
  const project = repository.create({ title: "Guided lyrics" });
  assert.deepEqual(project.lyrics, { sections: [] });

  const initialized = repository.initializeGuidedLyrics(project.projectId);
  assert.deepEqual(
    initialized.lyrics.sections.map((section) => section.name),
    ["Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Final Chorus"],
  );
  assert.ok(initialized.lyrics.sections.every((section) => section.userLyrics === ""));
  assert.ok(initialized.lyrics.sections.every((section) => section.notes === ""));
  assert.equal(new Set(initialized.lyrics.sections.map((section) => section.sectionId)).size, 6);
  assert.throws(() => repository.initializeGuidedLyrics(project.projectId), /empty Lyrics Workspace/i);
});

test("duplicate section copies user content under a new independent section ID", () => {
  const { repository } = createHarness();
  const project = repository.create({ title: "Duplicate a section" });
  const source = repository.addLyricsSection(project.projectId, { type: "bridge", name: "Bridge" });
  repository.updateLyricsSection(project.projectId, source.sectionId, {
    userLyrics: "Words written by the user",
    notes: "User note",
  });

  const duplicate = repository.duplicateLyricsSection(project.projectId, source.sectionId);
  assert.notEqual(duplicate.sectionId, source.sectionId);
  assert.equal(duplicate.projectId, project.projectId);
  assert.equal(duplicate.userLyrics, "Words written by the user");
  assert.equal(duplicate.notes, "User note");
  repository.updateLyricsSection(project.projectId, duplicate.sectionId, { userLyrics: "Changed copy only" });
  const updated = repository.get(project.projectId)!;
  assert.equal(updated.lyrics.sections.find((section) => section.sectionId === source.sectionId)?.userLyrics, "Words written by the user");
  assert.equal(updated.lyrics.sections.find((section) => section.sectionId === duplicate.sectionId)?.userLyrics, "Changed copy only");
});

test("delete and reorder target one section and persist normalized order", () => {
  const { storage, options, repository } = createHarness();
  const project = repository.create({ title: "Structure changes" });
  const intro = repository.addLyricsSection(project.projectId, { type: "intro", name: "Intro" });
  const verse = repository.addLyricsSection(project.projectId, { type: "verse", name: "Verse" });
  const outro = repository.addLyricsSection(project.projectId, { type: "outro", name: "Outro" });
  repository.updateLyricsSection(project.projectId, verse.sectionId, { userLyrics: "Keep this verse" });

  repository.moveLyricsSection(project.projectId, outro.sectionId, 0);
  repository.deleteLyricsSection(project.projectId, intro.sectionId);
  const refreshed = new LocalProjectRepository(storage, options).get(project.projectId)!;
  assert.deepEqual(refreshed.lyrics.sections.map((section) => section.sectionId), [outro.sectionId, verse.sectionId]);
  assert.deepEqual(refreshed.lyrics.sections.map((section) => section.order), [0, 1]);
  assert.equal(refreshed.lyrics.sections[1].userLyrics, "Keep this verse");
});

test("project duplicate remaps lyrics ownership and section IDs without shared changes", () => {
  const { repository } = createHarness();
  const original = repository.create({ title: "Original lyrics project" });
  const verse = repository.addLyricsSection(original.projectId, { type: "verse", name: "Verse" });
  const chorus = repository.addLyricsSection(original.projectId, { type: "chorus", name: "Chorus" });
  repository.updateLyricsSection(original.projectId, verse.sectionId, { userLyrics: "Original verse" });
  repository.updateLyricsSection(original.projectId, chorus.sectionId, { notes: "Original chorus note" });

  const duplicate = repository.duplicate(original.projectId);
  assert.notEqual(duplicate.projectId, original.projectId);
  assert.deepEqual(duplicate.lyrics.sections.map((section) => section.userLyrics), ["Original verse", ""]);
  assert.ok(duplicate.lyrics.sections.every((section) => section.projectId === duplicate.projectId));
  assert.notDeepEqual(
    duplicate.lyrics.sections.map((section) => section.sectionId),
    [verse.sectionId, chorus.sectionId],
  );
  repository.updateLyricsSection(duplicate.projectId, duplicate.lyrics.sections[0].sectionId, { userLyrics: "Duplicate only" });
  assert.equal(repository.get(original.projectId)?.lyrics.sections[0].userLyrics, "Original verse");
  assert.equal(repository.get(duplicate.projectId)?.lyrics.sections[0].userLyrics, "Duplicate only");
});

test("project delete removes nested lyrics without affecting another project", () => {
  const { storage, repository } = createHarness();
  const deleted = repository.create({ title: "Delete lyrics" });
  const kept = repository.create({ title: "Keep lyrics" });
  repository.addLyricsSection(deleted.projectId, { type: "verse", name: "Deleted Verse" });
  const keptSection = repository.addLyricsSection(kept.projectId, { type: "chorus", name: "Kept Chorus" });
  repository.updateLyricsSection(kept.projectId, keptSection.sectionId, { userLyrics: "Still here" });

  repository.delete(deleted.projectId);
  assert.equal(storage.getItem(`songwriting-workspace:project:${deleted.projectId}`), null);
  assert.equal(repository.get(kept.projectId)?.lyrics.sections[0].userLyrics, "Still here");
});

test("schema version 4 migrates to empty v5 lyrics while preserving PHASE 1–4 data", () => {
  const storage = new MemoryStorage();
  const projectId = "phase-4-project";
  const createdAt = "2026-09-10T00:00:00.000Z";
  const updatedAt = "2026-09-11T00:00:00.000Z";
  const summary = { projectId, title: "Existing phase 4 song", createdAt, updatedAt, currentStage: "Lyrics", status: "active" };
  const material = {
    materialId: "material-4",
    projectId,
    type: "phrase",
    content: "User material survives",
    note: "Material note",
    origin: "manual",
    createdAt,
    updatedAt,
  };
  storage.setItem("songwriting-workspace:meta", JSON.stringify({ schemaVersion: 4, appDataCreatedAt: createdAt, lastMigratedAt: createdAt }));
  storage.setItem("songwriting-workspace:workspace", JSON.stringify({
    schemaVersion: 4,
    data: { workspaceId: "workspace-4", projectIndex: [summary] },
  }));
  storage.setItem(`songwriting-workspace:project:${projectId}`, JSON.stringify({
    schemaVersion: 4,
    data: {
      ...summary,
      creationMode: "Free",
      projectNote: "Project note survives",
      idea: { startingPoint: "phrase" },
      explore: { currentPromptIndex: 2, responses: [] },
      materials: [material],
      songIntent: {
        projectId,
        coreIdea: "User intent survives",
        desiredFeeling: "User feeling survives",
        coreImage: "User image survives",
        centralConflict: "User conflict survives",
        selectedMaterialIds: [material.materialId],
        updatedAt,
      },
    },
  }));

  const migrated = new LocalProjectRepository(storage, { now: () => "2026-09-19T00:00:00.000Z" }).get(projectId)!;
  assert.equal(migrated.title, "Existing phase 4 song");
  assert.equal(migrated.projectNote, "Project note survives");
  assert.deepEqual(migrated.idea, { startingPoint: "phrase" });
  assert.deepEqual(migrated.materials, [material]);
  assert.equal(migrated.songIntent.coreIdea, "User intent survives");
  assert.deepEqual(migrated.songIntent.selectedMaterialIds, [material.materialId]);
  assert.deepEqual(migrated.lyrics, { sections: [] });
  assert.deepEqual(migrated.reflection, {
    lineReflections: [],
    emotionMap: [],
    songIntentCheck: null,
    updatedAt: "2026-09-19T00:00:00.000Z",
  });
  assert.equal(JSON.parse(storage.getItem("songwriting-workspace:meta") ?? "{}").schemaVersion, CURRENT_SCHEMA_VERSION);
});

test("PHASE 6 reflection persists user judgments and remains isolated by project", () => {
  const { storage, options, repository } = createHarness();
  const projectA = repository.create({ title: "Reflection A" });
  const projectB = repository.create({ title: "Reflection B" });
  const sectionA = repository.addLyricsSection(projectA.projectId, { type: "verse", name: "Verse A" });
  const sectionB = repository.addLyricsSection(projectB.projectId, { type: "verse", name: "Verse B" });
  repository.updateLyricsSection(projectA.projectId, sectionA.sectionId, {
    userLyrics: "A concrete line\nA feeling line",
  });
  repository.updateLyricsSection(projectB.projectId, sectionB.sectionId, {
    userLyrics: "Only B",
  });

  repository.setLineReflection(projectA.projectId, {
    sectionId: sectionA.sectionId,
    lineIndex: 0,
    lineText: "A concrete line",
    label: "specific",
  });
  repository.setSectionEmotion(projectA.projectId, sectionA.sectionId, "Uneasy");
  repository.setSongIntentCheck(projectA.projectId, "partly");

  const refreshed = new LocalProjectRepository(storage, options);
  assert.deepEqual(refreshed.get(projectA.projectId)?.reflection.lineReflections, [{
    sectionId: sectionA.sectionId,
    lineIndex: 0,
    lineText: "A concrete line",
    label: "specific",
  }]);
  assert.deepEqual(refreshed.get(projectA.projectId)?.reflection.emotionMap, [{
    sectionId: sectionA.sectionId,
    emotion: "Uneasy",
  }]);
  assert.equal(refreshed.get(projectA.projectId)?.reflection.songIntentCheck, "partly");
  assert.deepEqual(refreshed.get(projectB.projectId)?.reflection.lineReflections, []);
  assert.deepEqual(refreshed.get(projectB.projectId)?.reflection.emotionMap, []);
  assert.equal(refreshed.get(projectB.projectId)?.reflection.songIntentCheck, null);
});

test("line reflection cannot attach to another project or stale lyric text", () => {
  const { repository } = createHarness();
  const projectA = repository.create({ title: "A" });
  const projectB = repository.create({ title: "B" });
  const sectionA = repository.addLyricsSection(projectA.projectId, { type: "verse", name: "A" });
  repository.updateLyricsSection(projectA.projectId, sectionA.sectionId, { userLyrics: "Current line" });

  assert.throws(() => repository.setLineReflection(projectB.projectId, {
    sectionId: sectionA.sectionId,
    lineIndex: 0,
    lineText: "Current line",
    label: "unsure",
  }), /not found in this project/i);
  assert.throws(() => repository.setLineReflection(projectA.projectId, {
    sectionId: sectionA.sectionId,
    lineIndex: 0,
    lineText: "Old line",
    label: "abstract",
  }), /no longer matches/i);
});

test("editing lyrics removes stale line reflections and deleting a section cleans reflection data", () => {
  const { repository } = createHarness();
  const project = repository.create({ title: "Cleanup" });
  const section = repository.addLyricsSection(project.projectId, { type: "chorus", name: "Chorus" });
  repository.updateLyricsSection(project.projectId, section.sectionId, { userLyrics: "Keep\nChange" });
  repository.setLineReflection(project.projectId, {
    sectionId: section.sectionId,
    lineIndex: 0,
    lineText: "Keep",
    label: "specific",
  });
  repository.setLineReflection(project.projectId, {
    sectionId: section.sectionId,
    lineIndex: 1,
    lineText: "Change",
    label: "abstract",
  });
  repository.setSectionEmotion(project.projectId, section.sectionId, "Open");

  repository.updateLyricsSection(project.projectId, section.sectionId, { userLyrics: "Keep\nChanged" });
  assert.deepEqual(repository.get(project.projectId)?.reflection.lineReflections.map((entry) => entry.lineText), ["Keep"]);
  repository.deleteLyricsSection(project.projectId, section.sectionId);
  assert.deepEqual(repository.get(project.projectId)?.reflection.lineReflections, []);
  assert.deepEqual(repository.get(project.projectId)?.reflection.emotionMap, []);
});

test("project duplication remaps reflection section references independently", () => {
  const { repository } = createHarness();
  const original = repository.create({ title: "Original reflection" });
  const section = repository.addLyricsSection(original.projectId, { type: "bridge", name: "Bridge" });
  repository.updateLyricsSection(original.projectId, section.sectionId, { userLyrics: "My line" });
  repository.setLineReflection(original.projectId, {
    sectionId: section.sectionId,
    lineIndex: 0,
    lineText: "My line",
    label: "unsure",
  });
  repository.setSectionEmotion(original.projectId, section.sectionId, "Tense");

  const duplicate = repository.duplicate(original.projectId);
  const copiedSectionId = duplicate.lyrics.sections[0].sectionId;
  assert.notEqual(copiedSectionId, section.sectionId);
  assert.equal(duplicate.reflection.lineReflections[0].sectionId, copiedSectionId);
  assert.equal(duplicate.reflection.emotionMap[0].sectionId, copiedSectionId);
  repository.setSectionEmotion(duplicate.projectId, copiedSectionId, "Released");
  assert.equal(repository.get(original.projectId)?.reflection.emotionMap[0].emotion, "Tense");
});

test("repetition count is mechanical, case-normalized, and neutral", () => {
  assert.deepEqual(countRepeatedTerms("Rain, rain. HOME home home; once."), [
    { term: "home", count: 3 },
    { term: "rain", count: 2 },
  ]);
});

test("schema version 5 migrates to empty PHASE 6 reflection without losing lyrics", () => {
  const storage = new MemoryStorage();
  const projectId = "phase-5-project";
  const createdAt = "2026-09-10T00:00:00.000Z";
  const updatedAt = "2026-09-11T00:00:00.000Z";
  const summary = { projectId, title: "Existing lyrics", createdAt, updatedAt, currentStage: "Review", status: "active" };
  const section = {
    sectionId: "section-5",
    projectId,
    name: "Verse",
    type: "verse",
    order: 0,
    purpose: "Existing purpose",
    reflectionQuestions: ["Existing question"],
    userLyrics: "User lyrics survive",
    notes: "User notes survive",
    createdAt,
    updatedAt,
  };
  storage.setItem("songwriting-workspace:meta", JSON.stringify({ schemaVersion: 5, appDataCreatedAt: createdAt, lastMigratedAt: createdAt }));
  storage.setItem("songwriting-workspace:workspace", JSON.stringify({
    schemaVersion: 5,
    data: { workspaceId: "workspace-5", projectIndex: [summary] },
  }));
  storage.setItem(`songwriting-workspace:project:${projectId}`, JSON.stringify({
    schemaVersion: 5,
    data: {
      ...summary,
      creationMode: "Free",
      projectNote: "Keep note",
      idea: { startingPoint: "phrase" },
      explore: { currentPromptIndex: 0, responses: [] },
      materials: [],
      songIntent: {
        projectId,
        coreIdea: "Keep intent",
        desiredFeeling: "",
        coreImage: "",
        centralConflict: "",
        selectedMaterialIds: [],
        updatedAt,
      },
      lyrics: { sections: [section] },
    },
  }));

  const migrated = new LocalProjectRepository(storage, { now: () => "2026-09-19T00:00:00.000Z" }).get(projectId)!;
  assert.deepEqual(migrated.lyrics.sections, [{ ...section, bars: null }]);
  assert.equal(migrated.songIntent.coreIdea, "Keep intent");
  assert.deepEqual(migrated.reflection, {
    lineReflections: [],
    emotionMap: [],
    songIntentCheck: null,
    updatedAt: "2026-09-19T00:00:00.000Z",
  });
  assert.equal(JSON.parse(storage.getItem("songwriting-workspace:meta") ?? "{}").schemaVersion, CURRENT_SCHEMA_VERSION);
});

test("PHASE 7 multiple takes persist and stay isolated by section and project", async () => {
  const { storage, options, repository } = createHarness();
  const audio = new MemoryAudioAssetRepository();
  let assetId = 0;
  const service = new MelodyService(repository, audio, {
    now: options.now,
    createId: () => `asset-${++assetId}`,
  });
  const projectA = repository.create({ title: "Melody A" });
  const projectB = repository.create({ title: "Melody B" });
  const verseA = repository.addLyricsSection(projectA.projectId, { type: "verse", name: "Verse A" });
  const chorusA = repository.addLyricsSection(projectA.projectId, { type: "chorus", name: "Chorus A" });
  const verseB = repository.addLyricsSection(projectB.projectId, { type: "verse", name: "Verse B" });

  await service.createTake(projectA.projectId, verseA.sectionId, new Blob(["a-one"], { type: "audio/webm" }), 1000);
  await service.createTake(projectA.projectId, verseA.sectionId, new Blob(["a-two"], { type: "audio/webm" }), 1200);
  await service.createTake(projectA.projectId, chorusA.sectionId, new Blob(["a-chorus"], { type: "audio/webm" }), 900);
  await service.createTake(projectB.projectId, verseB.sectionId, new Blob(["b-one"], { type: "audio/webm" }), 800);

  const refreshedRepository = new LocalProjectRepository(storage, options);
  const refreshedService = new MelodyService(refreshedRepository, audio);
  const refreshedA = refreshedRepository.get(projectA.projectId)!;
  assert.equal(refreshedA.melody.takes.filter((take) => take.sectionId === verseA.sectionId).length, 2);
  assert.equal(refreshedA.melody.takes.filter((take) => take.sectionId === chorusA.sectionId).length, 1);
  assert.equal(refreshedRepository.get(projectB.projectId)?.melody.takes.length, 1);
  const playback = await refreshedService.loadAudio(projectA.projectId, refreshedA.melody.takes[0].takeId);
  assert.equal(await playback.text(), "a-one");
  await assert.rejects(
    refreshedService.loadAudio(projectB.projectId, refreshedA.melody.takes[0].takeId),
    /not found in this project/i,
  );
});

test("PHASE 7 take rename, notes, status, and delete update metadata and Blob storage", async () => {
  const { repository } = createHarness();
  const audio = new MemoryAudioAssetRepository();
  const service = new MelodyService(repository, audio, { createId: () => "audio-1" });
  const project = repository.create({ title: "Take editing" });
  const section = repository.addLyricsSection(project.projectId, { type: "custom", name: "Part" });
  const take = await service.createTake(project.projectId, section.sectionId, new Blob(["voice"], { type: "audio/webm" }), null);

  service.updateTake(project.projectId, take.takeId, {
    name: "Hummed ending",
    notes: "Try a shorter ending next time",
    status: "return-later",
  });
  const updated = repository.get(project.projectId)!.melody.takes[0];
  assert.equal(updated.name, "Hummed ending");
  assert.equal(updated.notes, "Try a shorter ending next time");
  assert.equal(updated.status, "return-later");
  await service.deleteTake(project.projectId, take.takeId);
  assert.deepEqual(repository.get(project.projectId)?.melody.takes, []);
  assert.equal(audio.assets.size, 0);
});

test("PHASE 7 section and project delete clean owned audio without touching other projects", async () => {
  const { repository } = createHarness();
  const audio = new MemoryAudioAssetRepository();
  let assetId = 0;
  const service = new MelodyService(repository, audio, { createId: () => `audio-${++assetId}` });
  const projectA = repository.create({ title: "Delete A" });
  const projectB = repository.create({ title: "Keep B" });
  const sectionA1 = repository.addLyricsSection(projectA.projectId, { type: "verse", name: "A1" });
  const sectionA2 = repository.addLyricsSection(projectA.projectId, { type: "chorus", name: "A2" });
  const sectionB = repository.addLyricsSection(projectB.projectId, { type: "verse", name: "B" });
  await service.createTake(projectA.projectId, sectionA1.sectionId, new Blob(["a1"]), null);
  await service.createTake(projectA.projectId, sectionA2.sectionId, new Blob(["a2"]), null);
  await service.createTake(projectB.projectId, sectionB.sectionId, new Blob(["b"]), null);

  await service.deleteSection(projectA.projectId, sectionA1.sectionId);
  assert.equal((await audio.listBySection(projectA.projectId, sectionA1.sectionId)).length, 0);
  assert.equal((await audio.listByProject(projectA.projectId)).length, 1);
  await service.deleteProject(projectA.projectId);
  assert.equal(repository.get(projectA.projectId), null);
  assert.equal((await audio.listByProject(projectA.projectId)).length, 0);
  assert.equal(repository.get(projectB.projectId)?.melody.takes.length, 1);
  assert.equal((await audio.listByProject(projectB.projectId)).length, 1);
});

test("PHASE 7 project duplicate remaps sections, takes, assets, and stays independent", async () => {
  const { repository } = createHarness();
  const audio = new MemoryAudioAssetRepository();
  let assetId = 0;
  const service = new MelodyService(repository, audio, { createId: () => `audio-${++assetId}` });
  const source = repository.create({ title: "Original melody" });
  const section = repository.addLyricsSection(source.projectId, { type: "chorus", name: "Chorus" });
  const sourceTake = await service.createTake(source.projectId, section.sectionId, new Blob(["original recording"], { type: "audio/webm" }), 1500);
  service.updateTake(source.projectId, sourceTake.takeId, { name: "My chorus", status: "interesting" });
  service.setSectionNotes(source.projectId, section.sectionId, "Explore the last note");

  const duplicate = await service.duplicateProject(source.projectId);
  const copiedTake = duplicate.melody.takes[0];
  assert.notEqual(copiedTake.takeId, sourceTake.takeId);
  assert.notEqual(copiedTake.audioAssetId, sourceTake.audioAssetId);
  assert.notEqual(copiedTake.sectionId, section.sectionId);
  assert.equal(copiedTake.projectId, duplicate.projectId);
  assert.equal(await (await service.loadAudio(duplicate.projectId, copiedTake.takeId)).text(), "original recording");
  assert.equal(duplicate.melody.notesBySection[copiedTake.sectionId], "Explore the last note");
  service.updateTake(duplicate.projectId, copiedTake.takeId, { name: "Copy only" });
  assert.equal(repository.get(source.projectId)?.melody.takes[0].name, "My chorus");
  await service.deleteProject(source.projectId);
  assert.equal(await (await service.loadAudio(duplicate.projectId, copiedTake.takeId)).text(), "original recording");
});

test("schema version 6 safely migrates to empty PHASE 7 melody data", () => {
  const storage = new MemoryStorage();
  const projectId = "phase-6-project";
  const timestamp = "2026-09-18T00:00:00.000Z";
  const summary = { projectId, title: "Existing reflection", createdAt: timestamp, updatedAt: timestamp, currentStage: "Melody", status: "active" };
  storage.setItem("songwriting-workspace:meta", JSON.stringify({ schemaVersion: 6, appDataCreatedAt: timestamp, lastMigratedAt: timestamp }));
  storage.setItem("songwriting-workspace:workspace", JSON.stringify({ schemaVersion: 6, data: { workspaceId: "workspace-6", projectIndex: [summary] } }));
  storage.setItem(`songwriting-workspace:project:${projectId}`, JSON.stringify({
    schemaVersion: 6,
    data: {
      ...summary,
      creationMode: "Free",
      projectNote: "Preserved",
      idea: { startingPoint: null },
      explore: { currentPromptIndex: 0, responses: [] },
      materials: [],
      songIntent: { projectId, coreIdea: "Keep", desiredFeeling: "", coreImage: "", centralConflict: "", selectedMaterialIds: [], updatedAt: timestamp },
      lyrics: { sections: [] },
      reflection: { lineReflections: [], emotionMap: [], songIntentCheck: null, updatedAt: timestamp },
    },
  }));

  const repository = new LocalProjectRepository(storage, { now: () => "2026-09-19T00:00:00.000Z" });
  const migrated = repository.get(projectId)!;
  assert.deepEqual(migrated.melody, { notesBySection: {}, takes: [], selectedTakeIds: [] });
  assert.equal(migrated.songIntent.coreIdea, "Keep");
  assert.equal(migrated.projectNote, "Preserved");
  assert.equal(JSON.parse(storage.getItem("songwriting-workspace:meta") ?? "{}").schemaVersion, CURRENT_SCHEMA_VERSION);
});

test("microphone permission and device failures explain that no take was saved", () => {
  assert.match(
    recordingErrorMessage(new DOMException("denied", "NotAllowedError")),
    /permission was denied.*No take was saved/i,
  );
  assert.match(
    recordingErrorMessage(new DOMException("missing", "NotFoundError")),
    /No microphone was found.*No take was saved/i,
  );
  assert.match(recordingErrorMessage(null), /project data is unchanged/i);
});

test("PHASE 8 BPM boundaries, slider/manual values, signatures, notes, and refresh persistence", () => {
  const { storage, options, repository } = createHarness();
  const projectA = repository.create({ title: "Rhythm A" });
  const projectB = repository.create({ title: "Rhythm B" });

  repository.updateRhythm(projectA.projectId, { bpm: 40, timeSignature: "3/4", notes: "Leave space after beat three." });
  assert.equal(repository.get(projectA.projectId)?.rhythm.bpm, 40);
  repository.updateRhythm(projectA.projectId, { bpm: 220, timeSignature: "6/8" });
  assert.deepEqual(repository.get(projectA.projectId)?.rhythm, {
    bpm: 220,
    timeSignature: "6/8",
    notes: "Leave space after beat three.",
  });
  repository.updateRhythm(projectA.projectId, { timeSignature: "4/4", bpm: 127 });

  assert.throws(() => repository.updateRhythm(projectA.projectId, { bpm: 39 }), /40 to 220/i);
  assert.throws(() => repository.updateRhythm(projectA.projectId, { bpm: 221 }), /40 to 220/i);
  assert.throws(() => repository.updateRhythm(projectA.projectId, { bpm: 100.5 }), /whole number/i);
  assert.deepEqual(repository.get(projectB.projectId)?.rhythm, { bpm: 120, timeSignature: "4/4", notes: "" });

  const refreshed = new LocalProjectRepository(storage, options);
  assert.deepEqual(refreshed.get(projectA.projectId)?.rhythm, {
    bpm: 127,
    timeSignature: "4/4",
    notes: "Leave space after beat three.",
  });
});

test("Tap Tempo averages recent intervals, clamps BPM, and resets after a long pause", () => {
  let result = recordTempoTap({ timestamps: [] }, 0);
  assert.equal(result.bpm, null);
  result = recordTempoTap(result.session, 500);
  assert.equal(result.bpm, 120);
  result = recordTempoTap(result.session, 1_010);
  assert.equal(result.bpm, 119);

  const fast = recordTempoTap(recordTempoTap({ timestamps: [] }, 0).session, 100);
  assert.equal(fast.bpm, 220);
  const slow = recordTempoTap(recordTempoTap({ timestamps: [] }, 0).session, 2_000);
  assert.equal(slow.bpm, 40);

  const reset = recordTempoTap(result.session, 4_000);
  assert.equal(reset.bpm, null);
  assert.deepEqual(reset.session.timestamps, [4_000]);
});

test("PHASE 8 project duplication preserves independent rhythm data", () => {
  const { repository } = createHarness();
  const source = repository.create({ title: "Original rhythm" });
  repository.updateRhythm(source.projectId, { bpm: 88, timeSignature: "6/8", notes: "User rhythm note" });

  const duplicate = repository.duplicate(source.projectId);
  assert.notEqual(duplicate.projectId, source.projectId);
  assert.deepEqual(duplicate.rhythm, { bpm: 88, timeSignature: "6/8", notes: "User rhythm note" });
  repository.updateRhythm(duplicate.projectId, { bpm: 164, notes: "Copy only" });
  assert.deepEqual(repository.get(source.projectId)?.rhythm, { bpm: 88, timeSignature: "6/8", notes: "User rhythm note" });
  assert.deepEqual(repository.get(duplicate.projectId)?.rhythm, { bpm: 164, timeSignature: "6/8", notes: "Copy only" });
});

test("schema version 7 safely migrates Rhythm defaults without clearing existing project data", () => {
  const { storage, options, repository } = createHarness();
  const project = repository.create({ title: "Existing melody" });
  repository.update(project.projectId, { projectNote: "Keep this" });

  const projectKey = `songwriting-workspace:project:${project.projectId}`;
  const storedProject = JSON.parse(storage.getItem(projectKey)!) as { schemaVersion: number; data: Record<string, unknown> };
  delete storedProject.data.rhythm;
  storedProject.schemaVersion = 7;
  storage.setItem(projectKey, JSON.stringify(storedProject));

  const workspace = JSON.parse(storage.getItem("songwriting-workspace:workspace")!) as { schemaVersion: number; data: unknown };
  workspace.schemaVersion = 7;
  storage.setItem("songwriting-workspace:workspace", JSON.stringify(workspace));
  const meta = JSON.parse(storage.getItem("songwriting-workspace:meta")!) as { schemaVersion: number };
  meta.schemaVersion = 7;
  storage.setItem("songwriting-workspace:meta", JSON.stringify(meta));

  const migrated = new LocalProjectRepository(storage, options).get(project.projectId)!;
  assert.deepEqual(migrated.rhythm, { bpm: 120, timeSignature: "4/4", notes: "" });
  assert.equal(migrated.projectNote, "Keep this");
  assert.deepEqual(migrated.melody, { notesBySection: {}, takes: [], selectedTakeIds: [] });
  assert.equal(JSON.parse(storage.getItem("songwriting-workspace:meta")!).schemaVersion, CURRENT_SCHEMA_VERSION);
});

test("PHASE 9 key, chord notes, and progressions persist with explicit project isolation", () => {
  const { storage, options, repository } = createHarness();
  const projectA = repository.create({ title: "Harmony A" });
  const projectB = repository.create({ title: "Harmony B" });

  repository.setHarmonyKey(projectA.projectId, "G");
  repository.setHarmonyNotes(projectA.projectId, "Notice how the third changes.");
  const verse = repository.createHarmonyProgression(projectA.projectId, { type: "verse" });
  const chorus = repository.createHarmonyProgression(projectA.projectId, { type: "chorus", name: "Lift" });
  const bridge = repository.createHarmonyProgression(projectA.projectId, { type: "bridge" });
  const custom = repository.createHarmonyProgression(projectA.projectId, { type: "custom", name: "My experiment" });

  const chords = ["Am", "F", "C", "G"] as ChordSymbol[];
  repository.updateHarmonyProgression(projectA.projectId, verse.harmony.progressions[0].progressionId, {
    chords,
    notes: "User sequence",
  });
  repository.updateHarmonyProgression(projectA.projectId, chorus.harmony.progressions[1].progressionId, {
    name: "Chorus idea",
  });
  repository.updateHarmonyProgression(projectA.projectId, bridge.harmony.progressions[2].progressionId, {
    notes: "Try a different turn",
  });
  repository.deleteHarmonyProgression(projectA.projectId, custom.harmony.progressions[3].progressionId);

  assert.equal(repository.get(projectA.projectId)?.harmony.key, "G");
  assert.equal(repository.get(projectA.projectId)?.harmony.chordNotes, "Notice how the third changes.");
  assert.deepEqual(repository.get(projectA.projectId)?.harmony.progressions.map((item) => item.type), ["verse", "chorus", "bridge"]);
  assert.deepEqual(repository.get(projectA.projectId)?.harmony.progressions[0].chords, chords);
  assert.equal(repository.get(projectA.projectId)?.harmony.progressions[1].name, "Chorus idea");
  assert.equal(repository.get(projectA.projectId)?.harmony.progressions[2].notes, "Try a different turn");
  assert.deepEqual(repository.get(projectB.projectId)?.harmony, {
    projectId: projectB.projectId,
    key: null,
    chordNotes: "",
    progressions: [],
  });

  repository.setHarmonyKey(projectA.projectId, null);
  assert.equal(repository.get(projectA.projectId)?.harmony.key, null);
  repository.setCreationMode(projectA.projectId, "Free");
  assert.equal(repository.get(projectA.projectId)?.harmony.progressions.length, 3);
  repository.setCreationMode(projectA.projectId, "Guided");
  assert.equal(repository.get(projectA.projectId)?.harmony.progressions.length, 3);
  const refreshed = new LocalProjectRepository(storage, options);
  assert.equal(refreshed.get(projectA.projectId)?.harmony.chordNotes, "Notice how the third changes.");
  assert.deepEqual(refreshed.get(projectA.projectId)?.harmony.progressions[0].chords, chords);
});

test("PHASE 9 project duplication remaps harmony ownership and mutable progression data", () => {
  const { repository } = createHarness();
  const source = repository.create({ title: "Original harmony" });
  repository.setHarmonyKey(source.projectId, "E♭");
  repository.setHarmonyNotes(source.projectId, "Source notes");
  const updated = repository.createHarmonyProgression(source.projectId, {
    type: "custom",
    name: "Source progression",
  });
  const sourceProgression = updated.harmony.progressions[0];
  repository.updateHarmonyProgression(source.projectId, sourceProgression.progressionId, {
    chords: ["Dm", "G"] as ChordSymbol[],
    notes: "Keep exploring",
  });

  const duplicate = repository.duplicate(source.projectId);
  const copiedProgression = duplicate.harmony.progressions[0];
  assert.notEqual(duplicate.projectId, source.projectId);
  assert.equal(duplicate.harmony.projectId, duplicate.projectId);
  assert.equal(duplicate.harmony.key, "E♭");
  assert.notEqual(copiedProgression.progressionId, sourceProgression.progressionId);
  assert.equal(copiedProgression.projectId, duplicate.projectId);
  assert.deepEqual(copiedProgression.chords, ["Dm", "G"]);

  repository.updateHarmonyProgression(duplicate.projectId, copiedProgression.progressionId, {
    name: "Copy only",
    chords: ["Am"] as ChordSymbol[],
  });
  repository.setHarmonyKey(duplicate.projectId, "C");
  assert.equal(repository.get(source.projectId)?.harmony.key, "E♭");
  assert.equal(repository.get(source.projectId)?.harmony.progressions[0].name, "Source progression");
  assert.deepEqual(repository.get(source.projectId)?.harmony.progressions[0].chords, ["Dm", "G"]);
});

test("schema version 8 safely migrates empty PHASE 9 harmony without clearing existing project data", () => {
  const { storage, options, repository } = createHarness();
  const project = repository.create({ title: "Existing rhythm" });
  repository.update(project.projectId, { projectNote: "Keep this project" });
  const projectKey = `songwriting-workspace:project:${project.projectId}`;
  const storedProject = JSON.parse(storage.getItem(projectKey)!) as { schemaVersion: number; data: Record<string, unknown> };
  delete storedProject.data.harmony;
  storedProject.schemaVersion = 8;
  storage.setItem(projectKey, JSON.stringify(storedProject));

  const workspace = JSON.parse(storage.getItem("songwriting-workspace:workspace")!) as { schemaVersion: number; data: unknown };
  workspace.schemaVersion = 8;
  storage.setItem("songwriting-workspace:workspace", JSON.stringify(workspace));
  const meta = JSON.parse(storage.getItem("songwriting-workspace:meta")!) as { schemaVersion: number };
  meta.schemaVersion = 8;
  storage.setItem("songwriting-workspace:meta", JSON.stringify(meta));

  const migrated = new LocalProjectRepository(storage, options).get(project.projectId)!;
  assert.equal(migrated.projectNote, "Keep this project");
  assert.deepEqual(migrated.harmony, {
    projectId: project.projectId,
    key: null,
    chordNotes: "",
    progressions: [],
  });
  assert.equal(JSON.parse(storage.getItem("songwriting-workspace:meta")!).schemaVersion, CURRENT_SCHEMA_VERSION);
});

test("PHASE 10 Song Map persists bars, statuses, reorder, and section duplication by stable identity", () => {
  const { storage, options, repository } = createHarness();
  const projectA = repository.create({ title: "Song Map A" });
  const projectB = repository.create({ title: "Song Map B" });
  const verse = repository.addLyricsSection(projectA.projectId, { type: "verse", name: "Verse 1" });
  const chorus = repository.addLyricsSection(projectA.projectId, { type: "chorus", name: "Chorus" });
  const bridge = repository.addLyricsSection(projectB.projectId, { type: "bridge", name: "Other bridge" });

  repository.updateLyricsSection(projectA.projectId, verse.sectionId, {
    name: "Opening verse",
    bars: 8,
    userLyrics: "User verse",
  });
  repository.setMelodyNotes(projectA.projectId, verse.sectionId, "User melody note");
  const harmonyProject = repository.createHarmonyProgression(projectA.projectId, {
    type: "chorus",
    sectionId: chorus.sectionId,
    name: "User chorus progression",
  });

  const beforeDuplicate = repository.get(projectA.projectId)!;
  assert.deepEqual(getSongMapSectionStatuses(
    beforeDuplicate,
    beforeDuplicate.lyrics.sections.find((section) => section.sectionId === verse.sectionId)!,
  ), {
    lyrics: "已有歌词",
    melody: "已有备注",
    harmony: "暂无和弦进行",
    arrangement: "尚未开始",
  });
  assert.deepEqual(getSongMapSectionStatuses(
    beforeDuplicate,
    beforeDuplicate.lyrics.sections.find((section) => section.sectionId === chorus.sectionId)!,
  ), {
    lyrics: "暂无歌词",
    melody: "暂无 Melody 数据",
    harmony: "已保存 1 个和弦进行",
    arrangement: "尚未开始",
  });

  const duplicated = repository.duplicateLyricsSection(projectA.projectId, chorus.sectionId);
  const afterDuplicate = repository.get(projectA.projectId)!;
  const copiedProgression = afterDuplicate.harmony.progressions.find(
    (progression) => progression.sectionId === duplicated.sectionId,
  );
  assert.equal(duplicated.bars, null);
  assert.ok(copiedProgression);
  assert.notEqual(copiedProgression.progressionId, harmonyProject.harmony.progressions[0].progressionId);
  assert.equal(copiedProgression.projectId, projectA.projectId);
  assert.equal(copiedProgression.sectionId, duplicated.sectionId);

  repository.updateLyricsSection(projectA.projectId, duplicated.sectionId, { bars: 16 });
  repository.moveLyricsSection(projectA.projectId, duplicated.sectionId, 0);
  repository.deleteLyricsSection(projectA.projectId, verse.sectionId);
  const refreshed = new LocalProjectRepository(storage, options).get(projectA.projectId)!;
  assert.deepEqual(refreshed.lyrics.sections.map((section) => section.order), [0, 1]);
  assert.equal(refreshed.lyrics.sections[0].sectionId, duplicated.sectionId);
  assert.equal(refreshed.lyrics.sections[0].bars, 16);
  assert.equal(refreshed.melody.notesBySection[verse.sectionId], undefined);
  assert.equal(refreshed.harmony.progressions.some((progression) => progression.sectionId === verse.sectionId), false);
  assert.equal(repository.get(projectB.projectId)?.lyrics.sections[0].sectionId, bridge.sectionId);
  assert.equal(repository.get(projectB.projectId)?.lyrics.sections[0].bars, null);
});

test("PHASE 10 project duplication remaps Song Map section and harmony identities independently", () => {
  const { repository } = createHarness();
  const source = repository.create({ title: "Source Song Map" });
  const section = repository.addLyricsSection(source.projectId, { type: "custom", name: "Chosen part" });
  repository.updateLyricsSection(source.projectId, section.sectionId, { bars: 12, userLyrics: "Source words" });
  const sourceWithHarmony = repository.createHarmonyProgression(source.projectId, {
    type: "custom",
    sectionId: section.sectionId,
  });

  const duplicate = repository.duplicate(source.projectId);
  const copiedSection = duplicate.lyrics.sections[0];
  const copiedProgression = duplicate.harmony.progressions[0];
  assert.notEqual(copiedSection.sectionId, section.sectionId);
  assert.equal(copiedSection.projectId, duplicate.projectId);
  assert.equal(copiedSection.bars, 12);
  assert.equal(copiedProgression.sectionId, copiedSection.sectionId);
  assert.notEqual(copiedProgression.progressionId, sourceWithHarmony.harmony.progressions[0].progressionId);
  repository.updateLyricsSection(duplicate.projectId, copiedSection.sectionId, { bars: 4 });
  assert.equal(repository.get(source.projectId)?.lyrics.sections[0].bars, 12);
});

test("schema version 9 migrates Song Map bars and Harmony section references without guessing old associations", () => {
  const { storage, options, repository } = createHarness();
  const project = repository.create({ title: "Legacy Song Map" });
  const section = repository.addLyricsSection(project.projectId, { type: "verse", name: "Verse" });
  const withHarmony = repository.createHarmonyProgression(project.projectId, { type: "verse" });
  const projectKey = `songwriting-workspace:project:${project.projectId}`;
  const storedProject = JSON.parse(storage.getItem(projectKey)!) as {
    schemaVersion: number;
    data: Record<string, unknown> & {
      lyrics: { sections: Record<string, unknown>[] };
      harmony: { progressions: Record<string, unknown>[] };
    };
  };
  for (const storedSection of storedProject.data.lyrics.sections as Record<string, unknown>[]) {
    delete storedSection.bars;
  }
  for (const progression of storedProject.data.harmony.progressions as Record<string, unknown>[]) {
    delete progression.sectionId;
  }
  storedProject.schemaVersion = 9;
  storage.setItem(projectKey, JSON.stringify(storedProject));
  const workspace = JSON.parse(storage.getItem("songwriting-workspace:workspace")!) as { schemaVersion: number; data: unknown };
  workspace.schemaVersion = 9;
  storage.setItem("songwriting-workspace:workspace", JSON.stringify(workspace));
  const meta = JSON.parse(storage.getItem("songwriting-workspace:meta")!) as { schemaVersion: number };
  meta.schemaVersion = 9;
  storage.setItem("songwriting-workspace:meta", JSON.stringify(meta));

  const migrated = new LocalProjectRepository(storage, options).get(project.projectId)!;
  assert.equal(migrated.lyrics.sections[0].bars, null);
  assert.equal(migrated.harmony.progressions[0].sectionId, null);
  assert.equal(migrated.lyrics.sections[0].sectionId, section.sectionId);
  assert.equal(migrated.harmony.progressions[0].progressionId, withHarmony.harmony.progressions[0].progressionId);
  assert.equal(JSON.parse(storage.getItem("songwriting-workspace:meta")!).schemaVersion, CURRENT_SCHEMA_VERSION);
});

test("PHASE 11 Arrangement Board stores cell dimensions, keeps section identity, isolates projects, and persists after refresh", () => {
  const { storage, options, repository } = createHarness();
  const projectA = repository.create({ title: "Arrangement A" });
  const projectB = repository.create({ title: "Arrangement B" });
  const verse = repository.addLyricsSection(projectA.projectId, { type: "verse", name: "Verse" });
  const chorus = repository.addLyricsSection(projectA.projectId, { type: "chorus", name: "Chorus" });
  const otherSection = repository.addLyricsSection(projectB.projectId, { type: "verse", name: "Other verse" });
  const track = repository.addArrangementTrack(projectA.projectId, { category: "other", name: "User layer" });

  const cell = repository.updateArrangementCell(projectA.projectId, verse.sectionId, track.trackId, {
    presence: "Present",
    energy: "More open",
    density: "Sparse",
    dynamics: "Soft to strong",
    register: "Low-mid",
    notes: "User arrangement decision",
  });
  assert.ok(cell);
  assert.equal(cell?.projectId, projectA.projectId);
  assert.equal(cell?.sectionId, verse.sectionId);
  assert.equal(cell?.trackId, track.trackId);
  assert.equal(repository.get(projectB.projectId)?.arrangement.cells.length, 0);
  assert.equal(getSongMapSectionStatuses(repository.get(projectA.projectId)!, verse).arrangement, "已有 Arrangement 数据");

  repository.updateLyricsSection(projectA.projectId, verse.sectionId, { name: "Opening verse" });
  const renamed = repository.get(projectA.projectId)!;
  assert.equal(renamed.lyrics.sections[0].sectionId, verse.sectionId);
  assert.equal(renamed.arrangement.cells[0].sectionId, verse.sectionId);

  const refreshed = new LocalProjectRepository(storage, options).get(projectA.projectId)!;
  assert.deepEqual(refreshed.arrangement.cells[0], repository.get(projectA.projectId)!.arrangement.cells[0]);
  assert.equal(refreshed.arrangement.tracks[0].name, "User layer");
  assert.equal(repository.get(projectB.projectId)?.lyrics.sections[0].sectionId, otherSection.sectionId);
  assert.equal(repository.get(projectA.projectId)?.lyrics.sections[1].sectionId, chorus.sectionId);
});

test("PHASE 11 track Add/Rename/Delete and section Duplicate/Delete preserve only valid arrangement ownership", () => {
  const { repository } = createHarness();
  const project = repository.create({ title: "Arrangement structure" });
  const verse = repository.addLyricsSection(project.projectId, { type: "verse", name: "Verse" });
  const track = repository.addArrangementTrack(project.projectId, { category: "piano", name: "My piano" });
  repository.updateArrangementCell(project.projectId, verse.sectionId, track.trackId, { notes: "Keep this cell" });

  const duplicate = repository.duplicateLyricsSection(project.projectId, verse.sectionId);
  const afterSectionDuplicate = repository.get(project.projectId)!;
  const copiedCell = afterSectionDuplicate.arrangement.cells.find((cell) => cell.sectionId === duplicate.sectionId);
  assert.ok(copiedCell);
  assert.notEqual(copiedCell?.cellId, afterSectionDuplicate.arrangement.cells.find((cell) => cell.sectionId === verse.sectionId)?.cellId);
  assert.equal(copiedCell?.trackId, track.trackId);

  repository.updateArrangementTrack(project.projectId, track.trackId, { name: "Renamed user track" });
  assert.equal(repository.get(project.projectId)?.arrangement.tracks[0].name, "Renamed user track");
  repository.deleteLyricsSection(project.projectId, verse.sectionId);
  assert.equal(repository.get(project.projectId)?.arrangement.cells.some((cell) => cell.sectionId === verse.sectionId), false);

  repository.deleteArrangementTrack(project.projectId, track.trackId);
  const finalProject = repository.get(project.projectId)!;
  assert.equal(finalProject.arrangement.tracks.length, 0);
  assert.equal(finalProject.arrangement.cells.length, 0);
});

test("PHASE 11 project duplication remaps sections, tracks, and cells without shared mutable data", () => {
  const { repository } = createHarness();
  const source = repository.create({ title: "Source arrangement" });
  const section = repository.addLyricsSection(source.projectId, { type: "chorus", name: "Chorus" });
  const track = repository.addArrangementTrack(source.projectId, { category: "other", name: "Source layer" });
  repository.updateArrangementCell(source.projectId, section.sectionId, track.trackId, {
    presence: "User presence",
    notes: "Source notes",
  });

  const duplicate = repository.duplicate(source.projectId);
  const copiedSection = duplicate.lyrics.sections[0];
  const copiedTrack = duplicate.arrangement.tracks[0];
  const copiedCell = duplicate.arrangement.cells[0];
  assert.notEqual(copiedSection.sectionId, section.sectionId);
  assert.notEqual(copiedTrack.trackId, track.trackId);
  assert.notEqual(copiedCell.cellId, repository.get(source.projectId)!.arrangement.cells[0].cellId);
  assert.equal(copiedCell.projectId, duplicate.projectId);
  assert.equal(copiedCell.sectionId, copiedSection.sectionId);
  assert.equal(copiedCell.trackId, copiedTrack.trackId);

  repository.updateArrangementCell(duplicate.projectId, copiedSection.sectionId, copiedTrack.trackId, { notes: "Copy only" });
  repository.updateArrangementTrack(duplicate.projectId, copiedTrack.trackId, { name: "Copy layer" });
  assert.equal(repository.get(source.projectId)?.arrangement.cells[0].notes, "Source notes");
  assert.equal(repository.get(source.projectId)?.arrangement.tracks[0].name, "Source layer");
});

test("schema version 10 safely migrates Arrangement defaults without clearing existing project data", () => {
  const { storage, options, repository } = createHarness();
  const project = repository.create({ title: "Legacy before arrangement" });
  repository.update(project.projectId, { projectNote: "Keep this project" });
  const projectKey = `songwriting-workspace:project:${project.projectId}`;
  const storedProject = JSON.parse(storage.getItem(projectKey)!) as { schemaVersion: number; data: Record<string, unknown> };
  delete storedProject.data.arrangement;
  storedProject.schemaVersion = 10;
  storage.setItem(projectKey, JSON.stringify(storedProject));
  const workspace = JSON.parse(storage.getItem("songwriting-workspace:workspace")!) as { schemaVersion: number; data: unknown };
  workspace.schemaVersion = 10;
  storage.setItem("songwriting-workspace:workspace", JSON.stringify(workspace));
  const meta = JSON.parse(storage.getItem("songwriting-workspace:meta")!) as { schemaVersion: number };
  meta.schemaVersion = 10;
  storage.setItem("songwriting-workspace:meta", JSON.stringify(meta));

  const migrated = new LocalProjectRepository(storage, options).get(project.projectId)!;
  assert.deepEqual(migrated.arrangement, { projectId: project.projectId, tracks: [], cells: [] });
  assert.equal(migrated.projectNote, "Keep this project");
  assert.equal(JSON.parse(storage.getItem("songwriting-workspace:meta")!).schemaVersion, CURRENT_SCHEMA_VERSION);
});

test("PHASE 13 Skill Map persists at Workspace level and keeps skill states independent", () => {
  const { storage, options, repository } = createHarness();
  const projectA = repository.create({ title: "Skill Map A" });
  const projectB = repository.create({ title: "Skill Map B" });
  const workspaceRepository = new LocalWorkspaceRepository(storage);

  assert.deepEqual(workspaceRepository.getSkillProgress(), []);
  workspaceRepository.updateSkillProgress("Lyrics", "Seen");
  workspaceRepository.updateSkillProgress("Melody", "Practiced");

  assert.deepEqual(workspaceRepository.getSkillProgress(), [
    { skillId: "Lyrics", state: "Seen" },
    { skillId: "Melody", state: "Practiced" },
  ]);
  repository.setCurrentStage(projectA.projectId, "Lyrics");
  repository.setCurrentStage(projectB.projectId, "Melody");
  assert.deepEqual(workspaceRepository.getSkillProgress(), [
    { skillId: "Lyrics", state: "Seen" },
    { skillId: "Melody", state: "Practiced" },
  ]);
  assert.equal(repository.get(projectA.projectId)?.title, "Skill Map A");
  assert.equal(repository.get(projectB.projectId)?.title, "Skill Map B");

  workspaceRepository.updateSkillProgress("Lyrics", "WantToRevisit");
  assert.deepEqual(workspaceRepository.getSkillProgress(), [
    { skillId: "Lyrics", state: "WantToRevisit" },
    { skillId: "Melody", state: "Practiced" },
  ]);

  const refreshedWorkspaceRepository = new LocalWorkspaceRepository(storage);
  assert.deepEqual(refreshedWorkspaceRepository.getSkillProgress(), [
    { skillId: "Lyrics", state: "WantToRevisit" },
    { skillId: "Melody", state: "Practiced" },
  ]);
  assert.equal(new LocalProjectRepository(storage, options).get(projectA.projectId)?.title, "Skill Map A");
});

test("schema version 11 migrates Workspace Skill Map defaults without changing projects", () => {
  const { storage, options, repository } = createHarness();
  const project = repository.create({ title: "Legacy Skill Map" });
  repository.update(project.projectId, { projectNote: "Keep this project" });

  const workspace = JSON.parse(storage.getItem("songwriting-workspace:workspace")!) as {
    schemaVersion: number;
    data: Record<string, unknown>;
  };
  delete workspace.data.skillProgress;
  workspace.schemaVersion = 11;
  storage.setItem("songwriting-workspace:workspace", JSON.stringify(workspace));

  const projectKey = `songwriting-workspace:project:${project.projectId}`;
  const storedProject = JSON.parse(storage.getItem(projectKey)!) as { schemaVersion: number };
  storedProject.schemaVersion = 11;
  storage.setItem(projectKey, JSON.stringify(storedProject));

  const meta = JSON.parse(storage.getItem("songwriting-workspace:meta")!) as { schemaVersion: number };
  meta.schemaVersion = 11;
  storage.setItem("songwriting-workspace:meta", JSON.stringify(meta));

  const migratedWorkspaceRepository = new LocalWorkspaceRepository(storage);
  assert.deepEqual(migratedWorkspaceRepository.getSkillProgress(), []);
  assert.equal(new LocalProjectRepository(storage, options).get(project.projectId)?.projectNote, "Keep this project");
  assert.equal(JSON.parse(storage.getItem("songwriting-workspace:meta")!).schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(JSON.parse(storage.getItem("songwriting-workspace:workspace")!).schemaVersion, CURRENT_SCHEMA_VERSION);
});

function experimentInput(
  type: (typeof GARAGEBAND_EXPERIMENT_TYPES)[number],
  sectionId?: string | null,
) {
  return {
    sectionId,
    type,
    date: "2026-09-20",
    goal: `${type} question from the user`,
    whatITried: `${type} test written by the user`,
    whatINoticed: `${type} observation written by the user`,
    decision: `${type} decision written by the user`,
    nextQuestion: `${type} next question written by the user`,
  };
}

test("PHASE 16 experiment log supports every type, edit, delete, refresh, and project isolation", () => {
  const { storage, options, repository } = createHarness();
  const projectA = repository.create({ title: "Experiment A" });
  const projectB = repository.create({ title: "Experiment B" });
  const section = repository.addLyricsSection(projectA.projectId, { type: "verse", name: "Verse" });

  const experiments = GARAGEBAND_EXPERIMENT_TYPES.map((type) =>
    repository.addGarageBandExperiment(projectA.projectId, experimentInput(type, section.sectionId)),
  );
  assert.deepEqual(experiments.map((experiment) => experiment.type), [...GARAGEBAND_EXPERIMENT_TYPES]);
  assert.ok(experiments.every((experiment) => experiment.projectId === projectA.projectId));
  assert.ok(experiments.every((experiment) => experiment.sectionId === section.sectionId));
  assert.equal(repository.get(projectB.projectId)?.garageBandExperiments.length, 0);

  const edited = repository.updateGarageBandExperiment(projectA.projectId, experiments[0].experimentId, {
    type: "Other",
    whatINoticed: "The user wrote a different observation",
  });
  assert.equal(edited.type, "Other");
  assert.equal(edited.whatINoticed, "The user wrote a different observation");

  repository.deleteGarageBandExperiment(projectA.projectId, experiments[1].experimentId);
  const refreshed = new LocalProjectRepository(storage, options).get(projectA.projectId)!;
  assert.equal(refreshed.garageBandExperiments.length, GARAGEBAND_EXPERIMENT_TYPES.length - 1);
  assert.equal(refreshed.garageBandExperiments.some((experiment) => experiment.experimentId === experiments[1].experimentId), false);
  assert.equal(new LocalProjectRepository(storage, options).get(projectB.projectId)?.garageBandExperiments.length, 0);
});

test("PHASE 16 keeps Section identity through rename and preserves experiments when a Section is deleted", () => {
  const { repository } = createHarness();
  const project = repository.create({ title: "Section history" });
  const section = repository.addLyricsSection(project.projectId, { type: "chorus", name: "Chorus" });
  const experiment = repository.addGarageBandExperiment(
    project.projectId,
    experimentInput("Harmony", section.sectionId),
  );

  repository.updateLyricsSection(project.projectId, section.sectionId, { name: "Renamed chorus" });
  assert.equal(repository.get(project.projectId)?.garageBandExperiments[0].sectionId, section.sectionId);
  assert.equal(repository.get(project.projectId)?.lyrics.sections[0].name, "Renamed chorus");

  repository.deleteLyricsSection(project.projectId, section.sectionId);
  const afterDelete = repository.get(project.projectId)!;
  assert.equal(afterDelete.garageBandExperiments.length, 1);
  assert.equal(afterDelete.garageBandExperiments[0].experimentId, experiment.experimentId);
  assert.equal(afterDelete.garageBandExperiments[0].sectionId, null);
  assert.equal(afterDelete.garageBandExperiments.some((item) => item.sectionId === section.sectionId), false);
});

test("PHASE 16 Duplicate Section does not fabricate experiment history", () => {
  const { repository } = createHarness();
  const project = repository.create({ title: "Section duplicate history" });
  const section = repository.addLyricsSection(project.projectId, { type: "verse", name: "Verse" });
  repository.addGarageBandExperiment(project.projectId, experimentInput("Melody", section.sectionId));

  const duplicateSection = repository.duplicateLyricsSection(project.projectId, section.sectionId);
  const afterDuplicate = repository.get(project.projectId)!;
  assert.notEqual(duplicateSection.sectionId, section.sectionId);
  assert.equal(afterDuplicate.garageBandExperiments.length, 1);
  assert.equal(afterDuplicate.garageBandExperiments[0].sectionId, section.sectionId);
  assert.equal(afterDuplicate.garageBandExperiments.some((item) => item.sectionId === duplicateSection.sectionId), false);
});

test("PHASE 16 Duplicate Project remaps experiment and Section IDs without sharing history", () => {
  const { repository } = createHarness();
  const source = repository.create({ title: "Experiment source" });
  const sourceSection = repository.addLyricsSection(source.projectId, { type: "verse", name: "Source verse" });
  const sourceOtherSection = repository.addLyricsSection(source.projectId, { type: "chorus", name: "Source chorus" });
  const sourceExperiment = repository.addGarageBandExperiment(
    source.projectId,
    experimentInput("Recording", sourceSection.sectionId),
  );
  const unboundExperiment = repository.addGarageBandExperiment(
    source.projectId,
    experimentInput("Other", null),
  );

  const duplicate = repository.duplicate(source.projectId);
  const copiedSourceSection = duplicate.lyrics.sections.find((section) => section.name === sourceSection.name)!;
  const copiedOtherSection = duplicate.lyrics.sections.find((section) => section.name === sourceOtherSection.name)!;
  const copiedExperiment = duplicate.garageBandExperiments.find(
    (experiment) => experiment.type === sourceExperiment.type,
  )!;
  const copiedUnbound = duplicate.garageBandExperiments.find(
    (experiment) => experiment.type === unboundExperiment.type,
  )!;

  assert.notEqual(duplicate.projectId, source.projectId);
  assert.notEqual(copiedSourceSection.sectionId, sourceSection.sectionId);
  assert.notEqual(copiedOtherSection.sectionId, sourceOtherSection.sectionId);
  assert.notEqual(copiedExperiment.experimentId, sourceExperiment.experimentId);
  assert.equal(copiedExperiment.projectId, duplicate.projectId);
  assert.equal(copiedExperiment.sectionId, copiedSourceSection.sectionId);
  assert.equal(copiedUnbound.projectId, duplicate.projectId);
  assert.equal(copiedUnbound.sectionId, null);

  repository.updateGarageBandExperiment(duplicate.projectId, copiedExperiment.experimentId, {
    decision: "Copy-only decision written by the user",
  });
  assert.equal(repository.get(source.projectId)?.garageBandExperiments.find(
    (experiment) => experiment.experimentId === sourceExperiment.experimentId,
  )?.decision, sourceExperiment.decision);
});

test("schema version 12 migrates legacy projects to an empty PHASE 16 Experiment Log", () => {
  const { storage, options, repository } = createHarness();
  const project = repository.create({ title: "Legacy before experiments" });
  repository.update(project.projectId, { projectNote: "Preserve this project" });

  const projectKey = `songwriting-workspace:project:${project.projectId}`;
  const storedProject = JSON.parse(storage.getItem(projectKey)!) as {
    schemaVersion: number;
    data: Record<string, unknown>;
  };
  delete storedProject.data.garageBandExperiments;
  storedProject.schemaVersion = 12;
  storage.setItem(projectKey, JSON.stringify(storedProject));
  const workspace = JSON.parse(storage.getItem("songwriting-workspace:workspace")!) as {
    schemaVersion: number;
    data: unknown;
  };
  workspace.schemaVersion = 12;
  storage.setItem("songwriting-workspace:workspace", JSON.stringify(workspace));
  const meta = JSON.parse(storage.getItem("songwriting-workspace:meta")!) as { schemaVersion: number };
  meta.schemaVersion = 12;
  storage.setItem("songwriting-workspace:meta", JSON.stringify(meta));

  const migrated = new LocalProjectRepository(storage, options).get(project.projectId)!;
  assert.deepEqual(migrated.garageBandExperiments, []);
  assert.equal(migrated.projectNote, "Preserve this project");
  assert.equal(JSON.parse(storage.getItem("songwriting-workspace:meta")!).schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(JSON.parse(storage.getItem(projectKey)!).schemaVersion, CURRENT_SCHEMA_VERSION);
});

test("PHASE 17 creates immutable numbered snapshots and compares factual differences", () => {
  const { repository, storage, options } = createHarness();
  const projectA = repository.create({ title: "Versioned song", projectNote: "First note" });
  const projectB = repository.create({ title: "Other song" });
  const section = repository.addLyricsSection(projectA.projectId, { type: "verse", name: "Verse" });
  repository.updateLyricsSection(projectA.projectId, section.sectionId, {
    userLyrics: "User-written first state",
    bars: 8,
    notes: "Section note",
  });
  repository.updateRhythm(projectA.projectId, { bpm: 90, timeSignature: "3/4", notes: "Rhythm note" });
  repository.setHarmonyKey(projectA.projectId, "C");
  repository.createHarmonyProgression(projectA.projectId, { type: "verse", sectionId: section.sectionId });
  const track = repository.addArrangementTrack(projectA.projectId, { category: "piano", name: "My piano idea" });
  repository.updateArrangementCell(projectA.projectId, section.sectionId, track.trackId, { presence: "Present", notes: "Cell note" });
  const take = repository.addMelodyTake(projectA.projectId, {
    sectionId: section.sectionId,
    audioAssetId: "asset-version-1",
    name: "My Take",
    mimeType: "audio/webm",
  });
  repository.setMelodyTakeSelected(projectA.projectId, take.takeId, true);
  repository.updateOpenQuestions(projectA.projectId, ["Does this section need more space?"]);

  const v1 = repository.saveVersion(projectA.projectId, { userNote: "First manual snapshot" });
  repository.updateLyricsSection(projectA.projectId, section.sectionId, { userLyrics: "User-written second state" });
  repository.updateRhythm(projectA.projectId, { bpm: 110, timeSignature: "4/4" });
  repository.updateOpenQuestions(projectA.projectId, ["What happens next?"]);
  const v2 = repository.saveVersion(projectA.projectId, { userNote: "Second manual snapshot" });
  const v3 = repository.saveVersion(projectA.projectId);

  assert.equal(v1.label, "V1");
  assert.equal(v2.label, "V2");
  assert.equal(v3.label, "V3");
  assert.equal(v1.userNote, "First manual snapshot");
  assert.equal(v1.snapshot.lyrics.sections[0].userLyrics, "User-written first state");
  assert.equal(v1.snapshot.rhythm.bpm, 90);
  assert.equal(v1.snapshot.rhythm.timeSignature, "3/4");
  assert.deepEqual(v1.snapshot.melody.selectedTakeIds, [take.takeId]);
  assert.equal(v1.snapshot.melody.takes[0].audioAssetId, "asset-version-1");
  assert.deepEqual(v1.snapshot.openQuestions, ["Does this section need more space?"]);
  v1.snapshot.lyrics.sections[0].userLyrics = "Mutated returned clone";
  const refreshedV1 = new LocalProjectRepository(storage, options).get(projectA.projectId)!.versions[0];
  assert.equal(refreshedV1.snapshot.lyrics.sections[0].userLyrics, "User-written first state");
  const differenceLabels = compareVersions(v1, v2).map((difference) => difference.label);
  assert.ok(differenceLabels.includes("Lyrics changed"));
  assert.ok(differenceLabels.includes("BPM changed"));
  assert.ok(differenceLabels.includes("Time signature changed"));
  assert.ok(differenceLabels.includes("Open Questions changed"));
  assert.doesNotMatch(JSON.stringify(compareVersions(refreshedV1, v2)), /best|better|worse|stronger|score|rank|mature/i);
  const duplicate = repository.duplicate(projectA.projectId);
  assert.equal(duplicate.versions.length, 3);
  assert.notEqual(duplicate.versions[0].versionId, refreshedV1.versionId);
  assert.equal(duplicate.versions[0].projectId, duplicate.projectId);
  assert.equal(duplicate.versions[0].snapshot.projectId, duplicate.projectId);
  assert.notEqual(duplicate.versions[0].snapshot.lyrics.sections[0].sectionId, refreshedV1.snapshot.lyrics.sections[0].sectionId);
  assert.equal(
    duplicate.versions[0].snapshot.harmony.progressions[0].sectionId,
    duplicate.versions[0].snapshot.lyrics.sections[0].sectionId,
  );
  assert.equal(
    duplicate.versions[0].snapshot.arrangement.cells[0].trackId,
    duplicate.versions[0].snapshot.arrangement.tracks[0].trackId,
  );
  assert.throws(() => repository.restoreVersion(projectB.projectId, v1.versionId, false), /not found in this project/i);
  assert.throws(() => repository.deleteVersion(projectB.projectId, v1.versionId), /not found in this project/i);
});

test("PHASE 17 restore preserves project identity and Experiment Log while restoring valid references", () => {
  const { repository } = createHarness();
  const project = repository.create({ title: "Restore song" });
  const section = repository.addLyricsSection(project.projectId, { type: "chorus", name: "Chorus" });
  repository.updateLyricsSection(project.projectId, section.sectionId, { userLyrics: "Snapshot lyrics" });
  repository.setHarmonyKey(project.projectId, "G");
  repository.createHarmonyProgression(project.projectId, { type: "chorus", sectionId: section.sectionId });
  const track = repository.addArrangementTrack(project.projectId, { category: "lead-vocal", name: "Voice" });
  repository.updateArrangementCell(project.projectId, section.sectionId, track.trackId, { energy: "Open" });
  const take = repository.addMelodyTake(project.projectId, {
    sectionId: section.sectionId,
    audioAssetId: "restore-asset",
    name: "Restore Take",
    mimeType: "audio/webm",
  });
  repository.setMelodyTakeSelected(project.projectId, take.takeId, true);
  const version = repository.saveVersion(project.projectId);
  const experiment = repository.addGarageBandExperiment(project.projectId, {
    sectionId: section.sectionId,
    type: "Melody",
    date: "2026-09-20",
    goal: "User goal",
    whatITried: "User trial",
    whatINoticed: "User observation",
    decision: "User decision",
    nextQuestion: "User question",
  });
  repository.updateLyricsSection(project.projectId, section.sectionId, { userLyrics: "Current replacement" });

  const restored = repository.restoreVersion(project.projectId, version.versionId, true);
  assert.equal(restored.projectId, project.projectId);
  assert.equal(restored.lyrics.sections[0].userLyrics, "Snapshot lyrics");
  assert.equal(restored.harmony.progressions[0].sectionId, restored.lyrics.sections[0].sectionId);
  assert.equal(restored.arrangement.cells[0].sectionId, restored.lyrics.sections[0].sectionId);
  assert.equal(restored.arrangement.cells[0].trackId, restored.arrangement.tracks[0].trackId);
  assert.equal(restored.melody.takes[0].sectionId, restored.lyrics.sections[0].sectionId);
  assert.equal(restored.melody.selectedTakeIds[0], restored.melody.takes[0].takeId);
  assert.equal(restored.garageBandExperiments[0].experimentId, experiment.experimentId);
  assert.equal(restored.garageBandExperiments[0].goal, experiment.goal);
  assert.equal(restored.versions.length, 2);
  assert.match(restored.versions[1].label, /before restore/i);
});

test("PHASE 17 audio references survive Take deletion, Version duplication, and project duplication", async () => {
  const { repository } = createHarness();
  const audio = new MemoryAudioAssetRepository();
  let assetId = 0;
  const melody = new MelodyService(repository, audio, { createId: () => `audio-${++assetId}` });
  const versions = new VersionService(repository, audio);
  const project = repository.create({ title: "Audio version song" });
  const section = repository.addLyricsSection(project.projectId, { type: "verse", name: "Verse" });
  const take = await melody.createTake(project.projectId, section.sectionId, new Blob(["audio"]), 1000);
  repository.setMelodyTakeSelected(project.projectId, take.takeId, true);
  const version = repository.saveVersion(project.projectId);
  await melody.deleteTake(project.projectId, take.takeId);
  assert.ok(await audio.get(project.projectId, take.audioAssetId));

  const copiedVersion = repository.duplicateVersion(project.projectId, version.versionId);
  await versions.deleteVersion(project.projectId, version.versionId);
  assert.ok(await audio.get(project.projectId, take.audioAssetId));
  await versions.deleteVersion(project.projectId, copiedVersion.versionId);
  assert.equal(await audio.get(project.projectId, take.audioAssetId), null);

  const take2 = await melody.createTake(project.projectId, section.sectionId, new Blob(["audio-2"]), 1200);
  repository.saveVersion(project.projectId);
  await melody.deleteTake(project.projectId, take2.takeId);
  const duplicate = await melody.duplicateProject(project.projectId);
  const duplicateVersionTake = duplicate.versions[0].snapshot.melody.takes[0];
  assert.equal(duplicateVersionTake.projectId, duplicate.projectId);
  assert.notEqual(duplicateVersionTake.audioAssetId, take2.audioAssetId);
  assert.ok(await audio.get(duplicate.projectId, duplicateVersionTake.audioAssetId));

  await melody.deleteProject(project.projectId);
  assert.equal((await audio.listByProject(project.projectId)).length, 0);
  assert.ok(await audio.get(duplicate.projectId, duplicateVersionTake.audioAssetId));
});

test("PHASE 17 restore without a safety backup cleans audio no longer referenced", async () => {
  const { repository } = createHarness();
  const audio = new MemoryAudioAssetRepository();
  let id = 0;
  const melody = new MelodyService(repository, audio, { createId: () => `restore-audio-${++id}` });
  const versions = new VersionService(repository, audio);
  const project = repository.create({ title: "Restore cleanup" });
  const section = repository.addLyricsSection(project.projectId, { type: "verse", name: "Verse" });
  const version = repository.saveVersion(project.projectId);
  const laterTake = await melody.createTake(project.projectId, section.sectionId, new Blob(["later audio"]), 900);
  assert.ok(await audio.get(project.projectId, laterTake.audioAssetId));

  const restored = await versions.restoreVersion(project.projectId, version.versionId, false);
  assert.equal(restored.melody.takes.length, 0);
  assert.equal(await audio.get(project.projectId, laterTake.audioAssetId), null);
});

test("schema version 13 migrates projects to empty PHASE 17 Version state", () => {
  const { storage, options, repository } = createHarness();
  const project = repository.create({ title: "Legacy before versions" });
  const projectKey = `songwriting-workspace:project:${project.projectId}`;
  const storedProject = JSON.parse(storage.getItem(projectKey)!) as { schemaVersion: number; data: Record<string, unknown> };
  const melody = storedProject.data.melody as Record<string, unknown>;
  delete melody.selectedTakeIds;
  delete storedProject.data.openQuestions;
  delete storedProject.data.versions;
  storedProject.schemaVersion = 13;
  storage.setItem(projectKey, JSON.stringify(storedProject));
  const workspace = JSON.parse(storage.getItem("songwriting-workspace:workspace")!) as { schemaVersion: number; data: unknown };
  workspace.schemaVersion = 13;
  storage.setItem("songwriting-workspace:workspace", JSON.stringify(workspace));
  const meta = JSON.parse(storage.getItem("songwriting-workspace:meta")!) as { schemaVersion: number };
  meta.schemaVersion = 13;
  storage.setItem("songwriting-workspace:meta", JSON.stringify(meta));

  const migrated = new LocalProjectRepository(storage, options).get(project.projectId)!;
  assert.deepEqual(migrated.melody.selectedTakeIds, []);
  assert.deepEqual(migrated.openQuestions, []);
  assert.deepEqual(migrated.versions, []);
  assert.equal(JSON.parse(storage.getItem("songwriting-workspace:meta")!).schemaVersion, CURRENT_SCHEMA_VERSION);
});

test("PHASE 18 Review defaults, saves user reflections, and reuses Open Questions", () => {
  const { repository, storage, options } = createHarness();
  const project = repository.create({ title: "Review state" });

  assert.deepEqual(project.review, {
    projectId: project.projectId,
    createdAt: project.createdAt,
    updatedAt: project.createdAt,
    status: "not-reviewed",
    userReflection: "",
    categoryReflections: [],
    nextFocus: {
      workOnNext: "",
      testNext: "",
      leaveAloneForNow: "",
    },
  });

  const updated = repository.updateReview(project.projectId, {
    status: "in-review",
    userReflection: "I want to remember what changed in this pass.",
    categoryReflections: [
      { category: "lyrics", content: "I want to revisit the second section." },
      { category: "version-history", content: "I changed the rhythm notes since the last Version." },
    ],
    nextFocus: {
      workOnNext: "Return to the second section.",
      testNext: "Try one external listening experiment.",
      leaveAloneForNow: "Leave the opening as it is for now.",
    },
  });
  const intentChecked = repository.setSongIntentCheck(project.projectId, "partly");
  repository.updateOpenQuestions(project.projectId, ["What do I want to test next?"]);

  assert.equal(updated.review.status, "in-review");
  assert.equal(updated.review.userReflection, "I want to remember what changed in this pass.");
  assert.equal(updated.review.categoryReflections.length, 2);
  assert.equal(updated.review.nextFocus.testNext, "Try one external listening experiment.");
  assert.equal(intentChecked.reflection.songIntentCheck, "partly");
  assert.deepEqual(repository.get(project.projectId)?.openQuestions, ["What do I want to test next?"]);

  const refreshed = new LocalProjectRepository(storage, options).get(project.projectId)!;
  assert.equal(refreshed.review.userReflection, updated.review.userReflection);
  assert.equal("projectId" in refreshed.review.categoryReflections[0], false);
  assert.deepEqual(refreshed.openQuestions, ["What do I want to test next?"]);
});

test("PHASE 18 Review data is isolated and deeply copied by Project Duplicate", () => {
  const { repository } = createHarness();
  const source = repository.create({ title: "Review source" });
  repository.updateReview(source.projectId, {
    status: "reviewed",
    userReflection: "Source reflection",
    categoryReflections: [{ category: "melody", content: "Source melody note" }],
    nextFocus: { workOnNext: "Source next focus" },
  });

  const duplicate = repository.duplicate(source.projectId);
  assert.notEqual(duplicate.projectId, source.projectId);
  assert.equal(duplicate.review.projectId, duplicate.projectId);
  assert.equal(duplicate.review.userReflection, "Source reflection");
  assert.notEqual(duplicate.review, repository.get(source.projectId)!.review);
  assert.notEqual(duplicate.review.categoryReflections, repository.get(source.projectId)!.review.categoryReflections);

  repository.updateReview(duplicate.projectId, {
    userReflection: "Duplicate reflection",
    categoryReflections: [{ category: "melody", content: "Duplicate melody note" }],
  });
  assert.equal(repository.get(source.projectId)?.review.userReflection, "Source reflection");
  assert.equal(repository.get(source.projectId)?.review.categoryReflections[0].content, "Source melody note");
});

test("PHASE 18 Version Restore preserves current Review and restores only snapshot fields", () => {
  const { repository } = createHarness();
  const project = repository.create({ title: "Review restore" });
  const section = repository.addLyricsSection(project.projectId, { type: "verse", name: "Verse" });
  repository.updateLyricsSection(project.projectId, section.sectionId, { userLyrics: "Snapshot lyrics" });
  repository.updateReview(project.projectId, {
    status: "reviewed",
    userReflection: "Review written before saving Version",
    nextFocus: { workOnNext: "Work before restore" },
  });
  const version = repository.saveVersion(project.projectId);
  repository.updateLyricsSection(project.projectId, section.sectionId, { userLyrics: "Current lyrics" });
  repository.updateReview(project.projectId, {
    status: "in-review",
    userReflection: "Current Review remains active",
    nextFocus: { workOnNext: "Current next focus" },
  });

  const restored = repository.restoreVersion(project.projectId, version.versionId, false);
  assert.equal(restored.lyrics.sections[0].userLyrics, "Snapshot lyrics");
  assert.equal(restored.review.status, "in-review");
  assert.equal(restored.review.userReflection, "Current Review remains active");
  assert.equal(restored.review.nextFocus.workOnNext, "Current next focus");
});

test("schema version 14 migrates legacy projects to an empty PHASE 18 Review state", () => {
  const { storage, options, repository } = createHarness();
  const project = repository.create({ title: "Legacy before Review", projectNote: "Keep this note" });
  const projectKey = `songwriting-workspace:project:${project.projectId}`;
  const storedProject = JSON.parse(storage.getItem(projectKey)!) as {
    schemaVersion: number;
    data: Record<string, unknown>;
  };
  delete storedProject.data.review;
  storedProject.schemaVersion = 14;
  storage.setItem(projectKey, JSON.stringify(storedProject));
  const workspace = JSON.parse(storage.getItem("songwriting-workspace:workspace")!) as {
    schemaVersion: number;
    data: unknown;
  };
  workspace.schemaVersion = 14;
  storage.setItem("songwriting-workspace:workspace", JSON.stringify(workspace));
  const meta = JSON.parse(storage.getItem("songwriting-workspace:meta")!) as { schemaVersion: number };
  meta.schemaVersion = 14;
  storage.setItem("songwriting-workspace:meta", JSON.stringify(meta));

  const migrated = new LocalProjectRepository(storage, options).get(project.projectId)!;
  assert.equal(migrated.projectNote, "Keep this note");
  assert.equal(migrated.review.projectId, project.projectId);
  assert.equal(migrated.review.status, "not-reviewed");
  assert.deepEqual(migrated.review.categoryReflections, []);
  assert.equal(JSON.parse(storage.getItem("songwriting-workspace:meta")!).schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(JSON.parse(storage.getItem(projectKey)!).schemaVersion, CURRENT_SCHEMA_VERSION);
});

test("PHASE 19 unarchive restores an archived project in the workspace index", () => {
  const { repository, storage, options } = createHarness();
  const project = repository.create({ title: "Archive lifecycle" });
  repository.update(project.projectId, { projectNote: "Keep this note" });

  const archived = repository.archive(project.projectId);
  assert.equal(archived.status, "archived");
  assert.equal(repository.list("active").some((item) => item.projectId === project.projectId), false);
  assert.equal(repository.list("archived").some((item) => item.projectId === project.projectId), true);

  const restored = repository.unarchive(project.projectId);
  assert.equal(restored.status, "active");
  assert.equal(restored.projectNote, "Keep this note");
  assert.equal(repository.list("active").some((item) => item.projectId === project.projectId), true);
  assert.equal(repository.list("archived").some((item) => item.projectId === project.projectId), false);

  const refreshed = new LocalProjectRepository(storage, options).get(project.projectId);
  assert.equal(refreshed?.status, "active");
  assert.equal(refreshed?.projectNote, "Keep this note");
});
