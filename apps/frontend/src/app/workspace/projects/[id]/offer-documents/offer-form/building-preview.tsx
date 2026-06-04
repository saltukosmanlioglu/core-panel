'use client';

import { Box, Typography } from '@mui/material';
import type {
  BasementFloor,
  NormalFloor,
  OfferBuilding,
  OfferUnit,
  RoofFloor,
  StreetLabels,
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

function UnitCell({ unit, globalNum }: { unit: OfferUnit; globalNum: number }) {
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
      <Typography sx={{ fontSize: 10 }}>Brüt: {unit.brutM2 || 0} m²</Typography>
      {unit.ownerType === 'tapu' && unit.paymentAmount ? (
        <Typography sx={{ fontSize: 10 }}>{formatTry(unit.paymentAmount)}</Typography>
      ) : null}
      {unit.label ? <Typography sx={{ fontSize: 9, mt: 0.5 }}>{unit.label}</Typography> : null}
      <Box
        sx={{
          position: 'absolute',
          right: 4,
          bottom: 4,
          width: 18,
          height: 18,
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
      {unit.linkedUnitLabel ? (
        <Typography sx={{ fontSize: 8, fontStyle: 'italic', mt: 0.25, lineHeight: 1.2 }}>
          {unit.linkedUnitLabel}
        </Typography>
      ) : null}
    </Box>
  );
}

function StreetLabelsView({ labels }: { labels?: StreetLabels }) {
  if (!labels?.left && !labels?.right) return null;
  return (
    <>
      {labels.left ? (
        <Typography sx={{ position: 'absolute', left: -36, top: '45%', transform: 'rotate(-90deg)', fontSize: 10 }}>
          {labels.left}
        </Typography>
      ) : null}
      {labels.right ? (
        <Typography sx={{ position: 'absolute', right: -36, top: '45%', transform: 'rotate(90deg)', fontSize: 10 }}>
          {labels.right}
        </Typography>
      ) : null}
    </>
  );
}

function FloorRow({
  label,
  units,
  numMap,
  streetLabels,
}: {
  label: string;
  units: OfferUnit[];
  numMap: Map<number, number>;
  streetLabels?: StreetLabels;
}) {
  const visibleUnits = units.filter((u) => !u.isMergedInto);
  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `1fr ${LABEL_COL}`,
          minHeight: 70,
          borderTop: `1px solid ${NAVY}`,
          position: 'relative',
        }}
      >
        <StreetLabelsView labels={streetLabels} />
        <Box sx={{ display: 'flex', gap: 0.5, p: 0.5 }}>
          {visibleUnits.length > 0
            ? visibleUnits.map((unit) => (
              <UnitCell
                key={`${label}-${unit.id}`}
                unit={unit}
                globalNum={numMap.get(unit.id) ?? unit.id}
              />
            ))
            : <Box sx={{ flex: 1, border: `1px solid ${NAVY}`, p: 1, fontSize: 12 }}>Birim eklenmedi</Box>}
        </Box>
        <Box sx={LABEL_SX}>{label}</Box>
      </Box>
      {streetLabels?.bottom ? (
        <Typography sx={{ textAlign: 'center', fontSize: 10, mt: 0.3 }}>
          {streetLabels.bottom}
        </Typography>
      ) : null}
    </>
  );
}

function RoofRow({ floor, numMap }: { floor: RoofFloor; numMap: Map<number, number> }) {
  const visibleUnits = floor.exists ? floor.units.filter((u) => !u.isMergedInto) : [];
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: `1fr ${LABEL_COL}` }}>
      <Box sx={{ p: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {/* Roof triangle using clip-path (full width, 50px tall) */}
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
              <UnitCell key={unit.id} unit={unit} globalNum={numMap.get(unit.id) ?? unit.id} />
            ))}
          </Box>
        ) : null}
      </Box>
      <Box sx={LABEL_SX}>{floor.exists ? 'ÇATI KATI' : ''}</Box>
    </Box>
  );
}

function NormalFloorRow({ floor, numMap }: { floor: NormalFloor; numMap: Map<number, number> }) {
  return <FloorRow label={`${floor.floorNumber}.NORMAL KAT`} units={floor.units} numMap={numMap} />;
}

function BasementFloorRow({ floor, numMap }: { floor: BasementFloor; numMap: Map<number, number> }) {
  if (floor.isCommonArea) {
    return (
      <>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `1fr ${LABEL_COL}`,
            minHeight: 70,
            borderTop: `1px solid ${NAVY}`,
            position: 'relative',
          }}
        >
          <StreetLabelsView labels={floor.streetLabels} />
          <Box sx={{ display: 'grid', placeItems: 'center', border: `1px solid ${NAVY}`, m: 0.5, fontWeight: 800, color: NAVY }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{floor.commonAreaM2 ?? 0} m²</Typography>
              <Typography sx={{ fontSize: 12 }}>{floor.commonAreaLabel ?? 'ORTAK ALAN'}</Typography>
            </Box>
          </Box>
          <Box sx={LABEL_SX}>{floor.label}</Box>
        </Box>
        {floor.streetLabels.bottom ? (
          <Typography sx={{ textAlign: 'center', fontSize: 10, mt: 0.3 }}>
            {floor.streetLabels.bottom}
          </Typography>
        ) : null}
      </>
    );
  }
  return <FloorRow label={floor.label} units={floor.units} numMap={numMap} streetLabels={floor.streetLabels} />;
}

export function BuildingPreview({ parcelTitle, building }: { parcelTitle: string; building: OfferBuilding }) {
  const numMap = computeGlobalNumbers(building);
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
          <NormalFloorRow key={floor.floorNumber} floor={floor} numMap={numMap} />
        ))}
        {building.groundFloor.exists ? (
          <FloorRow
            label="ZEMİN KAT"
            units={building.groundFloor.units}
            numMap={numMap}
            streetLabels={building.groundFloor.streetLabels}
          />
        ) : null}
        {building.basementFloors.map((floor, index) => (
          <BasementFloorRow key={`${floor.label}-${index}`} floor={floor} numMap={numMap} />
        ))}
      </Box>
    </Box>
  );
}
