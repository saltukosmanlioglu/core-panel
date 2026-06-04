import type {
  AdministrativeItem,
  ParcelCalculation,
  Point,
  TKGMParcelResult,
} from '@/services/parcel-calculations/types';
import type { EdgeRole, ParcelResultWithVertices } from './types';

export const stepLabels = [
  'Parsel Sorgula',
  'Belgeler & Analiz',
  'Cephe & Çekmeler',
  'İmar Özeti',
  'Sonuç',
];

export const coverageRatioOptions = [0.2, 0.3, 0.4] as const;

export const numberFormatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const edgeRoleOptions: Array<{
  role: EdgeRole;
  label: string;
  color: string;
}> = [
  { role: 'front', label: 'Yol', color: '#1565c0' },
  { role: 'side', label: 'Yan', color: '#2e7d32' },
  { role: 'back', label: 'Arka', color: '#e65100' },
  { role: 'inactive', label: 'Pasif', color: '#757575' },
];

export const queryFieldStyle = {
  '& .MuiInputLabel-root': {
    fontSize: '0.9rem',
  },
  '& .MuiOutlinedInput-root': {
    borderRadius: '4px',
  },
} as const;

export function formatArea(value: number | null | undefined): string {
  return `${numberFormatter.format(value ?? 0)} m²`;
}

export function makeOverhangs(floorCount: number, overhangValues: number[]) {
  return Array.from({ length: floorCount }, (_, index) => ({
    floor: index + 1,
    front: index === 0 ? 0 : (overhangValues[0] ?? 0),
    back: index === 0 ? 0 : (overhangValues[2] ?? overhangValues[0] ?? 0),
    left: index === 0 ? 0 : (overhangValues[3] ?? overhangValues[1] ?? 0),
    right: index === 0 ? 0 : (overhangValues[1] ?? 0),
  }));
}

