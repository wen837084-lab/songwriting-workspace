export type ProjectStatus = "active" | "archived";

export const PROJECT_STAGES = [
  "Idea",
  "Explore",
  "Define",
  "Lyrics",
  "Melody",
  "Rhythm",
  "Harmony",
  "SongStructure",
  "Arrangement",
  "Review",
] as const;

export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const PROJECT_CREATION_MODES = ["Guided", "Free"] as const;

export type ProjectCreationMode = (typeof PROJECT_CREATION_MODES)[number];

export const IDEA_STARTING_POINTS = [
  "idea",
  "story",
  "phrase",
  "scene",
  "emotion",
  "melody",
  "rhythm",
  "harmony",
  "sound",
  "nothing",
] as const;

export type IdeaStartingPoint = (typeof IDEA_STARTING_POINTS)[number];

export const MATERIAL_TYPES = [
  "scene",
  "emotion",
  "phrase",
  "memory",
  "sound",
  "person",
  "object",
  "event",
  "dialogue",
  "melody-idea",
  "rhythm-idea",
  "harmony-idea",
  "other",
] as const;

export type MaterialType = (typeof MATERIAL_TYPES)[number];
export type ExploreResponseStatus = "answered" | "skipped";

export interface IdeaState {
  startingPoint: IdeaStartingPoint | null;
}

export interface ExploreResponse {
  responseId: string;
  projectId: string;
  promptId: string;
  status: ExploreResponseStatus;
  content: string;
  updatedAt: string;
}

export interface ExploreState {
  currentPromptIndex: number;
  responses: ExploreResponse[];
}

