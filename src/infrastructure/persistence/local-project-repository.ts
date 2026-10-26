import type { ProjectRepository } from "../../application/ports/project-repository";
import {
  CHORD_SYMBOLS,
  ARRANGEMENT_TRACK_PRESETS,
  duplicateProjectData,
  GUIDED_LYRICS_STARTING_STRUCTURE,
  HARMONY_KEYS,
  HARMONY_PROGRESSION_TYPES,
  IDEA_STARTING_POINTS,
  LYRICS_SECTION_GUIDANCE,
  LYRICS_SECTION_TYPES,
  LINE_REFLECTION_LABELS,
  GARAGEBAND_EXPERIMENT_TYPES,
  MELODY_TAKE_STATUSES,
  MATERIAL_TYPES,
  PROJECT_CREATION_MODES,
  PROJECT_STAGES,
  REVIEW_CATEGORIES,
  REVIEW_STATUSES,
  SONG_INTENT_CHECK_OPTIONS,
  TIME_SIGNATURES,
  toProjectSummary,
  type AddMaterialInput,
  type AddArrangementTrackInput,
  type AddGarageBandExperimentInput,
  type ArrangementCell,
  type ArrangementTrack,
  type AddLyricsSectionInput,
  type AddMelodyTakeInput,
  type AnswerExploreInput,
  type CreateHarmonyProgressionInput,
  type CreateProjectInput,
  type ChordSymbol,
  type HarmonyKey,
  type HarmonyProgression,
  type GarageBandExperiment,
  type IdeaStartingPoint,
  type Material,
  type LyricsSection,
  type MelodyTake,
  type ProjectCreationMode,
  type ProjectListItem,
  type ProjectStatus,
  type ProjectStage,
  type SaveVersionInput,
  type SetLineReflectionInput,
  type SongProject,
  type SongVersion,
  type VersionSnapshot,
  type SongIntentCheckOption,
  type UpdateMaterialInput,
  type UpdateArrangementCellInput,
  type UpdateArrangementTrackInput,
  type UpdateLyricsSectionInput,
  type UpdateMelodyTakeInput,
  type UpdateProjectInput,
  type UpdateReviewInput,
  type UpdateRhythmInput,
  type UpdateHarmonyProgressionInput,
  type UpdateGarageBandExperimentInput,
  type UpdateSongIntentInput,
  type ReviewState,
} from "../../domain/project/project";
import { createVersionSnapshot } from "../../domain/project/versions";
import type { WorkspaceState } from "../../domain/workspace/workspace";
import {
  isSkillId,
  isSkillState,
  type SkillId,
  type SkillProgress,
  type SkillState,
} from "../../domain/workspace/skill-map";
import type { WorkspaceRepository } from "../../application/ports/workspace-repository";
import {
  PersistenceError,
  ProjectNotFoundError,
  UnsupportedSchemaVersionError,
} from "./errors";
import type { KeyValueStorage } from "./storage";

export const CURRENT_SCHEMA_VERSION = 15;

const META_KEY = "songwriting-workspace:meta";
const WORKSPACE_KEY = "songwriting-workspace:workspace";
const PROJECT_KEY_PREFIX = "songwriting-workspace:project:";

interface StorageMeta {
  schemaVersion: number;
  appDataCreatedAt: string;
  lastMigratedAt: string;
}

interface StorageEnvelope<T> {
  schemaVersion: number;
  data: T;
}

interface RepositoryOptions {
  now?: () => string;
  createId?: () => string;
}

function createEmptyReview(projectId: string, timestamp: string): ReviewState {
  return {
    projectId,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "not-reviewed",
    userReflection: "",
    categoryReflections: [],
    nextFocus: {
      workOnNext: "",
      testNext: "",
      leaveAloneForNow: "",
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertSkillProgress(skillProgress: unknown): asserts skillProgress is SkillProgress[] {
  if (!Array.isArray(skillProgress)) {
    throw new PersistenceError("Workspace Skill Map data is invalid. No data was changed.");
  }
  const skillIds = new Set<SkillId>();
  for (const progress of skillProgress) {
    if (
      !isRecord(progress) ||
      !isSkillId(progress.skillId) ||
      !isSkillState(progress.state) ||
      skillIds.has(progress.skillId)
    ) {
      throw new PersistenceError("Workspace Skill Map data is invalid. No data was changed.");
    }
    skillIds.add(progress.skillId);
  }
}

function assertWorkspace(workspace: WorkspaceState): void {
  if (
    typeof workspace.workspaceId !== "string" ||
    !Array.isArray(workspace.projectIndex)
  ) {
    throw new PersistenceError("Workspace index is invalid. No data was changed.");
  }
  assertSkillProgress(workspace.skillProgress);
}

function isChordSymbol(value: unknown): value is ChordSymbol {
  return typeof value === "string" && CHORD_SYMBOLS.includes(value as ChordSymbol);
}

function isArrangementTrackCategory(value: unknown): value is ArrangementTrack["category"] {
  return typeof value === "string" && ARRANGEMENT_TRACK_PRESETS.some((preset) => preset.category === value);
}

function parseJson(raw: string, key: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new PersistenceError(
      `Stored data at ${key} could not be read. No data was changed.`,
      { cause: error },
    );
  }
}

function readEnvelope<T>(raw: string, key: string): T {
  const parsed = parseJson(raw, key);
  if (!isRecord(parsed) || typeof parsed.schemaVersion !== "number") {
    throw new PersistenceError(
      `Stored data at ${key} has no valid schema version. No data was changed.`,
    );
  }
  if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(parsed.schemaVersion);
  }
  if (!("data" in parsed)) {
    throw new PersistenceError(
      `Stored data at ${key} is incomplete. No data was changed.`,
    );
  }
  return parsed.data as T;
}

function readEnvelopeAtVersion<T>(raw: string, key: string, version: number): T {
  const parsed = parseJson(raw, key);
  if (!isRecord(parsed) || parsed.schemaVersion !== version || !("data" in parsed)) {
    throw new PersistenceError(
      `Stored data at ${key} is not a valid schema version ${version} record. No data was changed.`,
    );
  }
  return parsed.data as T;
}

function envelope<T>(data: T): StorageEnvelope<T> {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, data };
}

function envelopeAtVersion<T>(data: T, schemaVersion: number): StorageEnvelope<T> {
  return { schemaVersion, data };
}

