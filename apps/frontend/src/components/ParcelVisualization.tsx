'use client';

interface Coordinate {
  nokta_no: number;
  Y: number;
  X: number;
}

interface Setbacks {
  on_bahce: number | null;
  yan_bahce: number | null;
  arka_bahce: number | null;
  effective_west: number | null;
}

interface FrontFacade {
  edge_start_point: number | null;
  edge_end_point: number | null;
  description: string | null;
}

interface ParcelInfo {
  ada: string | null;
  parsel: string | null;
  ilce: string | null;
  mahalle: string | null;
  net_alan: number | null;
  tapu_alani: number | null;
}

interface ExtractedData {
  parcel: ParcelInfo;
  coordinates: Coordinate[];
  setbacks: Setbacks;
  front_facade: FrontFacade;
}

interface CalculatedResults {
  max_insaat_alani: number | null;
  max_taban_oturumu_min: number | null;
  max_taban_oturumu_max: number | null;
  net_alan: number | null;
  tapu_alani: number | null;
  terk_alani: number | null;
  on_bahce: number | null;
  yan_bahce: number | null;
  arka_bahce: number | null;
}

interface SvgPoint {
  svgX: number;
  svgY: number;
  pointIndex: number;
}

/** Simple 2-D point used by polygon geometry helpers */
interface Pt {
  svgX: number;
  svgY: number;
}

interface ParcelVisualizationProps {
  extractedData: ExtractedData;
  calculatedResults: CalculatedResults;
}

type SetbackEdgeRole = 'front' | 'left' | 'right' | 'rear';

interface SetbackEdgeAnnotation {
  edgeIndex: number;
  role: SetbackEdgeRole;
  first: SvgPoint;
  second: SvgPoint;
  value: number;
  labelPosition: { x: number; y: number };
}

const SVG_WIDTH = 800;
const SVG_HEIGHT = 620;
const PADDING = 90;
const COLORS = {
  background: '#0f1117',
  grid: '#1e2433',
  parcel: { fill: '#2563eb22', stroke: '#3b82f6' },
  setback: { stroke: '#f97316' },
  buildable: { fill: '#ef444422', stroke: '#ef4444' },
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  dot: '#3b82f6',
};

const numberFormatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMetric(value: number | null, suffix: string): string {
  return value === null || !Number.isFinite(value) ? '—' : `${numberFormatter.format(value)} ${suffix}`;
}

function formatArea(value: number | null): string {
  return formatMetric(value, 'm²');
}

function formatMeter(value: number | null): string {
  return formatMetric(value, 'm');
}

// ─── SVG coordinate conversion ───────────────────────────────────────────────

function convertToSvgCoordinates(
  coords: Coordinate[],
  svgWidth: number,
  svgHeight: number,
  padding: number,
): { points: SvgPoint[]; scale: number } {
  if (coords.length === 0) return { points: [], scale: 1 };

  const minY = Math.min(...coords.map((c) => c.Y));
  const maxY = Math.max(...coords.map((c) => c.Y));
  const minX = Math.min(...coords.map((c) => c.X));
  const maxX = Math.max(...coords.map((c) => c.X));
  const rangeY = maxY - minY || 1;
  const rangeX = maxX - minX || 1;
  const availableWidth = svgWidth - padding * 2;
  const availableHeight = svgHeight - padding * 2;
  const scale = Math.min(availableWidth / rangeY, availableHeight / rangeX);
  const offsetX = padding + (availableWidth - rangeY * scale) / 2;
  const offsetY = padding + (availableHeight - rangeX * scale) / 2;

  const points = coords.map((c, index) => ({
    svgX: offsetX + (c.Y - minY) * scale,
    svgY: offsetY + (maxX - c.X) * scale,
    pointIndex: c.nokta_no ?? index + 1,
  }));

  return { points, scale };
}

// ─── Label helpers ────────────────────────────────────────────────────────────

function calculateCentroid(points: SvgPoint[]): { x: number; y: number } {
  if (points.length === 0) return { x: SVG_WIDTH / 2, y: SVG_HEIGHT / 2 };
  return {
    x: points.reduce((s, p) => s + p.svgX, 0) / points.length,
    y: points.reduce((s, p) => s + p.svgY, 0) / points.length,
  };
}

