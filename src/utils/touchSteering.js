// clientX and the surface bounds use viewport CSS pixels, including any inset.
// Captured pointers outside the bounds keep the side of their nearest edge.
export function getSteeringSide(clientX, rect) {
  if (!Number.isFinite(clientX) || !Number.isFinite(rect?.left)
    || !Number.isFinite(rect?.width) || rect.width <= 0) return null;
  const midpoint = rect.left + rect.width / 2;
  if (!Number.isFinite(midpoint)) return null;
  return clientX < midpoint ? 'left' : 'right';
}