function assertProject(project: SongProject, expectedProjectId: string): void {
  if (project.projectId !== expectedProjectId) {
    throw new PersistenceError(
      `Project ownership mismatch for ${expectedProjectId}. No data was changed.`,
    );
  }
  if (!PROJECT_CREATION_MODES.includes(project.creationMode)) {
    throw new PersistenceError(
      `Project ${expectedProjectId} has an invalid creation mode. No data was changed.`,
    );
  }
  if (!PROJECT_STAGES.includes(project.currentStage)) {
    throw new PersistenceError(
      `Project ${expectedProjectId} has an invalid current stage. No data was changed.`,
    );
  }
  if (!isRecord(project.idea) || (
    project.idea.startingPoint !== null &&
    !IDEA_STARTING_POINTS.includes(project.idea.startingPoint)
  )) {
    throw new PersistenceError(
      `Project ${expectedProjectId} has invalid idea data. No data was changed.`,
    );
  }
  if (!isRecord(project.explore) || !Number.isInteger(project.explore.currentPromptIndex) || !Array.isArray(project.explore.responses)) {
    throw new PersistenceError(
      `Project ${expectedProjectId} has invalid explore data. No data was changed.`,
    );
  }
  if (!Array.isArray(project.materials)) {
    throw new PersistenceError(
      `Project ${expectedProjectId} has invalid materials. No data was changed.`,
    );
  }
  if (
    !isRecord(project.songIntent) ||
    project.songIntent.projectId !== expectedProjectId ||
    typeof project.songIntent.coreIdea !== "string" ||
    typeof project.songIntent.desiredFeeling !== "string" ||
    typeof project.songIntent.coreImage !== "string" ||
    typeof project.songIntent.centralConflict !== "string" ||
    !Array.isArray(project.songIntent.selectedMaterialIds) ||
    project.songIntent.selectedMaterialIds.length > 3 ||
    typeof project.songIntent.updatedAt !== "string"
  ) {
    throw new PersistenceError(
      `Project ${expectedProjectId} has invalid song intent data. No data was changed.`,
    );
  }
  if (!isRecord(project.lyrics) || !Array.isArray(project.lyrics.sections)) {
    throw new PersistenceError(
      `Project ${expectedProjectId} has invalid lyrics data. No data was changed.`,
    );
  }
  if (!Array.isArray(project.garageBandExperiments)) {
    throw new PersistenceError(
      `Project ${expectedProjectId} has invalid GarageBand experiment data. No data was changed.`,
    );
  }
  if (
    !isRecord(project.melody) ||
    !isRecord(project.melody.notesBySection) ||
    !Array.isArray(project.melody.takes) ||
    !Array.isArray(project.melody.selectedTakeIds)
  ) {
    throw new PersistenceError(
      `Project ${expectedProjectId} has invalid melody data. No data was changed.`,
    );
  }
  if (
    !isRecord(project.rhythm) ||
    !Number.isInteger(project.rhythm.bpm) ||
    project.rhythm.bpm < 40 ||
    project.rhythm.bpm > 220 ||
    !TIME_SIGNATURES.includes(project.rhythm.timeSignature) ||
    typeof project.rhythm.notes !== "string"
  ) {
    throw new PersistenceError(
      `Project ${expectedProjectId} has invalid rhythm data. No data was changed.`,
    );
  }
  if (
    !isRecord(project.harmony) ||
    project.harmony.projectId !== expectedProjectId ||
    (project.harmony.key !== null && !HARMONY_KEYS.includes(project.harmony.key)) ||
    typeof project.harmony.chordNotes !== "string" ||
    !Array.isArray(project.harmony.progressions)
  ) {
    throw new PersistenceError(
      `Project ${expectedProjectId} has invalid harmony data. No data was changed.`,
    );
  }
  if (
    !isRecord(project.arrangement) ||
    project.arrangement.projectId !== expectedProjectId ||
    !Array.isArray(project.arrangement.tracks) ||
    !Array.isArray(project.arrangement.cells)
  ) {
    throw new PersistenceError(
      `Project ${expectedProjectId} has invalid arrangement data. No data was changed.`,
    );
  }
  if (
    !isRecord(project.reflection) ||
    !Array.isArray(project.reflection.lineReflections) ||
    !Array.isArray(project.reflection.emotionMap) ||
    (project.reflection.songIntentCheck !== null &&
      !SONG_INTENT_CHECK_OPTIONS.includes(project.reflection.songIntentCheck)) ||
    typeof project.reflection.updatedAt !== "string"
  ) {
    throw new PersistenceError(
      `Project ${expectedProjectId} has invalid reflection data. No data was changed.`,
    );
  }
  if (
    !isRecord(project.review) ||
    project.review.projectId !== expectedProjectId ||
    typeof project.review.createdAt !== "string" ||
    typeof project.review.updatedAt !== "string" ||
    !REVIEW_STATUSES.includes(project.review.status) ||
    typeof project.review.userReflection !== "string" ||
    !isRecord(project.review.nextFocus) ||
    typeof project.review.nextFocus.workOnNext !== "string" ||
    typeof project.review.nextFocus.testNext !== "string" ||
    typeof project.review.nextFocus.leaveAloneForNow !== "string" ||
    !Array.isArray(project.review.categoryReflections)
  ) {
    throw new PersistenceError(
      `Project ${expectedProjectId} has invalid review data. No data was changed.`,
    );
  }
  const reviewCategories = new Set<string>();
  for (const reflection of project.review.categoryReflections) {
    if (
      !isRecord(reflection) ||
      !REVIEW_CATEGORIES.includes(reflection.category as typeof REVIEW_CATEGORIES[number]) ||
      reviewCategories.has(reflection.category as string) ||
      typeof reflection.content !== "string" ||
      !reflection.content.trim() ||
      typeof reflection.updatedAt !== "string"
    ) {
      throw new PersistenceError(
        `Review category reflection ownership or structure mismatch for ${expectedProjectId}. No data was changed.`,
      );
    }
    reviewCategories.add(reflection.category as string);
  }
  for (const response of project.explore.responses) {
    if (response.projectId !== expectedProjectId) {
      throw new PersistenceError(
        `Explore response ownership mismatch for ${expectedProjectId}. No data was changed.`,
      );
    }
  }
  for (const material of project.materials) {
    if (material.projectId !== expectedProjectId || !MATERIAL_TYPES.includes(material.type)) {
      throw new PersistenceError(
        `Material ownership or type mismatch for ${expectedProjectId}. No data was changed.`,
      );
    }
  }
  const sectionIds = new Set<string>();
  for (const [index, section] of project.lyrics.sections.entries()) {
    if (
      section.projectId !== expectedProjectId ||
      sectionIds.has(section.sectionId) ||
      !LYRICS_SECTION_TYPES.includes(section.type) ||
      section.order !== index ||
      typeof section.name !== "string" ||
      !section.name.trim() ||
      (section.bars !== null && (!Number.isInteger(section.bars) || section.bars < 1)) ||
      typeof section.purpose !== "string" ||
      !Array.isArray(section.reflectionQuestions) ||
      section.reflectionQuestions.some((question) => typeof question !== "string") ||
      typeof section.userLyrics !== "string" ||
      typeof section.notes !== "string" ||
      typeof section.createdAt !== "string" ||
      typeof section.updatedAt !== "string"
    ) {
      throw new PersistenceError(
        `Lyrics section ownership or structure mismatch for ${expectedProjectId}. No data was changed.`,
      );
    }
    sectionIds.add(section.sectionId);
  }
  const experimentIds = new Set<string>();
  for (const experiment of project.garageBandExperiments) {
    if (
      !isRecord(experiment) ||
      typeof experiment.experimentId !== "string" ||
      experimentIds.has(experiment.experimentId) ||
      experiment.projectId !== expectedProjectId ||
      (experiment.sectionId !== null && (
        typeof experiment.sectionId !== "string" ||
        !sectionIds.has(experiment.sectionId)
      )) ||
      typeof experiment.type !== "string" ||
      !GARAGEBAND_EXPERIMENT_TYPES.includes(experiment.type as GarageBandExperiment["type"]) ||
      typeof experiment.date !== "string" ||
      typeof experiment.goal !== "string" ||
      typeof experiment.whatITried !== "string" ||
      typeof experiment.whatINoticed !== "string" ||
      typeof experiment.decision !== "string" ||
      typeof experiment.nextQuestion !== "string"
    ) {
      throw new PersistenceError(
        `GarageBand experiment ownership or structure mismatch for ${expectedProjectId}. No data was changed.`,
      );
    }
    experimentIds.add(experiment.experimentId);
  }
  for (const [sectionId, notes] of Object.entries(project.melody.notesBySection)) {
    if (!sectionIds.has(sectionId) || typeof notes !== "string") {
      throw new PersistenceError(
        `Melody notes ownership mismatch for ${expectedProjectId}. No data was changed.`,
      );
    }
  }
  const takeIds = new Set<string>();
  const audioAssetIds = new Set<string>();
  for (const take of project.melody.takes) {
    if (
      take.projectId !== expectedProjectId ||
      !sectionIds.has(take.sectionId) ||
      takeIds.has(take.takeId) ||
      audioAssetIds.has(take.audioAssetId) ||
      !take.name.trim() ||
      !take.audioAssetId ||
      !take.mimeType ||
      (take.durationMs !== null && (!Number.isFinite(take.durationMs) || take.durationMs < 0)) ||
      !MELODY_TAKE_STATUSES.includes(take.status)
    ) {
      throw new PersistenceError(
        `Melody take ownership or structure mismatch for ${expectedProjectId}. No data was changed.`,
      );
    }
    takeIds.add(take.takeId);
    audioAssetIds.add(take.audioAssetId);
  }
  if (
    new Set(project.melody.selectedTakeIds).size !== project.melody.selectedTakeIds.length ||
    project.melody.selectedTakeIds.some((takeId) => !takeIds.has(takeId))
  ) {
    throw new PersistenceError(
      `Selected Melody Take references are invalid for ${expectedProjectId}. No data was changed.`,
    );
  }
  const lineReflectionKeys = new Set<string>();
  for (const entry of project.reflection.lineReflections) {
    const key = `${entry.sectionId}:${entry.lineIndex}`;
    if (
      !sectionIds.has(entry.sectionId) ||
      !Number.isInteger(entry.lineIndex) ||
      entry.lineIndex < 0 ||
      typeof entry.lineText !== "string" ||
      !entry.lineText.trim() ||
      !LINE_REFLECTION_LABELS.includes(entry.label) ||
      lineReflectionKeys.has(key)
    ) {
      throw new PersistenceError(
        `Line reflection ownership or structure mismatch for ${expectedProjectId}. No data was changed.`,
      );
    }
    lineReflectionKeys.add(key);
  }
  const emotionSectionIds = new Set<string>();
  for (const entry of project.reflection.emotionMap) {
    if (
      !sectionIds.has(entry.sectionId) ||
      typeof entry.emotion !== "string" ||
      emotionSectionIds.has(entry.sectionId)
    ) {
      throw new PersistenceError(
        `Emotion Map ownership or structure mismatch for ${expectedProjectId}. No data was changed.`,
      );
    }
    emotionSectionIds.add(entry.sectionId);
  }
  const materialIds = new Set(project.materials.map((material) => material.materialId));
  const selectedMaterialIds = project.songIntent.selectedMaterialIds;
  if (
    new Set(selectedMaterialIds).size !== selectedMaterialIds.length ||
    selectedMaterialIds.some((materialId) => !materialIds.has(materialId))
  ) {
    throw new PersistenceError(
      `Song intent material references are invalid for ${expectedProjectId}. No data was changed.`,
    );
  }
  const progressionIds = new Set<string>();
  for (const progression of project.harmony.progressions) {
    if (
      progression.projectId !== expectedProjectId ||
      (progression.sectionId !== null && !sectionIds.has(progression.sectionId)) ||
      progressionIds.has(progression.progressionId) ||
      !HARMONY_PROGRESSION_TYPES.includes(progression.type) ||
      typeof progression.name !== "string" ||
      !progression.name.trim() ||
      !Array.isArray(progression.chords) ||
      progression.chords.some((chord) => !isChordSymbol(chord)) ||
      typeof progression.notes !== "string" ||
      typeof progression.createdAt !== "string" ||
      typeof progression.updatedAt !== "string"
    ) {
      throw new PersistenceError(
        `Harmony progression ownership or structure mismatch for ${expectedProjectId}. No data was changed.`,
      );
    }
    progressionIds.add(progression.progressionId);
  }
  const trackIds = new Set<string>();
  for (const [index, track] of project.arrangement.tracks.entries()) {
    if (
      track.projectId !== expectedProjectId ||
      trackIds.has(track.trackId) ||
      track.order !== index ||
      !isArrangementTrackCategory(track.category) ||
      typeof track.name !== "string" ||
      !track.name.trim() ||
      typeof track.createdAt !== "string" ||
      typeof track.updatedAt !== "string"
    ) {
      throw new PersistenceError(
        `Arrangement track ownership or structure mismatch for ${expectedProjectId}. No data was changed.`,
      );
    }
    trackIds.add(track.trackId);
  }
  const cellIds = new Set<string>();
  const cellKeys = new Set<string>();
  for (const cell of project.arrangement.cells) {
    const cellKey = `${cell.sectionId}:${cell.trackId}`;
    if (
      cell.projectId !== expectedProjectId ||
      cellIds.has(cell.cellId) ||
      cellKeys.has(cellKey) ||
      !sectionIds.has(cell.sectionId) ||
      !trackIds.has(cell.trackId) ||
      typeof cell.presence !== "string" ||
      typeof cell.energy !== "string" ||
      typeof cell.density !== "string" ||
      typeof cell.dynamics !== "string" ||
      typeof cell.register !== "string" ||
      typeof cell.notes !== "string" ||
      typeof cell.updatedAt !== "string"
    ) {
      throw new PersistenceError(
        `Arrangement cell ownership or structure mismatch for ${expectedProjectId}. No data was changed.`,
      );
    }
    cellIds.add(cell.cellId);
    cellKeys.add(cellKey);
  }
  if (!Array.isArray(project.openQuestions) || project.openQuestions.some((question) => typeof question !== "string")) {
    throw new PersistenceError(
      `Open Questions are invalid for ${expectedProjectId}. No data was changed.`,
    );
  }
  if (!Array.isArray(project.versions)) {
    throw new PersistenceError(
      `Version history is invalid for ${expectedProjectId}. No data was changed.`,
    );
  }
  const versionIds = new Set<string>();
  const versionNumbers = new Set<number>();
  for (const version of project.versions) {
    if (
      !isRecord(version) ||
      typeof version.versionId !== "string" ||
      versionIds.has(version.versionId) ||
      version.projectId !== expectedProjectId ||
      !Number.isInteger(version.versionNumber) ||
      version.versionNumber < 1 ||
      versionNumbers.has(version.versionNumber) ||
      typeof version.label !== "string" ||
      !version.label.trim() ||
      typeof version.createdAt !== "string" ||
      typeof version.userNote !== "string" ||
      !isRecord(version.snapshot) ||
      version.snapshot.projectId !== expectedProjectId
    ) {
      throw new PersistenceError(
        `Version ownership or structure mismatch for ${expectedProjectId}. No data was changed.`,
      );
    }
    assertVersionSnapshot(version.snapshot as unknown as VersionSnapshot, expectedProjectId);
    versionIds.add(version.versionId);
    versionNumbers.add(version.versionNumber);
  }
}

function assertVersionSnapshot(snapshot: VersionSnapshot, projectId: string): void {
  const timestamp = "1970-01-01T00:00:00.000Z";
  assertProject({
    projectId,
    title: "Version snapshot",
    createdAt: timestamp,
    updatedAt: timestamp,
    currentStage: "Review",
    status: "active",
    creationMode: "Free",
    projectNote: snapshot.projectNote,
    idea: { startingPoint: null },
    explore: { currentPromptIndex: 0, responses: [] },
    materials: [],
    songIntent: {
      projectId,
      coreIdea: "",
      desiredFeeling: "",
      coreImage: "",
      centralConflict: "",
      selectedMaterialIds: [],
      updatedAt: timestamp,
    },
    lyrics: snapshot.lyrics,
    garageBandExperiments: [],
    melody: snapshot.melody,
    rhythm: snapshot.rhythm,
    harmony: snapshot.harmony,
    arrangement: snapshot.arrangement,
    reflection: snapshot.reflection,
    review: createEmptyReview(projectId, timestamp),
    openQuestions: snapshot.openQuestions,
    versions: [],
  }, projectId);
}

export class LocalProjectRepository implements ProjectRepository, WorkspaceRepository {
  private readonly now: () => string;
  private readonly createId: () => string;

  constructor(
    private readonly storage: KeyValueStorage,
    options: RepositoryOptions = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? (() => crypto.randomUUID());
  }

  list(status?: ProjectStatus): ProjectListItem[] {
    const workspace = this.readWorkspace();
    return workspace.projectIndex
      .filter((summary) => status === undefined || summary.status === status)
      .map((summary) => {
        const project = this.get(summary.projectId);
        if (!project) {
          throw new PersistenceError(
            `Project index references missing project ${summary.projectId}. No data was changed.`,
          );
        }
        return project;
      });
  }

  getSkillProgress(): SkillProgress[] {
    const workspace = this.readWorkspace();
    return structuredClone(workspace.skillProgress);
  }

  updateSkillProgress(skillId: SkillId, state: SkillState): SkillProgress[] {
    if (!isSkillId(skillId) || !isSkillState(state)) {
      throw new PersistenceError("Skill Map status is invalid. No data was changed.");
    }
    const workspace = this.readWorkspace();
    const existingIndex = workspace.skillProgress.findIndex(
      (progress) => progress.skillId === skillId,
    );
    const progress = { skillId, state } satisfies SkillProgress;
    if (existingIndex === -1) {
      workspace.skillProgress.push(progress);
    } else {
      workspace.skillProgress[existingIndex] = progress;
    }
    this.writeWorkspace(workspace);
    return structuredClone(workspace.skillProgress);
  }

  get(projectId: string): SongProject | null {
    this.ensureSchema();
    const key = this.projectKey(projectId);
    const raw = this.storage.getItem(key);
    if (raw === null) return null;

    const project = readEnvelope<SongProject>(raw, key);
    assertProject(project, projectId);
    return structuredClone(project);
  }

  create(input: CreateProjectInput): SongProject {
    const workspace = this.readWorkspace();
    const timestamp = this.now();
    const projectId = this.createId();
    const project: SongProject = {
      projectId,
      title: this.requireTitle(input.title),
      createdAt: timestamp,
      updatedAt: timestamp,
      currentStage: "Idea",
      status: "active",
      creationMode: "Guided",
      projectNote: input.projectNote?.trim() ?? "",
      idea: { startingPoint: null },
      explore: { currentPromptIndex: 0, responses: [] },
      materials: [],
      songIntent: {
        projectId,
        coreIdea: "",
        desiredFeeling: "",
        coreImage: "",
        centralConflict: "",
        selectedMaterialIds: [],
        updatedAt: timestamp,
      },
      lyrics: { sections: [] },
      garageBandExperiments: [],
      melody: { notesBySection: {}, takes: [], selectedTakeIds: [] },
      rhythm: { bpm: 120, timeSignature: "4/4", notes: "" },
      harmony: {
        projectId,
        key: null,
        chordNotes: "",
        progressions: [],
      },
      arrangement: {
        projectId,
        tracks: [],
        cells: [],
      },
      reflection: {
        lineReflections: [],
        emotionMap: [],
        songIntentCheck: null,
        updatedAt: timestamp,
      },
      review: createEmptyReview(projectId, timestamp),
      openQuestions: [],
      versions: [],
    };
    workspace.projectIndex.push(toProjectSummary(project));
    this.writeProjectAndWorkspace(project, workspace);
    return structuredClone(project);
  }

