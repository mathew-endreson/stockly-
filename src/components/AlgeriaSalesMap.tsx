import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Map as AlgeriaMap } from 'algeria-map-ts';
import { useTheme } from '@/context/ThemeContext';
import type { SalesAnalytics } from '@/types';

type GeographicEntry = SalesAnalytics['geographicDistribution'][number];

type TooltipRecord = {
  value: string;
  color?: string;
  wilaya: string;
  itemsSold: number;
  revenue: number;
  orders: number;
};

const MAP_WILAYAS = [
  'Adrar',
  'Chlef',
  'Laghouat',
  'Oum El Bouaghi',
  'Batna',
  'B\u00e9ja\u00efa',
  'Biskra',
  'B\u00e9char',
  'Blida',
  'Bouira',
  'Tamanrasset',
  'T\u00e9bessa',
  'Tlemcen',
  'Tiaret',
  'Tizi Ouzou',
  'Alger',
  'Djelfa',
  'Jijel',
  'S\u00e9tif',
  'Sa\u00efda',
  'Skikda',
  'Sidi Bel Abb\u00e8s',
  'Annaba',
  'Guelma',
  'Constantine',
  'M\u00e9d\u00e9a',
  'Mostaganem',
  "M'Sila",
  'Mascara',
  'Ouargla',
  'Oran',
  'El Bayadh',
  'Illizi',
  'Bordj Bou Arr\u00e9ridj',
  'Boumerd\u00e8s',
  'El Tarf',
  'Tindouf',
  'Tissemsilt',
  'El Oued',
  'Khenchela',
  'Souk Ahras',
  'Tipaza',
  'Mila',
  'A\u00efn Defla',
  'Na\u00e2ma',
  'A\u00efn T\u00e9mouchent',
  'Gharda\u00efa',
  'Relizane',
  'Timimoun',
  'Bordj Badji Mokhtar',
  'Ouled Djellal',
  'B\u00e9ni Abb\u00e8s',
  'In Salah',
  'In Guezzam',
  'Touggourt',
  'Djanet',
  "El M'Ghair",
  'El Menia',
] as const;

