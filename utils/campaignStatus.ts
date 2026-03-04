// Unified campaign status classification — single source of truth

export interface CampaignInput {
    campaign_name: string;
    cost: number;
    profit: number;
    conversions?: number;
    conversion_value: number;
    target_cpa?: number;
}

export interface StatusInfo {
    label: string;
    roi: number;
    estimatedCommission: number;
    extractedCommission: number;
    rowStyle: string;
    badgeStyle: string;
    barColor: string;
}

export interface GridStatus {
    label: string;
    card: string;
    dot: string;
    value: string;
}

// ─── Shared Constants ─────────────────────────────────────────────────────────
export const STATUS_ORDER: Record<string, number> = {
    'ABORTAR': 7, 'ALERTA': 6, 'PREJUÍZO': 5, 'QUEDA ROI': 4,
    'GASTANDO': 3, 'OCIOSO': 2, 'LUCRO': 1, 'ROI BRUTAL': 0,
};

export const STATUS_DISPLAY_ORDER = ['ABORTAR', 'ALERTA', 'PREJUÍZO', 'QUEDA ROI', 'GASTANDO', 'OCIOSO', 'LUCRO', 'ROI BRUTAL'];

export const STATUS_PILL: Record<string, string> = {
    'ROI BRUTAL': 'border-emerald-700 text-emerald-300 bg-emerald-900/60',
    'LUCRO': 'border-emerald-800 text-emerald-400 bg-emerald-950/60',
    'QUEDA ROI': 'border-yellow-800  text-yellow-400  bg-yellow-950/60',
    'ALERTA': 'border-orange-800  text-orange-400  bg-orange-950/60',
    'ABORTAR': 'border-rose-800    text-rose-400    bg-rose-950/60',
    'PREJUÍZO': 'border-rose-800    text-rose-400    bg-rose-950/60',
    'GASTANDO': 'border-neutral-700 text-neutral-400 bg-neutral-800/60',
    'OCIOSO': 'border-neutral-800 text-neutral-600 bg-neutral-900/60',
};

// ─── Thresholds ───────────────────────────────────────────────────────────────
function extractCommission(campaignName: string, targetCpa?: number, conversions?: number, conversionValue?: number): { extracted: number; estimated: number } {
    const nameMatch = campaignName.match(/\$(\d+(\.\d+)?)/);
    const extracted = nameMatch ? parseFloat(nameMatch[1]) : 0;
    const estimated = extracted > 0
        ? extracted
        : targetCpa && targetCpa > 0
            ? targetCpa
            : (conversions ?? 0) > 0 ? (conversionValue ?? 0) / (conversions ?? 1) : 0;
    return { extracted, estimated };
}

function classifyStatus(conversions: number, cost: number, profit: number, conversionValue: number, commission: number, roi: number): string {
    if (conversions === 0) {
        if (commission > 0 && cost > 0.7 * commission) return 'ABORTAR';
        if (commission > 0 && cost > 0.5 * commission) return 'ALERTA';
        if (cost > 0) return 'GASTANDO';
        return 'OCIOSO';
    }
    if (profit < 0) return 'PREJUÍZO';
    if (profit < 0.4 * conversionValue) return 'QUEDA ROI';
    if (roi > 100) return 'ROI BRUTAL';
    return 'LUCRO';
}