  update(projectId: string, input: UpdateProjectInput): SongProject {
    const workspace = this.readWorkspace();
    const current = this.requireProject(projectId);
    const updated: SongProject = {
      ...current,
      title: input.title === undefined ? current.title : this.requireTitle(input.title),
      projectNote:
        input.projectNote === undefined ? current.projectNote : input.projectNote.trim(),
      updatedAt: this.now(),
    };
    this.replaceSummary(workspace, updated);
    this.writeProjectAndWorkspace(updated, workspace);
    return structuredClone(updated);
  }

  rename(projectId: string, title: string): SongProject {
    return this.update(projectId, { title });
  }

  setCreationMode(projectId: string, creationMode: ProjectCreationMode): SongProject {
    return this.updateJourney(projectId, { creationMode });
  }

  setCurrentStage(projectId: string, currentStage: ProjectStage): SongProject {
    return this.updateJourney(projectId, { currentStage });
  }

  setIdeaStartingPoint(projectId: string, startingPoint: IdeaStartingPoint): SongProject {
    if (!IDEA_STARTING_POINTS.includes(startingPoint)) {
      throw new PersistenceError("Idea starting point is invalid.");
    }
    return this.updateCreativeData(projectId, (project, timestamp) => ({
      ...project,
      idea: { startingPoint },
      updatedAt: timestamp,
    }));
  }

  answerExplore(projectId: string, input: AnswerExploreInput): SongProject {
    const content = this.requireContent(input.content, "Explore answer");
    return this.updateCreativeData(projectId, (project, timestamp) => {
      const existing = project.explore.responses.find(
        (response) => response.promptId === input.promptId,
      );
      const response = {
        responseId: existing?.responseId ?? this.createId(),
        projectId,
        promptId: input.promptId,
        status: "answered" as const,
        content,
        updatedAt: timestamp,
      };
      const responses = project.explore.responses.filter(
        (item) => item.promptId !== input.promptId,
      );
      responses.push(response);
      const materials = input.saveAsMaterial === undefined
        ? project.materials
        : [
            ...project.materials,
            this.createMaterial(projectId, {
              type: input.saveAsMaterial,
              content,
              origin: "explore-response",
              sourcePromptId: input.promptId,
            }, timestamp),
          ];
      return {
        ...project,
        explore: {
          currentPromptIndex: input.promptIndex + 1,
          responses,
        },
        materials,
        updatedAt: timestamp,
      };
    });
  }

  skipExplore(projectId: string, promptId: string, promptIndex: number): SongProject {
    return this.updateCreativeData(projectId, (project, timestamp) => {
      const existing = project.explore.responses.find(
        (response) => response.promptId === promptId,
      );
      const responses = project.explore.responses.filter(
        (response) => response.promptId !== promptId,
      );
      responses.push({
        responseId: existing?.responseId ?? this.createId(),
        projectId,
        promptId,
        status: "skipped",
        content: existing?.status === "answered" ? existing.content : "",
        updatedAt: timestamp,
      });
      return {
        ...project,
        explore: { currentPromptIndex: promptIndex + 1, responses },
        updatedAt: timestamp,
      };
    });
  }

  setExplorePromptIndex(projectId: string, promptIndex: number): SongProject {
    if (!Number.isInteger(promptIndex) || promptIndex < 0) {
      throw new PersistenceError("Explore prompt position is invalid.");
    }
    return this.updateCreativeData(projectId, (project, timestamp) => ({
      ...project,
      explore: { ...project.explore, currentPromptIndex: promptIndex },
      updatedAt: timestamp,
    }));
  }

  addMaterial(projectId: string, input: AddMaterialInput): Material {
    let added: Material | null = null;
    this.updateCreativeData(projectId, (project, timestamp) => {
      added = this.createMaterial(projectId, input, timestamp);
      return { ...project, materials: [...project.materials, added], updatedAt: timestamp };
    });
    return structuredClone(added as unknown as Material);
  }

  updateMaterial(projectId: string, materialId: string, input: UpdateMaterialInput): Material {
    let result: Material | null = null;
    this.updateCreativeData(projectId, (project, timestamp) => {
      const existing = project.materials.find((material) => material.materialId === materialId);
      if (!existing || existing.projectId !== projectId) {
        throw new PersistenceError(`Material ${materialId} was not found in this project.`);
      }
      if (input.type !== undefined && !MATERIAL_TYPES.includes(input.type)) {
        throw new PersistenceError("Material type is invalid.");
      }
      result = {
        ...existing,
        type: input.type ?? existing.type,
        content: input.content === undefined
          ? existing.content
          : this.requireContent(input.content, "Material"),
        note: input.note === undefined ? existing.note : input.note.trim(),
        updatedAt: timestamp,
      };
      return {
        ...project,
        materials: project.materials.map((material) =>
          material.materialId === materialId ? result as Material : material
        ),
        updatedAt: timestamp,
      };
    });
    return structuredClone(result as unknown as Material);
  }

  deleteMaterial(projectId: string, materialId: string): void {
    this.updateCreativeData(projectId, (project, timestamp) => {
      const existing = project.materials.find((material) => material.materialId === materialId);
      if (!existing || existing.projectId !== projectId) {
        throw new PersistenceError(`Material ${materialId} was not found in this project.`);
      }
      return {
        ...project,
        materials: project.materials.filter((material) => material.materialId !== materialId),
        songIntent: {
          ...project.songIntent,
          selectedMaterialIds: project.songIntent.selectedMaterialIds.filter(
            (selectedId) => selectedId !== materialId,
          ),
          updatedAt: project.songIntent.selectedMaterialIds.includes(materialId)
            ? timestamp
            : project.songIntent.updatedAt,
        },
        updatedAt: timestamp,
      };
    });
  }

  updateSongIntent(projectId: string, input: UpdateSongIntentInput): SongProject {
    return this.updateCreativeData(projectId, (project, timestamp) => {
      const selectedMaterialIds = input.selectedMaterialIds === undefined
        ? project.songIntent.selectedMaterialIds
        : [...input.selectedMaterialIds];
      if (selectedMaterialIds.length > 3) {
        throw new PersistenceError("Song Intent can include at most three materials.");
      }
      const availableMaterialIds = new Set(
        project.materials.map((material) => material.materialId),
      );
      if (
        new Set(selectedMaterialIds).size !== selectedMaterialIds.length ||
        selectedMaterialIds.some((materialId) => !availableMaterialIds.has(materialId))
      ) {
        throw new PersistenceError("Song Intent can only select materials from this project.");
      }
      return {
        ...project,
        songIntent: {
          ...project.songIntent,
          ...input,
          selectedMaterialIds,
          projectId,
          updatedAt: timestamp,
        },
        updatedAt: timestamp,
      };
    });
  }

  initializeGuidedLyrics(projectId: string): SongProject {
    return this.updateCreativeData(projectId, (project, timestamp) => {
      if (project.lyrics.sections.length > 0) {
        throw new PersistenceError("Guided starting sections can only be added to an empty Lyrics Workspace.");
      }
      return {
        ...project,
        lyrics: {
          sections: GUIDED_LYRICS_STARTING_STRUCTURE.map((item, order) =>
            this.createLyricsSection(projectId, item, order, timestamp)
          ),
        },
        updatedAt: timestamp,
      };
    });
  }

  addLyricsSection(projectId: string, input: AddLyricsSectionInput): LyricsSection {
    let added: LyricsSection | null = null;
    this.updateCreativeData(projectId, (project, timestamp) => {
      added = this.createLyricsSection(
        projectId,
        input,
        project.lyrics.sections.length,
        timestamp,
      );
      return {
        ...project,
        lyrics: { sections: [...project.lyrics.sections, added] },
        updatedAt: timestamp,
      };
    });
    return structuredClone(added as unknown as LyricsSection);
  }

  updateLyricsSection(
    projectId: string,
    sectionId: string,
    input: UpdateLyricsSectionInput,
  ): LyricsSection {
    let result: LyricsSection | null = null;
    this.updateCreativeData(projectId, (project, timestamp) => {
      const existing = this.requireLyricsSection(project, projectId, sectionId);
      result = {
        ...existing,
        name: input.name === undefined ? existing.name : this.requireSectionName(input.name),
        bars: input.bars === undefined ? existing.bars : this.validateBars(input.bars),
        userLyrics: input.userLyrics ?? existing.userLyrics,
        notes: input.notes ?? existing.notes,
        updatedAt: timestamp,
      };
      const nextLyrics = input.userLyrics ?? existing.userLyrics;
      const nextLines = nextLyrics.split(/\r?\n/);
      return {
        ...project,
        lyrics: {
          sections: project.lyrics.sections.map((section) =>
            section.sectionId === sectionId ? result as LyricsSection : section
          ),
        },
        reflection: {
          ...project.reflection,
          lineReflections: project.reflection.lineReflections.filter((entry) =>
            entry.sectionId !== sectionId || nextLines[entry.lineIndex] === entry.lineText
          ),
          updatedAt: input.userLyrics === undefined ? project.reflection.updatedAt : timestamp,
        },
        updatedAt: timestamp,
      };
    });
    return structuredClone(result as unknown as LyricsSection);
  }

