// Picks the grade (or comment) band a percentage belongs to.
// Schools enter bands as whole numbers (e.g. 30 to 39, then 40 to 49), but real percentages
// have decimals (e.g. 39.5 or 49.5 for a score of 99 out of 200). Matching strictly on min and max
// leaves those in-between values with no band, which showed as a dash on the report card.
// So a band covers everything from its own minimum up to the next band's minimum.
export type Band = { min_score: number | string; max_score: number | string; [key: string]: any };

export function pickBand<T extends Band>(bands: T[] | null | undefined, percent: number): T | null {
  const list = (bands || []).filter(b => !isNaN(Number(b.min_score)) && !isNaN(Number(b.max_score)));
  if (list.length === 0 || isNaN(percent)) {
    return null;
  }
  const sorted = list.slice().sort((a, b) => Number(b.min_score) - Number(a.min_score));
  const top = Number(sorted[0].max_score);
  const bottom = Number(sorted[sorted.length - 1].min_score);
  // A score above the highest band (or below the lowest) belongs to that end band.
  if (percent > top) {
    return sorted[0];
  }
  if (percent < bottom) {
    return sorted[sorted.length - 1];
  }
  return sorted.find(b => percent >= Number(b.min_score)) || null;
}
