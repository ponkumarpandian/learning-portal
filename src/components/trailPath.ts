/** Cubic segments with vertical tangents through the stone centres (`C x0,my x1,my x1,y1`). */
export function trailPath(pts: ReadonlyArray<readonly [number, number]>): string {
  return pts
    .map(([x, y], i) => {
      if (i === 0) return `M${x} ${y}`;
      const prev = pts[i - 1]!;
      const my = (prev[1] + y) / 2;
      return `C${prev[0]} ${my} ${x} ${my} ${x} ${y}`;
    })
    .join(' ');
}