  duplicateLyricsSection(projectId: string, sectionId: string): LyricsSection {
    let duplicate: LyricsSection | null = null;
    this.updateCreativeData(projectId, (project, timestamp) => {
      const existing = this.requireLyricsSection(project, projectId, sectionId);
      const insertAt = existing.order + 1;
      duplicate = {
        ...structuredClone(existing),
        sectionId: this.createId(),
        name: `${existing.name} copy`,
        order: insertAt,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const sections = [...project.lyrics.sections];
      sections.splice(insertAt, 0, duplicate);
      const copiedLineReflections = project.reflection.lineReflections
        .filter((entry) => entry.sectionId === sectionId)
        .map((entry) => ({ ...entry, sectionId: (duplicate as LyricsSection).sectionId }));
      const copiedEmotion = project.reflection.emotionMap.find(
        (entry) => entry.sectionId === sectionId,
      );
      const duplicateSectionId = (duplicate as LyricsSection).sectionId;
      const copiedNotes = project.melody.notesBySection[sectionId];
      const copiedProgressions = project.harmony.progressions
        .filter((progression) => progression.sectionId === sectionId)
        .map((progression) => ({
          ...structuredClone(progression),
          progressionId: this.createId(),
          sectionId: duplicateSectionId,
          chords: [...progression.chords],
          createdAt: timestamp,
          updatedAt: timestamp,
        }));
      const copiedArrangementCells = project.arrangement.cells
        .filter((cell) => cell.sectionId === sectionId)
        .map((cell) => ({
          ...structuredClone(cell),
          cellId: this.createId(),
          projectId,
          sectionId: duplicateSectionId,
          updatedAt: timestamp,
        }));
      return {
        ...project,
        lyrics: { sections: this.normalizeSectionOrder(sections, timestamp) },
        melody: {
          ...project.melody,
          notesBySection: copiedNotes === undefined
            ? { ...project.melody.notesBySection }
            : { ...project.melody.notesBySection, [duplicateSectionId]: copiedNotes },
        },
        harmony: {
          ...project.harmony,
          progressions: [...project.harmony.progressions, ...copiedProgressions],
        },
        arrangement: {
          ...project.arrangement,
          projectId,
          cells: [...project.arrangement.cells, ...copiedArrangementCells],
        },
        reflection: {
          ...project.reflection,
          lineReflections: [...project.reflection.lineReflections, ...copiedLineReflections],
          emotionMap: copiedEmotion
            ? [...project.reflection.emotionMap, { ...copiedEmotion, sectionId: (duplicate as LyricsSection).sectionId }]
            : project.reflection.emotionMap,
          updatedAt: copiedLineReflections.length > 0 || copiedEmotion ? timestamp : project.reflection.updatedAt,
        },
        updatedAt: timestamp,
      };
    });
    return structuredClone(duplicate as unknown as LyricsSection);
  }

  deleteLyricsSection(projectId: string, sectionId: string): void {
    this.updateCreativeData(projectId, (project, timestamp) => {
      this.requireLyricsSection(project, projectId, sectionId);
      const remaining = project.lyrics.sections.filter(
        (section) => section.sectionId !== sectionId,
      );
      return {
        ...project,
        lyrics: { sections: this.normalizeSectionOrder(remaining, timestamp) },
        melody: {
          notesBySection: Object.fromEntries(
            Object.entries(project.melody.notesBySection).filter(([id]) => id !== sectionId),
          ),
          takes: project.melody.takes.filter((take) => take.sectionId !== sectionId),
          selectedTakeIds: project.melody.selectedTakeIds.filter((takeId) =>
            project.melody.takes.some((take) => take.takeId === takeId && take.sectionId !== sectionId)
          ),
        },
        harmony: {
          ...project.harmony,
          progressions: project.harmony.progressions.filter(
            (progression) => progression.sectionId !== sectionId,
          ),
        },
        garageBandExperiments: project.garageBandExperiments.map((experiment) =>
          experiment.sectionId === sectionId
            ? { ...experiment, sectionId: null }
            : experiment,
        ),
        arrangement: {
          ...project.arrangement,
          projectId,
          cells: project.arrangement.cells.filter((cell) => cell.sectionId !== sectionId),
        },
        reflection: {
          ...project.reflection,
          lineReflections: project.reflection.lineReflections.filter(
            (entry) => entry.sectionId !== sectionId,
          ),
          emotionMap: project.reflection.emotionMap.filter(
            (entry) => entry.sectionId !== sectionId,
          ),
          updatedAt: timestamp,
        },
        updatedAt: timestamp,
      };
    });
  }

  addGarageBandExperiment(
    projectId: string,
    input: AddGarageBandExperimentInput,
  ): GarageBandExperiment {
    let added: GarageBandExperiment | null = null;
    this.updateCreativeData(projectId, (project, timestamp) => {
      const sectionId = this.resolveExperimentSectionId(project, projectId, input.sectionId);
      added = this.createGarageBandExperiment(projectId, input, sectionId);
      return {
        ...project,
        garageBandExperiments: [...project.garageBandExperiments, added],
        updatedAt: timestamp,
      };
    });
    return structuredClone(added as unknown as GarageBandExperiment);
  }

  updateGarageBandExperiment(
    projectId: string,
    experimentId: string,
    input: UpdateGarageBandExperimentInput,
  ): GarageBandExperiment {
    let updatedExperiment: GarageBandExperiment | null = null;
    this.updateCreativeData(projectId, (project, timestamp) => {
      const existing = this.requireGarageBandExperiment(project, projectId, experimentId);
      const sectionId = input.sectionId === undefined
        ? existing.sectionId
        : this.resolveExperimentSectionId(project, projectId, input.sectionId);
      updatedExperiment = {
        ...existing,
        sectionId,
        type: input.type === undefined
          ? existing.type
          : this.requireGarageBandExperimentType(input.type),
        date: input.date === undefined
          ? existing.date
          : this.requireGarageBandExperimentDate(input.date),
        goal: input.goal === undefined
          ? existing.goal
          : this.requireExperimentField(input.goal, "Experiment goal"),
        whatITried: input.whatITried === undefined
          ? existing.whatITried
          : this.requireExperimentField(input.whatITried, "What I tried"),
        whatINoticed: input.whatINoticed === undefined
          ? existing.whatINoticed
          : this.requireExperimentField(input.whatINoticed, "What I noticed"),
        decision: input.decision === undefined
          ? existing.decision
          : this.requireExperimentField(input.decision, "Decision"),
        nextQuestion: input.nextQuestion === undefined
          ? existing.nextQuestion
          : this.requireExperimentField(input.nextQuestion, "Next question"),
      };
      return {
        ...project,
        garageBandExperiments: project.garageBandExperiments.map((experiment) =>
          experiment.experimentId === experimentId ? updatedExperiment as GarageBandExperiment : experiment,
        ),
        updatedAt: timestamp,
      };
    });
    return structuredClone(updatedExperiment as unknown as GarageBandExperiment);
  }

  deleteGarageBandExperiment(projectId: string, experimentId: string): void {
    this.updateCreativeData(projectId, (project, timestamp) => {
      this.requireGarageBandExperiment(project, projectId, experimentId);
      return {
        ...project,
        garageBandExperiments: project.garageBandExperiments.filter(
          (experiment) => experiment.experimentId !== experimentId,
        ),
        updatedAt: timestamp,
      };
    });
  }

  moveLyricsSection(projectId: string, sectionId: string, targetIndex: number): SongProject {
    return this.updateCreativeData(projectId, (project, timestamp) => {
      const existing = this.requireLyricsSection(project, projectId, sectionId);
      if (
        !Number.isInteger(targetIndex) ||
        targetIndex < 0 ||
        targetIndex >= project.lyrics.sections.length
      ) {
        throw new PersistenceError("Lyrics section position is invalid.");
      }
      const sections = [...project.lyrics.sections];
      sections.splice(existing.order, 1);
      sections.splice(targetIndex, 0, existing);
      return {
        ...project,
        lyrics: { sections: this.normalizeSectionOrder(sections, timestamp) },
        updatedAt: timestamp,
      };
    });
  }

  setMelodyNotes(projectId: string, sectionId: string, notes: string): SongProject {
    return this.updateCreativeData(projectId, (project, timestamp) => {
      this.requireLyricsSection(project, projectId, sectionId);
      const normalized = notes.trim();
      const notesBySection = { ...project.melody.notesBySection };
      if (normalized) notesBySection[sectionId] = normalized;
      else delete notesBySection[sectionId];
      return {
        ...project,
        melody: { ...project.melody, notesBySection },
        updatedAt: timestamp,
      };
    });
  }

  addMelodyTake(projectId: string, input: AddMelodyTakeInput): MelodyTake {
    let added: MelodyTake | null = null;
    this.updateCreativeData(projectId, (project, timestamp) => {
      this.requireLyricsSection(project, projectId, input.sectionId);
      if (!input.audioAssetId || !input.mimeType) {
        throw new PersistenceError("Recorded audio metadata is incomplete.");
      }
      added = {
        takeId: this.createId(),
        projectId,
        sectionId: input.sectionId,
        audioAssetId: input.audioAssetId,
        name: this.requireTakeName(input.name),
        notes: "",
        status: "keep-exploring",
        mimeType: input.mimeType,
        durationMs: input.durationMs ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      return {
        ...project,
        melody: { ...project.melody, takes: [...project.melody.takes, added as MelodyTake] },
        updatedAt: timestamp,
      };
    });
    return structuredClone(added as unknown as MelodyTake);
  }

  updateMelodyTake(
    projectId: string,
    takeId: string,
    input: UpdateMelodyTakeInput,
  ): MelodyTake {
    let updatedTake: MelodyTake | null = null;
    this.updateCreativeData(projectId, (project, timestamp) => {
      const existing = this.requireMelodyTake(project, projectId, takeId);
      if (input.status !== undefined && !MELODY_TAKE_STATUSES.includes(input.status)) {
        throw new PersistenceError("Melody take status is invalid.");
      }
      updatedTake = {
        ...existing,
        name: input.name === undefined ? existing.name : this.requireTakeName(input.name),
        notes: input.notes === undefined ? existing.notes : input.notes.trim(),
        status: input.status ?? existing.status,
        updatedAt: timestamp,
      };
      return {
        ...project,
        melody: {
          ...project.melody,
          takes: project.melody.takes.map((take) =>
            take.takeId === takeId ? updatedTake as MelodyTake : take
          ),
        },
        updatedAt: timestamp,
      };
    });
    return structuredClone(updatedTake as unknown as MelodyTake);
  }

  setMelodyTakeSelected(projectId: string, takeId: string, selected: boolean): SongProject {
    return this.updateCreativeData(projectId, (project, timestamp) => {
      this.requireMelodyTake(project, projectId, takeId);
      const selectedTakeIds = selected
        ? [...new Set([...project.melody.selectedTakeIds, takeId])]
        : project.melody.selectedTakeIds.filter((id) => id !== takeId);
      return {
        ...project,
        melody: { ...project.melody, selectedTakeIds },
        updatedAt: timestamp,
      };
    });
  }

  deleteMelodyTake(projectId: string, takeId: string): void {
    this.updateCreativeData(projectId, (project, timestamp) => {
      this.requireMelodyTake(project, projectId, takeId);
      return {
        ...project,
        melody: {
          ...project.melody,
          takes: project.melody.takes.filter((take) => take.takeId !== takeId),
          selectedTakeIds: project.melody.selectedTakeIds.filter((id) => id !== takeId),
        },
        updatedAt: timestamp,
      };
    });
  }

  updateRhythm(projectId: string, input: UpdateRhythmInput): SongProject {
    return this.updateCreativeData(projectId, (project, timestamp) => {
      const bpm = input.bpm ?? project.rhythm.bpm;
      const timeSignature = input.timeSignature ?? project.rhythm.timeSignature;
      if (!Number.isInteger(bpm) || bpm < 40 || bpm > 220) {
        throw new PersistenceError("BPM must be a whole number from 40 to 220.");
      }
      if (!TIME_SIGNATURES.includes(timeSignature)) {
        throw new PersistenceError("Time signature is invalid.");
      }
      return {
        ...project,
        rhythm: {
          bpm,
          timeSignature,
          notes: input.notes === undefined ? project.rhythm.notes : input.notes.trim(),
        },
        updatedAt: timestamp,
      };
    });
  }

  addArrangementTrack(projectId: string, input: AddArrangementTrackInput): ArrangementTrack {
    let added: ArrangementTrack | null = null;
    this.updateCreativeData(projectId, (project, timestamp) => {
      if (!isArrangementTrackCategory(input.category)) {
        throw new PersistenceError("Arrangement track category is invalid.");
      }
      added = {
        trackId: this.createId(),
        projectId,
        category: input.category,
        name: this.requireTrackName(input.name),
        order: project.arrangement.tracks.length,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      return {
        ...project,
        arrangement: {
          ...project.arrangement,
          projectId,
          tracks: [...project.arrangement.tracks, added],
        },
        updatedAt: timestamp,
      };
    });
    return structuredClone(added as unknown as ArrangementTrack);
  }

  updateArrangementTrack(
    projectId: string,
    trackId: string,
    input: UpdateArrangementTrackInput,
  ): ArrangementTrack {
    let updatedTrack: ArrangementTrack | null = null;
    this.updateCreativeData(projectId, (project, timestamp) => {
      const existing = this.requireArrangementTrack(project, projectId, trackId);
      if (input.category !== undefined && !isArrangementTrackCategory(input.category)) {
        throw new PersistenceError("Arrangement track category is invalid.");
      }
      updatedTrack = {
        ...existing,
        category: input.category ?? existing.category,
        name: input.name === undefined ? existing.name : this.requireTrackName(input.name),
        updatedAt: timestamp,
      };
      return {
        ...project,
        arrangement: {
          ...project.arrangement,
          projectId,
          tracks: project.arrangement.tracks.map((track) =>
            track.trackId === trackId ? updatedTrack as ArrangementTrack : track,
          ),
        },
        updatedAt: timestamp,
      };
    });
    return structuredClone(updatedTrack as unknown as ArrangementTrack);
  }

  deleteArrangementTrack(projectId: string, trackId: string): void {
    this.updateCreativeData(projectId, (project, timestamp) => {
      this.requireArrangementTrack(project, projectId, trackId);
      const tracks = project.arrangement.tracks
        .filter((track) => track.trackId !== trackId)
        .map((track, order) => track.order === order ? track : { ...track, order, updatedAt: timestamp });
      return {
        ...project,
        arrangement: {
          ...project.arrangement,
          projectId,
          tracks,
          cells: project.arrangement.cells.filter((cell) => cell.trackId !== trackId),
        },
        updatedAt: timestamp,
      };
    });
  }

  updateArrangementCell(
    projectId: string,
    sectionId: string,
    trackId: string,
    input: UpdateArrangementCellInput,
  ): ArrangementCell | null {
    let result: ArrangementCell | null = null;
    this.updateCreativeData(projectId, (project, timestamp) => {
      this.requireLyricsSection(project, projectId, sectionId);
      this.requireArrangementTrack(project, projectId, trackId);
      const existing = project.arrangement.cells.find(
        (cell) => cell.sectionId === sectionId && cell.trackId === trackId,
      );
      const next: ArrangementCell = {
        cellId: existing?.cellId ?? this.createId(),
        projectId,
        sectionId,
        trackId,
        presence: input.presence === undefined ? existing?.presence ?? "" : input.presence.trim(),
        energy: input.energy === undefined ? existing?.energy ?? "" : input.energy.trim(),
        density: input.density === undefined ? existing?.density ?? "" : input.density.trim(),
        dynamics: input.dynamics === undefined ? existing?.dynamics ?? "" : input.dynamics.trim(),
        register: input.register === undefined ? existing?.register ?? "" : input.register.trim(),
        notes: input.notes === undefined ? existing?.notes ?? "" : input.notes.trim(),
        updatedAt: timestamp,
      };
      const hasData = [
        next.presence,
        next.energy,
        next.density,
        next.dynamics,
        next.register,
        next.notes,
      ].some((value) => value.length > 0);
      result = hasData ? next : null;
      const cells = project.arrangement.cells.filter(
        (cell) => cell.sectionId !== sectionId || cell.trackId !== trackId,
      );
      if (hasData) cells.push(next);
      return {
        ...project,
        arrangement: { ...project.arrangement, projectId, cells },
        updatedAt: timestamp,
      };
    });
    return result ? structuredClone(result) : null;
  }

  setHarmonyKey(projectId: string, key: HarmonyKey | null): SongProject {
    if (key !== null && !HARMONY_KEYS.includes(key)) {
      throw new PersistenceError("Key is invalid.");
    }
    return this.updateCreativeData(projectId, (project, timestamp) => ({
      ...project,
      harmony: {
        ...project.harmony,
        projectId,
        key,
      },
      updatedAt: timestamp,
    }));
  }

  setHarmonyNotes(projectId: string, chordNotes: string): SongProject {
    return this.updateCreativeData(projectId, (project, timestamp) => ({
      ...project,
      harmony: {
        ...project.harmony,
        projectId,
        chordNotes: chordNotes.trim(),
      },
      updatedAt: timestamp,
    }));
  }

  createHarmonyProgression(
    projectId: string,
    input: CreateHarmonyProgressionInput,
  ): SongProject {
    return this.updateCreativeData(projectId, (project, timestamp) => {
      if (!HARMONY_PROGRESSION_TYPES.includes(input.type)) {
        throw new PersistenceError("Harmony progression type is invalid.");
      }
      const progression: HarmonyProgression = {
        progressionId: this.createId(),
        projectId,
        sectionId: input.sectionId === undefined
          ? null
          : this.requireLyricsSection(project, projectId, input.sectionId).sectionId,
        type: input.type,
        name: this.requireProgressionName(input.name ?? this.progressionTypeLabel(input.type)),
        chords: [],
        notes: "",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      return {
        ...project,
        harmony: {
          ...project.harmony,
          projectId,
          progressions: [...project.harmony.progressions, progression],
        },
        updatedAt: timestamp,
      };
    });
  }

  updateHarmonyProgression(
    projectId: string,
    progressionId: string,
    input: UpdateHarmonyProgressionInput,
  ): SongProject {
    return this.updateCreativeData(projectId, (project, timestamp) => {
      const existing = this.requireHarmonyProgression(project, projectId, progressionId);
      const chords = input.chords === undefined ? existing.chords : [...input.chords];
      if (!chords.every((chord) => isChordSymbol(chord))) {
        throw new PersistenceError("Harmony progression contains an invalid chord.");
      }
      const updated: HarmonyProgression = {
        ...existing,
        sectionId: input.sectionId === undefined
          ? existing.sectionId
          : input.sectionId === null
            ? null
            : this.requireLyricsSection(project, projectId, input.sectionId).sectionId,
        name: input.name === undefined
          ? existing.name
          : this.requireProgressionName(input.name),
        chords,
        notes: input.notes === undefined ? existing.notes : input.notes.trim(),
        updatedAt: timestamp,
      };
      return {
        ...project,
        harmony: {
          ...project.harmony,
          projectId,
          progressions: project.harmony.progressions.map((progression) =>
            progression.progressionId === progressionId ? updated : progression,
          ),
        },
        updatedAt: timestamp,
      };
    });
  }

  deleteHarmonyProgression(projectId: string, progressionId: string): SongProject {
    return this.updateCreativeData(projectId, (project, timestamp) => {
      this.requireHarmonyProgression(project, projectId, progressionId);
      return {
        ...project,
        harmony: {
          ...project.harmony,
          projectId,
          progressions: project.harmony.progressions.filter(
            (progression) => progression.progressionId !== progressionId,
          ),
        },
        updatedAt: timestamp,
      };
    });
  }

  setLineReflection(projectId: string, input: SetLineReflectionInput): SongProject {
    return this.updateCreativeData(projectId, (project, timestamp) => {
      const section = this.requireLyricsSection(project, projectId, input.sectionId);
      const lines = section.userLyrics.split(/\r?\n/);
      if (
        !Number.isInteger(input.lineIndex) ||
        input.lineIndex < 0 ||
        lines[input.lineIndex] !== input.lineText ||
        !input.lineText.trim()
      ) {
        throw new PersistenceError("This lyric line no longer matches the saved section.");
      }
      if (input.label !== null && !LINE_REFLECTION_LABELS.includes(input.label)) {
        throw new PersistenceError("Line reflection label is invalid.");
      }
      const remaining = project.reflection.lineReflections.filter(
        (entry) => entry.sectionId !== input.sectionId || entry.lineIndex !== input.lineIndex,
      );
      return {
        ...project,
        reflection: {
          ...project.reflection,
          lineReflections: input.label === null
            ? remaining
            : [...remaining, {
                sectionId: input.sectionId,
                lineIndex: input.lineIndex,
                lineText: input.lineText,
                label: input.label,
              }],
          updatedAt: timestamp,
        },
        updatedAt: timestamp,
      };
    });
  }

  setSectionEmotion(projectId: string, sectionId: string, emotion: string): SongProject {
    return this.updateCreativeData(projectId, (project, timestamp) => {
      this.requireLyricsSection(project, projectId, sectionId);
      const normalized = emotion.trim();
      const remaining = project.reflection.emotionMap.filter(
        (entry) => entry.sectionId !== sectionId,
      );
      return {
        ...project,
        reflection: {
          ...project.reflection,
          emotionMap: normalized ? [...remaining, { sectionId, emotion: normalized }] : remaining,
          updatedAt: timestamp,
        },
        updatedAt: timestamp,
      };
    });
  }

  setSongIntentCheck(projectId: string, value: SongIntentCheckOption | null): SongProject {
    if (value !== null && !SONG_INTENT_CHECK_OPTIONS.includes(value)) {
      throw new PersistenceError("Song Intent check value is invalid.");
    }
    return this.updateCreativeData(projectId, (project, timestamp) => ({
      ...project,
      reflection: {
        ...project.reflection,
        songIntentCheck: value,
        updatedAt: timestamp,
      },
      updatedAt: timestamp,
    }));
  }

  updateReview(projectId: string, input: UpdateReviewInput): SongProject {
    return this.updateCreativeData(projectId, (project, timestamp) => {
      if (input.status !== undefined && !REVIEW_STATUSES.includes(input.status)) {
        throw new PersistenceError("Review status is invalid.");
      }

      const nextFocus = {
        ...project.review.nextFocus,
        ...(input.nextFocus?.workOnNext === undefined
          ? {}
          : { workOnNext: input.nextFocus.workOnNext.trim() }),
        ...(input.nextFocus?.testNext === undefined
          ? {}
          : { testNext: input.nextFocus.testNext.trim() }),
        ...(input.nextFocus?.leaveAloneForNow === undefined
          ? {}
          : { leaveAloneForNow: input.nextFocus.leaveAloneForNow.trim() }),
      };

      const categoryReflections = input.categoryReflections === undefined
        ? project.review.categoryReflections.map((reflection) => ({ ...reflection }))
        : input.categoryReflections.flatMap((reflection) => {
            if (!REVIEW_CATEGORIES.includes(reflection.category)) {
              throw new PersistenceError("Review category is invalid.");
            }
            const content = reflection.content.trim();
            return content ? [{
              category: reflection.category,
              content,
              updatedAt: timestamp,
            }] : [];
          });

      if (new Set(categoryReflections.map((reflection) => reflection.category)).size !== categoryReflections.length) {
        throw new PersistenceError("Review category reflections must be unique.");
      }

      return {
        ...project,
        review: {
          ...project.review,
          projectId,
          status: input.status ?? project.review.status,
          userReflection: input.userReflection === undefined
            ? project.review.userReflection
            : input.userReflection.trim(),
          categoryReflections,
          nextFocus,
          updatedAt: timestamp,
        },
        updatedAt: timestamp,
      };
    });
  }

  updateOpenQuestions(projectId: string, questions: string[]): SongProject {
    const normalized = questions.map((question) => question.trim()).filter(Boolean);
    return this.updateCreativeData(projectId, (project, timestamp) => ({
      ...project,
      openQuestions: normalized,
      updatedAt: timestamp,
    }));
  }

  saveVersion(projectId: string, input: SaveVersionInput = {}): SongVersion {
    let saved: SongVersion | null = null;
    this.updateCreativeData(projectId, (project, timestamp) => {
      const versionNumber = this.nextVersionNumber(project);
      saved = {
        versionId: this.createId(),
        projectId,
        versionNumber,
        label: input.label === undefined ? `V${versionNumber}` : this.requireVersionLabel(input.label),
        createdAt: timestamp,
        userNote: input.userNote?.trim() ?? "",
        snapshot: createVersionSnapshot(project),
      };
      return { ...project, versions: [...project.versions, saved as SongVersion], updatedAt: timestamp };
    });
    return structuredClone(saved as unknown as SongVersion);
  }

  duplicateVersion(projectId: string, versionId: string): SongVersion {
    let duplicate: SongVersion | null = null;
    this.updateCreativeData(projectId, (project, timestamp) => {
      const source = this.requireVersion(project, projectId, versionId);
      const versionNumber = this.nextVersionNumber(project);
      duplicate = {
        ...structuredClone(source),
        versionId: this.createId(),
        versionNumber,
        label: `V${versionNumber}`,
        createdAt: timestamp,
      };
      return { ...project, versions: [...project.versions, duplicate as SongVersion], updatedAt: timestamp };
    });
    return structuredClone(duplicate as unknown as SongVersion);
  }

  renameVersion(projectId: string, versionId: string, label: string): SongVersion {
    let renamed: SongVersion | null = null;
    this.updateCreativeData(projectId, (project, timestamp) => {
      const existing = this.requireVersion(project, projectId, versionId);
      renamed = { ...existing, label: this.requireVersionLabel(label) };
      return {
        ...project,
        versions: project.versions.map((version) => version.versionId === versionId ? renamed as SongVersion : version),
        updatedAt: timestamp,
      };
    });
    return structuredClone(renamed as unknown as SongVersion);
  }

  deleteVersion(projectId: string, versionId: string): void {
    this.updateCreativeData(projectId, (project, timestamp) => {
      this.requireVersion(project, projectId, versionId);
      return {
        ...project,
        versions: project.versions.filter((version) => version.versionId !== versionId),
        updatedAt: timestamp,
      };
    });
  }

  restoreVersion(projectId: string, versionId: string, createBackup: boolean): SongProject {
    return this.updateCreativeData(projectId, (project, timestamp) => {
      const version = this.requireVersion(project, projectId, versionId);
      const snapshot = structuredClone(version.snapshot);
      const sectionIds = new Set(snapshot.lyrics.sections.map((section) => section.sectionId));
      const versions = [...project.versions];
      if (createBackup) {
        const versionNumber = this.nextVersionNumber(project);
        versions.push({
          versionId: this.createId(),
          projectId,
          versionNumber,
          label: `V${versionNumber} — before restore`,
          createdAt: timestamp,
          userNote: `Safety backup created before restoring ${version.label}.`,
          snapshot: createVersionSnapshot(project),
        });
      }
      return {
        ...project,
        projectNote: snapshot.projectNote,
        lyrics: snapshot.lyrics,
        melody: snapshot.melody,
        rhythm: snapshot.rhythm,
        harmony: snapshot.harmony,
        arrangement: snapshot.arrangement,
        reflection: snapshot.reflection,
        openQuestions: snapshot.openQuestions,
        versions,
        garageBandExperiments: project.garageBandExperiments.map((experiment) =>
          experiment.sectionId !== null && !sectionIds.has(experiment.sectionId)
            ? { ...experiment, sectionId: null }
            : experiment
        ),
        updatedAt: timestamp,
      };
    });
  }

  duplicate(sourceProjectId: string): SongProject {
    const workspace = this.readWorkspace();
    const source = this.requireProject(sourceProjectId);
    const duplicate = duplicateProjectData(source, this.createId(), this.now(), this.createId);
    workspace.projectIndex.push(toProjectSummary(duplicate));
    this.writeProjectAndWorkspace(duplicate, workspace);
    return structuredClone(duplicate);
  }

  archive(projectId: string): SongProject {
    const workspace = this.readWorkspace();
    const current = this.requireProject(projectId);
    const archived: SongProject = {
      ...current,
      status: "archived",
      updatedAt: this.now(),
    };
    this.replaceSummary(workspace, archived);
    this.writeProjectAndWorkspace(archived, workspace);
    return structuredClone(archived);
  }

  unarchive(projectId: string): SongProject {
    const workspace = this.readWorkspace();
    const current = this.requireProject(projectId);
    const restored: SongProject = {
      ...current,
      status: "active",
      updatedAt: this.now(),
    };
    this.replaceSummary(workspace, restored);
    this.writeProjectAndWorkspace(restored, workspace);
    return structuredClone(restored);
  }

  delete(projectId: string): void {
    const workspace = this.readWorkspace();
    const existingIndex = workspace.projectIndex.findIndex(
      (project) => project.projectId === projectId,
    );
    if (existingIndex === -1 || this.get(projectId) === null) {
      throw new ProjectNotFoundError(projectId);
    }
    workspace.projectIndex.splice(existingIndex, 1);
    this.writeWorkspace(workspace);
    this.storage.removeItem(this.projectKey(projectId));
  }

  private ensureSchema(): void {
    const rawMeta = this.storage.getItem(META_KEY);
    if (rawMeta === null) {
      if (this.storage.getItem(WORKSPACE_KEY) !== null) {
        throw new PersistenceError(
          "Workspace data exists without schema metadata. No data was changed.",
        );
      }
      const timestamp = this.now();
      const meta: StorageMeta = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        appDataCreatedAt: timestamp,
        lastMigratedAt: timestamp,
      };
      const workspace: WorkspaceState = {
        workspaceId: this.createId(),
        projectIndex: [],
        skillProgress: [],
      };
      this.storage.setItem(META_KEY, JSON.stringify(meta));
      this.storage.setItem(WORKSPACE_KEY, JSON.stringify(envelope(workspace)));
      return;
    }

    const meta = parseJson(rawMeta, META_KEY);
    if (!isRecord(meta) || typeof meta.schemaVersion !== "number") {
      throw new PersistenceError("Storage metadata is invalid. No data was changed.");
    }
    if (meta.schemaVersion > CURRENT_SCHEMA_VERSION || meta.schemaVersion < 1) {
      throw new UnsupportedSchemaVersionError(meta.schemaVersion);
    }
    let version = meta.schemaVersion;
    while (version < CURRENT_SCHEMA_VERSION) {
      if (version === 1) this.migrateVersion1To2(meta);
      if (version === 2) this.migrateVersion2To3(meta);
      if (version === 3) this.migrateVersion3To4(meta);
      if (version === 4) this.migrateVersion4To5(meta);
      if (version === 5) this.migrateVersion5To6(meta);
      if (version === 6) this.migrateVersion6To7(meta);
      if (version === 7) this.migrateVersion7To8(meta);
      if (version === 8) this.migrateVersion8To9(meta);
      if (version === 9) this.migrateVersion9To10(meta);
      if (version === 10) this.migrateVersion10To11(meta);
      if (version === 11) this.migrateVersion11To12(meta);
      if (version === 12) this.migrateVersion12To13(meta);
      if (version === 13) this.migrateVersion13To14(meta);
      if (version === 14) this.migrateVersion14To15(meta);
      version += 1;
    }
  }

  private migrateVersion1To2(meta: Record<string, unknown>): void {
    const rawWorkspace = this.storage.getItem(WORKSPACE_KEY);
    if (rawWorkspace === null) {
      throw new PersistenceError("Workspace index is missing. No data was changed.");
    }

    const workspace = readEnvelopeAtVersion<WorkspaceState>(rawWorkspace, WORKSPACE_KEY, 1);
    if (typeof workspace.workspaceId !== "string" || !Array.isArray(workspace.projectIndex)) {
      throw new PersistenceError("Workspace index is invalid. No data was changed.");
    }

    const migratedProjects = workspace.projectIndex.map((summary) => {
      if (!isRecord(summary) || typeof summary.projectId !== "string") {
        throw new PersistenceError("Workspace project index is invalid. No data was changed.");
      }
      const key = this.projectKey(summary.projectId);
      const rawProject = this.storage.getItem(key);
      if (rawProject === null) {
        throw new PersistenceError(
          `Project index references missing project ${summary.projectId}. No data was changed.`,
        );
      }
      const project = readEnvelopeAtVersion<
        Omit<SongProject, "creationMode" | "idea" | "explore" | "materials" | "songIntent">
      >(
        rawProject,
        key,
        1,
      );
      if (project.projectId !== summary.projectId) {
        throw new PersistenceError(
          `Project ownership mismatch for ${summary.projectId}. No data was changed.`,
        );
      }
      return {
        ...project,
        currentStage: "Idea" as const,
        creationMode: "Guided" as const,
      };
    });

    for (const project of migratedProjects) {
      this.storage.setItem(
        this.projectKey(project.projectId),
        JSON.stringify(envelopeAtVersion(project, 2)),
      );
    }
    this.storage.setItem(WORKSPACE_KEY, JSON.stringify(envelopeAtVersion(workspace, 2)));
    this.writeMigratedMeta(meta, 2);
  }

  private migrateVersion2To3(meta: Record<string, unknown>): void {
    const rawWorkspace = this.storage.getItem(WORKSPACE_KEY);
    if (rawWorkspace === null) {
      throw new PersistenceError("Workspace index is missing. No data was changed.");
    }
    const workspace = readEnvelopeAtVersion<WorkspaceState>(rawWorkspace, WORKSPACE_KEY, 2);
    if (typeof workspace.workspaceId !== "string" || !Array.isArray(workspace.projectIndex)) {
      throw new PersistenceError("Workspace index is invalid. No data was changed.");
    }
    const migratedProjects = workspace.projectIndex.map((summary) => {
      if (!isRecord(summary) || typeof summary.projectId !== "string") {
        throw new PersistenceError("Workspace project index is invalid. No data was changed.");
      }
      const key = this.projectKey(summary.projectId);
      const rawProject = this.storage.getItem(key);
      if (rawProject === null) {
        throw new PersistenceError(
          `Project index references missing project ${summary.projectId}. No data was changed.`,
        );
      }
      const project = readEnvelopeAtVersion<
        Omit<SongProject, "idea" | "explore" | "materials" | "songIntent">
      >(
        rawProject,
        key,
        2,
      );
      if (project.projectId !== summary.projectId) {
        throw new PersistenceError(
          `Project ownership mismatch for ${summary.projectId}. No data was changed.`,
        );
      }
      return {
        ...project,
        idea: { startingPoint: null },
        explore: { currentPromptIndex: 0, responses: [] },
        materials: [],
      };
    });
    for (const project of migratedProjects) {
      this.storage.setItem(
        this.projectKey(project.projectId),
        JSON.stringify(envelopeAtVersion(project, 3)),
      );
    }
    this.storage.setItem(WORKSPACE_KEY, JSON.stringify(envelopeAtVersion(workspace, 3)));
    this.writeMigratedMeta(meta, 3);
  }

  private migrateVersion3To4(meta: Record<string, unknown>): void {
    const rawWorkspace = this.storage.getItem(WORKSPACE_KEY);
    if (rawWorkspace === null) {
      throw new PersistenceError("Workspace index is missing. No data was changed.");
    }
    const workspace = readEnvelopeAtVersion<WorkspaceState>(rawWorkspace, WORKSPACE_KEY, 3);
    if (typeof workspace.workspaceId !== "string" || !Array.isArray(workspace.projectIndex)) {
      throw new PersistenceError("Workspace index is invalid. No data was changed.");
    }
    const timestamp = this.now();
    const migratedProjects = workspace.projectIndex.map((summary) => {
      if (!isRecord(summary) || typeof summary.projectId !== "string") {
        throw new PersistenceError("Workspace project index is invalid. No data was changed.");
      }
      const key = this.projectKey(summary.projectId);
      const rawProject = this.storage.getItem(key);
      if (rawProject === null) {
        throw new PersistenceError(
          `Project index references missing project ${summary.projectId}. No data was changed.`,
        );
      }
      const project = readEnvelopeAtVersion<Omit<SongProject, "songIntent">>(
        rawProject,
        key,
        3,
      );
      if (project.projectId !== summary.projectId) {
        throw new PersistenceError(
          `Project ownership mismatch for ${summary.projectId}. No data was changed.`,
        );
      }
      return {
        ...project,
        songIntent: {
          projectId: project.projectId,
          coreIdea: "",
          desiredFeeling: "",
          coreImage: "",
          centralConflict: "",
          selectedMaterialIds: [],
          updatedAt: timestamp,
        },
      } satisfies SongProject;
    });
    for (const project of migratedProjects) {
      this.storage.setItem(
        this.projectKey(project.projectId),
        JSON.stringify(envelopeAtVersion(project, 4)),
      );
    }
    this.storage.setItem(WORKSPACE_KEY, JSON.stringify(envelopeAtVersion(workspace, 4)));
    this.writeMigratedMeta(meta, 4);
  }

  private migrateVersion4To5(meta: Record<string, unknown>): void {
    const rawWorkspace = this.storage.getItem(WORKSPACE_KEY);
    if (rawWorkspace === null) {
      throw new PersistenceError("Workspace index is missing. No data was changed.");
    }
    const workspace = readEnvelopeAtVersion<WorkspaceState>(rawWorkspace, WORKSPACE_KEY, 4);
    if (typeof workspace.workspaceId !== "string" || !Array.isArray(workspace.projectIndex)) {
      throw new PersistenceError("Workspace index is invalid. No data was changed.");
    }
    const migratedProjects = workspace.projectIndex.map((summary) => {
      if (!isRecord(summary) || typeof summary.projectId !== "string") {
        throw new PersistenceError("Workspace project index is invalid. No data was changed.");
      }
      const key = this.projectKey(summary.projectId);
      const rawProject = this.storage.getItem(key);
      if (rawProject === null) {
        throw new PersistenceError(
          `Project index references missing project ${summary.projectId}. No data was changed.`,
        );
      }
      const project = readEnvelopeAtVersion<Omit<SongProject, "lyrics">>(rawProject, key, 4);
      if (project.projectId !== summary.projectId) {
        throw new PersistenceError(
          `Project ownership mismatch for ${summary.projectId}. No data was changed.`,
        );
      }
      return { ...project, lyrics: { sections: [] } } satisfies SongProject;
    });
    for (const project of migratedProjects) {
      this.storage.setItem(this.projectKey(project.projectId), JSON.stringify(envelopeAtVersion(project, 5)));
    }
    this.storage.setItem(WORKSPACE_KEY, JSON.stringify(envelopeAtVersion(workspace, 5)));
    this.writeMigratedMeta(meta, 5);
  }

  private migrateVersion5To6(meta: Record<string, unknown>): void {
    const rawWorkspace = this.storage.getItem(WORKSPACE_KEY);
    if (rawWorkspace === null) {
      throw new PersistenceError("Workspace index is missing. No data was changed.");
    }
    const workspace = readEnvelopeAtVersion<WorkspaceState>(rawWorkspace, WORKSPACE_KEY, 5);
    if (typeof workspace.workspaceId !== "string" || !Array.isArray(workspace.projectIndex)) {
      throw new PersistenceError("Workspace index is invalid. No data was changed.");
    }
    const timestamp = this.now();
    const migratedProjects = workspace.projectIndex.map((summary) => {
      if (!isRecord(summary) || typeof summary.projectId !== "string") {
        throw new PersistenceError("Workspace project index is invalid. No data was changed.");
      }
      const key = this.projectKey(summary.projectId);
      const rawProject = this.storage.getItem(key);
      if (rawProject === null) {
        throw new PersistenceError(
          `Project index references missing project ${summary.projectId}. No data was changed.`,
        );
      }
      const project = readEnvelopeAtVersion<Omit<SongProject, "reflection">>(rawProject, key, 5);
      if (project.projectId !== summary.projectId) {
        throw new PersistenceError(
          `Project ownership mismatch for ${summary.projectId}. No data was changed.`,
        );
      }
      return {
        ...project,
        reflection: {
          lineReflections: [],
          emotionMap: [],
          songIntentCheck: null,
          updatedAt: timestamp,
        },
      } satisfies SongProject;
    });
    for (const project of migratedProjects) {
      this.storage.setItem(this.projectKey(project.projectId), JSON.stringify(envelopeAtVersion(project, 6)));
    }
    this.storage.setItem(WORKSPACE_KEY, JSON.stringify(envelopeAtVersion(workspace, 6)));
    this.writeMigratedMeta(meta, 6);
  }

  private migrateVersion6To7(meta: Record<string, unknown>): void {
    const rawWorkspace = this.storage.getItem(WORKSPACE_KEY);
    if (rawWorkspace === null) {
      throw new PersistenceError("Workspace index is missing. No data was changed.");
    }
    const workspace = readEnvelopeAtVersion<WorkspaceState>(rawWorkspace, WORKSPACE_KEY, 6);
    if (typeof workspace.workspaceId !== "string" || !Array.isArray(workspace.projectIndex)) {
      throw new PersistenceError("Workspace index is invalid. No data was changed.");
    }
    const migratedProjects = workspace.projectIndex.map((summary) => {
      if (!isRecord(summary) || typeof summary.projectId !== "string") {
        throw new PersistenceError("Workspace project index is invalid. No data was changed.");
      }
      const key = this.projectKey(summary.projectId);
      const rawProject = this.storage.getItem(key);
      if (rawProject === null) {
        throw new PersistenceError(
          `Project index references missing project ${summary.projectId}. No data was changed.`,
        );
      }
      const project = readEnvelopeAtVersion<Omit<SongProject, "melody">>(rawProject, key, 6);
      if (project.projectId !== summary.projectId) {
        throw new PersistenceError(
          `Project ownership mismatch for ${summary.projectId}. No data was changed.`,
        );
      }
      return { ...project, melody: { notesBySection: {}, takes: [], selectedTakeIds: [] } } satisfies SongProject;
    });
    for (const project of migratedProjects) {
      this.storage.setItem(this.projectKey(project.projectId), JSON.stringify(envelopeAtVersion(project, 7)));
    }
    this.storage.setItem(WORKSPACE_KEY, JSON.stringify(envelopeAtVersion(workspace, 7)));
    this.writeMigratedMeta(meta, 7);
  }

  private migrateVersion7To8(meta: Record<string, unknown>): void {
    const rawWorkspace = this.storage.getItem(WORKSPACE_KEY);
    if (rawWorkspace === null) {
      throw new PersistenceError("Workspace index is missing. No data was changed.");
    }
    const workspace = readEnvelopeAtVersion<WorkspaceState>(rawWorkspace, WORKSPACE_KEY, 7);
    if (typeof workspace.workspaceId !== "string" || !Array.isArray(workspace.projectIndex)) {
      throw new PersistenceError("Workspace index is invalid. No data was changed.");
    }
    const migratedProjects = workspace.projectIndex.map((summary) => {
      if (!isRecord(summary) || typeof summary.projectId !== "string") {
        throw new PersistenceError("Workspace project index is invalid. No data was changed.");
      }
      const key = this.projectKey(summary.projectId);
      const rawProject = this.storage.getItem(key);
      if (rawProject === null) {
        throw new PersistenceError(
          `Project index references missing project ${summary.projectId}. No data was changed.`,
        );
      }
      const project = readEnvelopeAtVersion<Omit<SongProject, "rhythm">>(rawProject, key, 7);
      if (project.projectId !== summary.projectId) {
        throw new PersistenceError(
          `Project ownership mismatch for ${summary.projectId}. No data was changed.`,
        );
      }
      return {
        ...project,
        rhythm: { bpm: 120, timeSignature: "4/4", notes: "" },
      } satisfies SongProject;
    });
    for (const project of migratedProjects) {
      this.storage.setItem(
        this.projectKey(project.projectId),
        JSON.stringify(envelopeAtVersion(project, 8)),
      );
    }
    this.storage.setItem(WORKSPACE_KEY, JSON.stringify(envelopeAtVersion(workspace, 8)));
    this.writeMigratedMeta(meta, 8);
  }

  private migrateVersion8To9(meta: Record<string, unknown>): void {
    const rawWorkspace = this.storage.getItem(WORKSPACE_KEY);
    if (rawWorkspace === null) {
      throw new PersistenceError("Workspace index is missing. No data was changed.");
    }
    const workspace = readEnvelopeAtVersion<WorkspaceState>(rawWorkspace, WORKSPACE_KEY, 8);
    if (typeof workspace.workspaceId !== "string" || !Array.isArray(workspace.projectIndex)) {
      throw new PersistenceError("Workspace index is invalid. No data was changed.");
    }
    const migratedProjects = workspace.projectIndex.map((summary) => {
      if (!isRecord(summary) || typeof summary.projectId !== "string") {
        throw new PersistenceError("Workspace project index is invalid. No data was changed.");
      }
      const key = this.projectKey(summary.projectId);
      const rawProject = this.storage.getItem(key);
      if (rawProject === null) {
        throw new PersistenceError(
          `Project index references missing project ${summary.projectId}. No data was changed.`,
        );
      }
      const project = readEnvelopeAtVersion<Omit<SongProject, "harmony">>(rawProject, key, 8);
      if (project.projectId !== summary.projectId) {
        throw new PersistenceError(
          `Project ownership mismatch for ${summary.projectId}. No data was changed.`,
        );
      }
      return {
        ...project,
        harmony: {
          projectId: project.projectId,
          key: null,
          chordNotes: "",
          progressions: [],
        },
      } satisfies SongProject;
    });
    for (const project of migratedProjects) {
      this.storage.setItem(
        this.projectKey(project.projectId),
        JSON.stringify(envelopeAtVersion(project, 9)),
      );
    }
    this.storage.setItem(WORKSPACE_KEY, JSON.stringify(envelopeAtVersion(workspace, 9)));
    this.writeMigratedMeta(meta, 9);
  }

  private migrateVersion9To10(meta: Record<string, unknown>): void {
    const rawWorkspace = this.storage.getItem(WORKSPACE_KEY);
    if (rawWorkspace === null) {
      throw new PersistenceError("Workspace index is missing. No data was changed.");
    }
    const workspace = readEnvelopeAtVersion<WorkspaceState>(rawWorkspace, WORKSPACE_KEY, 9);
    if (typeof workspace.workspaceId !== "string" || !Array.isArray(workspace.projectIndex)) {
      throw new PersistenceError("Workspace index is invalid. No data was changed.");
    }
    const migratedProjects = workspace.projectIndex.map((summary) => {
      if (!isRecord(summary) || typeof summary.projectId !== "string") {
        throw new PersistenceError("Workspace project index is invalid. No data was changed.");
      }
      const key = this.projectKey(summary.projectId);
      const rawProject = this.storage.getItem(key);
      if (rawProject === null) {
        throw new PersistenceError(
          `Project index references missing project ${summary.projectId}. No data was changed.`,
        );
      }
      const project = readEnvelopeAtVersion<SongProject>(rawProject, key, 9);
      if (project.projectId !== summary.projectId) {
        throw new PersistenceError(
          `Project ownership mismatch for ${summary.projectId}. No data was changed.`,
        );
      }
      return {
        ...project,
        lyrics: {
          sections: project.lyrics.sections.map((section) => ({
            ...section,
            bars: null,
          })),
        },
        harmony: {
          ...project.harmony,
          progressions: project.harmony.progressions.map((progression) => ({
            ...progression,
            sectionId: null,
          })),
        },
      } satisfies SongProject;
    });
    for (const project of migratedProjects) {
      this.storage.setItem(
        this.projectKey(project.projectId),
        JSON.stringify(envelopeAtVersion(project, 10)),
      );
    }
    this.storage.setItem(WORKSPACE_KEY, JSON.stringify(envelopeAtVersion(workspace, 10)));
    this.writeMigratedMeta(meta, 10);
  }

  private migrateVersion10To11(meta: Record<string, unknown>): void {
    const rawWorkspace = this.storage.getItem(WORKSPACE_KEY);
    if (rawWorkspace === null) {
      throw new PersistenceError("Workspace index is missing. No data was changed.");
    }
    const workspace = readEnvelopeAtVersion<WorkspaceState>(rawWorkspace, WORKSPACE_KEY, 10);
    if (typeof workspace.workspaceId !== "string" || !Array.isArray(workspace.projectIndex)) {
      throw new PersistenceError("Workspace index is invalid. No data was changed.");
    }
    const migratedProjects = workspace.projectIndex.map((summary) => {
      if (!isRecord(summary) || typeof summary.projectId !== "string") {
        throw new PersistenceError("Workspace project index is invalid. No data was changed.");
      }
      const key = this.projectKey(summary.projectId);
      const rawProject = this.storage.getItem(key);
      if (rawProject === null) {
        throw new PersistenceError(
          `Project index references missing project ${summary.projectId}. No data was changed.`,
        );
      }
      const project = readEnvelopeAtVersion<SongProject>(rawProject, key, 10);
      if (project.projectId !== summary.projectId) {
        throw new PersistenceError(
          `Project ownership mismatch for ${summary.projectId}. No data was changed.`,
        );
      }
      return {
        ...project,
        arrangement: {
          projectId: project.projectId,
          tracks: [],
          cells: [],
        },
      } satisfies SongProject;
    });
    for (const project of migratedProjects) {
      this.storage.setItem(
        this.projectKey(project.projectId),
        JSON.stringify(envelopeAtVersion(project, 11)),
      );
    }
    this.storage.setItem(WORKSPACE_KEY, JSON.stringify(envelopeAtVersion(workspace, 11)));
    this.writeMigratedMeta(meta, 11);
  }

  private migrateVersion11To12(meta: Record<string, unknown>): void {
    const rawWorkspace = this.storage.getItem(WORKSPACE_KEY);
    if (rawWorkspace === null) {
      throw new PersistenceError("Workspace index is missing. No data was changed.");
    }
    const workspace = readEnvelopeAtVersion<WorkspaceState>(rawWorkspace, WORKSPACE_KEY, 11);
    if (typeof workspace.workspaceId !== "string" || !Array.isArray(workspace.projectIndex)) {
      throw new PersistenceError("Workspace index is invalid. No data was changed.");
    }
    const legacyWorkspace = workspace as WorkspaceState & { skillProgress?: unknown };
    const skillProgress = legacyWorkspace.skillProgress === undefined
      ? []
      : legacyWorkspace.skillProgress;
    assertSkillProgress(skillProgress);
    const migratedWorkspace: WorkspaceState = {
      workspaceId: workspace.workspaceId,
      projectIndex: workspace.projectIndex,
      skillProgress,
    };
    const migratedProjects = workspace.projectIndex.map((summary) => {
      if (!isRecord(summary) || typeof summary.projectId !== "string") {
        throw new PersistenceError("Workspace project index is invalid. No data was changed.");
      }
      const key = this.projectKey(summary.projectId);
      const rawProject = this.storage.getItem(key);
      if (rawProject === null) {
        throw new PersistenceError(
          `Project index references missing project ${summary.projectId}. No data was changed.`,
        );
      }
      const project = readEnvelopeAtVersion<SongProject>(rawProject, key, 11);
      if (project.projectId !== summary.projectId) {
        throw new PersistenceError(
          `Project ownership mismatch for ${summary.projectId}. No data was changed.`,
        );
      }
      return project;
    });
    for (const project of migratedProjects) {
      this.storage.setItem(
        this.projectKey(project.projectId),
        JSON.stringify(envelopeAtVersion(project, 12)),
      );
    }
    this.storage.setItem(
      WORKSPACE_KEY,
      JSON.stringify(envelopeAtVersion(migratedWorkspace, 12)),
    );
    this.writeMigratedMeta(meta, 12);
  }

  private migrateVersion12To13(meta: Record<string, unknown>): void {
    const rawWorkspace = this.storage.getItem(WORKSPACE_KEY);
    if (rawWorkspace === null) {
      throw new PersistenceError("Workspace index is missing. No data was changed.");
    }
    const workspace = readEnvelopeAtVersion<WorkspaceState>(rawWorkspace, WORKSPACE_KEY, 12);
    if (typeof workspace.workspaceId !== "string" || !Array.isArray(workspace.projectIndex)) {
      throw new PersistenceError("Workspace index is invalid. No data was changed.");
    }
    const migratedProjects = workspace.projectIndex.map((summary) => {
      if (!isRecord(summary) || typeof summary.projectId !== "string") {
        throw new PersistenceError("Workspace project index is invalid. No data was changed.");
      }
      const key = this.projectKey(summary.projectId);
      const rawProject = this.storage.getItem(key);
      if (rawProject === null) {
        throw new PersistenceError(
          `Project index references missing project ${summary.projectId}. No data was changed.`,
        );
      }
      const project = readEnvelopeAtVersion<SongProject>(rawProject, key, 12);
      if (project.projectId !== summary.projectId) {
        throw new PersistenceError(
          `Project ownership mismatch for ${summary.projectId}. No data was changed.`,
        );
      }
      return {
        ...project,
        garageBandExperiments: [],
      } satisfies SongProject;
    });
    for (const project of migratedProjects) {
      this.storage.setItem(
        this.projectKey(project.projectId),
        JSON.stringify(envelopeAtVersion(project, 13)),
      );
    }
    this.storage.setItem(
      WORKSPACE_KEY,
      JSON.stringify(envelopeAtVersion(workspace, 13)),
    );
    this.writeMigratedMeta(meta, 13);
  }

  private migrateVersion13To14(meta: Record<string, unknown>): void {
    const rawWorkspace = this.storage.getItem(WORKSPACE_KEY);
    if (rawWorkspace === null) {
      throw new PersistenceError("Workspace index is missing. No data was changed.");
    }
    const workspace = readEnvelopeAtVersion<WorkspaceState>(rawWorkspace, WORKSPACE_KEY, 13);
    if (typeof workspace.workspaceId !== "string" || !Array.isArray(workspace.projectIndex)) {
      throw new PersistenceError("Workspace index is invalid. No data was changed.");
    }
    const migratedProjects = workspace.projectIndex.map((summary) => {
      if (!isRecord(summary) || typeof summary.projectId !== "string") {
        throw new PersistenceError("Workspace project index is invalid. No data was changed.");
      }
      const key = this.projectKey(summary.projectId);
      const rawProject = this.storage.getItem(key);
      if (rawProject === null) {
        throw new PersistenceError(`Project index references missing project ${summary.projectId}. No data was changed.`);
      }
      type Version13Project = Omit<SongProject, "melody" | "openQuestions" | "versions"> & {
        melody: Omit<SongProject["melody"], "selectedTakeIds">;
      };
      const project = readEnvelopeAtVersion<Version13Project>(rawProject, key, 13);
      if (project.projectId !== summary.projectId) {
        throw new PersistenceError(`Project ownership mismatch for ${summary.projectId}. No data was changed.`);
      }
      return {
        ...project,
        melody: { ...project.melody, selectedTakeIds: [] },
        openQuestions: [],
        versions: [],
      } satisfies SongProject;
    });
    for (const project of migratedProjects) {
      this.storage.setItem(this.projectKey(project.projectId), JSON.stringify(envelopeAtVersion(project, 14)));
    }
    this.storage.setItem(WORKSPACE_KEY, JSON.stringify(envelopeAtVersion(workspace, 14)));
    this.writeMigratedMeta(meta, 14);
  }

  private migrateVersion14To15(meta: Record<string, unknown>): void {
    const rawWorkspace = this.storage.getItem(WORKSPACE_KEY);
    if (rawWorkspace === null) {
      throw new PersistenceError("Workspace index is missing. No data was changed.");
    }
    const workspace = readEnvelopeAtVersion<WorkspaceState>(rawWorkspace, WORKSPACE_KEY, 14);
    if (typeof workspace.workspaceId !== "string" || !Array.isArray(workspace.projectIndex)) {
      throw new PersistenceError("Workspace index is invalid. No data was changed.");
    }
    const timestamp = this.now();
    const migratedProjects = workspace.projectIndex.map((summary) => {
      if (!isRecord(summary) || typeof summary.projectId !== "string") {
        throw new PersistenceError("Workspace project index is invalid. No data was changed.");
      }
      const key = this.projectKey(summary.projectId);
      const rawProject = this.storage.getItem(key);
      if (rawProject === null) {
        throw new PersistenceError(
          `Project index references missing project ${summary.projectId}. No data was changed.`,
        );
      }
      const project = readEnvelopeAtVersion<Omit<SongProject, "review">>(rawProject, key, 14);
      if (project.projectId !== summary.projectId) {
        throw new PersistenceError(
          `Project ownership mismatch for ${summary.projectId}. No data was changed.`,
        );
      }
      return {
        ...project,
        review: createEmptyReview(project.projectId, timestamp),
      } satisfies SongProject;
    });
    for (const project of migratedProjects) {
      this.storage.setItem(
        this.projectKey(project.projectId),
        JSON.stringify(envelopeAtVersion(project, 15)),
      );
    }
    this.storage.setItem(WORKSPACE_KEY, JSON.stringify(envelopeAtVersion(workspace, 15)));
    this.writeMigratedMeta(meta, 15);
  }

  private writeMigratedMeta(meta: Record<string, unknown>, schemaVersion: number): void {
    const timestamp = this.now();
    this.storage.setItem(META_KEY, JSON.stringify({
      schemaVersion,
      appDataCreatedAt: typeof meta.appDataCreatedAt === "string"
        ? meta.appDataCreatedAt
        : timestamp,
      lastMigratedAt: timestamp,
    } satisfies StorageMeta));
  }

  private readWorkspace(): WorkspaceState {
    this.ensureSchema();
    const raw = this.storage.getItem(WORKSPACE_KEY);
    if (raw === null) {
      throw new PersistenceError("Workspace index is missing. No data was changed.");
    }
    const workspace = readEnvelope<WorkspaceState>(raw, WORKSPACE_KEY);
    assertWorkspace(workspace);
    return structuredClone(workspace);
  }

  private writeWorkspace(workspace: WorkspaceState): void {
    assertWorkspace(workspace);
    this.storage.setItem(WORKSPACE_KEY, JSON.stringify(envelope(workspace)));
  }

  private writeProjectAndWorkspace(project: SongProject, workspace: WorkspaceState): void {
    assertProject(project, project.projectId);
    this.storage.setItem(
      this.projectKey(project.projectId),
      JSON.stringify(envelope(project)),
    );
    this.writeWorkspace(workspace);
  }

  private replaceSummary(workspace: WorkspaceState, project: SongProject): void {
    const index = workspace.projectIndex.findIndex(
      (summary) => summary.projectId === project.projectId,
    );
    if (index === -1) throw new ProjectNotFoundError(project.projectId);
    workspace.projectIndex[index] = toProjectSummary(project);
  }

  private requireProject(projectId: string): SongProject {
    const project = this.get(projectId);
    if (!project) throw new ProjectNotFoundError(projectId);
    return project;
  }

  private updateJourney(
    projectId: string,
    change: Partial<Pick<SongProject, "creationMode" | "currentStage">>,
  ): SongProject {
    const workspace = this.readWorkspace();
    const current = this.requireProject(projectId);
    const updated: SongProject = {
      ...current,
      ...change,
      updatedAt: this.now(),
    };
    this.replaceSummary(workspace, updated);
    this.writeProjectAndWorkspace(updated, workspace);
    return structuredClone(updated);
  }

  private updateCreativeData(
    projectId: string,
    change: (project: SongProject, timestamp: string) => SongProject,
  ): SongProject {
    const workspace = this.readWorkspace();
    const current = this.requireProject(projectId);
    const updated = change(current, this.now());
    assertProject(updated, projectId);
    this.replaceSummary(workspace, updated);
    this.writeProjectAndWorkspace(updated, workspace);
    return structuredClone(updated);
  }

  private createMaterial(
    projectId: string,
    input: AddMaterialInput,
    timestamp: string,
  ): Material {
    if (!MATERIAL_TYPES.includes(input.type)) {
      throw new PersistenceError("Material type is invalid.");
    }
    return {
      materialId: this.createId(),
      projectId,
      type: input.type,
      content: this.requireContent(input.content, "Material"),
      note: input.note?.trim() ?? "",
      origin: input.origin ?? "manual",
      sourcePromptId: input.sourcePromptId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private createLyricsSection(
    projectId: string,
    input: AddLyricsSectionInput,
    order: number,
    timestamp: string,
  ): LyricsSection {
    if (!LYRICS_SECTION_TYPES.includes(input.type)) {
      throw new PersistenceError("Lyrics section type is invalid.");
    }
    const guidance = LYRICS_SECTION_GUIDANCE[input.type];
    return {
      sectionId: this.createId(),
      projectId,
      name: this.requireSectionName(input.name),
      type: input.type,
      order,
      purpose: guidance.purpose,
      reflectionQuestions: [...guidance.reflectionQuestions],
      bars: null,
      userLyrics: "",
      notes: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private createGarageBandExperiment(
    projectId: string,
    input: AddGarageBandExperimentInput,
    sectionId: string | null,
  ): GarageBandExperiment {
    return {
      experimentId: this.createId(),
      projectId,
      sectionId,
      type: this.requireGarageBandExperimentType(input.type),
      date: this.requireGarageBandExperimentDate(input.date),
      goal: this.requireExperimentField(input.goal, "Experiment goal"),
      whatITried: this.requireExperimentField(input.whatITried, "What I tried"),
      whatINoticed: this.requireExperimentField(input.whatINoticed, "What I noticed"),
      decision: this.requireExperimentField(input.decision, "Decision"),
      nextQuestion: this.requireExperimentField(input.nextQuestion, "Next question"),
    };
  }

  private resolveExperimentSectionId(
    project: SongProject,
    projectId: string,
    sectionId: string | null | undefined,
  ): string | null {
    if (sectionId === undefined || sectionId === null || sectionId === "") return null;
    return this.requireLyricsSection(project, projectId, sectionId).sectionId;
  }

  private requireLyricsSection(
    project: SongProject,
    projectId: string,
    sectionId: string,
  ): LyricsSection {
    const section = project.lyrics.sections.find((item) => item.sectionId === sectionId);
    if (!section || section.projectId !== projectId) {
      throw new PersistenceError(`Lyrics section ${sectionId} was not found in this project.`);
    }
    return section;
  }

  private requireMelodyTake(
    project: SongProject,
    projectId: string,
    takeId: string,
  ): MelodyTake {
    const take = project.melody.takes.find((item) => item.takeId === takeId);
    if (!take || take.projectId !== projectId) {
      throw new PersistenceError(`Melody take ${takeId} was not found in this project.`);
    }
    return take;
  }

  private requireGarageBandExperiment(
    project: SongProject,
    projectId: string,
    experimentId: string,
  ): GarageBandExperiment {
    const experiment = project.garageBandExperiments.find(
      (item) => item.experimentId === experimentId,
    );
    if (!experiment || experiment.projectId !== projectId) {
      throw new PersistenceError(
        `GarageBand experiment ${experimentId} was not found in this project.`,
      );
    }
    return experiment;
  }

  private requireVersion(project: SongProject, projectId: string, versionId: string): SongVersion {
    const version = project.versions.find((item) => item.versionId === versionId);
    if (!version || version.projectId !== projectId) {
      throw new PersistenceError(`Version ${versionId} was not found in this project.`);
    }
    return version;
  }

  private nextVersionNumber(project: SongProject): number {
    return project.versions.reduce((highest, version) => Math.max(highest, version.versionNumber), 0) + 1;
  }

  private requireHarmonyProgression(
    project: SongProject,
    projectId: string,
    progressionId: string,
  ): HarmonyProgression {
    const progression = project.harmony.progressions.find(
      (item) => item.progressionId === progressionId,
    );
    if (!progression || progression.projectId !== projectId) {
      throw new PersistenceError(
        `Harmony progression ${progressionId} was not found in this project.`,
      );
    }
    return progression;
  }

  private requireArrangementTrack(
    project: SongProject,
    projectId: string,
    trackId: string,
  ): ArrangementTrack {
    const track = project.arrangement.tracks.find((item) => item.trackId === trackId);
    if (!track || track.projectId !== projectId) {
      throw new PersistenceError(`Arrangement track ${trackId} was not found in this project.`);
    }
    return track;
  }

  private normalizeSectionOrder(
    sections: readonly LyricsSection[],
    timestamp: string,
  ): LyricsSection[] {
    return sections.map((section, order) => section.order === order
      ? section
      : { ...section, order, updatedAt: timestamp });
  }

  private requireSectionName(name: string): string {
    const normalized = name.trim();
    if (!normalized) throw new PersistenceError("Section name cannot be empty.");
    return normalized;
  }

  private requireTakeName(name: string): string {
    const normalized = name.trim();
    if (!normalized) throw new PersistenceError("Take name cannot be empty.");
    return normalized;
  }

  private requireProgressionName(name: string): string {
    const normalized = name.trim();
    if (!normalized) throw new PersistenceError("Progression name cannot be empty.");
    return normalized;
  }

  private requireTrackName(name: string): string {
    const normalized = name.trim();
    if (!normalized) throw new PersistenceError("Arrangement track name cannot be empty.");
    return normalized;
  }

  private requireVersionLabel(label: string): string {
    const normalized = label.trim();
    if (!normalized) throw new PersistenceError("Version label cannot be empty.");
    return normalized;
  }

  private requireGarageBandExperimentType(
    type: AddGarageBandExperimentInput["type"],
  ): GarageBandExperiment["type"] {
    if (!GARAGEBAND_EXPERIMENT_TYPES.includes(type)) {
      throw new PersistenceError("GarageBand experiment type is invalid.");
    }
    return type;
  }

  private requireGarageBandExperimentDate(date: string): string {
    const normalized = date.trim();
    if (!normalized) throw new PersistenceError("Experiment date cannot be empty.");
    return normalized;
  }

  private requireExperimentField(value: string, label: string): string {
    const normalized = value.trim();
    if (!normalized) throw new PersistenceError(`${label} cannot be empty.`);
    return normalized;
  }

  private validateBars(bars: number | null): number | null {
    if (bars !== null && (!Number.isInteger(bars) || bars < 1)) {
      throw new PersistenceError("Bars must be a whole number of 1 or more, or left empty.");
    }
    return bars;
  }

  private progressionTypeLabel(type: CreateHarmonyProgressionInput["type"]): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  private requireContent(content: string, label: string): string {
    const normalized = content.trim();
    if (!normalized) throw new PersistenceError(`${label} cannot be empty.`);
    return normalized;
  }

  private requireTitle(title: string): string {
    const normalized = title.trim();
    if (!normalized) throw new PersistenceError("Project title cannot be empty.");
    return normalized;
  }

  private projectKey(projectId: string): string {
    return `${PROJECT_KEY_PREFIX}${projectId}`;
  }
}
