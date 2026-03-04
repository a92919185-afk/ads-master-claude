"use client";

import { useState, useMemo } from 'react';
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
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
    { key: 'profit_desc', label: '↓ Maior Lucro' },
    { key: 'profit_asc', label: '↑ Maior Perda' },
    { key: 'roi_desc', label: '↓ Maior ROI%' },
    { key: 'cost_desc', label: '↑ Maior Custo' },
    { key: 'conv_desc', label: '↓ Mais Conv.' },
    { key: 'risk', label: '🔴 Urgência' },
];

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
    const W = 52, H = 18;
    const points = data
        .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`)
        .join(' ');
    const color = data[data.length - 1] > 0 ? '#10b981' : data[data.length - 1] < 0 ? '#f43f5e' : '#525252';
    return (
        <svg width={W} height={H} className="overflow-visible shrink-0 opacity-70">
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
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
                <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${pct}%`, background: barColor }}
                />
            </div>
            <span className="text-[9px] font-mono font-bold w-12 text-right shrink-0" style={{ color: barColor }}>
                {roi >= 0 ? '+' : ''}{roi.toFixed(0)}%
            </span>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function FilteredTableView({ metrics, selectedCampaign, currentFilter, sparklineData }: FilteredTableViewProps) {
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<string>('profit_desc');
    const [productFilter, setProductFilter] = useState<string | null>(null);
    const [thresholdKey, setThresholdKey] = useState<string | null>(null);

    // Enrich all metrics with status (once)
    const enriched = useMemo<EnrichedMetric[]>(
        () => metrics.map(m => ({ ...m, _s: computeStatus(m) })),
        [metrics]
    );

    // Status counts for pills
    const statusCounts = useMemo(() => {
        const c: Record<string, number> = {};
        enriched.forEach(m => { c[m._s.label] = (c[m._s.label] || 0) + 1; });
        return c;
    }, [enriched]);

    // Product groups for product pills
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

    // Filtered + sorted result
    const filtered = useMemo<EnrichedMetric[]>(() => {
        let r = [...enriched];
        if (statusFilter) r = r.filter(m => m._s.label === statusFilter);
        if (productFilter) r = r.filter(m => extractProductName(m.campaign_name) === productFilter);
        if (thresholdKey) {
            const opt = THRESHOLD_OPTIONS.find(o => o.key === thresholdKey);
            if (opt) r = r.filter(opt.fn);
        }

        r.sort((a, b) => {
            switch (sortKey) {
                case 'profit_desc': return b.profit - a.profit;
                case 'profit_asc': return a.profit - b.profit;
                case 'roi_desc': return b._s.roi - a._s.roi;
                case 'cost_desc': return b.cost - a.cost;
                case 'conv_desc': return (b.conversions ?? 0) - (a.conversions ?? 0);
                case 'risk': return (STATUS_ORDER[b._s.label] ?? 0) - (STATUS_ORDER[a._s.label] ?? 0);
                default: return b.profit - a.profit;
            }
        });

        return r;
    }, [enriched, statusFilter, productFilter, thresholdKey, sortKey]);

    const hiddenCount = metrics.length - filtered.length;
    const isFiltered = !!(statusFilter || productFilter || thresholdKey);

    const maxAbsRoi = useMemo(
        () => Math.max(...filtered.map(m => Math.abs(m._s.roi)), 0.01),
        [filtered]
    );

    // ─── Totals for tfoot ────────────────────────────────────────────────────
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

    const clearAll = () => {
        setStatusFilter(null);
        setProductFilter(null);
        setThresholdKey(null);
        setSortKey('profit_desc');
    };

    const toggleStatus = (s: string) => setStatusFilter(v => v === s ? null : s);
    const toggleProduct = (p: string) => setProductFilter(v => v === p ? null : p);
    const toggleThreshold = (k: string) => setThresholdKey(v => v === k ? null : k);

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

                {/* Sort Bar + Threshold Filters */}
                <div className="px-4 py-2.5 flex items-start gap-6 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-semibold tracking-widest text-neutral-600 uppercase shrink-0">Ordenar</span>
                        {SORT_OPTIONS.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => setSortKey(opt.key)}
                                className={`text-[9px] px-2.5 py-1 rounded border font-bold transition-all ${sortKey === opt.key ? 'border-violet-700 text-violet-300 bg-violet-950/60 scale-105' : 'border-neutral-800 text-neutral-600 hover:text-neutral-400 hover:border-neutral-700'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
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
            </div>

            {/* Filter feedback bar */}
            <div className="flex items-center justify-between mb-2 px-1 min-h-[20px]">
                <span className="text-[9px] font-mono text-neutral-700">
                    {filtered.length === metrics.length
                        ? `${metrics.length} campanhas`
                        : <>{filtered.length} de {metrics.length}&nbsp;<span className="text-amber-600/80">· {hiddenCount} ocultas pelos filtros</span></>
                    }
                </span>
                {isFiltered && (
                    <button
                        onClick={clearAll}
                        className="text-[9px] font-bold text-neutral-600 hover:text-neutral-300 transition-colors border border-neutral-800 hover:border-neutral-600 px-2 py-0.5 rounded"
                    >
                        Limpar filtros ×
                    </button>
                )}
            </div>

            {/* ─── Table ─────────────────────────────────────────────────────── */}
            <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/20">
                <div className="border-b border-neutral-800 bg-neutral-900/40 px-5 py-3 flex items-center justify-between">
                    <h2 className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Operações — Tabela Completa</h2>
                    <div className="flex items-center gap-3 text-[9px] font-mono text-neutral-700">
                        <span>{filtered.length} linhas</span>
                        {isFiltered && <span className="text-amber-700">filtrado</span>}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-neutral-900/30">
                            <tr>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase border-b border-neutral-800 min-w-[220px]">Conta / Campanha</th>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-300 uppercase border-b border-neutral-800 min-w-[150px]">Perf. (ROI%)</th>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">Orçamento</th>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-center border-b border-neutral-800">Status</th>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">Cli/Conv.</th>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">Impr.</th>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">Cliques</th>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">CPC méd.</th>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">Custo</th>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">% 1ª pos</th>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">% Sup</th>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">Parc.IS</th>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">Conv.</th>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">Break-even</th>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">Custo/Conv.</th>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">Receita</th>
                                <th className="px-4 py-3 text-[9px] font-bold tracking-widest text-neutral-200 uppercase text-right border-b border-neutral-800">Lucro Net</th>
                                <th className="px-4 py-3 text-[9px] font-bold tracking-widest text-neutral-200 uppercase text-right border-b border-neutral-800">ROI %</th>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">CPA des.</th>
                                <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">CPA md.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/50">
                            {filtered.map((metric) => {
                                const s = metric._s;
                                const conversions = metric.conversions ?? 0;
                                const clicksPerConv = conversions > 0 ? metric.clicks / conversions : 0;
                                const avgCpc = metric.clicks > 0 ? metric.cost / metric.clicks : 0;
                                const costPerConv = conversions > 0 ? metric.cost / conversions : 0;
                                const showMarginBar = s.extractedCommission > 0 && conversions === 0 && metric.cost > 0;
                                const consumption = showMarginBar ? (metric.cost / s.extractedCommission) * 100 : 0;
                                const breakeven = conversions === 0 && s.estimatedCommission > 0 && metric.cost > 0
                                    ? Math.ceil(metric.cost / s.estimatedCommission) : null;
                                const isSelected = selectedCampaign === metric.campaign_name;
                                const sparkline = sparklineData?.[metric.campaign_name];

                                return (
                                    <tr
                                        key={metric.id}
                                        className={`transition-colors hover:bg-neutral-800/40 group ${isSelected ? 'bg-emerald-500/8 border-l-[3px] border-l-emerald-500' : s.rowStyle}`}
                                    >
                                        {/* Campaign name + sparkline + margin bar */}
                                        <td className="px-4 py-2.5 pl-3">
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

                                        {/* Performance Bar */}
                                        <td className="px-4 py-2.5">
                                            <PerfBar roi={s.roi} maxAbsRoi={maxAbsRoi} barColor={s.barColor} />
                                        </td>

                                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{metric.budget ? fmtCurrency(metric.budget) : '—'}</td>

                                        {/* Status badge */}
                                        <td className="px-4 py-2.5 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${s.badgeStyle}`}>{s.label}</span>
                                                {conversions === 0 && s.estimatedCommission > 0 && metric.cost > 0 && (
                                                    <span className="text-[8px] font-mono text-neutral-600">{fmtCurrency(metric.cost)}/{fmtCurrency(s.estimatedCommission)}</span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{fmtDecimal(clicksPerConv)}</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{metric.impressions ? fmtIntBR(metric.impressions) : '—'}</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{fmtIntBR(metric.clicks)}</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{fmtCurrency(avgCpc)}</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-rose-400/70">{fmtCurrency(metric.cost)}</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{metric.search_absolute_top_impression_share ? fmtPercent(metric.search_absolute_top_impression_share) : '—'}</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{metric.search_top_impression_share ? fmtPercent(metric.search_top_impression_share) : '—'}</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{metric.search_impression_share ? fmtPercent(metric.search_impression_share) : '—'}</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{conversions > 0 ? fmtDecimal(conversions) : '—'}</td>

                                        {/* Breakeven */}
                                        <td className="px-4 py-2.5 text-right font-mono text-[11px]">
                                            {conversions > 0
                                                ? <span className="text-emerald-500">✓</span>
                                                : breakeven !== null
                                                    ? <span className="text-orange-400 font-bold">{breakeven} conv.</span>
                                                    : <span className="text-neutral-700">—</span>
                                            }
                                        </td>

                                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{fmtCurrency(costPerConv)}</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-emerald-400/70">{fmtCurrency(metric.conversion_value)}</td>
                                        <td className={`px-4 py-2.5 text-right font-mono text-[11px] font-bold ${metric.profit > 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                            {metric.profit > 0 ? '+' : ''}{fmtCurrency(metric.profit)}
                                        </td>
                                        <td className={`px-4 py-2.5 text-right font-mono text-[11px] font-bold ${metric.profit > 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                            {fmtPercent(s.roi)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{metric.target_cpa ? fmtCurrency(metric.target_cpa) : '—'}</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{metric.avg_target_cpa ? fmtCurrency(metric.avg_target_cpa) : '—'}</td>
                                    </tr>
                                );
                            })}

                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={20} className="px-6 py-12 text-center text-neutral-700 font-mono text-xs">
                                        {metrics.length > 0
                                            ? '[ Nenhuma campanha corresponde aos filtros ativos ]'
                                            : '[ Aguardando telemetria do Motor de Anúncios ]'
                                        }
                                    </td>
                                </tr>
                            )}
                        </tbody>

                        {/* ─── Totals Footer ─────────────────────────────────── */}
                        {filtered.length > 0 && (
                            <tfoot>
                                <tr className="bg-neutral-900/60 border-t-2 border-neutral-700">
                                    <td className="px-4 py-3 pl-3 text-[10px] font-bold tracking-widest text-neutral-400 uppercase">
                                        Total ({filtered.length})
                                    </td>
                                    {/* Perf bar — total ROI */}
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-mono font-bold ${totalROI >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                            {totalROI >= 0 ? '+' : ''}{totalROI.toFixed(0)}%
                                        </span>
                                    </td>
                                    <td className="px-4 py-3" /> {/* Budget */}
                                    <td className="px-4 py-3" /> {/* Status */}
                                    <td className="px-4 py-3" /> {/* Cli/Conv */}
                                    <td className="px-4 py-3 text-right font-mono text-[10px] font-bold text-neutral-400">{fmtIntBR(totals.impressions)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-[10px] font-bold text-neutral-400">{fmtIntBR(totals.clicks)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-[10px] font-bold text-neutral-400">{fmtCurrency(totalCPC)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-[10px] font-bold text-rose-400">{fmtCurrency(totals.cost)}</td>
                                    <td className="px-4 py-3" /> {/* % 1ª pos */}
                                    <td className="px-4 py-3" /> {/* % Sup */}
                                    <td className="px-4 py-3" /> {/* Parc.IS */}
                                    <td className="px-4 py-3 text-right font-mono text-[10px] font-bold text-neutral-400">{fmtDecimal(totals.conversions)}</td>
                                    <td className="px-4 py-3" /> {/* Breakeven */}
                                    <td className="px-4 py-3" /> {/* Custo/Conv */}
                                    <td className="px-4 py-3 text-right font-mono text-[10px] font-bold text-emerald-400/80">{fmtCurrency(totals.conversion_value)}</td>
                                    <td className={`px-4 py-3 text-right font-mono text-[10px] font-bold ${totals.profit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                        {totals.profit >= 0 ? '+' : ''}{fmtCurrency(totals.profit)}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-mono text-[10px] font-bold ${totalROI >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                        {fmtPercent(totalROI)}
                                    </td>
                                    <td className="px-4 py-3" /> {/* CPA des */}
                                    <td className="px-4 py-3" /> {/* CPA md */}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