// ─── Full Status (for FilteredTableView) ──────────────────────────────────────
export function computeStatus(m: CampaignInput): StatusInfo {
    const conversions = m.conversions ?? 0;
    const { extracted, estimated } = extractCommission(m.campaign_name, m.target_cpa, m.conversions, m.conversion_value);
    const roi = m.cost > 0 ? (m.profit / m.cost) * 100 : 0;
    const label = classifyStatus(conversions, m.cost, m.profit, m.conversion_value, estimated, roi);
    const base = { roi, estimatedCommission: estimated, extractedCommission: extracted };

    const STYLES: Record<string, Pick<StatusInfo, 'rowStyle' | 'badgeStyle' | 'barColor'>> = {
        'ABORTAR': { rowStyle: 'bg-rose-900/15 border-l-[3px] border-l-rose-600', badgeStyle: 'bg-rose-950 text-rose-400 border-rose-800', barColor: '#f43f5e' },
        'ALERTA': { rowStyle: 'bg-orange-900/15 border-l-[3px] border-l-orange-500', badgeStyle: 'bg-orange-950 text-orange-400 border-orange-800', barColor: '#f97316' },
        'GASTANDO': { rowStyle: 'bg-transparent border-l-[3px] border-l-neutral-700', badgeStyle: 'bg-neutral-800 text-neutral-500 border-neutral-700', barColor: '#525252' },
        'OCIOSO': { rowStyle: 'bg-transparent border-l-[3px] border-l-transparent', badgeStyle: 'bg-neutral-900 text-neutral-600 border-neutral-800', barColor: '#262626' },
        'PREJUÍZO': { rowStyle: 'bg-rose-900/15 border-l-[3px] border-l-rose-600', badgeStyle: 'bg-rose-950 text-rose-400 border-rose-800', barColor: '#f43f5e' },
        'QUEDA ROI': { rowStyle: 'bg-yellow-900/8 border-l-[3px] border-l-yellow-500', badgeStyle: 'bg-yellow-950 text-yellow-400 border-yellow-800', barColor: '#eab308' },
        'ROI BRUTAL': { rowStyle: 'bg-emerald-900/15 border-l-[3px] border-l-emerald-500', badgeStyle: 'bg-emerald-950 text-emerald-400 border-emerald-800', barColor: '#10b981' },
        'LUCRO': { rowStyle: 'bg-emerald-900/5 border-l-[3px] border-l-emerald-600/40', badgeStyle: 'bg-emerald-950/50 text-emerald-500 border-emerald-900/50', barColor: '#34d399' },
    };

    return { ...base, label, ...STYLES[label] };
}

// ─── Grid Status (for CampaignStatusGrid) ─────────────────────────────────────
export function getGridStatus(c: CampaignInput): GridStatus {
    const conversions = c.conversions ?? 0;
    const { estimated } = extractCommission(c.campaign_name, c.target_cpa, c.conversions, c.conversion_value);
    const roi = c.cost > 0 ? (c.profit / c.cost) * 100 : 0;
    const label = classifyStatus(conversions, c.cost, c.profit, c.conversion_value, estimated, roi);

    const GRID_STYLES: Record<string, Omit<GridStatus, 'label'>> = {
        'ABORTAR': { card: 'bg-rose-950/70 border-rose-800/60', dot: 'bg-rose-500', value: 'text-rose-400' },
        'ALERTA': { card: 'bg-orange-950/60 border-orange-800/50', dot: 'bg-orange-500', value: 'text-orange-400' },
        'GASTANDO': { card: 'bg-neutral-900/70 border-neutral-800', dot: 'bg-neutral-600', value: 'text-neutral-500' },
        'OCIOSO': { card: 'bg-neutral-900/30 border-neutral-800/40', dot: 'bg-neutral-700', value: 'text-neutral-600' },
        'PREJUÍZO': { card: 'bg-rose-950/70 border-rose-800/60', dot: 'bg-rose-500', value: 'text-rose-400' },
        'QUEDA ROI': { card: 'bg-yellow-950/50 border-yellow-800/40', dot: 'bg-yellow-500', value: 'text-yellow-400' },
        'ROI BRUTAL': { card: 'bg-emerald-900/50 border-emerald-700/60', dot: 'bg-emerald-400', value: 'text-emerald-300' },
        'LUCRO': { card: 'bg-emerald-950/35 border-emerald-800/35', dot: 'bg-emerald-600', value: 'text-emerald-400' },
    };

    return { label, ...GRID_STYLES[label] };
}