export function calculateFootprintLocal(
  vertices: Point[],
  edgeSetbacksPerEdge: number[],
  edgeRoles: EdgeRole[],
  activeEdges?: boolean[],
): Point[] {
  if (vertices.length < 3) return [];

  const centimetersPerMeter = 100;

  function round(value: number, precision = 4): number {
    const multiplier = 10 ** precision;
    return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
  }

  function distance(first: Point, second: Point): number {
    return Math.sqrt((second.x - first.x) ** 2 + (second.y - first.y) ** 2);
  }

  function signedArea(points: Point[]): number {
    let area = 0;

    for (let index = 0; index < points.length; index++) {
      const nextIndex = (index + 1) % points.length;
      area += points[index]!.x * points[nextIndex]!.y;
      area -= points[nextIndex]!.x * points[index]!.y;
    }

    return area / 2;
  }

  function normalizeVector(vector: Point): Point {
    const length = Math.sqrt(vector.x ** 2 + vector.y ** 2);
    if (length === 0) return { x: 0, y: 0 };
    return { x: vector.x / length, y: vector.y / length };
  }

  function normalizedEdgeVector(start: Point, end: Point): Point {
    return normalizeVector({ x: end.x - start.x, y: end.y - start.y });
  }

  function normalizedInwardNormal(start: Point, end: Point, clockwise: boolean): Point {
    const edge = normalizedEdgeVector(start, end);
    return clockwise
      ? { x: edge.y, y: -edge.x }
      : { x: -edge.y, y: edge.x };
  }

  function lineIntersection(a: Point, directionA: Point, b: Point, directionB: Point): Point | null {
    const cross = directionA.x * directionB.y - directionA.y * directionB.x;
    if (Math.abs(cross) < 0.000001) return null;

    const delta = { x: b.x - a.x, y: b.y - a.y };
    const t = (delta.x * directionB.y - delta.y * directionB.x) / cross;

    return {
      x: a.x + directionA.x * t,
      y: a.y + directionA.y * t,
    };
  }

  function nearestPointOnSegment(point: Point, start: Point, end: Point): Point {
    const segment = { x: end.x - start.x, y: end.y - start.y };
    const lengthSquared = segment.x ** 2 + segment.y ** 2;
    if (lengthSquared === 0) return start;

    const projection = Math.max(
      0,
      Math.min(1, ((point.x - start.x) * segment.x + (point.y - start.y) * segment.y) / lengthSquared),
    );

    return {
      x: start.x + segment.x * projection,
      y: start.y + segment.y * projection,
    };
  }

  function pointInPolygon(point: Point, polygon: Point[]): boolean {
    if (polygon.length < 3) return false;

    for (let index = 0; index < polygon.length; index++) {
      if (
        distance(
          point,
          nearestPointOnSegment(point, polygon[index]!, polygon[(index + 1) % polygon.length]!),
        ) < 0.0001
      ) {
        return true;
      }
    }

    let inside = false;

    for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index++) {
      const current = polygon[index]!;
      const previous = polygon[previousIndex]!;
      const intersects = ((current.y > point.y) !== (previous.y > point.y))
        && point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;

      if (intersects) inside = !inside;
    }

    return inside;
  }

  function nearestPointOnPolygonBoundary(point: Point, polygon: Point[]): Point {
    if (polygon.length === 0) return point;

    let nearest = polygon[0]!;
    let nearestDistance = Infinity;

    for (let index = 0; index < polygon.length; index++) {
      const candidate = nearestPointOnSegment(point, polygon[index]!, polygon[(index + 1) % polygon.length]!);
      const candidateDistance = distance(point, candidate);

      if (candidateDistance < nearestDistance) {
        nearest = candidate;
        nearestDistance = candidateDistance;
      }
    }

    return nearest;
  }

  const clockwise = signedArea(vertices) < 0;
  const inset: Point[] = vertices.map((current, index) => {
    const previous = vertices[(index - 1 + vertices.length) % vertices.length]!;
    const next = vertices[(index + 1) % vertices.length]!;
    const previousEdgeIndex = (index - 1 + vertices.length) % vertices.length;
    const nextEdgeIndex = index;

    const previousSetback = (edgeSetbacksPerEdge[previousEdgeIndex] ?? 0) * centimetersPerMeter;
    const nextSetback = (edgeSetbacksPerEdge[nextEdgeIndex] ?? 0) * centimetersPerMeter;

    if (previousSetback === 0 && nextSetback === 0) {
      return { x: round(current.x), y: round(current.y) };
    }

    const previousNormal = normalizedInwardNormal(previous, current, clockwise);
    const nextNormal = normalizedInwardNormal(current, next, clockwise);
    const previousDirection = normalizedEdgeVector(previous, current);
    const nextDirection = normalizedEdgeVector(current, next);

    if (nextSetback === 0) {
      const previousOffset = { x: previousNormal.x * previousSetback, y: previousNormal.y * previousSetback };
      const offsetPreviousStart = { x: previous.x + previousOffset.x, y: previous.y + previousOffset.y };
      const dx = current.x - offsetPreviousStart.x;
      const dy = current.y - offsetPreviousStart.y;
      const dot = dx * previousDirection.x + dy * previousDirection.y;
      return {
        x: round(offsetPreviousStart.x + previousDirection.x * dot),
        y: round(offsetPreviousStart.y + previousDirection.y * dot),
      };
    }

    if (previousSetback === 0) {
      const nextOffset = { x: nextNormal.x * nextSetback, y: nextNormal.y * nextSetback };
      return {
        x: round(current.x + nextOffset.x),
        y: round(current.y + nextOffset.y),
      };
    }

    const previousOffset = { x: previousNormal.x * previousSetback, y: previousNormal.y * previousSetback };
    const nextOffset = { x: nextNormal.x * nextSetback, y: nextNormal.y * nextSetback };

    const miterPoint = lineIntersection(
      { x: previous.x + previousOffset.x, y: previous.y + previousOffset.y },
      previousDirection,
      { x: current.x + nextOffset.x, y: current.y + nextOffset.y },
      nextDirection,
    ) ?? {
      x: current.x + previousOffset.x + nextOffset.x,
      y: current.y + previousOffset.y + nextOffset.y,
    };

    const point = { x: round(miterPoint.x), y: round(miterPoint.y) };
    return pointInPolygon(point, vertices)
      ? point
      : nearestPointOnPolygonBoundary(point, vertices);
  });

  for (let index = 0; index < vertices.length; index++) {
    if (edgeRoles[index] === 'inactive' || activeEdges?.[index] === false) {
      const previousEdgeIndex = (index - 1 + vertices.length) % vertices.length;
      const nextEdgeIndex = (index + 1) % vertices.length;

      const previousSetback = (edgeSetbacksPerEdge[previousEdgeIndex] ?? 0) * centimetersPerMeter;
      const nextSetback = (edgeSetbacksPerEdge[nextEdgeIndex] ?? 0) * centimetersPerMeter;

      if (previousSetback > 0 && nextSetback > 0) {
        const previousPreviousVertex = vertices[(index - 1 + vertices.length) % vertices.length]!;
        const previousVertex = vertices[index]!;
        const nextVertex = vertices[(index + 1) % vertices.length]!;
        const nextNextVertex = vertices[(index + 2) % vertices.length]!;

        const previousNormal = normalizedInwardNormal(previousPreviousVertex, previousVertex, clockwise);
        const nextNormal = normalizedInwardNormal(nextVertex, nextNextVertex, clockwise);
        const previousDirection = normalizedEdgeVector(previousPreviousVertex, previousVertex);
        const nextDirection = normalizedEdgeVector(nextVertex, nextNextVertex);

        const previousOffsetPoint = {
          x: previousPreviousVertex.x + previousNormal.x * previousSetback,
          y: previousPreviousVertex.y + previousNormal.y * previousSetback,
        };
        const nextOffsetPoint = {
          x: nextVertex.x + nextNormal.x * nextSetback,
          y: nextVertex.y + nextNormal.y * nextSetback,
        };

        const intersection = lineIntersection(previousOffsetPoint, previousDirection, nextOffsetPoint, nextDirection);

        if (intersection) {
          const collapsePoint = pointInPolygon(intersection, vertices)
            ? intersection
            : nearestPointOnPolygonBoundary(intersection, vertices);
          inset[index] = { x: round(collapsePoint.x), y: round(collapsePoint.y) };
          inset[(index + 1) % vertices.length] = { x: round(collapsePoint.x), y: round(collapsePoint.y) };
        }
      }
    }
  }

  return inset.map((point) => ({ x: round(point.x), y: round(point.y) }));
}

