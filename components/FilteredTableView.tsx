"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { computeStatus, STATUS_ORDER, STATUS_DISPLAY_ORDER, STATUS_PILL } from '@/utils/campaignStatus';
import type { StatusInfo } from '@/utils/campaignStatus';
import { fmtCurrency, fmtDecimal, fmtPercent, fmtIntBR } from '@/utils/formatters';
import { extractProductName } from '@/utils/helpers';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CampaignMetric {
    id: string;
    campaign_name: string;
    budget?: number;
    status?: string;
    impressions?: number;
    clicks: number;
    cost: number;
    conversions?: number;
    conversion_value: number;
    profit: number;
    search_absolute_top_impression_share?: number;
    search_top_impression_share?: number;
    search_impression_share?: number;
    target_cpa?: number;
    avg_target_cpa?: number;
    date: string;
    account?: { name: string; google_ads_account_id: string } | null;
}

type EnrichedMetric = CampaignMetric & { _s: StatusInfo };

interface FilteredTableViewProps {
    metrics: CampaignMetric[];
    selectedCampaign?: string;
    currentFilter?: string;
    sparklineData?: Record<string, number[]>;
    showArchived?: boolean;
    archivedCount?: number;
}

// ─── Column Definitions ───────────────────────────────────────────────────────
interface ColumnDef {
    id: string;
    label: string;
    sortable: boolean;
    align: 'left' | 'center' | 'right';
    defaultWidth?: number;
    bold?: boolean;
}

const COLUMNS: ColumnDef[] = [
    { id: 'campaign', label: 'Conta / Campanha', sortable: true, align: 'left', defaultWidth: 240 },
    { id: 'ads_status', label: 'Ads', sortable: true, align: 'center', defaultWidth: 80 },
    { id: 'perf', label: 'Perf. (ROI%)', sortable: true, align: 'left', defaultWidth: 160 },
    { id: 'budget', label: 'Orçamento', sortable: true, align: 'right', defaultWidth: 100 },
    { id: 'status', label: 'Status', sortable: true, align: 'center', defaultWidth: 110 },
    { id: 'cli_conv', label: 'Cli/Conv.', sortable: true, align: 'right', defaultWidth: 85 },
    { id: 'impressions', label: 'Impr.', sortable: true, align: 'right', defaultWidth: 90 },
    { id: 'clicks', label: 'Cliques', sortable: true, align: 'right', defaultWidth: 85 },
    { id: 'cpc', label: 'CPC méd.', sortable: true, align: 'right', defaultWidth: 90 },
    { id: 'cost', label: 'Custo', sortable: true, align: 'right', defaultWidth: 100 },
    { id: 'abs_top_is', label: '% 1ª pos', sortable: true, align: 'right', defaultWidth: 85 },
    { id: 'top_is', label: '% Sup', sortable: true, align: 'right', defaultWidth: 80 },
    { id: 'is', label: 'Parc.IS', sortable: true, align: 'right', defaultWidth: 80 },
    { id: 'conversions', label: 'Conv.', sortable: true, align: 'right', defaultWidth: 80 },
    { id: 'breakeven', label: 'Break-even', sortable: false, align: 'right', defaultWidth: 95 },
    { id: 'cost_conv', label: 'Custo/Conv.', sortable: true, align: 'right', defaultWidth: 100 },
    { id: 'revenue', label: 'Receita', sortable: true, align: 'right', defaultWidth: 100 },
    { id: 'profit', label: 'Lucro Net', sortable: true, align: 'right', bold: true, defaultWidth: 110 },
    { id: 'roi', label: 'ROI %', sortable: true, align: 'right', bold: true, defaultWidth: 90 },
    { id: 'target_cpa', label: 'CPA des.', sortable: true, align: 'right', defaultWidth: 90 },
    { id: 'avg_cpa', label: 'CPA md.', sortable: true, align: 'right', defaultWidth: 90 },
];

const DEFAULT_ORDER = COLUMNS.map(c => c.id);
const COL_MAP = Object.fromEntries(COLUMNS.map(c => [c.id, c]));
const DEFAULT_WIDTHS: Record<string, number> = Object.fromEntries(COLUMNS.map(c => [c.id, c.defaultWidth ?? 100]));