function calculateDistance(first: Coordinate, second: Coordinate): number {
  return Math.sqrt((second.Y - first.Y) ** 2 + (second.X - first.X) ** 2);
}

function isFrontFacadeEdge(first: Coordinate, second: Coordinate, frontFacade: FrontFacade): boolean {
  const { edge_start_point: sp, edge_end_point: ep } = frontFacade;
  if (sp === null || ep === null) return false;
  return (
    (first.nokta_no === sp && second.nokta_no === ep) ||
    (first.nokta_no === ep && second.nokta_no === sp)
  );
}

function calculateOutsideLabelPosition(
  first: SvgPoint,
  second: SvgPoint,
  centroid: { x: number; y: number },
  distance: number,
): { x: number; y: number } {
  const mx = (first.svgX + second.svgX) / 2;
  const my = (first.svgY + second.svgY) / 2;
  const dx = second.svgX - first.svgX;
  const dy = second.svgY - first.svgY;
  const len = Math.sqrt(dx ** 2 + dy ** 2) || 1;
  const pxN = -dy / len;
  const pyN = dx / len;
  const cA = { x: mx + pxN * distance, y: my + pyN * distance };
  const cB = { x: mx - pxN * distance, y: my - pyN * distance };
  const dA = (cA.x - centroid.x) ** 2 + (cA.y - centroid.y) ** 2;
  const dB = (cB.x - centroid.x) ** 2 + (cB.y - centroid.y) ** 2;
  return dA >= dB ? cA : cB;
}

function getSetbackValueForRole(role: SetbackEdgeRole, setbacks: Setbacks): number | null {
  const value = role === 'front'
    ? setbacks.on_bahce
    : role === 'rear'
      ? setbacks.arka_bahce
      : setbacks.yan_bahce;

  return value !== null && Number.isFinite(value) ? value : null;
}

function findBottomEdgeIdx(svgPoints: SvgPoint[]): number | null {
  if (svgPoints.length < 2) return null;

  let edgeIdx = 0;
  let maxY = -Infinity;
  for (let i = 0; i < svgPoints.length; i++) {
    const first = svgPoints[i]!;
    const second = svgPoints[(i + 1) % svgPoints.length]!;
    const midpointY = (first.svgY + second.svgY) / 2;
    if (midpointY > maxY) {
      maxY = midpointY;
      edgeIdx = i;
    }
  }

  return edgeIdx;
}

function findRearEdgeIdx(
  svgPoints: SvgPoint[],
  frontEdgeIdx: number | null,
  centroid: { x: number; y: number },
): number | null {
  if (svgPoints.length < 3 || frontEdgeIdx === null) return null;

  const frontFirst = svgPoints[frontEdgeIdx]!;
  const frontSecond = svgPoints[(frontEdgeIdx + 1) % svgPoints.length]!;
  const frontMid = {
    svgX: (frontFirst.svgX + frontSecond.svgX) / 2,
    svgY: (frontFirst.svgY + frontSecond.svgY) / 2,
  };
  const inwardNormal = getEdgeInwardNormal(frontFirst, frontSecond, { svgX: centroid.x, svgY: centroid.y });

  let rearEdgeIdx: number | null = null;
  let maxProjection = -Infinity;
  for (let i = 0; i < svgPoints.length; i++) {
    if (i === frontEdgeIdx) continue;

    const first = svgPoints[i]!;
    const second = svgPoints[(i + 1) % svgPoints.length]!;
    const midpoint = {
      svgX: (first.svgX + second.svgX) / 2,
      svgY: (first.svgY + second.svgY) / 2,
    };
    const projection =
      (midpoint.svgX - frontMid.svgX) * inwardNormal.nx +
      (midpoint.svgY - frontMid.svgY) * inwardNormal.ny;

    if (projection > maxProjection) {
      maxProjection = projection;
      rearEdgeIdx = i;
    }
  }

  return rearEdgeIdx;
}

