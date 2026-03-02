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
    account?: {
        name: string;
        google_ads_account_id: string;
    } | null;
}

interface ProfitTableProps {
    metrics: CampaignMetric[];
    selectedCampaign?: string;
    currentFilter?: string;
    sparklineData?: Record<string, number[]>;
}

// Inline SVG sparkline (server-safe, no deps)
function Sparkline({ data }: { data: number[] }) {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const W = 52, H = 18;
    const points = data
        .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`)
        .join(' ');
    const last = data[data.length - 1];
    const color = last > 0 ? '#10b981' : last < 0 ? '#f43f5e' : '#525252';
    return (
        <svg width={W} height={H} className="overflow-visible shrink-0 opacity-80">
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
}

// Visual margin consumption bar
function MarginBar({ consumption, commission }: { consumption: number; commission: number }) {
    const clamped = Math.min(consumption, 100);
    const barColor = consumption >= 70 ? '#f43f5e' : consumption >= 50 ? '#f97316' : '#10b981';
    const textColor = consumption >= 70 ? 'text-rose-500' : consumption >= 50 ? 'text-orange-500' : 'text-emerald-500';
    return (
        <div className="flex items-center gap-1.5 mt-1">
            <div className="relative h-1 rounded-full bg-neutral-800 overflow-hidden" style={{ width: 72 }}>
                <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${clamped}%`, background: barColor }}
                />
            </div>
            <span className={`text-[8px] font-bold font-mono ${textColor}`}>
                {consumption.toFixed(0)}%&nbsp;<span className="text-neutral-700">/ ${commission}</span>
            </span>
        </div>
    );
}