export interface Material {
  materialId: string;
  projectId: string;
  type: MaterialType;
  content: string;
  note: string;
  origin: "manual" | "explore-response";
  sourcePromptId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SongIntent {
  projectId: string;
  coreIdea: string;
  desiredFeeling: string;
  coreImage: string;
  centralConflict: string;
  selectedMaterialIds: string[];
  updatedAt: string;
}

export const LYRICS_SECTION_TYPES = [
  "intro",
  "verse",
  "pre-chorus",
  "chorus",
  "post-chorus",
  "bridge",
  "outro",
  "custom",
] as const;

export type LyricsSectionType = (typeof LYRICS_SECTION_TYPES)[number];

export const LYRICS_SECTION_GUIDANCE: Record<
  LyricsSectionType,
  { defaultName: string; purpose: string; reflectionQuestions: readonly string[] }
> = {
  intro: {
    defaultName: "Intro",
    purpose: "Intro 通常用来建立开场氛围或进入歌曲的入口。",
    reflectionQuestions: ["听众首先遇到什么？", "你正在创造怎样的入口？"],
  },
  verse: {
    defaultName: "Verse",
    purpose: "Verse 通常用来建立场景或故事，或带来新的信息。",
    reflectionQuestions: ["事情从哪里开始？", "听众首先注意到什么？", "这个 Section 中发生了什么变化？"],
  },
  "pre-chorus": {
    defaultName: "Pre-Chorus",
    purpose: "Pre-Chorus 通常在 Verse 和 Chorus 之间制造移动感。",
    reflectionQuestions: ["这里正在发生什么移动？", "进入下一个 Section 前还有什么没有解决？"],
  },
  chorus: {
    defaultName: "Chorus",
    purpose: "Chorus 通常承载重复出现的核心表达或情绪焦点。",
    reflectionQuestions: ["这里对你来说什么最核心？", "你想回到什么？"],
  },
  "post-chorus": {
    defaultName: "Post-Chorus",
    purpose: "Post-Chorus 通常延展或释放 Chorus 中的某些内容。",
    reflectionQuestions: ["Chorus 之后还留下什么？", "核心表达过去之后发生了什么变化？"],
  },
  bridge: {
    defaultName: "Bridge",
    purpose: "Bridge 通常提供对比、转折或不同的视角。",
    reflectionQuestions: ["从这个角度看，还有什么没有被看见？", "在这里发生了什么变化？"],
  },
  outro: {
    defaultName: "Outro",
    purpose: "Outro 通常塑造歌曲如何留下最后的想法或感受。",
    reflectionQuestions: ["最后还剩下什么？", "你想如何留下这一刻？"],
  },
  custom: {
    defaultName: "Custom Section",
    purpose: "Custom Section 在这首歌中承担你为它选择的作用。",
    reflectionQuestions: ["这个 Section 为你的歌曲做什么？", "它发生时有什么变化？"],
  },
};

export const GUIDED_LYRICS_STARTING_STRUCTURE: readonly {
  type: LyricsSectionType;
  name: string;
}[] = [
  { type: "verse", name: "Verse 1" },
  { type: "chorus", name: "Chorus" },
  { type: "verse", name: "Verse 2" },
  { type: "chorus", name: "Chorus" },
  { type: "bridge", name: "Bridge" },
  { type: "chorus", name: "Final Chorus" },
];

export interface LyricsSection {
  sectionId: string;
  projectId: string;
  name: string;
  type: LyricsSectionType;
  order: number;
  bars: number | null;
  purpose: string;
  reflectionQuestions: string[];
  userLyrics: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface LyricsState {
  sections: LyricsSection[];
}

export const GARAGEBAND_EXPERIMENT_TYPES = [
  "Melody",
  "Rhythm",
  "Harmony",
  "Arrangement",
  "Recording",
  "Other",
] as const;

export type GarageBandExperimentType = (typeof GARAGEBAND_EXPERIMENT_TYPES)[number];

export interface GarageBandExperiment {
  experimentId: string;
  projectId: string;
  sectionId: string | null;
  type: GarageBandExperimentType;
  date: string;
  goal: string;
  whatITried: string;
  whatINoticed: string;
  decision: string;
  nextQuestion: string;
}

export const MELODY_TAKE_STATUSES = [
  "keep-exploring",
  "interesting",
  "return-later",
] as const;

export type MelodyTakeStatus = (typeof MELODY_TAKE_STATUSES)[number];

export interface MelodyTake {
  takeId: string;
  projectId: string;
  sectionId: string;
  audioAssetId: string;
  name: string;
  notes: string;
  status: MelodyTakeStatus;
  mimeType: string;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MelodyState {
  notesBySection: Record<string, string>;
  takes: MelodyTake[];
  selectedTakeIds: string[];
}

export const TIME_SIGNATURES = ["4/4", "3/4", "6/8"] as const;

export type TimeSignature = (typeof TIME_SIGNATURES)[number];

export interface RhythmState {
  bpm: number;
  timeSignature: TimeSignature;
  notes: string;
}

export interface UpdateRhythmInput {
  bpm?: number;
  timeSignature?: TimeSignature;
  notes?: string;
}

export const HARMONY_KEYS = [
  "C",
  "C♯",
  "D",
  "E♭",
  "E",
  "F",
  "F♯",
  "G",
  "A♭",
  "A",
  "B♭",
  "B",
] as const;

export type HarmonyKey = (typeof HARMONY_KEYS)[number];

export const CHORD_SYMBOLS = [
  "C",
  "Cm",
  "D",
  "Dm",
  "E",
  "Em",
  "F",
  "Fm",
  "G",
  "Gm",
  "A",
  "Am",
  "B",
  "Bm",
] as const;

export type ChordSymbol = (typeof CHORD_SYMBOLS)[number];

export const HARMONY_PROGRESSION_TYPES = ["verse", "chorus", "bridge", "custom"] as const;

export type HarmonyProgressionType = (typeof HARMONY_PROGRESSION_TYPES)[number];

export interface HarmonyProgression {
  progressionId: string;
  projectId: string;
  sectionId: string | null;
  type: HarmonyProgressionType;
  name: string;
  chords: ChordSymbol[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface HarmonyState {
  projectId: string;
  key: HarmonyKey | null;
  chordNotes: string;
  progressions: HarmonyProgression[];
}

export const ARRANGEMENT_TRACK_PRESETS = [
  { category: "lead-vocal", label: "Lead Vocal" },
  { category: "backing-vocal", label: "Backing Vocal" },
  { category: "piano", label: "Piano" },
  { category: "keyboard", label: "Keyboard" },
  { category: "acoustic-guitar", label: "Acoustic Guitar" },
  { category: "electric-guitar", label: "Electric Guitar" },
  { category: "bass", label: "Bass" },
  { category: "drums", label: "Drums" },
  { category: "percussion", label: "Percussion" },
  { category: "pad", label: "Pad" },
  { category: "strings", label: "Strings" },
  { category: "synth", label: "Synth" },
  { category: "fx", label: "FX" },
  { category: "other", label: "Other" },
] as const;

export type ArrangementTrackCategory = (typeof ARRANGEMENT_TRACK_PRESETS)[number]["category"];

export interface ArrangementTrack {
  trackId: string;
  projectId: string;
  category: ArrangementTrackCategory;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArrangementCell {
  cellId: string;
  projectId: string;
  sectionId: string;
  trackId: string;
  presence: string;
  energy: string;
  density: string;
  dynamics: string;
  register: string;
  notes: string;
  updatedAt: string;
}

export interface ArrangementState {
  projectId: string;
  tracks: ArrangementTrack[];
  cells: ArrangementCell[];
}

export interface CreateHarmonyProgressionInput {
  type: HarmonyProgressionType;
  sectionId?: string;
  name?: string;
}

export type UpdateHarmonyProgressionInput = Partial<
  Pick<HarmonyProgression, "name" | "chords" | "notes" | "sectionId">
>;

export const LINE_REFLECTION_LABELS = ["specific", "abstract", "unsure"] as const;

export type LineReflectionLabel = (typeof LINE_REFLECTION_LABELS)[number];

export const SONG_INTENT_CHECK_OPTIONS = ["yes", "partly", "no", "not-sure"] as const;

export type SongIntentCheckOption = (typeof SONG_INTENT_CHECK_OPTIONS)[number];

export interface LineReflection {
  sectionId: string;
  lineIndex: number;
  lineText: string;
  label: LineReflectionLabel;
}

export interface SectionEmotion {
  sectionId: string;
  emotion: string;
}

export interface ReflectionState {
  lineReflections: LineReflection[];
  emotionMap: SectionEmotion[];
  songIntentCheck: SongIntentCheckOption | null;
  updatedAt: string;
}

export const REVIEW_STATUSES = ["not-reviewed", "in-review", "reviewed"] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_CATEGORIES = [
  "song-intent",
  "lyrics",
  "melody",
  "rhythm",
  "harmony",
  "song-structure",
  "arrangement",
  "garageband-experiments",
  "open-questions",
  "version-history",
] as const;

export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number];

export interface ReviewCategoryReflection {
  category: ReviewCategory;
  content: string;
  updatedAt: string;
}

export interface ReviewNextFocus {
  workOnNext: string;
  testNext: string;
  leaveAloneForNow: string;
}

export interface ReviewState {
  projectId: string;
  createdAt: string;
  updatedAt: string;
  status: ReviewStatus;
  userReflection: string;
  categoryReflections: ReviewCategoryReflection[];
  nextFocus: ReviewNextFocus;
}

export interface VersionSnapshot {
  projectId: string;
  projectNote: string;
  lyrics: LyricsState;
  melody: MelodyState;
  rhythm: RhythmState;
  harmony: HarmonyState;
  arrangement: ArrangementState;
  reflection: ReflectionState;
  openQuestions: string[];
}

export interface SongVersion {
  versionId: string;
  projectId: string;
  versionNumber: number;
  label: string;
  createdAt: string;
  userNote: string;
  snapshot: VersionSnapshot;
}

export interface ProjectSummary {
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  currentStage: ProjectStage;
  status: ProjectStatus;
}

export interface SongProject extends ProjectSummary {
  creationMode: ProjectCreationMode;
  projectNote: string;
  idea: IdeaState;
  explore: ExploreState;
  materials: Material[];
  songIntent: SongIntent;
  lyrics: LyricsState;
  garageBandExperiments: GarageBandExperiment[];
  melody: MelodyState;
  rhythm: RhythmState;
  harmony: HarmonyState;
  arrangement: ArrangementState;
  reflection: ReflectionState;
  review: ReviewState;
  openQuestions: string[];
  versions: SongVersion[];
}

export interface ProjectListItem extends ProjectSummary {
  projectNote: string;
}

export interface CreateProjectInput {
  title: string;
  projectNote?: string;
}

export interface UpdateProjectInput {
  title?: string;
  projectNote?: string;
}

export interface AddMaterialInput {
  type: MaterialType;
  content: string;
  note?: string;
  origin?: Material["origin"];
  sourcePromptId?: string;
}

export interface UpdateMaterialInput {
  type?: MaterialType;
  content?: string;
  note?: string;
}

export interface AnswerExploreInput {
  promptId: string;
  promptIndex: number;
  content: string;
  saveAsMaterial?: MaterialType;
}

export type SongIntentTextField =
  | "coreIdea"
  | "desiredFeeling"
  | "coreImage"
  | "centralConflict";

export type UpdateSongIntentInput = Partial<
  Pick<SongIntent, SongIntentTextField | "selectedMaterialIds">
>;

export interface AddLyricsSectionInput {
  type: LyricsSectionType;
  name: string;
}

export interface AddGarageBandExperimentInput {
  sectionId?: string | null;
  type: GarageBandExperimentType;
  date: string;
  goal: string;
  whatITried: string;
  whatINoticed: string;
  decision: string;
  nextQuestion: string;
}

export type UpdateGarageBandExperimentInput = Partial<
  Pick<GarageBandExperiment, "sectionId" | "type" | "date" | "goal" | "whatITried" | "whatINoticed" | "decision" | "nextQuestion">
>;

export interface AddArrangementTrackInput {
  category: ArrangementTrackCategory;
  name: string;
}

export type UpdateArrangementTrackInput = Partial<Pick<ArrangementTrack, "category" | "name">>;

export type UpdateArrangementCellInput = Partial<
  Pick<ArrangementCell, "presence" | "energy" | "density" | "dynamics" | "register" | "notes">
>;

export type UpdateLyricsSectionInput = Partial<
  Pick<LyricsSection, "name" | "bars" | "userLyrics" | "notes">
>;

export interface AddMelodyTakeInput {
  sectionId: string;
  audioAssetId: string;
  name: string;
  mimeType: string;
  durationMs?: number | null;
}

export type UpdateMelodyTakeInput = Partial<
  Pick<MelodyTake, "name" | "notes" | "status">
>;

export interface SaveVersionInput {
  userNote?: string;
  label?: string;
}

export interface SetLineReflectionInput {
  sectionId: string;
  lineIndex: number;
  lineText: string;
  label: LineReflectionLabel | null;
}

export interface UpdateReviewInput {
  status?: ReviewStatus;
  userReflection?: string;
  categoryReflections?: Array<Pick<ReviewCategoryReflection, "category" | "content">>;
  nextFocus?: Partial<ReviewNextFocus>;
}

export type ProjectSort = "updatedAt" | "createdAt" | "title";

export function toProjectSummary(project: SongProject): ProjectSummary {
  const { projectId, title, createdAt, updatedAt, currentStage, status } = project;
  return { projectId, title, createdAt, updatedAt, currentStage, status };
}

export function duplicateProjectData(
  source: SongProject,
  projectId: string,
  timestamp: string,
  createId: () => string,
): SongProject {
  const copy = structuredClone(source);
  const materialIdMap = new Map<string, string>();
  const materials = copy.materials.map((material) => {
    const materialId = createId();
    materialIdMap.set(material.materialId, materialId);
    return {
      ...material,
      materialId,
      projectId,
    };
  });
  const sectionIdMap = new Map<string, string>();
  const takeIdMap = new Map<string, string>();
  const audioAssetIdMap = new Map<string, string>();
  const trackIdMap = new Map<string, string>();
  const mapId = (map: Map<string, string>, sourceId: string): string => {
    const existing = map.get(sourceId);
    if (existing) return existing;
    const next = createId();
    map.set(sourceId, next);
    return next;
  };
  const sections = copy.lyrics.sections.map((section, order) => {
    const sectionId = createId();
    sectionIdMap.set(section.sectionId, sectionId);
    return {
      ...section,
      sectionId,
      projectId,
      order,
      updatedAt: timestamp,
    };
  });
  const garageBandExperiments = copy.garageBandExperiments.map((experiment) => {
    const sectionId = experiment.sectionId === null
      ? null
      : sectionIdMap.get(experiment.sectionId) ?? null;
    return {
      ...experiment,
      experimentId: createId(),
      projectId,
      sectionId,
    };
  });
  const takes = copy.melody.takes.flatMap((take) => {
    const sectionId = sectionIdMap.get(take.sectionId);
    return sectionId ? [{
      ...take,
      takeId: mapId(takeIdMap, take.takeId),
      projectId,
      sectionId,
      audioAssetId: mapId(audioAssetIdMap, take.audioAssetId),
      updatedAt: timestamp,
    }] : [];
  });
  const notesBySection = Object.fromEntries(
    Object.entries(copy.melody.notesBySection).flatMap(([oldSectionId, notes]) => {
      const sectionId = sectionIdMap.get(oldSectionId);
      return sectionId ? [[sectionId, notes]] : [];
    }),
  );
  const tracks = copy.arrangement.tracks.map((track, order) => {
    const trackId = mapId(trackIdMap, track.trackId);
    return {
      ...track,
      trackId,
      projectId,
      order,
      updatedAt: timestamp,
    };
  });
  const cells = copy.arrangement.cells.flatMap((cell) => {
    const sectionId = sectionIdMap.get(cell.sectionId);
    const trackId = trackIdMap.get(cell.trackId);
    return sectionId && trackId
      ? [{ ...cell, cellId: createId(), projectId, sectionId, trackId, updatedAt: timestamp }]
      : [];
  });
  const remapSnapshot = (snapshot: VersionSnapshot): VersionSnapshot => {
    const snapshotSections = snapshot.lyrics.sections.map((section, order) => ({
      ...section,
      sectionId: mapId(sectionIdMap, section.sectionId),
      projectId,
      order,
    }));
    const snapshotSectionIds = new Set(snapshotSections.map((section) => section.sectionId));
    const snapshotTakes = snapshot.melody.takes.flatMap((take) => {
      const sectionId = sectionIdMap.get(take.sectionId);
      return sectionId && snapshotSectionIds.has(sectionId) ? [{
        ...take,
        takeId: mapId(takeIdMap, take.takeId),
        audioAssetId: mapId(audioAssetIdMap, take.audioAssetId),
        projectId,
        sectionId,
      }] : [];
    });
    const snapshotTakeIds = new Set(snapshotTakes.map((take) => take.takeId));
    const snapshotTracks = snapshot.arrangement.tracks.map((track, order) => ({
      ...track,
      trackId: mapId(trackIdMap, track.trackId),
      projectId,
      order,
    }));
    const snapshotTrackIds = new Set(snapshotTracks.map((track) => track.trackId));
    return {
      ...structuredClone(snapshot),
      projectId,
      lyrics: { sections: snapshotSections },
      melody: {
        notesBySection: Object.fromEntries(
          Object.entries(snapshot.melody.notesBySection).flatMap(([oldSectionId, note]) => {
            const sectionId = sectionIdMap.get(oldSectionId);
            return sectionId && snapshotSectionIds.has(sectionId) ? [[sectionId, note]] : [];
          }),
        ),
        takes: snapshotTakes,
        selectedTakeIds: snapshot.melody.selectedTakeIds
          .map((takeId) => takeIdMap.get(takeId))
          .filter((takeId): takeId is string => Boolean(takeId && snapshotTakeIds.has(takeId))),
      },
      harmony: {
        ...structuredClone(snapshot.harmony),
        projectId,
        progressions: snapshot.harmony.progressions.map((progression) => ({
          ...progression,
          progressionId: createId(),
          projectId,
          sectionId: progression.sectionId
            ? sectionIdMap.get(progression.sectionId) ?? null
            : null,
          chords: [...progression.chords],
        })),
      },
      arrangement: {
        projectId,
        tracks: snapshotTracks,
        cells: snapshot.arrangement.cells.flatMap((cell) => {
          const sectionId = sectionIdMap.get(cell.sectionId);
          const trackId = trackIdMap.get(cell.trackId);
          return sectionId && snapshotSectionIds.has(sectionId) && trackId && snapshotTrackIds.has(trackId)
            ? [{ ...cell, cellId: createId(), projectId, sectionId, trackId }]
            : [];
        }),
      },
      reflection: {
        ...structuredClone(snapshot.reflection),
        lineReflections: snapshot.reflection.lineReflections.flatMap((entry) => {
          const sectionId = sectionIdMap.get(entry.sectionId);
          return sectionId && snapshotSectionIds.has(sectionId) ? [{ ...entry, sectionId }] : [];
        }),
        emotionMap: snapshot.reflection.emotionMap.flatMap((entry) => {
          const sectionId = sectionIdMap.get(entry.sectionId);
          return sectionId && snapshotSectionIds.has(sectionId) ? [{ ...entry, sectionId }] : [];
        }),
      },
      openQuestions: [...snapshot.openQuestions],
    };
  };
  return {
    ...copy,
    projectId,
    title: `${copy.title} (copy)`,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "active",
    explore: {
      currentPromptIndex: copy.explore.currentPromptIndex,
      responses: copy.explore.responses.map((response) => ({
        ...response,
        responseId: createId(),
        projectId,
      })),
    },
    materials,
    songIntent: {
      ...copy.songIntent,
      projectId,
      selectedMaterialIds: copy.songIntent.selectedMaterialIds.flatMap((materialId) => {
        const remappedId = materialIdMap.get(materialId);
        return remappedId ? [remappedId] : [];
      }),
      updatedAt: timestamp,
    },
    lyrics: {
      sections,
    },
    garageBandExperiments,
    melody: {
      notesBySection,
      takes,
      selectedTakeIds: copy.melody.selectedTakeIds
        .map((takeId) => takeIdMap.get(takeId))
        .filter((takeId): takeId is string => Boolean(takeId)),
    },
    harmony: {
      ...copy.harmony,
      projectId,
      progressions: copy.harmony.progressions.map((progression) => ({
        ...progression,
        progressionId: createId(),
        projectId,
        sectionId: progression.sectionId
          ? sectionIdMap.get(progression.sectionId) ?? null
          : null,
        chords: [...progression.chords],
        updatedAt: timestamp,
      })),
    },
    arrangement: {
      projectId,
      tracks,
      cells,
    },
    reflection: {
      lineReflections: copy.reflection.lineReflections.flatMap((entry) => {
        const sectionId = sectionIdMap.get(entry.sectionId);
        return sectionId ? [{ ...entry, sectionId }] : [];
      }),
      emotionMap: copy.reflection.emotionMap.flatMap((entry) => {
        const sectionId = sectionIdMap.get(entry.sectionId);
        return sectionId ? [{ ...entry, sectionId }] : [];
      }),
      songIntentCheck: copy.reflection.songIntentCheck,
      updatedAt: timestamp,
    },
    review: {
      ...copy.review,
      projectId,
      createdAt: timestamp,
      updatedAt: timestamp,
      userReflection: copy.review.userReflection,
      categoryReflections: copy.review.categoryReflections.map((reflection) => ({
        ...reflection,
        updatedAt: timestamp,
      })),
      nextFocus: { ...copy.review.nextFocus },
    },
    openQuestions: [...copy.openQuestions],
    versions: copy.versions.map((version) => ({
      ...version,
      versionId: createId(),
      projectId,
      snapshot: remapSnapshot(version.snapshot),
    })),
  };
}

export function sortProjects(
  projects: readonly ProjectListItem[],
  sortBy: ProjectSort,
): ProjectListItem[] {
  return [...projects].sort((left, right) => {
    if (sortBy === "title") {
      return left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
    }
    return right[sortBy].localeCompare(left[sortBy]);
  });
}