function calculateSetbackLabelPosition(
  first: SvgPoint,
  second: SvgPoint,
  centroid: { x: number; y: number },
  role: SetbackEdgeRole,
): { x: number; y: number } {
  const distance = 24;
  const midpoint = {
    x: (first.svgX + second.svgX) / 2,
    y: (first.svgY + second.svgY) / 2,
  };
  const preferred = {
    front: { x: midpoint.x, y: midpoint.y + distance },
    left: { x: midpoint.x - distance, y: midpoint.y },
    right: { x: midpoint.x + distance, y: midpoint.y },
    rear: { x: midpoint.x, y: midpoint.y - distance },
  }[role];
  const midpointDistance = (midpoint.x - centroid.x) ** 2 + (midpoint.y - centroid.y) ** 2;
  const preferredDistance = (preferred.x - centroid.x) ** 2 + (preferred.y - centroid.y) ** 2;

  if (preferredDistance > midpointDistance) return preferred;

  return calculateOutsideLabelPosition(first, second, centroid, distance);
}

function createSetbackEdgeAnnotations(
  svgPoints: SvgPoint[],
  frontEdgeIdx: number | null,
  setbacks: Setbacks,
  centroid: { x: number; y: number },
): SetbackEdgeAnnotation[] {
  if (svgPoints.length < 3) return [];

  const resolvedFrontEdgeIdx = frontEdgeIdx ?? findBottomEdgeIdx(svgPoints);
  const rearEdgeIdx = findRearEdgeIdx(svgPoints, resolvedFrontEdgeIdx, centroid);
  const annotations: SetbackEdgeAnnotation[] = [];

  for (let i = 0; i < svgPoints.length; i++) {
    const first = svgPoints[i]!;
    const second = svgPoints[(i + 1) % svgPoints.length]!;
    const midpointX = (first.svgX + second.svgX) / 2;
    const role: SetbackEdgeRole = i === resolvedFrontEdgeIdx
      ? 'front'
      : i === rearEdgeIdx
        ? 'rear'
        : midpointX < centroid.x
          ? 'left'
          : 'right';
    const value = getSetbackValueForRole(role, setbacks);

    if (value === null) continue;

    annotations.push({
      edgeIndex: i,
      role,
      first,
      second,
      value,
      labelPosition: calculateSetbackLabelPosition(first, second, centroid, role),
    });
  }

  return annotations;
}

function getSetbackLabelWidth(label: string): number {
  return Math.max(48, label.length * 6.4 + 12);
}

function createGridLines(limit: number): number[] {
  const lines: number[] = [];
  for (let v = 0; v <= limit; v += 50) lines.push(v);
  return lines;
}

// ─── Polygon inset geometry ───────────────────────────────────────────────────

/** Centroid of a Pt[] polygon (simple vertex average). */
function polygonCentroidPt(pts: Pt[]): Pt {
  return {
    svgX: pts.reduce((s, p) => s + p.svgX, 0) / pts.length,
    svgY: pts.reduce((s, p) => s + p.svgY, 0) / pts.length,
  };
}

/** Inward-pointing unit normal of edge p1→p2 (toward polygonCentroid). */
function getEdgeInwardNormal(p1: Pt, p2: Pt, centroid: Pt): { nx: number; ny: number } {
  const dx = p2.svgX - p1.svgX;
  const dy = p2.svgY - p1.svgY;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const cand1 = { nx: -dy / len, ny: dx / len };
  const cand2 = { nx: dy / len, ny: -dx / len };
  const mid = { svgX: (p1.svgX + p2.svgX) / 2, svgY: (p1.svgY + p2.svgY) / 2 };
  const dot1 = (centroid.svgX - mid.svgX) * cand1.nx + (centroid.svgY - mid.svgY) * cand1.ny;
  return dot1 >= 0 ? cand1 : cand2;
}

/** Intersection of two lines given as (point, direction). Returns null when parallel. */
function lineIntersection(p1: Pt, d1: Pt, p2: Pt, d2: Pt): Pt | null {
  const denom = d1.svgX * d2.svgY - d1.svgY * d2.svgX;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((p2.svgX - p1.svgX) * d2.svgY - (p2.svgY - p1.svgY) * d2.svgX) / denom;
  return { svgX: p1.svgX + t * d1.svgX, svgY: p1.svgY + t * d1.svgY };
}