// Google Ads status display mapping
const ADS_STATUS_MAP: Record<string, { label: string; style: string }> = {
    'ENABLED': { label: 'Ativa', style: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60' },
    'PAUSED': { label: 'Pausada', style: 'text-amber-400 bg-amber-950/60 border-amber-800/60' },
    'REMOVED': { label: 'Removida', style: 'text-rose-400 bg-rose-950/60 border-rose-800/60' },
    'UNKNOWN': { label: '—', style: 'text-neutral-600 bg-neutral-900/40 border-neutral-800' },
};

// Sort value extractors for each column
function getSortValue(colId: string, m: EnrichedMetric): number | string {
    const conv = m.conversions ?? 0;
    switch (colId) {
        case 'campaign': return m.campaign_name.toLowerCase();
        case 'ads_status': return m.status === 'ENABLED' ? 0 : m.status === 'PAUSED' ? 1 : 2;
        case 'perf': return m._s.roi;
        case 'budget': return Number(m.budget) || 0;
        case 'status': return STATUS_ORDER[m._s.label] ?? 0;
        case 'cli_conv': return conv > 0 ? m.clicks / conv : 0;
        case 'impressions': return Number(m.impressions) || 0;
        case 'clicks': return m.clicks;
        case 'cpc': return m.clicks > 0 ? m.cost / m.clicks : 0;
        case 'cost': return m.cost;
        case 'abs_top_is': return Number(m.search_absolute_top_impression_share) || 0;
        case 'top_is': return Number(m.search_top_impression_share) || 0;
        case 'is': return Number(m.search_impression_share) || 0;
        case 'conversions': return conv;
        case 'cost_conv': return conv > 0 ? m.cost / conv : 0;
        case 'revenue': return m.conversion_value;
        case 'profit': return m.profit;
        case 'roi': return m._s.roi;
        case 'target_cpa': return Number(m.target_cpa) || 0;
        case 'avg_cpa': return Number(m.avg_target_cpa) || 0;
        default: return 0;
    }
}

// ─── Threshold Filters ────────────────────────────────────────────────────────
const THRESHOLD_OPTIONS: { key: string; label: string; fn: (m: EnrichedMetric) => boolean }[] = [
    { key: 'risk', label: 'Em Risco', fn: m => ['ABORTAR', 'ALERTA'].includes(m._s.label) },
    { key: 'profitable', label: 'Lucrativas', fn: m => ['LUCRO', 'ROI BRUTAL'].includes(m._s.label) },
    { key: 'roi_pos', label: 'ROI > 0%', fn: m => m._s.roi > 0 },
    { key: 'roi_brutal', label: 'ROI > 100%', fn: m => m._s.roi > 100 },
    { key: 'no_conv', label: 'Sem Conversão', fn: m => (m.conversions ?? 0) === 0 },
    { key: 'losing', label: 'Prejuízo', fn: m => m.profit < 0 },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function Sparkline({ data }: { data: number[] }) {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    const W = 60, H = 22;

    const GREEN = '#10b981';
    const RED = '#f43f5e';
    const GREY = '#525252';

    // Compute pixel coordinates for each data point
    const coords = data.map((v, i) => ({
        x: (i / (data.length - 1)) * W,
        y: H - ((v - min) / range) * H,
        val: v,
    }));

    // Zero-line Y position (clamped within the SVG)
    const zeroY = H - ((0 - min) / range) * H;
    const allPositive = min >= 0;
    const allNegative = max <= 0;

    // Build segments between each pair of consecutive points
    // Each segment can be: fully green, fully red, or split at the zero crossing
    const segments: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
    for (let i = 0; i < coords.length - 1; i++) {
        const a = coords[i], b = coords[i + 1];
        if ((a.val >= 0 && b.val >= 0) || (a.val > 0 && b.val === 0)) {
            segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: GREEN });
        } else if ((a.val <= 0 && b.val <= 0) || (a.val < 0 && b.val === 0)) {
            segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: RED });
        } else {
            // Crossing zero — find the interpolated crossing point
            const t = a.val / (a.val - b.val); // 0..1
            const cx = a.x + t * (b.x - a.x);
            const cy = a.y + t * (b.y - a.y);
            if (a.val > 0) {
                segments.push({ x1: a.x, y1: a.y, x2: cx, y2: cy, color: GREEN });
                segments.push({ x1: cx, y1: cy, x2: b.x, y2: b.y, color: RED });
            } else {
                segments.push({ x1: a.x, y1: a.y, x2: cx, y2: cy, color: RED });
                segments.push({ x1: cx, y1: cy, x2: b.x, y2: b.y, color: GREEN });
            }
        }
    }

    // Build filled area paths (green above zero, red below zero)
    const greenFillPts: string[] = [];
    const redFillPts: string[] = [];
    for (const seg of segments) {
        const arr = seg.color === GREEN ? greenFillPts : redFillPts;
        if (arr.length === 0) arr.push(`${seg.x1},${zeroY}`, `${seg.x1},${seg.y1}`);
        arr.push(`${seg.x2},${seg.y2}`);
    }
    if (greenFillPts.length > 0) greenFillPts.push(`${greenFillPts[greenFillPts.length - 1].split(',')[0]},${zeroY}`);
    if (redFillPts.length > 0) redFillPts.push(`${redFillPts[redFillPts.length - 1].split(',')[0]},${zeroY}`);

    return (
        <svg width={W} height={H} className="overflow-visible shrink-0">
            {/* Zero reference line */}
            {!allPositive && !allNegative && (
                <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="#404040" strokeWidth="0.5" strokeDasharray="2,2" />
            )}
            {/* Filled areas */}
            {greenFillPts.length > 2 && (
                <polygon points={greenFillPts.join(' ')} fill={GREEN} opacity={0.15} />
            )}
            {redFillPts.length > 2 && (
                <polygon points={redFillPts.join(' ')} fill={RED} opacity={0.15} />
            )}
            {/* Colored line segments */}
            {segments.map((seg, i) => (
                <line
                    key={i}
                    x1={seg.x1} y1={seg.y1}
                    x2={seg.x2} y2={seg.y2}
                    stroke={seg.color}
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
            ))}
            {/* Endpoint dot */}
            <circle
                cx={coords[coords.length - 1].x}
                cy={coords[coords.length - 1].y}
                r={2}
                fill={data[data.length - 1] > 0 ? GREEN : data[data.length - 1] < 0 ? RED : GREY}
            />
        </svg>
    );
}

