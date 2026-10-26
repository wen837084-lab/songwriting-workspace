export interface AudioAsset {
  audioAssetId: string;
  projectId: string;
  takeId: string;
  sectionId: string;
  mimeType: string;
  size: number;
  createdAt: string;
  blob: Blob;
}

export interface AudioAssetRepository {
  put(asset: AudioAsset): Promise<void>;
  get(projectId: string, audioAssetId: string): Promise<AudioAsset | null>;
  listByProject(projectId: string): Promise<AudioAsset[]>;
  listBySection(projectId: string, sectionId: string): Promise<AudioAsset[]>;
  delete(projectId: string, audioAssetId: string): Promise<void>;
  deleteByProject(projectId: string): Promise<void>;
  deleteBySection(projectId: string, sectionId: string): Promise<void>;
}