/** Ray-casting: is point strictly inside polygon? */
function isPointInsidePolygon(point: Pt, polygon: Pt[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    if (
      (pi.svgY > point.svgY) !== (pj.svgY > point.svgY) &&
      point.svgX < ((pj.svgX - pi.svgX) * (point.svgY - pi.svgY)) / (pj.svgY - pi.svgY) + pi.svgX
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Returns the index i of the edge points[i]→points[(i+1)%n] that matches
 * the front facade. Returns null when not found.
 */
function findFrontEdgeIdx(svgPoints: SvgPoint[], frontFacade: FrontFacade): number | null {
  const { edge_start_point: sp, edge_end_point: ep } = frontFacade;
  if (sp === null || ep === null) return null;
  const n = svgPoints.length;
  for (let i = 0; i < n; i++) {
    const pi = svgPoints[i]!;
    const pj = svgPoints[(i + 1) % n]!;
    if (
      (pi.pointIndex === sp && pj.pointIndex === ep) ||
      (pi.pointIndex === ep && pj.pointIndex === sp)
    ) {
      return i;
    }
  }
  return null;
}

/**
 * Shrinks each polygon edge inward by a setback amount determined by its role:
 *   - frontEdgeIdx → insetFront
 *   - edge roughly opposite to front (angle diff ≈ 180°) → insetRear
 *   - all others → insetSide
 * When frontEdgeIdx is null, insetSide is applied uniformly.
 *
 * Returns the inset polygon, or null if:
 *   - any two shifted edges are parallel (degenerate)
 *   - any resulting vertex falls outside the original polygon
 *     (i.e., the parcel is too small for the given setbacks)
 */
function insetPolygon(
  points: Pt[],
  frontEdgeIdx: number | null,
  insetFront: number,
  insetRear: number,
  insetSide: number,
): Pt[] | null {
  const n = points.length;
  if (n < 3) return null;

  const centroid = polygonCentroidPt(points);

  let frontAngle = 0;
  if (frontEdgeIdx !== null) {
    const fp1 = points[frontEdgeIdx]!;
    const fp2 = points[(frontEdgeIdx + 1) % n]!;
    frontAngle = Math.atan2(fp2.svgY - fp1.svgY, fp2.svgX - fp1.svgX);
  }

  // Compute a shifted version of each edge (point on shifted line + edge direction).
  const shifted: Array<{ pt: Pt; dir: Pt }> = [];
  for (let i = 0; i < n; i++) {
    const p1 = points[i]!;
    const p2 = points[(i + 1) % n]!;
    const normal = getEdgeInwardNormal(p1, p2, centroid);

    let inset: number;
    if (frontEdgeIdx === null) {
      inset = insetSide;
    } else if (i === frontEdgeIdx) {
      inset = insetFront;
    } else {
      const edgeAngle = Math.atan2(p2.svgY - p1.svgY, p2.svgX - p1.svgX);
      let diff = Math.abs(edgeAngle - (frontAngle + Math.PI)) % (2 * Math.PI);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      inset = diff < Math.PI / 3 ? insetRear : insetSide;
    }

    shifted.push({
      pt: { svgX: p1.svgX + normal.nx * inset, svgY: p1.svgY + normal.ny * inset },
      dir: { svgX: p2.svgX - p1.svgX, svgY: p2.svgY - p1.svgY },
    });
  }

  // Each new vertex is the intersection of adjacent shifted edges.
  const result: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const prev = shifted[(i - 1 + n) % n]!;
    const curr = shifted[i]!;
    const pt = lineIntersection(prev.pt, prev.dir, curr.pt, curr.dir);
    if (!pt) return null;
    result.push(pt);
  }

  // Reject if any resulting vertex is outside the original polygon.
  for (const pt of result) {
    if (!isPointInsidePolygon(pt, points)) return null;
  }

  return result;
}

// ─── UI sub-component ─────────────────────────────────────────────────────────

function HeaderMetric({ label, value, accentColor }: { label: string; value: string; accentColor: string }) {
  return (
    <div style={{ background: '#1e2433', borderRadius: 8, padding: '8px 16px', borderLeft: `4px solid ${accentColor}`, minWidth: 140 }}>
      <div style={{ color: COLORS.textMuted, fontSize: 11, lineHeight: 1.3 }}>{label}</div>
      <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ParcelVisualization({ extractedData, calculatedResults }: ParcelVisualizationProps) {
  const coordinates = Array.isArray(extractedData.coordinates)
    ? extractedData.coordinates.filter((c) => Number.isFinite(c.Y) && Number.isFinite(c.X) && Number.isFinite(c.nokta_no))
    : [];
  const { points: svgPoints, scale } = convertToSvgCoordinates(coordinates, SVG_WIDTH, SVG_HEIGHT, PADDING);
  const centroid = calculateCentroid(svgPoints);
  const hasCoordinates = svgPoints.length >= 3;
  const hasAnySetback =
    extractedData.setbacks.on_bahce !== null ||
    extractedData.setbacks.yan_bahce !== null ||
    extractedData.setbacks.arka_bahce !== null ||
    extractedData.setbacks.effective_west !== null;
  const parcelPolygonPoints = svgPoints.map((p) => `${p.svgX},${p.svgY}`).join(' ');
  const headerLocation = [extractedData.parcel.ilce, extractedData.parcel.mahalle].filter(Boolean).join(' / ') || '—';
  const frontEdgeIdx = hasCoordinates ? findFrontEdgeIdx(svgPoints, extractedData.front_facade) : null;
  const setbackEdgeAnnotations = hasCoordinates
    ? createSetbackEdgeAnnotations(svgPoints, frontEdgeIdx, extractedData.setbacks, centroid)
    : [];
  const setbackEdgeIndices = new Set(setbackEdgeAnnotations.map((annotation) => annotation.edgeIndex));

  // ── Compute inset polygons ─────────────────────────────────────────────────
  let buildablePolyStr: string | null = null;
  let buildableCentroidPt: Pt | null = null;
  let buildableAreaTooSmall = false;
  let widthDimension: number | null = null;
  let depthDimension: number | null = null;
  interface DimLine { x1: number; y1: number; x2: number; y2: number; mx: number; my: number }
  let widthLine: DimLine | null = null;
  interface DepthLine extends DimLine { angle: number }
  let depthLine: DepthLine | null = null;

  if (hasCoordinates && hasAnySetback) {
    const pts: Pt[] = svgPoints.map((p) => ({ svgX: p.svgX, svgY: p.svgY }));

    const frontPx = (extractedData.setbacks.on_bahce ?? 0) * scale;
    const rearPx = (extractedData.setbacks.arka_bahce ?? extractedData.setbacks.yan_bahce ?? 0) * scale;
    const sidePx = (extractedData.setbacks.yan_bahce ?? 0) * scale;

    // Buildable polygon at full setbacks.
    const shouldDraw = calculatedResults.max_taban_oturumu_max !== null;
    const buildablePoly = shouldDraw ? insetPolygon(pts, frontEdgeIdx, frontPx, rearPx, sidePx) : null;

    if (buildablePoly) {
      buildablePolyStr = buildablePoly.map((p) => `${p.svgX},${p.svgY}`).join(' ');
      buildableCentroidPt = polygonCentroidPt(buildablePoly);

      const n = buildablePoly.length;
      const resolvedFrontIdx = frontEdgeIdx ?? 0;
      const bFP1 = buildablePoly[resolvedFrontIdx]!;
      const bFP2 = buildablePoly[(resolvedFrontIdx + 1) % n]!;

      widthDimension =
        Math.sqrt((bFP2.svgX - bFP1.svgX) ** 2 + (bFP2.svgY - bFP1.svgY) ** 2) / scale;

      // Width dimension line: along front inset edge, offset slightly inward.
      const inwardN = getEdgeInwardNormal(bFP1, bFP2, buildableCentroidPt);
      const wOff = 16;
      const wx1 = bFP1.svgX + inwardN.nx * wOff;
      const wy1 = bFP1.svgY + inwardN.ny * wOff;
      const wx2 = bFP2.svgX + inwardN.nx * wOff;
      const wy2 = bFP2.svgY + inwardN.ny * wOff;
      widthLine = { x1: wx1, y1: wy1, x2: wx2, y2: wy2, mx: (wx1 + wx2) / 2, my: (wy1 + wy2) / 2 };

      // Depth dimension line: front edge midpoint → rear edge midpoint.
      const frontMid: Pt = { svgX: (bFP1.svgX + bFP2.svgX) / 2, svgY: (bFP1.svgY + bFP2.svgY) / 2 };
      let maxProj = 0;
      let rearEdgeMid: Pt | null = null;
      for (let i = 0; i < n; i++) {
        if (i === resolvedFrontIdx) continue;
        const ep1 = buildablePoly[i]!;
        const ep2 = buildablePoly[(i + 1) % n]!;
        const edgeMid: Pt = { svgX: (ep1.svgX + ep2.svgX) / 2, svgY: (ep1.svgY + ep2.svgY) / 2 };
        const proj =
          (edgeMid.svgX - frontMid.svgX) * inwardN.nx +
          (edgeMid.svgY - frontMid.svgY) * inwardN.ny;
        if (proj > maxProj) { maxProj = proj; rearEdgeMid = edgeMid; }
      }
      if (rearEdgeMid) {
        depthDimension = maxProj / scale;
        const dmx = (frontMid.svgX + rearEdgeMid.svgX) / 2;
        const dmy = (frontMid.svgY + rearEdgeMid.svgY) / 2;
        const dAngle =
          Math.atan2(rearEdgeMid.svgY - frontMid.svgY, rearEdgeMid.svgX - frontMid.svgX) * 180 / Math.PI + 90;
        depthLine = { x1: frontMid.svgX, y1: frontMid.svgY, x2: rearEdgeMid.svgX, y2: rearEdgeMid.svgY, mx: dmx, my: dmy, angle: dAngle };
      }
    } else if (shouldDraw) {
      buildableAreaTooSmall = true;
    }
  }

  return (
    <div style={{ background: COLORS.background }}>
      {/* Header */}
      <div style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.grid}`, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ color: COLORS.text, fontWeight: 800 }}>
            Ada/Parsel: {extractedData.parcel.ada ?? '—'}/{extractedData.parcel.parsel ?? '—'}
          </div>
          <div style={{ color: COLORS.textMuted }}>{headerLocation}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <HeaderMetric label="Tapu Alanı" value={formatArea(calculatedResults.tapu_alani ?? extractedData.parcel.tapu_alani)} accentColor="#3b82f6" />
          <HeaderMetric label="Net Alan" value={formatArea(calculatedResults.net_alan ?? extractedData.parcel.net_alan)} accentColor="#22c55e" />
          <HeaderMetric label="Terk Alanı" value={formatArea(calculatedResults.terk_alani)} accentColor="#f97316" />
          <HeaderMetric label="Max Taban" value={formatArea(calculatedResults.max_taban_oturumu_max)} accentColor="#ef4444" />
        </div>
      </div>

      <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} width="100%" role="img" aria-label="Parsel görselleştirme">
        <defs>
          <marker id="parcel-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L8,4 L0,8 z" fill="white" />
          </marker>
        </defs>

        {/* Background */}
        <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} fill={COLORS.background} />

        {/* Grid */}
        {createGridLines(SVG_HEIGHT).map((y) => (
          <line key={`h-${y}`} x1="0" y1={y} x2={SVG_WIDTH} y2={y} stroke={COLORS.grid} strokeWidth="0.5" />
        ))}
        {createGridLines(SVG_WIDTH).map((x) => (
          <line key={`v-${x}`} x1={x} y1="0" x2={x} y2={SVG_HEIGHT} stroke={COLORS.grid} strokeWidth="0.5" />
        ))}

        {!hasCoordinates ? (
          <text x={SVG_WIDTH / 2} y={SVG_HEIGHT / 2} textAnchor="middle" fill={COLORS.textMuted} fontSize="16" fontWeight="700">
            Koordinat verisi bulunamadı
          </text>
        ) : (
          <>
            {/* Parcel polygon */}
            <polygon
              points={parcelPolygonPoints}
              fill={COLORS.parcel.fill}
              stroke={COLORS.parcel.stroke}
              strokeWidth="2.5"
            />

            {/* Edge labels */}
            {coordinates.map((coordinate, index) => {
              const nextIndex = (index + 1) % coordinates.length;
              const currentPoint = svgPoints[index]!;
              const nextPoint = svgPoints[nextIndex]!;
              const nextCoordinate = coordinates[nextIndex]!;
              const midpoint = calculateOutsideLabelPosition(
                currentPoint,
                nextPoint,
                centroid,
                setbackEdgeIndices.has(index) ? 52 : 32,
              );
              const edgeDistance = calculateDistance(coordinate, nextCoordinate);
              const frontEdge = isFrontFacadeEdge(coordinate, nextCoordinate, extractedData.front_facade);
              const labelWidth = frontEdge ? 92 : 64;

              return (
                <g key={`edge-${coordinate.nokta_no}-${nextCoordinate.nokta_no}`}>
                  <rect
                    x={midpoint.x - labelWidth / 2}
                    y={midpoint.y - 15}
                    width={labelWidth}
                    height={frontEdge ? 34 : 18}
                    rx="4"
                    fill="#0f1117"
                    stroke={COLORS.parcel.stroke}
                    strokeWidth="1"
                  />
                  <text x={midpoint.x} y={midpoint.y - 3} textAnchor="middle" fill={COLORS.text} fontSize="9" fontFamily="monospace">
                    ~{edgeDistance.toFixed(1)}m
                  </text>
                  {frontEdge && (
                    <>
                      <rect x={midpoint.x - 30} y={midpoint.y + 3} width="60" height="13" rx="3" fill="#1a3a2a" stroke="#22c55e" />
                      <text x={midpoint.x} y={midpoint.y + 13} textAnchor="middle" fill="#22c55e" fontSize="8" fontWeight="700" fontFamily="monospace">
                        ÖN CEPHE
                      </text>
                    </>
                  )}
                </g>
              );
            })}

            {/* Setback edge lines */}
            {setbackEdgeAnnotations.map((annotation) => {
              const label = formatMeter(annotation.value);
              const labelWidth = getSetbackLabelWidth(label);

              return (
                <g key={`setback-${annotation.role}-${annotation.edgeIndex}`}>
                  <line
                    x1={annotation.first.svgX}
                    y1={annotation.first.svgY}
                    x2={annotation.second.svgX}
                    y2={annotation.second.svgY}
                    stroke={COLORS.setback.stroke}
                    strokeWidth="2.5"
                    strokeDasharray="8,5"
                  />
                  <rect
                    x={annotation.labelPosition.x - labelWidth / 2}
                    y={annotation.labelPosition.y - 8}
                    width={labelWidth}
                    height="16"
                    rx="4"
                    ry="4"
                    fill="rgba(0,0,0,0.7)"
                    stroke={COLORS.setback.stroke}
                    strokeWidth="1"
                  />
                  <text
                    x={annotation.labelPosition.x}
                    y={annotation.labelPosition.y + 3.5}
                    textAnchor="middle"
                    fill="white"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Buildable area polygon (red) — inset polygon at full setbacks */}
            {buildablePolyStr && buildableCentroidPt && (
              <g>
                <polygon
                  points={buildablePolyStr}
                  fill={COLORS.buildable.fill}
                  stroke={COLORS.buildable.stroke}
                  strokeWidth="2.5"
                />

                {/* Label */}
                <text
                  x={buildableCentroidPt.svgX}
                  y={buildableCentroidPt.svgY - 6}
                  textAnchor="middle"
                  fill={COLORS.text}
                  fontSize="13"
                  fontWeight="bold"
                >
                  NET TABAN
                </text>
                <text
                  x={buildableCentroidPt.svgX}
                  y={buildableCentroidPt.svgY + 10}
                  textAnchor="middle"
                  fill={calculatedResults.max_taban_oturumu_max === null ? COLORS.textMuted : '#22c55e'}
                  fontSize="12"
                >
                  {calculatedResults.max_taban_oturumu_max === null
                    ? 'Hesaplanamadı'
                    : formatArea(calculatedResults.max_taban_oturumu_max)}
                </text>

                {/* Width dimension line — along front inset edge */}
                {widthLine && (
                  <>
                    <line
                      x1={widthLine.x1} y1={widthLine.y1}
                      x2={widthLine.x2} y2={widthLine.y2}
                      stroke="white" strokeDasharray="4,3"
                      markerStart="url(#parcel-arrow)" markerEnd="url(#parcel-arrow)"
                    />
                    <text
                      x={widthLine.mx} y={widthLine.my - 5}
                      textAnchor="middle" fill={COLORS.text} fontSize="10"
                    >
                      {formatMeter(widthDimension)}
                    </text>
                  </>
                )}

                {/* Depth dimension line — front edge midpoint → rear edge midpoint */}
                {depthLine && (
                  <>
                    <line
                      x1={depthLine.x1} y1={depthLine.y1}
                      x2={depthLine.x2} y2={depthLine.y2}
                      stroke="white" strokeDasharray="4,3"
                      markerStart="url(#parcel-arrow)" markerEnd="url(#parcel-arrow)"
                    />
                    <text
                      x={depthLine.mx} y={depthLine.my}
                      textAnchor="middle" fill={COLORS.text} fontSize="10"
                      transform={`rotate(${depthLine.angle} ${depthLine.mx} ${depthLine.my})`}
                    >
                      {formatMeter(depthDimension)}
                    </text>
                  </>
                )}
              </g>
            )}

            {/* Warning: parcel too small for setbacks */}
            {buildableAreaTooSmall && (
              <text
                x={centroid.x}
                y={centroid.y}
                textAnchor="middle"
                fill="#f97316"
                fontSize="12"
                fontWeight="700"
              >
                Bahçe mesafeleri parsele sığmıyor
              </text>
            )}

            {/* Corner dots and point labels */}
            {svgPoints.map((point) => {
              const offsetX = point.svgX >= centroid.x ? 14 : -42;
              const offsetY = point.svgY >= centroid.y ? 12 : -28;
              return (
                <g key={`point-${point.pointIndex}`}>
                  <circle cx={point.svgX} cy={point.svgY} r="5" fill={COLORS.dot} />
                  <rect
                    x={point.svgX + offsetX} y={point.svgY + offsetY}
                    width="28" height="16" rx="3"
                    fill="#1e3a5f" stroke={COLORS.parcel.stroke}
                  />
                  <text
                    x={point.svgX + offsetX + 14} y={point.svgY + offsetY + 11}
                    textAnchor="middle" fill={COLORS.text} fontSize="10" fontFamily="monospace"
                  >
                    N{point.pointIndex}
                  </text>
                </g>
              );
            })}

            {/* Compass — top-right corner */}
            <g transform={`translate(${SVG_WIDTH - 44}, 44)`}>
              <circle r="22" fill="#1e2433" stroke={COLORS.grid} strokeWidth="1.5" />
              <line x1="0" y1="14" x2="0" y2="-14" stroke={COLORS.textMuted} strokeWidth="1" />
              <line x1="-14" y1="0" x2="14" y2="0" stroke={COLORS.textMuted} strokeWidth="1" />
              <polygon points="0,-14 -5,-4 5,-4" fill="#ef4444" />
              <polygon points="0,14 -5,4 5,4" fill={COLORS.textMuted} />
              <text y="-18" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="700">K</text>
            </g>
          </>
        )}

        {/* Axis labels */}
        <text x={SVG_WIDTH / 2} y={SVG_HEIGHT - 22} textAnchor="middle" fill={COLORS.textMuted} fontSize="11">
          Y — Doğu (m)
        </text>
        <text
          x="22" y={SVG_HEIGHT / 2}
          textAnchor="middle" fill={COLORS.textMuted} fontSize="11"
          transform={`rotate(-90 22 ${SVG_HEIGHT / 2})`}
        >
          X — Kuzey (m)
        </text>

        {/* Legend */}
        <g transform="translate(430 590)" fontFamily="monospace" fontSize="10" fill={COLORS.textMuted}>
          <rect x="0" y="-9" width="12" height="8" fill={COLORS.parcel.fill} stroke={COLORS.parcel.stroke} />
          <text x="18" y="-2">Parsel {formatArea(calculatedResults.tapu_alani ?? extractedData.parcel.tapu_alani)}</text>
          <rect x="190" y="-9" width="12" height="8" fill={COLORS.buildable.fill} stroke={COLORS.buildable.stroke} />
          <text x="208" y="-2">Net Taban {formatArea(calculatedResults.max_taban_oturumu_max)}</text>
        </g>
      </svg>
    </div>
  );
}
