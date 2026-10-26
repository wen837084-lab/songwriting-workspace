import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import type { AudioAsset } from "../src/application/ports/audio-asset-repository";
import { IndexedDbAudioAssetRepository } from "../src/infrastructure/persistence/indexed-db-audio-asset-repository";
import {
  CURRENT_SCHEMA_VERSION,
  LocalProjectRepository,
} from "../src/infrastructure/persistence/local-project-repository";
import type { KeyValueStorage } from "../src/infrastructure/persistence/storage";

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();

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

test("Desktop Step 4 keeps schema v15 project data across repository restarts", () => {
  const storage = new MemoryStorage();
  const firstRun = new LocalProjectRepository(storage, {
    now: () => "2026-09-21T00:00:00.000Z",
    createId: () => "desktop-project",
  });
  const project = firstRun.create({ title: "Persistent desktop song" });
  firstRun.update(project.projectId, { projectNote: "Survives a full app restart" });

  const restarted = new LocalProjectRepository(storage, {
    now: () => "2026-09-21T01:00:00.000Z",
  });
  assert.equal(restarted.get(project.projectId)?.projectNote, "Survives a full app restart");
  assert.equal(
    JSON.parse(storage.getItem("songwriting-workspace:meta") ?? "{}").schemaVersion,
    CURRENT_SCHEMA_VERSION,
  );
});

test("Desktop Step 4 persists IndexedDB audio Blobs across repository restarts", async () => {
  const databaseFactory = new IDBFactory();
  const databaseName = "desktop-step-4-audio";
  const firstRun = new IndexedDbAudioAssetRepository(databaseFactory, databaseName);
  const asset: AudioAsset = {
    audioAssetId: "audio-1",
    projectId: "project-1",
    takeId: "take-1",
    sectionId: "section-1",
    mimeType: "audio/webm",
    size: 11,
    createdAt: "2026-09-21T00:00:00.000Z",
    blob: new Blob(["hello audio"], { type: "audio/webm" }),
  };

  await firstRun.put(asset);
  const restarted = new IndexedDbAudioAssetRepository(databaseFactory, databaseName);
  const restored = await restarted.get(asset.projectId, asset.audioAssetId);

  assert.ok(restored);
  assert.equal(restored.blob.type, "audio/webm");
  assert.equal(await restored.blob.text(), "hello audio");
  assert.deepEqual(
    (await restarted.listBySection(asset.projectId, asset.sectionId)).map(({ audioAssetId }) => audioAssetId),
    [asset.audioAssetId],
  );
  await assert.rejects(() => restarted.get("another-project", asset.audioAssetId), /does not belong/i);

  await restarted.deleteByProject(asset.projectId);
  assert.equal(await restarted.get(asset.projectId, asset.audioAssetId), null);
});
