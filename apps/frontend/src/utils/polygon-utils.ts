export interface PolygonPoint {
  x: number;
  y: number;
}

function distance(first: PolygonPoint, second: PolygonPoint): number {
  return Math.sqrt((second.x - first.x) ** 2 + (second.y - first.y) ** 2);
}

export function nearestPointOnSegment(p: PolygonPoint, a: PolygonPoint, b: PolygonPoint): PolygonPoint {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const lengthSquared = ab.x ** 2 + ab.y ** 2;
  if (lengthSquared === 0) return a;

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / lengthSquared));

  return {
    x: a.x + ab.x * t,
    y: a.y + ab.y * t,
  };
}

export function nearestPointOnPolygonBoundary(p: PolygonPoint, poly: PolygonPoint[]): PolygonPoint {
  if (poly.length === 0) return p;

  let nearest = poly[0]!;
  let nearestDistance = Infinity;

  for (let i = 0; i < poly.length; i++) {
    const candidate = nearestPointOnSegment(p, poly[i]!, poly[(i + 1) % poly.length]!);
    const candidateDistance = distance(p, candidate);

    if (candidateDistance < nearestDistance) {
      nearest = candidate;
      nearestDistance = candidateDistance;
    }
  }

  return nearest;
}

export function pointInPolygon(p: PolygonPoint, poly: PolygonPoint[]): boolean {
  if (poly.length < 3) return false;

  for (let i = 0; i < poly.length; i++) {
    if (distance(p, nearestPointOnSegment(p, poly[i]!, poly[(i + 1) % poly.length]!)) < 0.0001) {
      return true;
    }
  }

  let inside = false;

  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const current = poly[i]!;
    const previous = poly[j]!;
    const intersects = ((current.y > p.y) !== (previous.y > p.y))
      && p.x < ((previous.x - current.x) * (p.y - current.y)) / (previous.y - current.y) + current.x;

    if (intersects) inside = !inside;
  }

  return inside;
}
