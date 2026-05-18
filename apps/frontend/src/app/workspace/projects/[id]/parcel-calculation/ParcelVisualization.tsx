'use client';

import type { Point } from '@/services/parcel-calculations/types';

interface ParcelVisualizationProps {
  parcelVertices: Point[];
  footprintVertices?: Point[];
  overhangVertices?: Point[];
  width?: number;
  height?: number;
  showLabels?: boolean;
  title?: string;
  setbacks?: { front: number; back: number; left: number; right: number };
  maxOverhangs?: { front: number; back: number; left: number; right: number };
  showSetbackAnnotations?: boolean;
  showOverhangAnnotations?: boolean;
  rotationDeg?: number;
}

const formatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const angleFormatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function polygonPoints(points: Array<{ x: number; y: number }>): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function distanceMeters(first: Point, second: Point): number {
  return Math.sqrt((second.x - first.x) ** 2 + (second.y - first.y) ** 2) / 100;
}

function vertexLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

function interiorAngleDeg(prev: Point, curr: Point, next: Point): number {
  const v1x = prev.x - curr.x;
  const v1y = prev.y - curr.y;
  const v2x = next.x - curr.x;
  const v2y = next.y - curr.y;
  const dot = v1x * v2x + v1y * v2y;
  const len1 = Math.sqrt(v1x ** 2 + v1y ** 2);
  const len2 = Math.sqrt(v2x ** 2 + v2y ** 2);
  if (len1 === 0 || len2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (len1 * len2)));
  return Math.acos(cos) * (180 / Math.PI);
}

