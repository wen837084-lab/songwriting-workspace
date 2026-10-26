import type { AudioAssetRepository } from "../ports/audio-asset-repository";
import type { ProjectRepository } from "../ports/project-repository";
import type { SongProject } from "../../domain/project/project";
import { referencedAudioAssetIds } from "../../domain/project/versions";
import { PersistenceError, ProjectNotFoundError } from "../../infrastructure/persistence/errors";

export class VersionService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly audioAssets: AudioAssetRepository,
  ) {}

  async deleteVersion(projectId: string, versionId: string): Promise<SongProject> {
    const before = this.requireProject(projectId);
    const version = before.versions.find((item) => item.versionId === versionId);
    if (!version) throw new PersistenceError(`Version ${versionId} was not found in this project.`);
    const candidates = new Set(version.snapshot.melody.takes.map((take) => take.audioAssetId));
    this.projects.deleteVersion(projectId, versionId);
    const updated = this.requireProject(projectId);
    const referenced = referencedAudioAssetIds(updated);
    for (const audioAssetId of candidates) {
      if (!referenced.has(audioAssetId)) await this.audioAssets.delete(projectId, audioAssetId);
    }
    return updated;
  }

  async restoreVersion(projectId: string, versionId: string, createBackup: boolean): Promise<SongProject> {
    this.requireProject(projectId);
    const assets = await this.audioAssets.listByProject(projectId);
    const updated = this.projects.restoreVersion(projectId, versionId, createBackup);
    const referenced = referencedAudioAssetIds(updated);
    for (const asset of assets) {
      if (!referenced.has(asset.audioAssetId)) {
        await this.audioAssets.delete(projectId, asset.audioAssetId);
      }
    }
    return updated;
  }

  private requireProject(projectId: string): SongProject {
    const project = this.projects.get(projectId);
    if (!project) throw new ProjectNotFoundError(projectId);
    return project;
  }
}