const normalizeWilayaKey = (value: string): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2019`\u00b4]/g, "'")
    .replace(/[^a-zA-Z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const TITLE_CASE_BY_NORMALIZED = MAP_WILAYAS.reduce<Record<string, string>>((acc, wilaya) => {
  acc[normalizeWilayaKey(wilaya)] = wilaya;
  return acc;
}, {});

const EXTRA_WILAYA_ALIASES: Record<string, string> = {
  bejaia: 'B\u00e9ja\u00efa',
  bejaiaa: 'B\u00e9ja\u00efa',
  bechar: 'B\u00e9char',
  tebessa: 'T\u00e9bessa',
  setif: 'S\u00e9tif',
  saida: 'Sa\u00efda',
  'sidi bel abbes': 'Sidi Bel Abb\u00e8s',
  medea: 'M\u00e9d\u00e9a',
  'bordj bou arreridj': 'Bordj Bou Arr\u00e9ridj',
  boumerdes: 'Boumerd\u00e8s',
  'ain defla': 'A\u00efn Defla',
  naama: 'Na\u00e2ma',
  'ain temouchent': 'A\u00efn T\u00e9mouchent',
  ghardaia: 'Gharda\u00efa',
  'beni abbes': 'B\u00e9ni Abb\u00e8s',
  'el mghair': "El M'Ghair",
  'el meghaier': "El M'Ghair",
  'el m ghaier': "El M'Ghair",
  elmeniaa: 'El Menia',
  'el meniaa': 'El Menia',
};

Object.entries(EXTRA_WILAYA_ALIASES).forEach(([alias, target]) => {
  TITLE_CASE_BY_NORMALIZED[normalizeWilayaKey(alias)] = target;
});

const extractWilayaName = (raw: string): string | null => {
  const value = String(raw || '').trim();
  if (!value) return null;

  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
  const candidates = [
    value,
    ...parts,
    parts.length > 1 ? parts[parts.length - 1] : '',
  ]
    .map((candidate) => candidate.replace(/^\d{1,2}\s*[-.)_:]?\s*/g, '').trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizeWilayaKey(candidate);
    const resolved = TITLE_CASE_BY_NORMALIZED[normalized];
    if (resolved) return resolved;
  }

  const fallbackCandidate = normalizeWilayaKey(candidates[candidates.length - 1] || value);
  if (!fallbackCandidate) return null;

  const possibleMatches = MAP_WILAYAS.filter((wilaya) => {
    const normalizedWilaya = normalizeWilayaKey(wilaya);
    return (
      normalizedWilaya.includes(fallbackCandidate) ||
      fallbackCandidate.includes(normalizedWilaya)
    );
  }).sort((a, b) => b.length - a.length);

  return possibleMatches[0] || null;
};

const interpolateColor = (ratio: number, isDarkMode: boolean) => {
  const start = isDarkMode ? { r: 30, g: 41, b: 59 } : { r: 233, g: 244, b: 255 };
  const end = isDarkMode ? { r: 96, g: 165, b: 250 } : { r: 37, g: 99, b: 235 };
  const clamp = Math.max(0, Math.min(1, ratio));
  const mix = (from: number, to: number) => Math.round(from + (to - from) * clamp);
  return `rgb(${mix(start.r, end.r)}, ${mix(start.g, end.g)}, ${mix(start.b, end.b)})`;
};

const formatItemsSold = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value % 1) > 0.00001) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return value.toLocaleString();
};

type Props = {
  distribution: GeographicEntry[];
  formatCurrency: (amount: number) => string;
};

const AlgeriaSalesMap: React.FC<Props> = ({ distribution, formatCurrency }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  const mapTheme = useMemo(
    () =>
      isDarkMode
        ? {
            containerClass: 'border-[#B9B9B9]/80 bg-[#333333]/45',
            baseColor: '#5E5E5E',
            hoverColor: '#7283FB',
            stroke: '#B9B9B9',
            hoverStroke: '#001EF4',
            tooltipBorder: '#B9B9B9',
            tooltipBackground: '#333333',
            tooltipShadow: '0 10px 30px rgba(2, 6, 23, 0.65)',
            tooltipText: '#FCFCFC',
          }
        : {
            containerClass: 'border-border bg-[#FCFCFC]/40',
            baseColor: '#F0F0F0',
            hoverColor: '#7283FB',
            stroke: '#C1C1C1',
            hoverStroke: '#001EF4',
            tooltipBorder: '#C1C1C1',
            tooltipBackground: '#FCFCFC',
            tooltipShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
            tooltipText: '#333333',
          },
    [isDarkMode]
  );

  const mapData = useMemo(() => {
    const aggregated = MAP_WILAYAS.reduce<Record<string, TooltipRecord>>((acc, wilaya) => {
      acc[wilaya] = {
        wilaya,
        value: '0',
        itemsSold: 0,
        revenue: 0,
        orders: 0,
        color: isDarkMode ? '#5E5E5E' : '#F0F0F0',
      };
      return acc;
    }, {});

    distribution.forEach((entry) => {
      const wilayaName = extractWilayaName(entry.wilaya);
      if (!wilayaName || !aggregated[wilayaName]) return;
      aggregated[wilayaName].itemsSold += Number(entry.itemsSold) || 0;
      aggregated[wilayaName].revenue += Number(entry.revenue) || 0;
      aggregated[wilayaName].orders += Number(entry.orders) || 0;
    });

    const maxRevenue = Math.max(
      0,
      ...Object.values(aggregated).map((entry) => entry.revenue)
    );

    Object.values(aggregated).forEach((entry) => {
      const ratio = maxRevenue > 0 ? entry.revenue / maxRevenue : 0;
      entry.color = entry.revenue > 0
        ? interpolateColor(ratio, isDarkMode)
        : (isDarkMode ? '#5E5E5E' : '#F0F0F0');
      entry.value = `${formatItemsSold(entry.itemsSold)} | ${formatCurrency(entry.revenue)}`;
    });

    return aggregated;
  }, [distribution, formatCurrency, isDarkMode]);

  return (
    <div className="space-y-4">
      <div className={`h-[520px] w-full rounded-md border p-2 ${mapTheme.containerClass}`} dir="ltr">
        <AlgeriaMap
          data={mapData}
          width="100%"
          height="500px"
          color={mapTheme.baseColor}
          HoverColor={mapTheme.hoverColor}
          stroke={mapTheme.stroke}
          hoverStroke={mapTheme.hoverStroke}
          hoverContentStyle={{
            minWidth: '220px',
            width: 'auto',
            height: 'auto',
            border: `1px solid ${mapTheme.tooltipBorder}`,
            borderRadius: '8px',
            backgroundColor: mapTheme.tooltipBackground,
            padding: '8px 10px',
            boxShadow: mapTheme.tooltipShadow,
            pointerEvents: 'none',
            fontSize: '12px',
            color: mapTheme.tooltipText,
          }}
          getHoverContent={(record: unknown) => {
            const current = record as TooltipRecord | null;
            if (!current) return '';
            return `
              <div style="font-weight:600;margin-bottom:6px;">${current.wilaya}</div>
              <div>${t('analytics.itemsSold', 'Items sold')}: ${formatItemsSold(current.itemsSold)}</div>
              <div>${t('analytics.totalRevenue', 'Revenue')}: ${formatCurrency(current.revenue)}</div>
            `;
          }}
        />
      </div>
    </div>
  );
};

export default AlgeriaSalesMap;