export function getOverhangVertices(
  footprintVertices: Point[],
  overhangs: number[],
): Point[] | undefined {
  if (footprintVertices.length < 3 || overhangs.every((value) => value <= 0)) return undefined;

  const count = footprintVertices.length;
  const round = (value: number) => Math.round(value * 100) / 100;
  const distance = (first: Point, second: Point) => Math.sqrt((first.x - second.x) ** 2 + (first.y - second.y) ** 2);
  const signedArea = footprintVertices.reduce((sum, point, index) => {
    const next = footprintVertices[(index + 1) % count]!;
    return sum + (point.x * next.y - next.x * point.y);
  }, 0);
  const isCounterClockwise = signedArea > 0;

  function buildOffsetEdges(flip = false): Array<{ pt: Point; dir: Point; collapsed: boolean; overhangCm: number }> {
    return footprintVertices.map((point, index) => {
      const next = footprintVertices[(index + 1) % count]!;
      const dx = next.x - point.x;
      const dy = next.y - point.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const overhangCm = Math.max(0, overhangs[index] ?? 0) * 100;

      if (length < 0.01) {
        return { pt: { x: point.x, y: point.y }, dir: { x: dx, y: dy }, collapsed: true, overhangCm };
      }

      const useRightHandNormal = flip ? !isCounterClockwise : isCounterClockwise;
      const normalX = useRightHandNormal ? dy / length : -dy / length;
      const normalY = useRightHandNormal ? -dx / length : dx / length;
      const offsetPoint = overhangCm <= 0
        ? { x: point.x, y: point.y }
        : { x: point.x + normalX * overhangCm, y: point.y + normalY * overhangCm };

      return {
        pt: offsetPoint,
        dir: { x: dx, y: dy },
        collapsed: false,
        overhangCm,
      };
    });
  }

  function intersectOffsetEdges(offsetEdges: Array<{ pt: Point; dir: Point; collapsed: boolean; overhangCm: number }>): Point[] {
    const result: Point[] = [];

    function lineIntersection(
      previous: { pt: Point; dir: Point; overhangCm: number },
      current: { pt: Point; dir: Point; overhangCm: number },
    ): Point | null {
      const cross = previous.dir.x * current.dir.y - previous.dir.y * current.dir.x;
      if (Math.abs(cross) < 0.000001) return null;

      const delta = { x: current.pt.x - previous.pt.x, y: current.pt.y - previous.pt.y };
      const t = (delta.x * current.dir.y - delta.y * current.dir.x) / cross;
      const intersection = {
        x: previous.pt.x + previous.dir.x * t,
        y: previous.pt.y + previous.dir.y * t,
      };

      const maxDistance = 50000;
      const distanceFromPrevious = distance(intersection, previous.pt);
      const distanceFromCurrent = distance(intersection, current.pt);

      if (distanceFromPrevious > maxDistance && distanceFromCurrent > maxDistance) {
        return {
          x: (previous.pt.x + current.pt.x) / 2,
          y: (previous.pt.y + current.pt.y) / 2,
        };
      }

      return intersection;
    }

    for (let index = 0; index < count; index++) {
      let previousIndex = (index - 1 + count) % count;
      while (offsetEdges[previousIndex]!.collapsed && previousIndex !== index) {
        previousIndex = (previousIndex - 1 + count) % count;
      }

      let currentIndex = index;
      while (offsetEdges[currentIndex]!.collapsed && currentIndex !== previousIndex) {
        currentIndex = (currentIndex + 1) % count;
      }

      const previous = offsetEdges[previousIndex]!;
      const current = offsetEdges[currentIndex]!;

      if (previous.collapsed && current.collapsed) {
        result.push({ x: round(footprintVertices[index]!.x), y: round(footprintVertices[index]!.y) });
        continue;
      }
      if (previousIndex === currentIndex) {
        result.push({ x: round(current.pt.x), y: round(current.pt.y) });
        continue;
      }
      if (previous.collapsed) {
        result.push({ x: round(current.pt.x), y: round(current.pt.y) });
        continue;
      }
      if (current.collapsed) {
        const dx = footprintVertices[index]!.x - previous.pt.x;
        const dy = footprintVertices[index]!.y - previous.pt.y;
        const t = dx * previous.dir.x + dy * previous.dir.y;
        result.push({
          x: round(previous.pt.x + previous.dir.x * t),
          y: round(previous.pt.y + previous.dir.y * t),
        });
        continue;
      }

      const intersection = lineIntersection(previous, current);
      if (!intersection) {
        result.push({ x: round(current.pt.x), y: round(current.pt.y) });
        continue;
      }

      result.push({
        x: round(intersection.x),
        y: round(intersection.y),
      });
    }

    return result;
  }

  const result = intersectOffsetEdges(buildOffsetEdges());
  if (result.length >= 3) return result;

  const flippedResult = intersectOffsetEdges(buildOffsetEdges(true));
  if (flippedResult.length >= 3) return flippedResult;

  return undefined;
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getItemName(items: AdministrativeItem[], id: number | null): string {
  if (!id) return '';
  return items.find((item) => item.id === id)?.name ?? '';
}

export function getParcelVertices(result: TKGMParcelResult | null): Point[] {
  if (!result) return [];
  const extended = result as ParcelResultWithVertices;
  return extended.parcelVertices ?? result.vertices ?? [];
}

export function normalizeParcelResult(result: TKGMParcelResult): TKGMParcelResult {
  const parcelVertices = getParcelVertices(result);
  const normalized: ParcelResultWithVertices = {
    ...result,
    id: result.id ?? '',
    parcelVertices,
    vertices: parcelVertices,
  };

  return normalized;
}

export function splitParcelName(name: string): { blockNumber: string; parcelNumber: string } {
  const [blockNumber = '', parcelNumber = ''] = name.split('/');
  return {
    blockNumber: blockNumber.trim(),
    parcelNumber: parcelNumber.trim(),
  };
}

export function calculationToParcelResult(calculation: ParcelCalculation): TKGMParcelResult {
  const { blockNumber, parcelNumber } = splitParcelName(calculation.name);
  const result: ParcelResultWithVertices = {
    id: calculation.id,
    area: calculation.parcelArea,
    info: {
      provinceName: '',
      districtName: '',
      neighborhoodName: '',
      blockNo: blockNumber,
      parcelNo: parcelNumber,
      landType: '',
      mapSheet: '',
      landStatus: '',
      summary: '',
    },
    edges: calculation.edges,
    parcelVertices: calculation.parcelVertices,
    vertices: calculation.parcelVertices,
    coordinates: [],
  };

  return result;
}
