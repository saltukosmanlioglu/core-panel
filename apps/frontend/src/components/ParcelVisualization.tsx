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

interface ParcelVisualizationProps {
  extractedData: ExtractedData;
  calculatedResults: CalculatedResults;
}

const SVG_WIDTH = 800;
const SVG_HEIGHT = 620;
const PADDING = 90;
const COLORS = {
  background: '#0f1117',
  grid: '#1e2433',
  parcel: { fill: '#2563eb22', stroke: '#3b82f6' },
  setback: { fill: '#f9731622', stroke: '#f97316' },
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

function convertToSvgCoordinates(
  coords: Coordinate[],
  svgWidth: number,
  svgHeight: number,
  padding: number,
): { points: SvgPoint[]; scale: number } {
  if (coords.length === 0) return { points: [], scale: 1 };

  const minY = Math.min(...coords.map((coordinate) => coordinate.Y));
  const maxY = Math.max(...coords.map((coordinate) => coordinate.Y));
  const minX = Math.min(...coords.map((coordinate) => coordinate.X));
  const maxX = Math.max(...coords.map((coordinate) => coordinate.X));
  const rangeY = maxY - minY || 1;
  const rangeX = maxX - minX || 1;
  const availableWidth = svgWidth - padding * 2;
  const availableHeight = svgHeight - padding * 2;
  const scale = Math.min(availableWidth / rangeY, availableHeight / rangeX);
  const offsetX = padding + (availableWidth - rangeY * scale) / 2;
  const offsetY = padding + (availableHeight - rangeX * scale) / 2;

  const points = coords.map((coordinate, index) => ({
    svgX: offsetX + (coordinate.Y - minY) * scale,
    svgY: offsetY + (maxX - coordinate.X) * scale,
    pointIndex: coordinate.nokta_no ?? index + 1,
  }));

  return { points, scale };
}

function calculateBuildableRect(
  svgPoints: SvgPoint[],
  setbacks: Setbacks,
  frontFacade: FrontFacade,
  scale: number,
): { x: number; y: number; width: number; height: number } | null {
  void frontFacade;

  if (svgPoints.length === 0 || scale <= 0) return null;

  const minSvgX = Math.min(...svgPoints.map((point) => point.svgX));
  const maxSvgX = Math.max(...svgPoints.map((point) => point.svgX));
  const minSvgY = Math.min(...svgPoints.map((point) => point.svgY));
  const maxSvgY = Math.max(...svgPoints.map((point) => point.svgY));
  const frontSetback = (setbacks.on_bahce ?? 0) * scale;
  const sideSetback = (setbacks.yan_bahce ?? 0) * scale;
  const rearSetback = (setbacks.arka_bahce ?? setbacks.yan_bahce ?? 0) * scale;
  const x = minSvgX + sideSetback;
  const y = minSvgY + rearSetback;
  const width = maxSvgX - minSvgX - sideSetback * 2;
  const height = maxSvgY - minSvgY - frontSetback - rearSetback;

  if (width <= 0 || height <= 0) return null;

  return { x, y, width, height };
}

function calculateSetbackRect(
  svgPoints: SvgPoint[],
  setbacks: Setbacks,
  scale: number,
): { x: number; y: number; width: number; height: number } | null {
  if (svgPoints.length === 0 || scale <= 0) return null;

  const minSvgX = Math.min(...svgPoints.map((p) => p.svgX));
  const maxSvgX = Math.max(...svgPoints.map((p) => p.svgX));
  const minSvgY = Math.min(...svgPoints.map((p) => p.svgY));
  const maxSvgY = Math.max(...svgPoints.map((p) => p.svgY));
  const frontPx = (setbacks.on_bahce ?? 0) * scale;
  const sidePx = (setbacks.yan_bahce ?? 0) * scale;
  const rearPx = (setbacks.arka_bahce ?? setbacks.yan_bahce ?? 0) * scale;

  const x = minSvgX + sidePx * 0.4;
  const y = minSvgY + rearPx * 0.4;
  const width = (maxSvgX - minSvgX) - sidePx * 0.8;
  const height = (maxSvgY - minSvgY) - frontPx * 0.4 - rearPx * 0.4;

  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function calculateCentroid(points: SvgPoint[]): { x: number; y: number } {
  if (points.length === 0) return { x: SVG_WIDTH / 2, y: SVG_HEIGHT / 2 };

  return {
    x: points.reduce((total, point) => total + point.svgX, 0) / points.length,
    y: points.reduce((total, point) => total + point.svgY, 0) / points.length,
  };
}

function calculateDistance(first: Coordinate, second: Coordinate): number {
  return Math.sqrt((second.Y - first.Y) ** 2 + (second.X - first.X) ** 2);
}

function isFrontFacadeEdge(first: Coordinate, second: Coordinate, frontFacade: FrontFacade): boolean {
  const startPoint = frontFacade.edge_start_point;
  const endPoint = frontFacade.edge_end_point;

  if (startPoint === null || endPoint === null) return false;

  return (
    (first.nokta_no === startPoint && second.nokta_no === endPoint) ||
    (first.nokta_no === endPoint && second.nokta_no === startPoint)
  );
}

function calculateOutsideLabelPosition(
  first: SvgPoint,
  second: SvgPoint,
  centroid: { x: number; y: number },
  distance: number,
): { x: number; y: number } {
  const midpointX = (first.svgX + second.svgX) / 2;
  const midpointY = (first.svgY + second.svgY) / 2;
  const deltaX = second.svgX - first.svgX;
  const deltaY = second.svgY - first.svgY;
  const length = Math.sqrt(deltaX ** 2 + deltaY ** 2) || 1;
  const perpendicularX = -deltaY / length;
  const perpendicularY = deltaX / length;
  const candidateA = {
    x: midpointX + perpendicularX * distance,
    y: midpointY + perpendicularY * distance,
  };
  const candidateB = {
    x: midpointX - perpendicularX * distance,
    y: midpointY - perpendicularY * distance,
  };
  const distanceA = Math.sqrt((candidateA.x - centroid.x) ** 2 + (candidateA.y - centroid.y) ** 2);
  const distanceB = Math.sqrt((candidateB.x - centroid.x) ** 2 + (candidateB.y - centroid.y) ** 2);

  return distanceA >= distanceB ? candidateA : candidateB;
}

function getRelevantSetbackLabel(isFrontEdge: boolean, setbacks: Setbacks): string | null {
  if (isFrontEdge && setbacks.on_bahce !== null) return `Ön: ${formatMeter(setbacks.on_bahce)}`;
  if (!isFrontEdge && setbacks.yan_bahce !== null) return `Yan: ${formatMeter(setbacks.yan_bahce)}`;
  if (!isFrontEdge && setbacks.arka_bahce !== null) return `Arka: ${formatMeter(setbacks.arka_bahce)}`;
  return null;
}


function createGridLines(limit: number): number[] {
  const lines: number[] = [];
  for (let value = 0; value <= limit; value += 50) {
    lines.push(value);
  }
  return lines;
}

function HeaderMetric({
  label,
  value,
  accentColor,
}: {
  label: string;
  value: string;
  accentColor: string;
}) {
  return (
    <div
      style={{
        background: '#1e2433',
        borderRadius: 8,
        padding: '8px 16px',
        borderLeft: `4px solid ${accentColor}`,
        minWidth: 140,
      }}
    >
      <div style={{ color: COLORS.textMuted, fontSize: 11, lineHeight: 1.3 }}>{label}</div>
      <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

export default function ParcelVisualization({
  extractedData,
  calculatedResults,
}: ParcelVisualizationProps) {
  const coordinates = Array.isArray(extractedData.coordinates)
    ? extractedData.coordinates.filter((coordinate) => (
      Number.isFinite(coordinate.Y) &&
      Number.isFinite(coordinate.X) &&
      Number.isFinite(coordinate.nokta_no)
    ))
    : [];
  const { points: svgPoints, scale } = convertToSvgCoordinates(coordinates, SVG_WIDTH, SVG_HEIGHT, PADDING);
  const centroid = calculateCentroid(svgPoints);
  const hasCoordinates = svgPoints.length >= 3;
  const hasAnySetback = (
    extractedData.setbacks.on_bahce !== null ||
    extractedData.setbacks.yan_bahce !== null ||
    extractedData.setbacks.arka_bahce !== null ||
    extractedData.setbacks.effective_west !== null
  );
  const setbackRect = hasAnySetback
    ? calculateSetbackRect(svgPoints, extractedData.setbacks, scale)
    : null;
  const buildableRect = hasAnySetback && calculatedResults.max_taban_oturumu_max !== null
    ? calculateBuildableRect(svgPoints, extractedData.setbacks, extractedData.front_facade, scale)
    : null;
  const parcelPolygonPoints = svgPoints.map((point) => `${point.svgX},${point.svgY}`).join(' ');
  const headerLocation = [extractedData.parcel.ilce, extractedData.parcel.mahalle].filter(Boolean).join(' / ') || '—';
  const widthDimension = buildableRect ? buildableRect.width / scale : null;
  const depthDimension = buildableRect ? buildableRect.height / scale : null;

  return (
    <div style={{ background: COLORS.background }}>
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

        <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} fill={COLORS.background} />

        {createGridLines(SVG_HEIGHT).map((y) => (
          <line key={`horizontal-${y}`} x1="0" y1={y} x2={SVG_WIDTH} y2={y} stroke={COLORS.grid} strokeWidth="0.5" />
        ))}
        {createGridLines(SVG_WIDTH).map((x) => (
          <line key={`vertical-${x}`} x1={x} y1="0" x2={x} y2={SVG_HEIGHT} stroke={COLORS.grid} strokeWidth="0.5" />
        ))}

        {!hasCoordinates ? (
          <text x={SVG_WIDTH / 2} y={SVG_HEIGHT / 2} textAnchor="middle" fill={COLORS.textMuted} fontSize="16" fontWeight="700">
            Koordinat verisi bulunamadı
          </text>
        ) : (
          <>
            <polygon
              points={parcelPolygonPoints}
              fill={COLORS.parcel.fill}
              stroke={COLORS.parcel.stroke}
              strokeWidth="2.5"
            />

            {coordinates.map((coordinate, index) => {
              const nextIndex = (index + 1) % coordinates.length;
              const currentPoint = svgPoints[index]!;
              const nextPoint = svgPoints[nextIndex]!;
              const nextCoordinate = coordinates[nextIndex]!;
              const midpoint = calculateOutsideLabelPosition(currentPoint, nextPoint, centroid, 32);
              const edgeDistance = calculateDistance(coordinate, nextCoordinate);
              const frontEdge = isFrontFacadeEdge(coordinate, nextCoordinate, extractedData.front_facade);
              const setbackLabel = getRelevantSetbackLabel(frontEdge, extractedData.setbacks);
              const labelWidth = frontEdge ? 92 : 64;

              return (
                <g key={`edge-${coordinate.nokta_no}-${nextCoordinate.nokta_no}`}>
                  <rect
                    x={midpoint.x - labelWidth / 2}
                    y={midpoint.y - 15}
                    width={labelWidth}
                    height={frontEdge ? (setbackLabel ? 46 : 34) : setbackLabel ? 28 : 18}
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
                      {setbackLabel && (
                        <text x={midpoint.x} y={midpoint.y + 28} textAnchor="middle" fill={COLORS.textMuted} fontSize="8" fontFamily="monospace">
                          {setbackLabel}
                        </text>
                      )}
                    </>
                  )}
                  {!frontEdge && setbackLabel && (
                    <text x={midpoint.x} y={midpoint.y + 10} textAnchor="middle" fill={COLORS.textMuted} fontSize="8" fontFamily="monospace">
                      {setbackLabel}
                    </text>
                  )}
                </g>
              );
            })}

            {setbackRect && (
              <rect
                x={setbackRect.x}
                y={setbackRect.y}
                width={setbackRect.width}
                height={setbackRect.height}
                fill={COLORS.setback.fill}
                stroke={COLORS.setback.stroke}
                strokeWidth="1.5"
                strokeDasharray="6,4"
              />
            )}

            {buildableRect && (
              <g>
                <rect
                  x={buildableRect.x}
                  y={buildableRect.y}
                  width={buildableRect.width}
                  height={buildableRect.height}
                  fill={COLORS.buildable.fill}
                  stroke={COLORS.buildable.stroke}
                  strokeWidth="2.5"
                />
                <text
                  x={buildableRect.x + buildableRect.width / 2}
                  y={buildableRect.y + buildableRect.height / 2 - 6}
                  textAnchor="middle"
                  fill={COLORS.text}
                  fontSize="13"
                  fontWeight="bold"
                >
                  NET TABAN
                </text>
                <text
                  x={buildableRect.x + buildableRect.width / 2}
                  y={buildableRect.y + buildableRect.height / 2 + 12}
                  textAnchor="middle"
                  fill={calculatedResults.max_taban_oturumu_max === null ? COLORS.textMuted : '#22c55e'}
                  fontSize="12"
                >
                  {calculatedResults.max_taban_oturumu_max === null ? 'Hesaplanamadı' : formatArea(calculatedResults.max_taban_oturumu_max)}
                </text>

                <line
                  x1={buildableRect.x}
                  y1={buildableRect.y + buildableRect.height + 22}
                  x2={buildableRect.x + buildableRect.width}
                  y2={buildableRect.y + buildableRect.height + 22}
                  stroke="white"
                  strokeDasharray="4,3"
                  markerStart="url(#parcel-arrow)"
                  markerEnd="url(#parcel-arrow)"
                />
                <text
                  x={buildableRect.x + buildableRect.width / 2}
                  y={buildableRect.y + buildableRect.height + 38}
                  textAnchor="middle"
                  fill={COLORS.text}
                  fontSize="10"
                >
                  {formatMeter(widthDimension)}
                </text>
                <line
                  x1={buildableRect.x + buildableRect.width + 22}
                  y1={buildableRect.y}
                  x2={buildableRect.x + buildableRect.width + 22}
                  y2={buildableRect.y + buildableRect.height}
                  stroke="white"
                  strokeDasharray="4,3"
                  markerStart="url(#parcel-arrow)"
                  markerEnd="url(#parcel-arrow)"
                />
                <text
                  x={buildableRect.x + buildableRect.width + 38}
                  y={buildableRect.y + buildableRect.height / 2}
                  fill={COLORS.text}
                  fontSize="10"
                  transform={`rotate(90 ${buildableRect.x + buildableRect.width + 38} ${buildableRect.y + buildableRect.height / 2})`}
                >
                  {formatMeter(depthDimension)}
                </text>
              </g>
            )}

            {svgPoints.map((point) => {
              const offsetX = point.svgX >= centroid.x ? 14 : -42;
              const offsetY = point.svgY >= centroid.y ? 12 : -28;

              return (
                <g key={`point-${point.pointIndex}`}>
                  <circle cx={point.svgX} cy={point.svgY} r="5" fill={COLORS.dot} />
                  <rect
                    x={point.svgX + offsetX}
                    y={point.svgY + offsetY}
                    width="28"
                    height="16"
                    rx="3"
                    fill="#1e3a5f"
                    stroke={COLORS.parcel.stroke}
                  />
                  <text
                    x={point.svgX + offsetX + 14}
                    y={point.svgY + offsetY + 11}
                    textAnchor="middle"
                    fill={COLORS.text}
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    N{point.pointIndex}
                  </text>
                </g>
              );
            })}
          </>
        )}

        <text x={SVG_WIDTH / 2} y={SVG_HEIGHT - 22} textAnchor="middle" fill={COLORS.textMuted} fontSize="11">
          Y — Doğu (m)
        </text>
        <text
          x="22"
          y={SVG_HEIGHT / 2}
          textAnchor="middle"
          fill={COLORS.textMuted}
          fontSize="11"
          transform={`rotate(-90 22 ${SVG_HEIGHT / 2})`}
        >
          X — Kuzey (m)
        </text>

        <g transform="translate(430 590)" fontFamily="monospace" fontSize="10" fill={COLORS.textMuted}>
          <rect x="0" y="-9" width="12" height="8" fill={COLORS.parcel.fill} stroke={COLORS.parcel.stroke} />
          <text x="18" y="-2">Parsel {formatArea(calculatedResults.tapu_alani ?? extractedData.parcel.tapu_alani)}</text>
          <line x1="150" y1="-5" x2="174" y2="-5" stroke={COLORS.setback.stroke} strokeDasharray="6,4" />
          <text x="180" y="-2">Bahçe Mesafeleri</text>
          <rect x="300" y="-9" width="12" height="8" fill={COLORS.buildable.fill} stroke={COLORS.buildable.stroke} />
          <text x="318" y="-2">Net Taban {formatArea(calculatedResults.max_taban_oturumu_max)}</text>
        </g>
      </svg>
    </div>
  );
}
