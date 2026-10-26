import type {
  AudioAsset,
  AudioAssetRepository,
} from "../../application/ports/audio-asset-repository";
import { PersistenceError } from "./errors";

const DATABASE_NAME = "songwriting-workspace-audio";
const DATABASE_VERSION = 1;
const STORE_NAME = "audio-assets";
const PROJECT_INDEX = "by-project";
const PROJECT_SECTION_INDEX = "by-project-section";

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });
}

export class IndexedDbAudioAssetRepository implements AudioAssetRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly databaseFactory: IDBFactory | undefined = globalThis.indexedDB,
    private readonly databaseName = DATABASE_NAME,
  ) {}

  async put(asset: AudioAsset): Promise<void> {
    this.assertAsset(asset);
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(asset);
    await this.complete(transaction, "save recorded audio");
  }

  async get(projectId: string, audioAssetId: string): Promise<AudioAsset | null> {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const [result] = await Promise.all([
      requestResult(
        transaction.objectStore(STORE_NAME).get(audioAssetId) as IDBRequest<AudioAsset | undefined>,
      ),
      this.complete(transaction, "read recorded audio"),
    ]);
    if (!result) return null;
    if (result.projectId !== projectId) {
      throw new PersistenceError("Recorded audio does not belong to this project.");
    }
    return result;
  }

  async listByProject(projectId: string): Promise<AudioAsset[]> {
    return this.listByIndex(PROJECT_INDEX, projectId);
  }

  async listBySection(projectId: string, sectionId: string): Promise<AudioAsset[]> {
    return this.listByIndex(PROJECT_SECTION_INDEX, [projectId, sectionId]);
  }

  async delete(projectId: string, audioAssetId: string): Promise<void> {
    const existing = await this.get(projectId, audioAssetId);
    if (!existing) return;
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(audioAssetId);
    await this.complete(transaction, "delete recorded audio");
  }

  async deleteByProject(projectId: string): Promise<void> {
    await this.deleteAssets(await this.listByProject(projectId));
  }

  async deleteBySection(projectId: string, sectionId: string): Promise<void> {
    await this.deleteAssets(await this.listBySection(projectId, sectionId));
  }

  private async listByIndex(indexName: string, key: IDBValidKey): Promise<AudioAsset[]> {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const [results] = await Promise.all([
      requestResult(
        transaction.objectStore(STORE_NAME).index(indexName).getAll(key) as IDBRequest<AudioAsset[]>,
      ),
      this.complete(transaction, "list recorded audio"),
    ]);
    return results;
  }

  private async deleteAssets(assets: readonly AudioAsset[]): Promise<void> {
    if (assets.length === 0) return;
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    for (const asset of assets) store.delete(asset.audioAssetId);
    await this.complete(transaction, "clean up recorded audio");
  }

  private open(): Promise<IDBDatabase> {
    if (!this.databaseFactory) {
      return Promise.reject(new PersistenceError("This browser does not support local audio storage."));
    }
    const databaseFactory = this.databaseFactory;
    if (!this.databasePromise) {
      const opening = new Promise<IDBDatabase>((resolve, reject) => {
        const request = databaseFactory.open(this.databaseName, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          const store = database.objectStoreNames.contains(STORE_NAME)
            ? request.transaction!.objectStore(STORE_NAME)
            : database.createObjectStore(STORE_NAME, { keyPath: "audioAssetId" });
          if (!store.indexNames.contains(PROJECT_INDEX)) {
            store.createIndex(PROJECT_INDEX, "projectId", { unique: false });
          }
          if (!store.indexNames.contains(PROJECT_SECTION_INDEX)) {
            store.createIndex(PROJECT_SECTION_INDEX, ["projectId", "sectionId"], { unique: false });
          }
        };
        request.onsuccess = () => {
          request.result.onversionchange = () => {
            request.result.close();
            this.databasePromise = null;
          };
          resolve(request.result);
        };
        request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB."));
        request.onblocked = () => reject(new Error("Audio storage upgrade is blocked by another tab."));
      }).catch((error): never => {
        this.databasePromise = null;
        throw new PersistenceError("Local audio storage could not be opened. No project data was changed.", { cause: error });
      });
      this.databasePromise = opening;
    }
    return this.databasePromise!;
  }

  private async complete(transaction: IDBTransaction, action: string): Promise<void> {
    try {
      await transactionDone(transaction);
    } catch (error) {
      throw new PersistenceError(`Could not ${action}. No project data was changed.`, { cause: error });
    }
  }

  private assertAsset(asset: AudioAsset): void {
    if (
      !asset.audioAssetId || !asset.projectId || !asset.takeId || !asset.sectionId ||
      !asset.mimeType || !(asset.blob instanceof Blob) || asset.size !== asset.blob.size
    ) {
      throw new PersistenceError("Recorded audio is incomplete and was not saved.");
    }
  }
}
