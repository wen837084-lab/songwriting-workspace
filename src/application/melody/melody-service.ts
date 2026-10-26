import type {
  AudioAsset,
  AudioAssetRepository,
} from "../ports/audio-asset-repository";
import type { ProjectRepository } from "../ports/project-repository";
import type {
  MelodyTake,
  SongProject,
  UpdateMelodyTakeInput,
} from "../../domain/project/project";
import { PersistenceError, ProjectNotFoundError } from "../../infrastructure/persistence/errors";
import { referencedAudioAssetIds } from "../../domain/project/versions";

interface MelodyServiceOptions {
  now?: () => string;
  createId?: () => string;
}

export class MelodyService {
  private readonly now: () => string;
  private readonly createId: () => string;

  constructor(
    private readonly projects: ProjectRepository,
    private readonly audioAssets: AudioAssetRepository,
    options: MelodyServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? (() => crypto.randomUUID());
  }

  async createTake(
    projectId: string,
    sectionId: string,
    blob: Blob,
    durationMs: number | null,
  ): Promise<MelodyTake> {
    if (blob.size === 0) throw new PersistenceError("The recording was empty and was not saved.");
    const project = this.requireProject(projectId);
    this.requireSection(project, sectionId);
    const audioAssetId = this.createId();
    const count = project.melody.takes.filter((take) => take.sectionId === sectionId).length;
    const take = this.projects.addMelodyTake(projectId, {
      sectionId,
      audioAssetId,
      name: `Take ${count + 1}`,
      mimeType: blob.type || "audio/webm",
      durationMs,
    });
    const asset: AudioAsset = {
      audioAssetId,
      projectId,
      takeId: take.takeId,
      sectionId,
      mimeType: take.mimeType,
      size: blob.size,
      createdAt: this.now(),
      blob,
    };
    try {
      await this.audioAssets.put(asset);
      return take;
    } catch (error) {
      this.projects.deleteMelodyTake(projectId, take.takeId);
      throw error;
    }
  }

  updateTake(projectId: string, takeId: string, input: UpdateMelodyTakeInput): MelodyTake {
    return this.projects.updateMelodyTake(projectId, takeId, input);
  }

  setSectionNotes(projectId: string, sectionId: string, notes: string): SongProject {
    return this.projects.setMelodyNotes(projectId, sectionId, notes);
  }

  async loadAudio(projectId: string, takeId: string): Promise<Blob> {
    const project = this.requireProject(projectId);
    const take = this.requireTake(project, takeId);
    const asset = await this.audioAssets.get(projectId, take.audioAssetId);
    if (!asset || asset.takeId !== takeId || asset.sectionId !== take.sectionId) {
      throw new PersistenceError("This take's recorded audio is missing or has invalid ownership.");
    }
    return asset.blob;
  }

  async deleteTake(projectId: string, takeId: string): Promise<void> {
    const project = this.requireProject(projectId);
    const take = this.requireTake(project, takeId);
    this.projects.deleteMelodyTake(projectId, takeId);
    const updated = this.requireProject(projectId);
    if (!referencedAudioAssetIds(updated).has(take.audioAssetId)) {
      await this.audioAssets.delete(projectId, take.audioAssetId);
    }
  }

  async deleteSection(projectId: string, sectionId: string): Promise<void> {
    const project = this.requireProject(projectId);
    this.requireSection(project, sectionId);
    const assets = await this.audioAssets.listBySection(projectId, sectionId);
    this.projects.deleteLyricsSection(projectId, sectionId);
    const referenced = referencedAudioAssetIds(this.requireProject(projectId));
    for (const asset of assets) {
      if (!referenced.has(asset.audioAssetId)) {
        await this.audioAssets.delete(projectId, asset.audioAssetId);
      }
    }
  }

  async duplicateProject(sourceProjectId: string): Promise<SongProject> {
    const source = this.requireProject(sourceProjectId);
    const duplicate = this.projects.duplicate(sourceProjectId);
    const copiedAssets: AudioAsset[] = [];
    try {
      const sourceTakes = [
        ...source.melody.takes,
        ...source.versions.flatMap((version) => version.snapshot.melody.takes),
      ];
      const copiedTakes = [
        ...duplicate.melody.takes,
        ...duplicate.versions.flatMap((version) => version.snapshot.melody.takes),
      ];
      const copiedAudioIds = new Set<string>();
      for (let index = 0; index < sourceTakes.length; index += 1) {
        const sourceTake = sourceTakes[index];
        const copiedTake = copiedTakes[index];
        if (copiedTake && copiedAudioIds.has(copiedTake.audioAssetId)) continue;
        const sourceAsset = await this.audioAssets.get(sourceProjectId, sourceTake.audioAssetId);
        if (!sourceAsset || !copiedTake) {
          throw new PersistenceError("A source recording is missing, so the project copy was not kept.");
        }
        const copiedAsset: AudioAsset = {
          ...sourceAsset,
          audioAssetId: copiedTake.audioAssetId,
          projectId: duplicate.projectId,
          takeId: copiedTake.takeId,
          sectionId: copiedTake.sectionId,
          createdAt: this.now(),
          blob: sourceAsset.blob.slice(0, sourceAsset.blob.size, sourceAsset.mimeType),
        };
        await this.audioAssets.put(copiedAsset);
        copiedAssets.push(copiedAsset);
        copiedAudioIds.add(copiedTake.audioAssetId);
      }
      return duplicate;
    } catch (error) {
      await Promise.all(copiedAssets.map((asset) =>
        this.audioAssets.delete(duplicate.projectId, asset.audioAssetId)
      ));
      this.projects.delete(duplicate.projectId);
      throw error;
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    this.requireProject(projectId);
    const assets = await this.audioAssets.listByProject(projectId);
    await this.audioAssets.deleteByProject(projectId);
    try {
      this.projects.delete(projectId);
    } catch (error) {
      await Promise.all(assets.map((asset) => this.audioAssets.put(asset)));
      throw error;
    }
  }

  private requireProject(projectId: string): SongProject {
    const project = this.projects.get(projectId);
    if (!project) throw new ProjectNotFoundError(projectId);
    return project;
  }

  private requireSection(project: SongProject, sectionId: string): void {
    if (!project.lyrics.sections.some((section) => section.sectionId === sectionId)) {
      throw new PersistenceError(`Lyrics section ${sectionId} was not found in this project.`);
    }
  }

  private requireTake(project: SongProject, takeId: string): MelodyTake {
    const take = project.melody.takes.find((item) => item.takeId === takeId);
    if (!take || take.projectId !== project.projectId) {
      throw new PersistenceError(`Melody take ${takeId} was not found in this project.`);
    }
    return take;
  }
}
