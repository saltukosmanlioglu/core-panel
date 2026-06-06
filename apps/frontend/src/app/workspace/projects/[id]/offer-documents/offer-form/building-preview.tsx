'use client';

import { Box, Typography } from '@mui/material';
import type {
  BasementFloor,
  NormalFloor,
  OfferBuilding,
  OfferUnit,
  RoofFloor,
} from '@/services/offer-documents/types';
import { computeGlobalNumbers, formatTry } from './building-utils';

const NAVY = '#1B3A5C';

const LABEL_COL = '90px';
const LABEL_SX = {
  borderLeft: `1px solid ${NAVY}`,
  color: NAVY,
  fontSize: 11,
  fontWeight: 600,
  display: 'grid',
  placeItems: 'center',
  textAlign: 'center',
  p: 0.5,
  minWidth: 90,
  whiteSpace: 'normal',
} as const;

function UnitCell({ unit, globalNum, overrideM2 }: { unit: OfferUnit; globalNum: string | undefined; overrideM2?: string }) {
  const isMila = unit.ownerType === 'mila';
  const isNullOwner = unit.ownerType === null;
  const flexGrow = 1 + (unit.mergedWithIds?.length ?? 0);

  const bgColor = isMila ? NAVY : isNullOwner ? '#f0f0f0' : '#fff';
  const textColor = isMila ? '#fff' : isNullOwner ? '#444' : '#111827';
  const borderColor = isNullOwner ? '#aaa' : NAVY;
  const badgeBg = isMila ? '#fff' : NAVY;
  const badgeColor = isMila ? NAVY : '#fff';

  return (
    <Box
      sx={{
        flex: `${flexGrow} 1 0`,
        minHeight: 58,
        p: 1,
        position: 'relative',
        bgcolor: bgColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
        ...(isNullOwner ? { textAlign: 'center' } : {}),
        fontSize: 11,
      }}
    >
      <Typography sx={{ fontSize: 11, fontWeight: 800, lineHeight: 1.2 }}>{unit.ownerName}</Typography>
      <Typography sx={{ fontSize: 10 }}>Brüt: {overrideM2 ?? unit.brutM2} m²</Typography>
      {unit.ownerType === 'tapu' && unit.paymentAmount ? (
        <Typography sx={{ fontSize: 10 }}>{formatTry(unit.paymentAmount)}</Typography>
      ) : null}
      {unit.label ? <Typography sx={{ fontSize: 9, mt: 0.5 }}>{unit.label}</Typography> : null}
      {globalNum !== undefined ? (
        <Box
          sx={{
            position: 'absolute',
            right: 4,
            bottom: 4,
            minWidth: 18,
            height: 18,
            px: 0.5,
            bgcolor: badgeBg,
            color: badgeColor,
            display: 'grid',
            placeItems: 'center',
            fontSize: 10,
            fontWeight: 800,
          }}
        >
          {globalNum}
        </Box>
      ) : null}
      {unit.linkedUnitLabel ? (
        <Typography sx={{ fontSize: 8, fontStyle: 'italic', mt: 0.25, lineHeight: 1.2 }}>
          {unit.linkedUnitLabel}
        </Typography>
      ) : null}
    </Box>
  );
}

function FloorRow({
  label,
  sublabel,
  units,
  numMap,
  hasSideMargin,
  overrideM2,
}: {
  label: string;
  sublabel?: string;
  units: OfferUnit[];
  numMap: Map<number, string>;
  hasSideMargin?: boolean;
  overrideM2?: string;
}) {
  const visibleUnits = units.filter((u) => !u.isMergedInto);
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `1fr ${LABEL_COL}`,
        minHeight: 70,
        borderTop: `1px solid ${NAVY}`,
        ...(hasSideMargin ? { ml: '40px', mr: '40px' } : {}),
      }}
    >
      <Box sx={{ display: 'flex', gap: 0.5, p: 0.5 }}>
        {visibleUnits.length > 0
          ? visibleUnits.map((unit) => (
            <UnitCell
              key={`${label}-${unit.id}`}
              unit={unit}
              globalNum={numMap.get(unit.id)}
              overrideM2={overrideM2}
            />
          ))
          : <Box sx={{ flex: 1, border: `1px solid ${NAVY}`, p: 1, fontSize: 12 }}>Birim eklenmedi</Box>}
      </Box>
      <Box sx={LABEL_SX}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
          {label}
          {sublabel ? <Typography sx={{ fontSize: 9, fontWeight: 400 }}>{sublabel}</Typography> : null}
        </Box>
      </Box>
    </Box>
  );
}

