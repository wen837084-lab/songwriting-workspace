import type { LyricsSection, SongProject } from "../../domain/project/project";

export interface SongMapSectionStatuses {
  lyrics: string;
  melody: string;
  harmony: string;
  arrangement: string;
}

export function getSongMapSectionStatuses(
  project: SongProject,
  section: LyricsSection,
): SongMapSectionStatuses {
  const melodyNotes = project.melody.notesBySection[section.sectionId]?.trim();
  const takeCount = project.melody.takes.filter((take) => take.sectionId === section.sectionId).length;
  const harmonyCount = project.harmony.progressions.filter(
    (progression) => progression.sectionId === section.sectionId,
  ).length;
  const hasArrangementData = project.arrangement.cells.some(
    (cell) => cell.sectionId === section.sectionId,
  );

  return {
    lyrics: section.userLyrics.trim() ? "已有歌词" : "暂无歌词",
    melody: melodyNotes && takeCount > 0
      ? `备注 + ${takeCount} 个 Take`
      : melodyNotes
        ? "已有备注"
        : takeCount > 0
          ? `${takeCount} 个 Take`
          : "暂无 Melody 数据",
    harmony: harmonyCount > 0
      ? `已保存 ${harmonyCount} 个和弦进行`
      : "暂无和弦进行",
    arrangement: hasArrangementData ? "已有 Arrangement 数据" : "尚未开始",
  };
}