function boxFromPoints(points: Array<{ x: number; y: number }>) {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function formatMeterLabel(value: number): string {
  return `${formatter.format(value)} m`;
}

function rotatePt(point: { x: number; y: number }, cx: number, cy: number, deg: number) {
  const radians = deg * Math.PI / 180;
  const dx = point.x - cx;
  const dy = point.y - cy;

  return {
    x: cx + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: cy + dx * Math.sin(radians) + dy * Math.cos(radians),
  };
}

export function ParcelVisualization({
  parcelVertices,
  footprintVertices,
  overhangVertices,
  width = 400,
  height = 400,
  showLabels = true,
  title,
  setbacks,
  maxOverhangs,
  showSetbackAnnotations = false,
  showOverhangAnnotations = false,
  rotationDeg = 0,
}: ParcelVisualizationProps) {
  const allVertices = [
    ...parcelVertices,
    ...(footprintVertices ?? []),
    ...(overhangVertices ?? []),
  ];

  if (allVertices.length === 0 || parcelVertices.length < 3) {
    return (
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Parsel çizimi">
        <rect width={width} height={height} fill="#ffffff" />
      </svg>
    );
  }

  const minX = Math.min(...allVertices.map((point) => point.x));
  const maxX = Math.max(...allVertices.map((point) => point.x));
  const minY = Math.min(...allVertices.map((point) => point.y));
  const maxY = Math.max(...allVertices.map((point) => point.y));
  const padding = 40;
  const legendHeight = 34;
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2 - legendHeight;
  const scale = Math.min(availableWidth / rangeX, availableHeight / rangeY);
  const offsetX = padding + (availableWidth - rangeX * scale) / 2;
  const offsetY = padding + (availableHeight - rangeY * scale) / 2;

  const toSvg = (point: Point) => ({
    x: offsetX + (point.x - minX) * scale,
    y: offsetY + (maxY - point.y) * scale,
  });

  const cx = width / 2;
  const cy = (height - legendHeight) / 2;
  const rot = rotationDeg ?? 0;
  const baseParcelPoints = parcelVertices.map(toSvg);
  const baseFootprintPoints = footprintVertices?.map(toSvg) ?? [];
  const baseOverhangPoints = overhangVertices?.map(toSvg) ?? [];
  const parcelPoints = rot !== 0 ? baseParcelPoints.map((point) => rotatePt(point, cx, cy, rot)) : baseParcelPoints;
  const footprintPoints = rot !== 0 ? baseFootprintPoints.map((point) => rotatePt(point, cx, cy, rot)) : baseFootprintPoints;
  const overhangPoints = rot !== 0 ? baseOverhangPoints.map((point) => rotatePt(point, cx, cy, rot)) : baseOverhangPoints;
  const parcelCentroid = {
    x: parcelPoints.reduce((sum, point) => sum + point.x, 0) / parcelPoints.length,
    y: parcelPoints.reduce((sum, point) => sum + point.y, 0) / parcelPoints.length,
  };
  const parcelBox = boxFromPoints(parcelPoints);
  const footprintBox = footprintPoints.length >= 3 ? boxFromPoints(footprintPoints) : null;
  const overhangBox = overhangPoints.length >= 3 ? boxFromPoints(overhangPoints) : null;
  const gridLines = Array.from({ length: Math.ceil(width / 50) + 1 }, (_, index) => index * 50);
  const horizontalGridLines = Array.from({ length: Math.ceil((height - legendHeight) / 50) + 1 }, (_, index) => index * 50);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Parsel çizimi">
      <defs>
        <marker id="arrow-red" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#e53935" />
        </marker>
        <marker id="arrow-orange" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#ed6c02" />
        </marker>
      </defs>
      <rect width={width} height={height} fill="#ffffff" />
      {gridLines.map((x) => (
        <line key={`v-${x}`} x1={x} x2={x} y1={0} y2={height - legendHeight} stroke="#edf2f7" strokeWidth={1} />
      ))}
      {horizontalGridLines.map((y) => (
        <line key={`h-${y}`} x1={0} x2={width} y1={y} y2={y} stroke="#edf2f7" strokeWidth={1} />
      ))}

      {title ? (
        <text x={padding} y={padding - 10} fontSize={12} fontWeight={700} fill="#334155">
          {title}
        </text>
      ) : null}

      <polygon
        points={polygonPoints(parcelPoints)}
        fill="#e8f5e9"
        stroke="#2d5a4a"
        strokeWidth={2}
      />

      {overhangPoints.length >= 3 ? (
        <polygon
          points={polygonPoints(overhangPoints)}
          fill="rgba(237,108,2,0.1)"
          stroke="#ed6c02"
          strokeWidth={1.5}
          strokeDasharray="4,4"
        />
      ) : null}

      {footprintPoints.length >= 3 ? (
        <polygon
          points={polygonPoints(footprintPoints)}
          fill="rgba(25,118,210,0.15)"
          stroke="#1976d2"
          strokeWidth={2}
          strokeDasharray="8,4"
        />
      ) : null}

      {showSetbackAnnotations && setbacks && footprintBox ? (
        <g>
          {setbacks.front > 0 ? (() => {
            const x = (footprintBox.minX + footprintBox.maxX) / 2;
            const y1 = parcelBox.minY;
            const y2 = footprintBox.minY;
            if (Math.abs(y2 - y1) < 6) return null;
            const label = formatMeterLabel(setbacks.front);
            const w = label.length * 5.5 + 8;
            const lx = x;
            const ly = (y1 + y2) / 2;
            return (
              <g>
                <line x1={x} y1={y1} x2={x} y2={y2} stroke="#e53935" strokeWidth={1.5} strokeDasharray="3,3" markerEnd="url(#arrow-red)" />
                <rect x={lx - w / 2} y={ly - 8} width={w} height={14} fill="white" rx={2} />
                <text x={lx} y={ly + 3} textAnchor="middle" fontSize={9} fill="#e53935" fontWeight={600}>{label}</text>
              </g>
            );
          })() : null}
          {setbacks.back > 0 ? (() => {
            const x = (footprintBox.minX + footprintBox.maxX) / 2;
            const y1 = parcelBox.maxY;
            const y2 = footprintBox.maxY;
            if (Math.abs(y2 - y1) < 6) return null;
            const label = formatMeterLabel(setbacks.back);
            const w = label.length * 5.5 + 8;
            const lx = x;
            const ly = (y1 + y2) / 2;
            return (
              <g>
                <line x1={x} y1={y1} x2={x} y2={y2} stroke="#e53935" strokeWidth={1.5} strokeDasharray="3,3" markerEnd="url(#arrow-red)" />
                <rect x={lx - w / 2} y={ly - 8} width={w} height={14} fill="white" rx={2} />
                <text x={lx} y={ly + 3} textAnchor="middle" fontSize={9} fill="#e53935" fontWeight={600}>{label}</text>
              </g>
            );
          })() : null}
          {setbacks.left > 0 ? (() => {
            const y = (footprintBox.minY + footprintBox.maxY) / 2;
            const x1 = parcelBox.minX;
            const x2 = footprintBox.minX;
            if (Math.abs(x2 - x1) < 6) return null;
            const label = formatMeterLabel(setbacks.left);
            const w = label.length * 5.5 + 8;
            const lx = (x1 + x2) / 2;
            const ly = y - 10;
            return (
              <g>
                <line x1={x1} y1={y} x2={x2} y2={y} stroke="#e53935" strokeWidth={1.5} strokeDasharray="3,3" markerEnd="url(#arrow-red)" />
                <rect x={lx - w / 2} y={ly - 8} width={w} height={14} fill="white" rx={2} />
                <text x={lx} y={ly + 3} textAnchor="middle" fontSize={9} fill="#e53935" fontWeight={600}>{label}</text>
              </g>
            );
          })() : null}
          {setbacks.right > 0 ? (() => {
            const y = (footprintBox.minY + footprintBox.maxY) / 2;
            const x1 = parcelBox.maxX;
            const x2 = footprintBox.maxX;
            if (Math.abs(x2 - x1) < 6) return null;
            const label = formatMeterLabel(setbacks.right);
            const w = label.length * 5.5 + 8;
            const lx = (x1 + x2) / 2;
            const ly = y - 10;
            return (
              <g>
                <line x1={x1} y1={y} x2={x2} y2={y} stroke="#e53935" strokeWidth={1.5} strokeDasharray="3,3" markerEnd="url(#arrow-red)" />
                <rect x={lx - w / 2} y={ly - 8} width={w} height={14} fill="white" rx={2} />
                <text x={lx} y={ly + 3} textAnchor="middle" fontSize={9} fill="#e53935" fontWeight={600}>{label}</text>
              </g>
            );
          })() : null}
        </g>
      ) : null}

      {showOverhangAnnotations && maxOverhangs && footprintBox && overhangBox ? (
        <g>
          {maxOverhangs.front > 0 ? (() => {
            const x = (footprintBox.minX + footprintBox.maxX) / 2 + 25;
            const y1 = footprintBox.minY;
            const y2 = overhangBox.minY;
            if (Math.abs(y2 - y1) < 6) return null;
            const label = formatMeterLabel(maxOverhangs.front);
            const w = label.length * 5.5 + 8;
            const lx = x;
            const ly = (y1 + y2) / 2;
            return (
              <g>
                <line x1={x} y1={y1} x2={x} y2={y2} stroke="#ed6c02" strokeWidth={1.5} strokeDasharray="3,3" markerEnd="url(#arrow-orange)" />
                <rect x={lx - w / 2} y={ly - 8} width={w} height={14} fill="white" rx={2} />
                <text x={lx} y={ly + 3} textAnchor="middle" fontSize={9} fill="#ed6c02" fontWeight={600}>{label}</text>
              </g>
            );
          })() : null}
          {maxOverhangs.back > 0 ? (() => {
            const x = (footprintBox.minX + footprintBox.maxX) / 2 + 25;
            const y1 = footprintBox.maxY;
            const y2 = overhangBox.maxY;
            if (Math.abs(y2 - y1) < 6) return null;
            const label = formatMeterLabel(maxOverhangs.back);
            const w = label.length * 5.5 + 8;
            const lx = x;
            const ly = (y1 + y2) / 2;
            return (
              <g>
                <line x1={x} y1={y1} x2={x} y2={y2} stroke="#ed6c02" strokeWidth={1.5} strokeDasharray="3,3" markerEnd="url(#arrow-orange)" />
                <rect x={lx - w / 2} y={ly - 8} width={w} height={14} fill="white" rx={2} />
                <text x={lx} y={ly + 3} textAnchor="middle" fontSize={9} fill="#ed6c02" fontWeight={600}>{label}</text>
              </g>
            );
          })() : null}
          {maxOverhangs.left > 0 ? (() => {
            const y = (footprintBox.minY + footprintBox.maxY) / 2 + 20;
            const x1 = footprintBox.minX;
            const x2 = overhangBox.minX;
            if (Math.abs(x2 - x1) < 6) return null;
            const label = formatMeterLabel(maxOverhangs.left);
            const w = label.length * 5.5 + 8;
            const lx = (x1 + x2) / 2;
            const ly = y + 20;
            return (
              <g>
                <line x1={x1} y1={y} x2={x2} y2={y} stroke="#ed6c02" strokeWidth={1.5} strokeDasharray="3,3" markerEnd="url(#arrow-orange)" />
                <rect x={lx - w / 2} y={ly - 8} width={w} height={14} fill="white" rx={2} />
                <text x={lx} y={ly + 3} textAnchor="middle" fontSize={9} fill="#ed6c02" fontWeight={600}>{label}</text>
              </g>
            );
          })() : null}
          {maxOverhangs.right > 0 ? (() => {
            const y = (footprintBox.minY + footprintBox.maxY) / 2 + 20;
            const x1 = footprintBox.maxX;
            const x2 = overhangBox.maxX;
            if (Math.abs(x2 - x1) < 6) return null;
            const label = formatMeterLabel(maxOverhangs.right);
            const w = label.length * 5.5 + 8;
            const lx = (x1 + x2) / 2;
            const ly = y + 20;
            return (
              <g>
                <line x1={x1} y1={y} x2={x2} y2={y} stroke="#ed6c02" strokeWidth={1.5} strokeDasharray="3,3" markerEnd="url(#arrow-orange)" />
                <rect x={lx - w / 2} y={ly - 8} width={w} height={14} fill="white" rx={2} />
                <text x={lx} y={ly + 3} textAnchor="middle" fontSize={9} fill="#ed6c02" fontWeight={600}>{label}</text>
              </g>
            );
          })() : null}
        </g>
      ) : null}

      {showLabels ? parcelPoints.map((point, index) => (
        <g key={`label-${index}`}>
          <circle cx={point.x} cy={point.y} r={10} fill="#ffffff" stroke="#2d5a4a" strokeWidth={1.5} />
          <text x={point.x} y={point.y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#2d5a4a">
            {vertexLabel(index)}
          </text>
        </g>
      )) : null}

      {showLabels ? parcelVertices.map((point, index) => {
        const prev = parcelVertices[(index - 1 + parcelVertices.length) % parcelVertices.length]!;
        const next = parcelVertices[(index + 1) % parcelVertices.length]!;
        const angle = interiorAngleDeg(prev, point, next);
        const svgVertex = parcelPoints[index]!;
        const dx = svgVertex.x - parcelCentroid.x;
        const dy = svgVertex.y - parcelCentroid.y;
        const len = Math.sqrt(dx ** 2 + dy ** 2) || 1;
        const labelX = svgVertex.x + (dx / len) * 32;
        const labelY = svgVertex.y + (dy / len) * 32;

        return (
          <g key={`angle-${index}`}>
            <rect
              x={labelX - 16}
              y={labelY - 8}
              width={32}
              height={14}
              fill="#f1f5f9"
              stroke="#94a3b8"
              strokeWidth={0.5}
              rx={3}
            />
            <text
              x={labelX}
              y={labelY + 3}
              textAnchor="middle"
              fontSize={8}
              fill="#475569"
              fontWeight={500}
            >
              {angleFormatter.format(angle)}°
            </text>
          </g>
        );
      }) : null}

      {parcelVertices.map((point, index) => {
        const next = parcelVertices[(index + 1) % parcelVertices.length]!;
        const first = parcelPoints[index]!;
        const second = parcelPoints[(index + 1) % parcelPoints.length]!;
        const midX = (first.x + second.x) / 2;
        const midY = (first.y + second.y) / 2;
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const centroidX = parcelPoints.reduce((sum, p) => sum + p.x, 0) / parcelPoints.length;
        const centroidY = parcelPoints.reduce((sum, p) => sum + p.y, 0) / parcelPoints.length;
        const outward = (nx * (midX - centroidX) + ny * (midY - centroidY)) > 0 ? 1 : -1;
        const labelX = midX + nx * outward * 16;
        const labelY = midY + ny * outward * 16;

        return (
          <text
            key={`dimension-${index}`}
            x={labelX}
            y={labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fontWeight={700}
            fill="#334155"
            paintOrder="stroke"
            stroke="#ffffff"
            strokeWidth={3}
          >
            {formatter.format(distanceMeters(point, next))} m
          </text>
        );
      })}

      <g transform={`translate(16 ${height - 24})`}>
        <rect x={0} y={-10} width={10} height={10} fill="#e8f5e9" stroke="#2d5a4a" />
        <text x={16} y={0} fontSize={10} fill="#334155">Arsa</text>
        {footprintVertices ? (
          <>
            <rect x={70} y={-10} width={10} height={10} fill="rgba(25,118,210,0.15)" stroke="#1976d2" />
            <text x={86} y={0} fontSize={10} fill="#334155">Taban</text>
          </>
        ) : null}
        {overhangVertices ? (
          <>
            <rect x={148} y={-10} width={10} height={10} fill="rgba(237,108,2,0.1)" stroke="#ed6c02" />
            <text x={164} y={0} fontSize={10} fill="#334155">Çıkma</text>
          </>
        ) : null}
        {showSetbackAnnotations && setbacks ? (
          <>
            <line x1={230} y1={-5} x2={246} y2={-5} stroke="#e53935" strokeWidth={1.5} strokeDasharray="3,3" />
            <text x={252} y={0} fontSize={10} fill="#334155">Bahçe Çekmesi</text>
          </>
        ) : null}
        {showOverhangAnnotations && maxOverhangs ? (
          <>
            <line x1={360} y1={-5} x2={376} y2={-5} stroke="#ed6c02" strokeWidth={1.5} strokeDasharray="3,3" />
            <text x={382} y={0} fontSize={10} fill="#334155">Çıkma Mesafesi</text>
          </>
        ) : null}
      </g>
    </svg>
  );
}