function RoofRow({ floor, numMap }: { floor: RoofFloor; numMap: Map<number, string> }) {
  const visibleUnits = floor.exists ? floor.units.filter((u) => !u.isMergedInto) : [];
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: `1fr ${LABEL_COL}` }}>
      <Box sx={{ p: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box
          sx={{
            width: '100%',
            height: 50,
            bgcolor: NAVY,
            clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
          }}
        />
        {visibleUnits.length > 0 ? (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {visibleUnits.map((unit) => (
              <UnitCell key={unit.id} unit={unit} globalNum={numMap.get(unit.id)} />
            ))}
          </Box>
        ) : null}
      </Box>
      <Box sx={LABEL_SX}>{floor.exists ? 'ÇATI KATI' : ''}</Box>
    </Box>
  );
}

function NormalFloorRow({ floor, numMap, floorAreas }: { floor: NormalFloor; numMap: Map<number, string>; floorAreas?: { floorNumber: number; netArea: number }[] | null }) {
  const visibleUnits = floor.units.filter((u) => !u.isMergedInto);
  const visibleUnitCount = Math.max(1, visibleUnits.length);
  const floorEntry = floorAreas?.find((fa) => fa.floorNumber === floor.floorNumber + 1);
  const perUnitArea = floorEntry
    ? (floorEntry.netArea / visibleUnitCount).toFixed(2)
    : null;
  const sublabel = floorEntry ? `${floorEntry.netArea.toFixed(2)} m²` : undefined;
  return (
    <FloorRow
      label={`${floor.floorNumber}. KAT`}
      units={floor.units}
      numMap={numMap}
      sublabel={sublabel}
      overrideM2={perUnitArea ?? undefined}
    />
  );
}

function BasementFloorRow({ floor, numMap, hasSideMargin }: { floor: BasementFloor; numMap: Map<number, string>; hasSideMargin?: boolean }) {
  if (floor.isCommonArea) {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `1fr ${LABEL_COL}`,
          minHeight: 70,
          borderTop: `1px solid ${NAVY}`,
          ...(hasSideMargin ? { ml: '40px', mr: '40px' } : {}),
        }}
      >
        <Box sx={{ display: 'grid', placeItems: 'center', border: `1px solid ${NAVY}`, m: 0.5, fontWeight: 800, color: NAVY }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{floor.commonAreaM2 ?? 0} m²</Typography>
            <Typography sx={{ fontSize: 12 }}>{floor.commonAreaLabel ?? 'ORTAK ALAN'}</Typography>
          </Box>
        </Box>
        <Box sx={LABEL_SX}>{floor.label}</Box>
      </Box>
    );
  }
  return <FloorRow label={floor.label} units={floor.units} numMap={numMap} hasSideMargin={hasSideMargin} />;
}

export function BuildingPreview({ parcelTitle, building, floorAreas }: { parcelTitle: string; building: OfferBuilding; floorAreas?: { floorNumber: number; netArea: number }[] | null }) {
  const numMap = computeGlobalNumbers(building);
  const groundFloorArea = floorAreas?.find((fa) => fa.floorNumber === 1)?.netArea;
  const upperFloorArea = floorAreas?.find((fa) => fa.floorNumber === 2)?.netArea;
  const hasOverhang = !!(groundFloorArea && upperFloorArea && upperFloorArea > groundFloorArea);

  return (
    <Box sx={{ border: '1px solid #d1d5db', borderRadius: 1, p: 1.5, bgcolor: '#fff', position: 'sticky', top: 16 }}>
      <Box sx={{ bgcolor: NAVY, color: '#fff', textAlign: 'center', fontWeight: 800, py: 1, px: 1, fontSize: 13 }}>
        {parcelTitle || 'PARSEL BAŞLIĞI'}
      </Box>
      <Typography sx={{ color: NAVY, textAlign: 'center', fontWeight: 800, fontSize: 12, my: 1 }}>
        KAT MALİKLERİ PAYLAŞIM KROKİSİ
      </Typography>
      <Box sx={{ border: `2px solid ${NAVY}`, p: 1, mx: 3 }}>
        <RoofRow floor={building.roofFloor} numMap={numMap} />
        {building.normalFloors.slice().reverse().map((floor) => (
          <NormalFloorRow
            key={floor.floorNumber}
            floor={floor}
            numMap={numMap}
            floorAreas={floorAreas}
          />
        ))}
        {building.groundFloor.exists ? (
          <FloorRow
            label="ZEMİN KAT"
            units={building.groundFloor.units}
            numMap={numMap}
            hasSideMargin={hasOverhang}
          />
        ) : null}
        {building.basementFloors.map((floor, index) => (
          <BasementFloorRow
            key={`${floor.label}-${index}`}
            floor={floor}
            numMap={numMap}
            hasSideMargin={hasOverhang}
          />
        ))}
      </Box>
    </Box>
  );
}
