/**
 * Which bar-chart x labels to paint. Dense weekly charts squash SVG text
 * when preserveAspectRatio="none"; callers still pass every label and we
 * pick a readable subset (edges + current + every nth).
 */
export function shouldShowAxisLabel(
  index: number,
  count: number,
  currentIndex?: number,
): boolean {
  if (count <= 10) return true;
  if (index === 0 || index === count - 1) return true;
  if (currentIndex != null && index === currentIndex) return true;
  const step = count > 20 ? 4 : 2;
  if (index % step !== 0) return false;
  if (currentIndex != null && Math.abs(index - currentIndex) === 1) return false;
  return true;
}
