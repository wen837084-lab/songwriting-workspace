export interface RepetitionCount {
  term: string;
  count: number;
}

export function countRepeatedTerms(text: string): RepetitionCount[] {
  const counts = new Map<string, number>();
  const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });

  for (const segment of segmenter.segment(text.normalize("NFKC").toLocaleLowerCase())) {
    if (!segment.isWordLike) continue;
    const term = segment.segment.trim();
    if (!term) continue;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([term, count]) => ({ term, count }))
    .sort((left, right) => right.count - left.count || left.term.localeCompare(right.term));
}
