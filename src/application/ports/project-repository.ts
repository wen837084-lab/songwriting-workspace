import type {
  ArrangementCell,
  ArrangementTrack,
  AddGarageBandExperimentInput,
  AddMaterialInput,
  AddArrangementTrackInput,
  AddLyricsSectionInput,
  AddMelodyTakeInput,
  AnswerExploreInput,
  CreateHarmonyProgressionInput,
  CreateProjectInput,
  GarageBandExperiment,
  HarmonyKey,
  IdeaStartingPoint,
  Material,
  LyricsSection,
  MelodyTake,
  ProjectCreationMode,
  ProjectListItem,
  ProjectStage,
  ProjectStatus,
  SaveVersionInput,
  SetLineReflectionInput,
  SongVersion,
  SongProject,
  SongIntentCheckOption,
  UpdateMaterialInput,
  UpdateArrangementCellInput,
  UpdateArrangementTrackInput,
  UpdateLyricsSectionInput,
  UpdateMelodyTakeInput,
  UpdateProjectInput,
  UpdateReviewInput,
  UpdateRhythmInput,
  UpdateHarmonyProgressionInput,
  UpdateGarageBandExperimentInput,
  UpdateSongIntentInput,
} from "../../domain/project/project";

export interface ProjectRepository {
  list(status?: ProjectStatus): ProjectListItem[];
  get(projectId: string): SongProject | null;
  create(input: CreateProjectInput): SongProject;
  update(projectId: string, input: UpdateProjectInput): SongProject;
  setCreationMode(projectId: string, mode: ProjectCreationMode): SongProject;
  setCurrentStage(projectId: string, stage: ProjectStage): SongProject;
  setIdeaStartingPoint(projectId: string, startingPoint: IdeaStartingPoint): SongProject;
  answerExplore(projectId: string, input: AnswerExploreInput): SongProject;
  skipExplore(projectId: string, promptId: string, promptIndex: number): SongProject;
  setExplorePromptIndex(projectId: string, promptIndex: number): SongProject;
  addMaterial(projectId: string, input: AddMaterialInput): Material;
  updateMaterial(projectId: string, materialId: string, input: UpdateMaterialInput): Material;
  deleteMaterial(projectId: string, materialId: string): void;
  updateSongIntent(projectId: string, input: UpdateSongIntentInput): SongProject;
  initializeGuidedLyrics(projectId: string): SongProject;
  addLyricsSection(projectId: string, input: AddLyricsSectionInput): LyricsSection;
  updateLyricsSection(projectId: string, sectionId: string, input: UpdateLyricsSectionInput): LyricsSection;
  duplicateLyricsSection(projectId: string, sectionId: string): LyricsSection;
  deleteLyricsSection(projectId: string, sectionId: string): void;
  addGarageBandExperiment(projectId: string, input: AddGarageBandExperimentInput): GarageBandExperiment;
  updateGarageBandExperiment(
    projectId: string,
    experimentId: string,
    input: UpdateGarageBandExperimentInput,
  ): GarageBandExperiment;
  deleteGarageBandExperiment(projectId: string, experimentId: string): void;
  moveLyricsSection(projectId: string, sectionId: string, targetIndex: number): SongProject;
  setMelodyNotes(projectId: string, sectionId: string, notes: string): SongProject;
  addMelodyTake(projectId: string, input: AddMelodyTakeInput): MelodyTake;
  updateMelodyTake(projectId: string, takeId: string, input: UpdateMelodyTakeInput): MelodyTake;
  setMelodyTakeSelected(projectId: string, takeId: string, selected: boolean): SongProject;
  deleteMelodyTake(projectId: string, takeId: string): void;
  updateRhythm(projectId: string, input: UpdateRhythmInput): SongProject;
  addArrangementTrack(projectId: string, input: AddArrangementTrackInput): ArrangementTrack;
  updateArrangementTrack(
    projectId: string,
    trackId: string,
    input: UpdateArrangementTrackInput,
  ): ArrangementTrack;
  deleteArrangementTrack(projectId: string, trackId: string): void;
  updateArrangementCell(
    projectId: string,
    sectionId: string,
    trackId: string,
    input: UpdateArrangementCellInput,
  ): ArrangementCell | null;
  setHarmonyKey(projectId: string, key: HarmonyKey | null): SongProject;
  setHarmonyNotes(projectId: string, chordNotes: string): SongProject;
  createHarmonyProgression(projectId: string, input: CreateHarmonyProgressionInput): SongProject;
  updateHarmonyProgression(
    projectId: string,
    progressionId: string,
    input: UpdateHarmonyProgressionInput,
  ): SongProject;
  deleteHarmonyProgression(projectId: string, progressionId: string): SongProject;
  setLineReflection(projectId: string, input: SetLineReflectionInput): SongProject;
  setSectionEmotion(projectId: string, sectionId: string, emotion: string): SongProject;
  setSongIntentCheck(projectId: string, value: SongIntentCheckOption | null): SongProject;
  updateReview(projectId: string, input: UpdateReviewInput): SongProject;
  updateOpenQuestions(projectId: string, questions: string[]): SongProject;
  saveVersion(projectId: string, input?: SaveVersionInput): SongVersion;
  duplicateVersion(projectId: string, versionId: string): SongVersion;
  renameVersion(projectId: string, versionId: string, label: string): SongVersion;
  deleteVersion(projectId: string, versionId: string): void;
  restoreVersion(projectId: string, versionId: string, createBackup: boolean): SongProject;
  rename(projectId: string, title: string): SongProject;
  duplicate(sourceProjectId: string): SongProject;
  archive(projectId: string): SongProject;
  unarchive(projectId: string): SongProject;
  delete(projectId: string): void;
}
