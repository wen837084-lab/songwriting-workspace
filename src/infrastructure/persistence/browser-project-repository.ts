import type { ProjectRepository } from "../../application/ports/project-repository";
import type { WorkspaceRepository } from "../../application/ports/workspace-repository";
import { LocalProjectRepository } from "./local-project-repository";
import { LocalWorkspaceRepository } from "./local-workspace-repository";
import { LocalStorageAdapter } from "./storage";
import { IndexedDbAudioAssetRepository } from "./indexed-db-audio-asset-repository";
import { MelodyService } from "../../application/melody/melody-service";
import { VersionService } from "../../application/versions/version-service";

let browserAudioAssets: IndexedDbAudioAssetRepository | null = null;

export function createBrowserProjectRepository(): ProjectRepository {
  return new LocalProjectRepository(new LocalStorageAdapter(window.localStorage));
}

export function createBrowserWorkspaceRepository(): WorkspaceRepository {
  return new LocalWorkspaceRepository(new LocalStorageAdapter(window.localStorage));
}

export function createBrowserMelodyService(): MelodyService {
  browserAudioAssets ??= new IndexedDbAudioAssetRepository();
  return new MelodyService(
    createBrowserProjectRepository(),
    browserAudioAssets,
  );
}

export function createBrowserVersionService(): VersionService {
  browserAudioAssets ??= new IndexedDbAudioAssetRepository();
  return new VersionService(createBrowserProjectRepository(), browserAudioAssets);
}