export function ProfitTable({ metrics, selectedCampaign, currentFilter, sparklineData }: ProfitTableProps) {
    return (
        <div className="mt-6 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/20 backdrop-blur-sm">
            <div className="border-b border-neutral-800 bg-neutral-900/40 px-6 py-4 flex items-center justify-between">
                <h2 className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Operações — Tabela Completa</h2>
                <span className="text-[9px] font-mono text-neutral-700">{metrics.length} linhas</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-neutral-900/30">
                        <tr>
                            <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase border-b border-neutral-800 min-w-[220px]">Conta / Campanha</th>
                            <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">Orçamento</th>
                            <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-center border-b border-neutral-800">Status</th>
                            <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">Cliques/Conv.</th>
                            <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">Impr.</th>
                            <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">Cliques</th>
                            <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">CPC méd.</th>
                            <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">Custo</th>
                            <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">% 1ª pos</th>
                            <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">% Sup</th>
                            <th className="px-4 py-3 text-[9px] font-semibold tracking-widest text-neutral-600 uppercase text-right border-b border-neutral-800">Parc. IS</th>
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
                        {metrics.map((metric) => {
                            const fmtCurrency = (val: number) =>
                                new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
                            const fmtDecimal = (val: number) =>
                                new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
                            const fmtPercent = (val: number) =>
                                new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1 }).format(val / 100);

                            const isProfitable = metric.profit > 0;
                            const isSelected = selectedCampaign === metric.campaign_name;
                            const conversionsCount = metric.conversions ?? 0;
                            const clicksPerConv = conversionsCount > 0 ? metric.clicks / conversionsCount : 0;
                            const avgCpc = metric.clicks > 0 ? metric.cost / metric.clicks : 0;
                            const costPerConv = conversionsCount > 0 ? metric.cost / conversionsCount : 0;
                            const roiPercent = metric.cost > 0 ? (metric.profit / metric.cost) * 100 : 0;

                            // Commission & risk
                            const nameMatch = metric.campaign_name.match(/\$(\d+(\.\d+)?)/);
                            const extractedCommission = nameMatch ? parseFloat(nameMatch[1]) : 0;
                            const estimatedCommission = extractedCommission > 0
                                ? extractedCommission
                                : (metric.target_cpa && metric.target_cpa > 0
                                    ? metric.target_cpa
                                    : conversionsCount > 0 ? metric.conversion_value / conversionsCount : 0);

                            const showMarginBar = extractedCommission > 0 && conversionsCount === 0 && metric.cost > 0;
                            const consumption = showMarginBar ? (metric.cost / extractedCommission) * 100 : 0;

                            // Breakeven: conversions needed at current commission to cover cost
                            const breakeven = conversionsCount === 0 && estimatedCommission > 0 && metric.cost > 0
                                ? Math.ceil(metric.cost / estimatedCommission)
                                : null;

                            // Status
                            let rowStyle = 'bg-transparent border-l-[3px] border-l-transparent';
                            let statusBadge = 'bg-neutral-800 text-neutral-400 border-neutral-700';
                            let statusLabel = 'NORMAL';

                            if (conversionsCount === 0) {
                                if (estimatedCommission > 0 && metric.cost > 0.7 * estimatedCommission) {
                                    rowStyle = 'bg-rose-900/15 border-l-[3px] border-l-rose-600';
                                    statusBadge = 'bg-rose-950 text-rose-400 border-rose-800';
                                    statusLabel = 'ABORTAR';
                                } else if (estimatedCommission > 0 && metric.cost > 0.5 * estimatedCommission) {
                                    rowStyle = 'bg-orange-900/15 border-l-[3px] border-l-orange-500';
                                    statusBadge = 'bg-orange-950 text-orange-400 border-orange-800';
                                    statusLabel = 'ALERTA';
                                } else if (metric.cost > 0) {
                                    rowStyle = 'bg-transparent border-l-[3px] border-l-neutral-700';
                                    statusBadge = 'bg-neutral-800 text-neutral-500 border-neutral-700';
                                    statusLabel = 'GASTANDO';
                                } else {
                                    statusLabel = 'OCIOSO';
                                }
                            } else {
                                if (metric.profit < 0) {
                                    rowStyle = 'bg-rose-900/15 border-l-[3px] border-l-rose-600';
                                    statusBadge = 'bg-rose-950 text-rose-400 border-rose-800';
                                    statusLabel = 'PREJUÍZO';
                                } else if (metric.profit < 0.4 * metric.conversion_value) {
                                    rowStyle = 'bg-yellow-900/8 border-l-[3px] border-l-yellow-500';
                                    statusBadge = 'bg-yellow-950 text-yellow-400 border-yellow-800';
                                    statusLabel = 'QUEDA ROI';
                                } else if (roiPercent > 100) {
                                    rowStyle = 'bg-emerald-900/15 border-l-[3px] border-l-emerald-500';
                                    statusBadge = 'bg-emerald-950 text-emerald-400 border-emerald-800';
                                    statusLabel = 'ROI BRUTAL';
                                } else {
                                    rowStyle = 'bg-emerald-900/5 border-l-[3px] border-l-emerald-600/40';
                                    statusBadge = 'bg-emerald-950/50 text-emerald-500 border-emerald-900/50';
                                    statusLabel = 'LUCRO';
                                }
                            }

                            const sparkline = sparklineData?.[metric.campaign_name];

                            return (
                                <tr
                                    key={metric.id}
                                    className={`transition-colors hover:bg-neutral-800/40 group ${isSelected ? 'bg-emerald-500/8 border-l-[3px] border-l-emerald-500' : rowStyle}`}
                                >
                                    <td className="px-4 py-2.5 pl-3">
                                        <div className="flex flex-col gap-0.5">
                                            {metric.account ? (
                                                <span className="text-[9px] uppercase tracking-wider text-neutral-600">
                                                    {metric.account.name} <span className="text-neutral-800">|</span> {metric.account.google_ads_account_id}
                                                </span>
                                            ) : (
                                                <span className="text-[9px] uppercase tracking-wider text-neutral-700">Conta Não Vinculada</span>
                                            )}
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
                                            {showMarginBar && (
                                                <MarginBar consumption={consumption} commission={extractedCommission} />
                                            )}
                                        </div>
                                    </td>

                                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">
                                        {metric.budget ? fmtCurrency(metric.budget) : '-'}
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${statusBadge}`}>
                                                {statusLabel}
                                            </span>
                                            {conversionsCount === 0 && estimatedCommission > 0 && metric.cost > 0 && (
                                                <span className="text-[8px] font-mono text-neutral-600">
                                                    {fmtCurrency(metric.cost)}/{fmtCurrency(estimatedCommission)}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{fmtDecimal(clicksPerConv)}</td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">
                                        {metric.impressions ? new Intl.NumberFormat('pt-BR').format(metric.impressions) : '-'}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{new Intl.NumberFormat('pt-BR').format(metric.clicks)}</td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{fmtCurrency(avgCpc)}</td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-rose-400/70">{fmtCurrency(metric.cost)}</td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">
                                        {metric.search_absolute_top_impression_share ? fmtPercent(metric.search_absolute_top_impression_share) : '-'}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">
                                        {metric.search_top_impression_share ? fmtPercent(metric.search_top_impression_share) : '-'}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">
                                        {metric.search_impression_share ? fmtPercent(metric.search_impression_share) : '-'}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">
                                        {conversionsCount > 0 ? fmtDecimal(conversionsCount) : '-'}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[11px]">
                                        {conversionsCount > 0 ? (
                                            <span className="text-emerald-500">✓</span>
                                        ) : breakeven !== null ? (
                                            <span className="text-orange-400 font-bold">{breakeven} conv.</span>
                                        ) : (
                                            <span className="text-neutral-700">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{fmtCurrency(costPerConv)}</td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-emerald-400/70">{fmtCurrency(metric.conversion_value)}</td>
                                    <td className={`px-4 py-2.5 text-right font-mono text-[11px] font-bold ${isProfitable ? 'text-emerald-400' : 'text-rose-500'}`}>
                                        {isProfitable ? '+' : ''}{fmtCurrency(metric.profit)}
                                    </td>
                                    <td className={`px-4 py-2.5 text-right font-mono text-[11px] font-bold ${isProfitable ? 'text-emerald-400' : 'text-rose-500'}`}>
                                        {fmtPercent(roiPercent)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{metric.target_cpa ? fmtCurrency(metric.target_cpa) : '-'}</td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-neutral-500">{metric.avg_target_cpa ? fmtCurrency(metric.avg_target_cpa) : '-'}</td>
                                </tr>
                            );
                        })}

                        {metrics.length === 0 && (
                            <tr>
                                <td colSpan={19} className="px-6 py-12 text-center text-neutral-700 font-mono text-xs border-t border-neutral-800">
                                    [ Aguardando telemetria do Motor de Anúncios ]
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
