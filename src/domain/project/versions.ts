import type {
  SongProject,
  SongVersion,
  VersionSnapshot,
} from "./project";

export type VersionDifferenceKind =
  | "lyrics"
  | "sections"
  | "rhythm"
  | "harmony"
  | "arrangement"
  | "melody"
  | "notes"
  | "open-questions";

export interface VersionDifference {
  kind: VersionDifferenceKind;
  label: string;
  detail: string;
}

export function createVersionSnapshot(project: SongProject): VersionSnapshot {
  return structuredClone({
    projectId: project.projectId,
    projectNote: project.projectNote,
    lyrics: project.lyrics,
    melody: project.melody,
    rhythm: project.rhythm,
    harmony: project.harmony,
    arrangement: project.arrangement,
    reflection: project.reflection,
    openQuestions: project.openQuestions,
  });
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function compareVersions(left: SongVersion, right: SongVersion): VersionDifference[] {
  const differences: VersionDifference[] = [];
  const leftSections = left.snapshot.lyrics.sections;
  const rightSections = right.snapshot.lyrics.sections;
  const leftSectionShape = leftSections.map(({ sectionId, name, order, bars }) => ({ sectionId, name, order, bars }));
  const rightSectionShape = rightSections.map(({ sectionId, name, order, bars }) => ({ sectionId, name, order, bars }));
  if (!equal(leftSectionShape, rightSectionShape)) {
    const added = rightSections.filter((section) => !leftSections.some((item) => item.sectionId === section.sectionId)).length;
    const removed = leftSections.filter((section) => !rightSections.some((item) => item.sectionId === section.sectionId)).length;
    differences.push({
      kind: "sections",
      label: "Song sections changed",
      detail: `${added} added, ${removed} removed; names, order, or bars may also differ.`,
    });
  }
  if (!equal(leftSections.map((section) => [section.sectionId, section.userLyrics]), rightSections.map((section) => [section.sectionId, section.userLyrics]))) {
    differences.push({ kind: "lyrics", label: "Lyrics changed", detail: "One or more section lyric fields differ." });
  }
  if (left.snapshot.rhythm.bpm !== right.snapshot.rhythm.bpm) {
    differences.push({ kind: "rhythm", label: "BPM changed", detail: `${left.snapshot.rhythm.bpm} → ${right.snapshot.rhythm.bpm}` });
  }
  if (left.snapshot.rhythm.timeSignature !== right.snapshot.rhythm.timeSignature) {
    differences.push({ kind: "rhythm", label: "Time signature changed", detail: `${left.snapshot.rhythm.timeSignature} → ${right.snapshot.rhythm.timeSignature}` });
  }
  if (!equal(left.snapshot.harmony, right.snapshot.harmony)) {
    differences.push({ kind: "harmony", label: "Harmony changed", detail: "Key, chord notes, or a user-created progression differs." });
  }
  if (!equal(left.snapshot.arrangement, right.snapshot.arrangement)) {
    differences.push({ kind: "arrangement", label: "Arrangement changed", detail: "Tracks or arrangement cells differ." });
  }
  if (!equal(left.snapshot.melody.selectedTakeIds, right.snapshot.melody.selectedTakeIds)) {
    differences.push({ kind: "melody", label: "Melody Take selection changed", detail: "The selected Take references differ." });
  } else {
    const leftSelectedTakes = left.snapshot.melody.takes.filter((take) => left.snapshot.melody.selectedTakeIds.includes(take.takeId));
    const rightSelectedTakes = right.snapshot.melody.takes.filter((take) => right.snapshot.melody.selectedTakeIds.includes(take.takeId));
    if (!equal(leftSelectedTakes, rightSelectedTakes)) {
      differences.push({ kind: "melody", label: "Selected Melody Take metadata changed", detail: "A selected Take name, note, status, or recording reference differs." });
    }
  }
  const leftNotes = {
    projectNote: left.snapshot.projectNote,
    sectionNotes: leftSections.map((section) => [section.sectionId, section.notes]),
    melodyNotes: left.snapshot.melody.notesBySection,
    rhythmNotes: left.snapshot.rhythm.notes,
    chordNotes: left.snapshot.harmony.chordNotes,
  };
  const rightNotes = {
    projectNote: right.snapshot.projectNote,
    sectionNotes: rightSections.map((section) => [section.sectionId, section.notes]),
    melodyNotes: right.snapshot.melody.notesBySection,
    rhythmNotes: right.snapshot.rhythm.notes,
    chordNotes: right.snapshot.harmony.chordNotes,
  };
  if (!equal(leftNotes, rightNotes)) {
    differences.push({ kind: "notes", label: "Notes changed", detail: "Project, section, melody, rhythm, or harmony notes differ." });
  }
  if (!equal(left.snapshot.openQuestions, right.snapshot.openQuestions)) {
    differences.push({ kind: "open-questions", label: "Open Questions changed", detail: "The saved questions differ." });
  }
  return differences;
}

export function referencedAudioAssetIds(project: SongProject): Set<string> {
  const ids = new Set(project.melody.takes.map((take) => take.audioAssetId));
  for (const version of project.versions) {
    for (const take of version.snapshot.melody.takes) ids.add(take.audioAssetId);
  }
  return ids;
}