function MarginBar({ consumption, commission }: { consumption: number; commission: number }) {
    const clamped = Math.min(consumption, 100);
    const barColor = consumption >= 70 ? '#f43f5e' : consumption >= 50 ? '#f97316' : '#10b981';
    const textColor = consumption >= 70 ? 'text-rose-500' : consumption >= 50 ? 'text-orange-500' : 'text-emerald-500';
    return (
        <div className="flex items-center gap-1.5 mt-1">
            <div className="relative h-1 rounded-full bg-neutral-800 overflow-hidden" style={{ width: 68 }}>
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${clamped}%`, background: barColor }} />
            </div>
            <span className={`text-[8px] font-bold font-mono ${textColor}`}>
                {consumption.toFixed(0)}%&nbsp;<span className="text-neutral-700">/ ${commission}</span>
            </span>
        </div>
    );
}

function PerfBar({ roi, maxAbsRoi, barColor }: { roi: number; maxAbsRoi: number; barColor: string }) {
    const pct = maxAbsRoi > 0 ? Math.min((Math.abs(roi) / maxAbsRoi) * 100, 100) : 0;
    return (
        <div className="flex items-center gap-2 min-w-[110px]">
            <div className="relative h-1.5 rounded-full bg-neutral-800 overflow-hidden" style={{ width: 72 }}>
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: barColor }} />
            </div>
            <span className="text-[9px] font-mono font-bold w-12 text-right shrink-0" style={{ color: barColor }}>
                {roi >= 0 ? '+' : ''}{roi.toFixed(0)}%
            </span>
        </div>
    );
}

// ─── Sort Arrow Indicator ─────────────────────────────────────────────────────
function SortArrow({ dir }: { dir: 'asc' | 'desc' | null }) {
    if (!dir) return <span className="text-neutral-800 ml-1 text-[8px]">⇅</span>;
    return (
        <span className={`ml-1 text-[9px] ${dir === 'asc' ? 'text-blue-400' : 'text-amber-400'}`}>
            {dir === 'asc' ? '▲' : '▼'}
        </span>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function FilteredTableView({ metrics, selectedCampaign, currentFilter, sparklineData, showArchived, archivedCount }: FilteredTableViewProps) {
    const router = useRouter();
    const [archiving, setArchiving] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const handleArchive = async (campaignName: string) => {
        setArchiving(campaignName);
        try {
            await fetch('/api/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaign_name: campaignName }),
            });
            router.refresh();
        } finally { setArchiving(null); }
    };

    const handleUnarchive = async (campaignName: string) => {
        setArchiving(campaignName);
        try {
            await fetch('/api/archive', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaign_name: campaignName }),
            });
            router.refresh();
        } finally { setArchiving(null); }
    };


    const handleDelete = async (campaignName: string) => {
        setDeleting(campaignName);
        setConfirmDelete(null);
        try {
            await fetch("/api/delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ campaign_name: campaignName }),
            });
            router.refresh();
        } finally { setDeleting(null); }
    };
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [productFilter, setProductFilter] = useState<string | null>(null);
    const [thresholdKey, setThresholdKey] = useState<string | null>(null);
    const [adsStatusFilter, setAdsStatusFilter] = useState<string | null>(null);

    // Column sort state
    const [sortCol, setSortCol] = useState<string>('profit');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    // Column order state (for drag reorder)
    const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_ORDER);

    // Column widths state (for resize)
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_WIDTHS);

    // Drag-and-drop refs
    const dragColRef = useRef<string | null>(null);
    const dragOverColRef = useRef<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    // Resize refs
    const resizingCol = useRef<string | null>(null);
    const resizeStartX = useRef<number>(0);
    const resizeStartW = useRef<number>(0);

    // ─── Column sort handler ──────────────────────────────────────────────────
    const handleHeaderClick = useCallback((colId: string) => {
        const col = COL_MAP[colId];
        if (!col?.sortable) return;
        if (sortCol === colId) {
            setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        } else {
            setSortCol(colId);
            setSortDir('desc');
        }
    }, [sortCol]);

    // ─── Drag handlers ───────────────────────────────────────────────────────
    const handleDragStart = useCallback((colId: string) => {
        dragColRef.current = colId;
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, colId: string) => {
        e.preventDefault();
        dragOverColRef.current = colId;
        setDragOverId(colId);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const from = dragColRef.current;
        const to = dragOverColRef.current;
        if (!from || !to || from === to) {
            dragColRef.current = null;
            dragOverColRef.current = null;
            setDragOverId(null);
            return;
        }
        setColumnOrder(prev => {
            const arr = [...prev];
            const fromIdx = arr.indexOf(from);
            const toIdx = arr.indexOf(to);
            if (fromIdx === -1 || toIdx === -1) return prev;
            arr.splice(fromIdx, 1);
            arr.splice(toIdx, 0, from);
            return arr;
        });
        dragColRef.current = null;
        dragOverColRef.current = null;
        setDragOverId(null);
    }, []);

    const handleDragEnd = useCallback(() => {
        dragColRef.current = null;
        dragOverColRef.current = null;
        setDragOverId(null);
    }, []);

    // ─── Resize handlers ──────────────────────────────────────────────────────
    const handleResizeMouseDown = useCallback((e: React.MouseEvent, colId: string) => {
        e.preventDefault();
        e.stopPropagation();
        resizingCol.current = colId;
        resizeStartX.current = e.clientX;
        resizeStartW.current = columnWidths[colId] || DEFAULT_WIDTHS[colId] || 100;
    }, [columnWidths]);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!resizingCol.current) return;
            const delta = e.clientX - resizeStartX.current;
            const newWidth = Math.max(50, resizeStartW.current + delta);
            setColumnWidths(prev => ({ ...prev, [resizingCol.current!]: newWidth }));
        };

        const onMouseUp = () => {
            resizingCol.current = null;
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    // ─── Enrich ───────────────────────────────────────────────────────────────
    const enriched = useMemo<EnrichedMetric[]>(
        () => metrics.map(m => ({ ...m, _s: computeStatus(m) })),
        [metrics]
    );

    const statusCounts = useMemo(() => {
        const c: Record<string, number> = {};
        enriched.forEach(m => { c[m._s.label] = (c[m._s.label] || 0) + 1; });
        return c;
    }, [enriched]);

    // Ads status counts (ENABLED/PAUSED from Google Ads)
    const adsStatusCounts = useMemo(() => {
        const c: Record<string, number> = {};
        enriched.forEach(m => {
            const raw = (m.status || 'UNKNOWN').toUpperCase();
            c[raw] = (c[raw] || 0) + 1;
        });
        return c;
    }, [enriched]);

    const productGroups = useMemo(() => {
        const g: Record<string, { profit: number; cost: number; count: number }> = {};
        enriched.forEach(m => {
            const p = extractProductName(m.campaign_name);
            if (!g[p]) g[p] = { profit: 0, cost: 0, count: 0 };
            g[p].profit += m.profit;
            g[p].cost += m.cost;
            g[p].count += 1;
        });
        return g;
    }, [enriched]);

    const hasMultipleProducts = Object.keys(productGroups).length > 1;

    // ─── Filter + Sort ────────────────────────────────────────────────────────
    const filtered = useMemo<EnrichedMetric[]>(() => {
        let r = [...enriched];
        if (statusFilter) r = r.filter(m => m._s.label === statusFilter);
        if (productFilter) r = r.filter(m => extractProductName(m.campaign_name) === productFilter);
        if (adsStatusFilter) r = r.filter(m => (m.status || 'UNKNOWN').toUpperCase() === adsStatusFilter);
        if (thresholdKey) {
            const opt = THRESHOLD_OPTIONS.find(o => o.key === thresholdKey);
            if (opt) r = r.filter(opt.fn);
        }

        // Sort by the active column header
        r.sort((a, b) => {
            const va = getSortValue(sortCol, a);
            const vb = getSortValue(sortCol, b);
            let cmp = 0;
            if (typeof va === 'string' && typeof vb === 'string') {
                cmp = va.localeCompare(vb);
            } else {
                cmp = (va as number) - (vb as number);
            }
            return sortDir === 'desc' ? -cmp : cmp;
        });

        return r;
    }, [enriched, statusFilter, productFilter, adsStatusFilter, thresholdKey, sortCol, sortDir]);

    const hiddenCount = metrics.length - filtered.length;
    const isFiltered = !!(statusFilter || productFilter || thresholdKey || adsStatusFilter);

    const maxAbsRoi = useMemo(
        () => Math.max(...filtered.map(m => Math.abs(m._s.roi)), 0.01),
        [filtered]
    );

    // ─── Totals ───────────────────────────────────────────────────────────────
    const totals = useMemo(() => {
        return filtered.reduce(
            (acc, m) => {
                acc.impressions += Number(m.impressions) || 0;
                acc.clicks += Number(m.clicks) || 0;
                acc.cost += Number(m.cost) || 0;
                acc.conversions += Number(m.conversions) || 0;
                acc.conversion_value += Number(m.conversion_value) || 0;
                acc.profit += Number(m.profit) || 0;
                return acc;
            },
            { impressions: 0, clicks: 0, cost: 0, conversions: 0, conversion_value: 0, profit: 0 }
        );
    }, [filtered]);

    const totalROI = totals.cost > 0 ? (totals.profit / totals.cost) * 100 : 0;
    const totalCPC = totals.clicks > 0 ? totals.cost / totals.clicks : 0;

    // ─── Helpers ──────────────────────────────────────────────────────────────
    const clearAll = () => {
        setStatusFilter(null);
        setProductFilter(null);
        setThresholdKey(null);
        setAdsStatusFilter(null);
        setSortCol('profit');
        setSortDir('desc');
    };

    const toggleStatus = (s: string) => setStatusFilter(v => v === s ? null : s);
    const toggleProduct = (p: string) => setProductFilter(v => v === p ? null : p);
    const toggleThreshold = (k: string) => setThresholdKey(v => v === k ? null : k);
    const toggleAdsStatus = (s: string) => setAdsStatusFilter(v => v === s ? null : s);

    // ─── Cell renderer (per column ID) ────────────────────────────────────────
    function renderCell(colId: string, metric: EnrichedMetric): React.ReactNode {
        const s = metric._s;
        const conversions = metric.conversions ?? 0;
        const clicksPerConv = conversions > 0 ? metric.clicks / conversions : 0;
        const avgCpc = metric.clicks > 0 ? metric.cost / metric.clicks : 0;
        const costPerConv = conversions > 0 ? metric.cost / conversions : 0;
        const showMarginBar = s.extractedCommission > 0 && conversions === 0 && metric.cost > 0;
        const consumption = showMarginBar ? (metric.cost / s.extractedCommission) * 100 : 0;
        const breakeven = conversions === 0 && s.estimatedCommission > 0 && metric.cost > 0
            ? Math.ceil(metric.cost / s.estimatedCommission) : null;
        const sparkline = sparklineData?.[metric.campaign_name];

        const cls = "px-4 py-2.5 font-mono text-[11px]";

        switch (colId) {
            case 'campaign':
                return (
                    <td key={colId} className="px-4 py-2.5 pl-3">
                        <div className="flex flex-col gap-0.5">
                            {metric.account
                                ? <span className="text-[9px] uppercase tracking-wider text-neutral-600">{metric.account.name} <span className="text-neutral-800">|</span> {metric.account.google_ads_account_id}</span>
                                : <span className="text-[9px] uppercase tracking-wider text-neutral-700">Conta Não Vinculada</span>
                            }
                            <div className="flex items-center gap-2">
                                <a
                                    href={`?filter=${currentFilter || 'today'}&campaign=${encodeURIComponent(metric.campaign_name)}`}
                                    className="font-mono text-[11px] text-neutral-300 group-hover:text-emerald-400 transition-colors hover:underline decoration-emerald-500/50 underline-offset-4 truncate max-w-[180px]"
                                    title={metric.campaign_name}
                                >
                                    {metric.campaign_name}
                                </a>
                                {sparkline && <Sparkline data={sparkline} />}
                            </div>
                            {showMarginBar && <MarginBar consumption={consumption} commission={s.extractedCommission} />}
                        </div>
                    </td>
                );
            case 'ads_status': {
                const rawStatus = (metric.status || 'UNKNOWN').toUpperCase();
                const statusInfo = ADS_STATUS_MAP[rawStatus] || ADS_STATUS_MAP['UNKNOWN'];
                return (
                    <td key={colId} className="px-2 py-2.5 text-center">
                        <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${statusInfo.style}`}>
                            {statusInfo.label}
                        </span>
                    </td>
                );
            }
            case 'perf':
                return <td key={colId} className="px-4 py-2.5"><PerfBar roi={s.roi} maxAbsRoi={maxAbsRoi} barColor={s.barColor} /></td>;
            case 'budget':
                return <td key={colId} className={`${cls} text-right text-neutral-500`}>{metric.budget ? fmtCurrency(metric.budget) : '—'}</td>;
            case 'status':
                return (
                    <td key={colId} className="px-4 py-2.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                            <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${s.badgeStyle}`}>{s.label}</span>
                            {conversions === 0 && s.estimatedCommission > 0 && metric.cost > 0 && (
                                <span className="text-[8px] font-mono text-neutral-600">{fmtCurrency(metric.cost)}/{fmtCurrency(s.estimatedCommission)}</span>
                            )}
                        </div>
                    </td>
                );
            case 'cli_conv':
                return <td key={colId} className={`${cls} text-right text-neutral-500`}>{fmtDecimal(clicksPerConv)}</td>;
            case 'impressions':
                return <td key={colId} className={`${cls} text-right text-neutral-500`}>{metric.impressions ? fmtIntBR(metric.impressions) : '—'}</td>;
            case 'clicks':
                return <td key={colId} className={`${cls} text-right text-neutral-500`}>{fmtIntBR(metric.clicks)}</td>;
            case 'cpc':
                return <td key={colId} className={`${cls} text-right text-neutral-500`}>{fmtCurrency(avgCpc)}</td>;
            case 'cost':
                return <td key={colId} className={`${cls} text-right text-rose-400/70`}>{fmtCurrency(metric.cost)}</td>;
            case 'abs_top_is':
                return <td key={colId} className={`${cls} text-right text-neutral-500`}>{metric.search_absolute_top_impression_share ? fmtPercent(metric.search_absolute_top_impression_share) : '—'}</td>;
            case 'top_is':
                return <td key={colId} className={`${cls} text-right text-neutral-500`}>{metric.search_top_impression_share ? fmtPercent(metric.search_top_impression_share) : '—'}</td>;
            case 'is':
                return <td key={colId} className={`${cls} text-right text-neutral-500`}>{metric.search_impression_share ? fmtPercent(metric.search_impression_share) : '—'}</td>;
            case 'conversions':
                return <td key={colId} className={`${cls} text-right text-neutral-500`}>{conversions > 0 ? fmtDecimal(conversions) : '—'}</td>;
            case 'breakeven':
                return (
                    <td key={colId} className={`${cls} text-right`}>
                        {conversions > 0
                            ? <span className="text-emerald-500">✓</span>
                            : breakeven !== null
                                ? <span className="text-orange-400 font-bold">{breakeven} conv.</span>
                                : <span className="text-neutral-700">—</span>
                        }
                    </td>
                );
            case 'cost_conv':
                return <td key={colId} className={`${cls} text-right text-neutral-500`}>{fmtCurrency(costPerConv)}</td>;
            case 'revenue':
                return <td key={colId} className={`${cls} text-right text-emerald-400/70`}>{fmtCurrency(metric.conversion_value)}</td>;
            case 'profit':
                return <td key={colId} className={`${cls} text-right font-bold ${metric.profit > 0 ? 'text-emerald-400' : 'text-rose-500'}`}>{metric.profit > 0 ? '+' : ''}{fmtCurrency(metric.profit)}</td>;
            case 'roi':
                return <td key={colId} className={`${cls} text-right font-bold ${metric.profit > 0 ? 'text-emerald-400' : 'text-rose-500'}`}>{fmtPercent(metric._s.roi)}</td>;
            case 'target_cpa':
                return <td key={colId} className={`${cls} text-right text-neutral-500`}>{metric.target_cpa ? fmtCurrency(metric.target_cpa) : '—'}</td>;
            case 'avg_cpa':
                return <td key={colId} className={`${cls} text-right text-neutral-500`}>{metric.avg_target_cpa ? fmtCurrency(metric.avg_target_cpa) : '—'}</td>;
            default:
                return <td key={colId} className="px-4 py-2.5">—</td>;
        }
    }

    // ─── Footer cell renderer ─────────────────────────────────────────────────
    function renderFooterCell(colId: string): React.ReactNode {
        const cls = "px-4 py-3 text-right font-mono text-[10px] font-bold";
        switch (colId) {
            case 'campaign':
                return <td key={colId} className="px-4 py-3 pl-3 text-[10px] font-bold tracking-widest text-neutral-400 uppercase">Total ({filtered.length})</td>;
            case 'ads_status':
                return <td key={colId} className="px-4 py-3" />;
            case 'perf':
                return <td key={colId} className="px-4 py-3"><span className={`text-[10px] font-mono font-bold ${totalROI >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>{totalROI >= 0 ? '+' : ''}{totalROI.toFixed(0)}%</span></td>;
            case 'impressions':
                return <td key={colId} className={`${cls} text-neutral-400`}>{fmtIntBR(totals.impressions)}</td>;
            case 'clicks':
                return <td key={colId} className={`${cls} text-neutral-400`}>{fmtIntBR(totals.clicks)}</td>;
            case 'cpc':
                return <td key={colId} className={`${cls} text-neutral-400`}>{fmtCurrency(totalCPC)}</td>;
            case 'cost':
                return <td key={colId} className={`${cls} text-rose-400`}>{fmtCurrency(totals.cost)}</td>;
            case 'conversions':
                return <td key={colId} className={`${cls} text-neutral-400`}>{fmtDecimal(totals.conversions)}</td>;
            case 'revenue':
                return <td key={colId} className={`${cls} text-emerald-400/80`}>{fmtCurrency(totals.conversion_value)}</td>;
            case 'profit':
                return <td key={colId} className={`${cls} ${totals.profit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>{totals.profit >= 0 ? '+' : ''}{fmtCurrency(totals.profit)}</td>;
            case 'roi':
                return <td key={colId} className={`${cls} ${totalROI >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>{fmtPercent(totalROI)}</td>;
            default:
                return <td key={colId} className="px-4 py-3" />;
        }
    }

    // ─── Ordered columns (resolved from state) ────────────────────────────────
    const orderedCols = useMemo(
        () => columnOrder.map(id => COL_MAP[id]).filter(Boolean),
        [columnOrder]
    );

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="mt-6">
            {/* ─── Filter Panel ──────────────────────────────────────────────── */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/20 overflow-hidden mb-3">

                {/* Product Pills */}
                {hasMultipleProducts && (
                    <div className="px-4 py-2.5 border-b border-neutral-800/50 flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-semibold tracking-widest text-neutral-600 uppercase shrink-0 w-14">Produto</span>
                        <button
                            onClick={() => setProductFilter(null)}
                            className={`text-[9px] px-2.5 py-1 rounded border font-bold transition-all ${!productFilter ? 'border-neutral-500 text-neutral-200 bg-neutral-800' : 'border-neutral-800 text-neutral-600 hover:text-neutral-400 hover:border-neutral-700'}`}
                        >
                            TODOS · {metrics.length}
                        </button>
                        {Object.entries(productGroups)
                            .sort(([, a], [, b]) => b.profit - a.profit)
                            .map(([name, g]) => {
                                const isActive = productFilter === name;
                                const roi = g.cost > 0 ? (g.profit / g.cost) * 100 : 0;
                                const pill = g.profit > 0 && roi > 50
                                    ? 'border-emerald-800 text-emerald-400 bg-emerald-950/50'
                                    : g.profit > 0
                                        ? 'border-yellow-800 text-yellow-400 bg-yellow-950/50'
                                        : 'border-rose-800 text-rose-400 bg-rose-950/50';
                                return (
                                    <button
                                        key={name}
                                        onClick={() => toggleProduct(name)}
                                        className={`text-[9px] px-2.5 py-1 rounded border font-bold transition-all flex items-center gap-1.5 ${pill} ${isActive ? 'ring-1 ring-current ring-opacity-40 scale-105 opacity-100' : 'opacity-55 hover:opacity-100'}`}
                                    >
                                        <span className="uppercase tracking-wide">{name}</span>
                                        <span className="font-mono">{g.profit >= 0 ? '+' : ''}{fmtCurrency(g.profit)}</span>
                                        <span className="opacity-40 text-[8px]">·{g.count}</span>
                                    </button>
                                );
                            })
                        }
                    </div>
                )}

                {/* Ads Status Pills (Google Ads: Ativa/Pausada) */}
                <div className="px-4 py-2.5 border-b border-neutral-800/50 flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] font-semibold tracking-widest text-neutral-600 uppercase shrink-0 w-14">Ads</span>
                    <button
                        onClick={() => setAdsStatusFilter(null)}
                        className={`text-[9px] px-2.5 py-1 rounded border font-bold transition-all ${!adsStatusFilter ? 'border-neutral-500 text-neutral-200 bg-neutral-800' : 'border-neutral-800 text-neutral-600 hover:text-neutral-400 hover:border-neutral-700'}`}
                    >
                        TODOS · {metrics.length}
                    </button>
                    {(['ENABLED', 'PAUSED', 'REMOVED'] as const)
                        .filter(s => (adsStatusCounts[s] || 0) > 0)
                        .map(s => {
                            const isActive = adsStatusFilter === s;
                            const info = ADS_STATUS_MAP[s];
                            return (
                                <button
                                    key={s}
                                    onClick={() => toggleAdsStatus(s)}
                                    className={`text-[9px] px-2.5 py-1 rounded border font-bold transition-all flex items-center gap-1 ${info.style} ${isActive ? 'ring-1 ring-current ring-opacity-40 scale-105 opacity-100' : 'opacity-55 hover:opacity-100'}`}
                                >
                                    {info.label}&nbsp;·&nbsp;{adsStatusCounts[s]}
                                </button>
                            );
                        })
                    }
                </div>

                {/* Status Pills */}
                <div className="px-4 py-2.5 border-b border-neutral-800/50 flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] font-semibold tracking-widest text-neutral-600 uppercase shrink-0 w-14">Status</span>
                    <button
                        onClick={() => setStatusFilter(null)}
                        className={`text-[9px] px-2.5 py-1 rounded border font-bold transition-all ${!statusFilter ? 'border-neutral-500 text-neutral-200 bg-neutral-800' : 'border-neutral-800 text-neutral-600 hover:text-neutral-400 hover:border-neutral-700'}`}
                    >
                        TODOS · {metrics.length}
                    </button>
                    {STATUS_DISPLAY_ORDER
                        .filter(s => statusCounts[s] > 0)
                        .map(s => {
                            const isActive = statusFilter === s;
                            const pill = STATUS_PILL[s] || 'border-neutral-700 text-neutral-400 bg-neutral-800/60';
                            return (
                                <button
                                    key={s}
                                    onClick={() => toggleStatus(s)}
                                    className={`text-[9px] px-2.5 py-1 rounded border font-bold transition-all flex items-center gap-1 ${pill} ${isActive ? 'ring-1 ring-current ring-opacity-40 scale-105 opacity-100' : 'opacity-55 hover:opacity-100'}`}
                                >
                                    {s}&nbsp;·&nbsp;{statusCounts[s]}
                                </button>
                            );
                        })
                    }
                </div>

                {/* Threshold Filters */}
                <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] font-semibold tracking-widest text-neutral-600 uppercase shrink-0">Mostrar só</span>
                    {THRESHOLD_OPTIONS.map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => toggleThreshold(opt.key)}
                            className={`text-[9px] px-2.5 py-1 rounded border font-bold transition-all ${thresholdKey === opt.key ? 'border-amber-700 text-amber-300 bg-amber-950/60 scale-105' : 'border-neutral-800 text-neutral-600 hover:text-neutral-400 hover:border-neutral-700'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filter feedback bar */}
            <div className="flex items-center justify-between mb-2 px-1 min-h-[20px]">
                <span className="text-[9px] font-mono text-neutral-700">
                    {filtered.length === metrics.length
                        ? `${metrics.length} campanhas`
                        : <>{filtered.length} de {metrics.length}&nbsp;<span className="text-amber-600/80">· {hiddenCount} ocultas pelos filtros</span></>
                    }
                </span>
                <div className="flex items-center gap-3">
                    {sortCol !== 'profit' || sortDir !== 'desc' ? (
                        <span className="text-[9px] font-mono text-violet-500/70">
                            Ordenado por: {COL_MAP[sortCol]?.label} {sortDir === 'desc' ? '▼' : '▲'}
                        </span>
                    ) : null}
                    {(isFiltered || sortCol !== 'profit' || sortDir !== 'desc') && (
                        <button
                            onClick={clearAll}
                            className="text-[9px] font-bold text-neutral-600 hover:text-neutral-300 transition-colors border border-neutral-800 hover:border-neutral-600 px-2 py-0.5 rounded"
                        >
                            Resetar ×
                        </button>
                    )}
                </div>
            </div>

            {/* ─── Table ─────────────────────────────────────────────────────── */}
            <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/20">
                <div className="border-b border-neutral-800 bg-neutral-900/40 px-5 py-3 flex items-center justify-between">
                    <h2 className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Operações — Tabela Completa</h2>
                    <div className="flex items-center gap-3 text-[9px] font-mono text-neutral-700">
                        <span>{filtered.length} linhas</span>
                        <span className="text-neutral-800">|</span>
                        <span className="text-neutral-600">⇅ clique p/ ordenar · ⬌ arraste p/ mover</span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="text-left whitespace-nowrap" style={{ tableLayout: 'fixed', minWidth: '100%' }}>
                        {/* ─── COLGROUP (explicit widths for resize) ───────────── */}
                        <colgroup>
                            {orderedCols.map(col => (
                                <col key={col.id} style={{ width: columnWidths[col.id] || col.defaultWidth || 100 }} />
                            ))}
                            <col style={{ width: 46 }} />
                        </colgroup>

                        {/* ─── THEAD (dynamic column order + resize handles) ──── */}
                        <thead className="bg-neutral-900/30">
                            <tr>
                                {orderedCols.map(col => {
                                    const isSorted = sortCol === col.id;
                                    const arrow = isSorted ? sortDir : null;
                                    const isDragOver = dragOverId === col.id;
                                    const textAlign = col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';

                                    return (
                                        <th
                                            key={col.id}
                                            draggable
                                            onDragStart={() => handleDragStart(col.id)}
                                            onDragOver={(e) => handleDragOver(e, col.id)}
                                            onDrop={handleDrop}
                                            onDragEnd={handleDragEnd}
                                            onClick={() => handleHeaderClick(col.id)}
                                            className={[
                                                'px-4 py-3 text-[9px] tracking-widest uppercase border-b border-neutral-800 select-none transition-all relative overflow-visible',
                                                col.bold ? 'font-bold text-neutral-200' : 'font-semibold text-neutral-600',
                                                col.sortable ? 'cursor-pointer hover:text-neutral-300 hover:bg-neutral-800/30' : 'cursor-grab',
                                                isSorted ? 'bg-neutral-800/20 text-neutral-300' : '',
                                                isDragOver ? 'border-l-2 border-l-emerald-500' : '',
                                                textAlign,
                                            ].join(' ')}
                                            style={{ cursor: 'grab' }}
                                        >
                                            <span className="inline-flex items-center gap-0.5 overflow-hidden text-ellipsis">
                                                {col.label}
                                                {col.sortable && <SortArrow dir={arrow} />}
                                            </span>
                                            {/* Resize handle */}
                                            <div
                                                onMouseDown={(e) => handleResizeMouseDown(e, col.id)}
                                                className="absolute top-0 right-0 w-[5px] h-full cursor-col-resize hover:bg-emerald-500/40 active:bg-emerald-500/60 z-10"
                                                title="Arrastar para redimensionar"
                                                onClick={(e) => e.stopPropagation()}
                                                draggable={false}
                                                onDragStart={(e) => e.stopPropagation()}
                                            />
                                        </th>
                                    );
                                })}
                                                            <th className="px-2 py-3 text-[9px] tracking-widest uppercase border-b border-neutral-800 text-neutral-700 text-center w-[92px]">
                                    Ações
                                </th>
</tr>
                        </thead>

                        {/* ─── TBODY (dynamic column order) ───────────────────── */}
                        <tbody className="divide-y divide-neutral-800/50">
                            {filtered.map((metric) => {
                                const isSelected = selectedCampaign === metric.campaign_name;
                                return (
                                    <tr
                                        key={metric.id}
                                        className={`transition-colors hover:bg-neutral-800/40 group ${isSelected ? 'bg-emerald-500/8 border-l-[3px] border-l-emerald-500' : metric._s.rowStyle}`}
                                    >
                                        {orderedCols.map(col => renderCell(col.id, metric))}
                                    <td className="px-1 py-2.5 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                        {showArchived ? (
                                            <button
                                                onClick={() => handleUnarchive(metric.campaign_name)}
                                                disabled={archiving === metric.campaign_name}
                                                title="Desarquivar campanha"
                                                className="text-[9px] px-1.5 py-0.5 rounded border border-amber-800/60 text-amber-500 hover:bg-amber-950/40 transition-colors disabled:opacity-40"
                                            >
                                                {archiving === metric.campaign_name ? '...' : '↩ Ativar'}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleArchive(metric.campaign_name)}
                                                disabled={archiving === metric.campaign_name}
                                                title="Arquivar campanha (ocultar dos relatórios)"
                                                className="text-[9px] px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-500 hover:border-amber-700/60 hover:text-amber-400 transition-all disabled:opacity-40"
                                            >
                                                {archiving === metric.campaign_name ? '...' : '⤓'}
                                            </button>
                                        )}
                                        {confirmDelete === metric.campaign_name ? (
                                            <span className="flex items-center gap-0.5">
                                                <button
                                                    onClick={() => handleDelete(metric.campaign_name)}
                                                    disabled={deleting === metric.campaign_name}
                                                    title="Confirmar exclusão permanente"
                                                    className="text-[9px] px-1 py-0.5 rounded border border-rose-700 text-rose-400 hover:bg-rose-950/40 transition-colors disabled:opacity-40"
                                                >
                                                    {deleting === metric.campaign_name ? '...' : '✓'}
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(null)}
                                                    className="text-[9px] px-1 py-0.5 rounded border border-neutral-700 text-neutral-500 hover:text-neutral-300 transition-colors"
                                                >
                                                    ✕
                                                </button>
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmDelete(metric.campaign_name)}
                                                disabled={deleting === metric.campaign_name}
                                                title="Excluir campanha permanentemente"
                                                className="text-[9px] px-1.5 py-0.5 rounded border border-neutral-800 text-neutral-600 hover:border-rose-800/60 hover:text-rose-500 transition-all disabled:opacity-40"
                                            >
                                                🗑
                                            </button>
                                        )}
                                        </div>
                                    </td>
                                    </tr>
                                );
                            })}

                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={orderedCols.length} className="px-6 py-12 text-center text-neutral-700 font-mono text-xs">
                                        {metrics.length > 0
                                            ? '[ Nenhuma campanha corresponde aos filtros ativos ]'
                                            : '[ Aguardando telemetria do Motor de Anúncios ]'
                                        }
                                    </td>
                                </tr>
                            )}
                        </tbody>

                        {/* ─── TFOOT (dynamic column order) ───────────────────── */}
                        {filtered.length > 0 && (
                            <tfoot>
                                <tr className="bg-neutral-900/60 border-t-2 border-neutral-700">
                                    {orderedCols.map(col => renderFooterCell(col.id))}
                                    <td className="px-2 py-3" />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
