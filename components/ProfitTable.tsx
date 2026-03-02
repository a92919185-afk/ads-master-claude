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
}

export function ProfitTable({ metrics, selectedCampaign, currentFilter }: ProfitTableProps) {
    return (
        <div className="mt-8 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/20 backdrop-blur-sm">
            <div className="border-b border-neutral-800 bg-neutral-900/40 px-6 py-5">
                <h2 className="text-sm font-semibold tracking-wide text-neutral-300 uppercase">Operações Atuais</h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-neutral-900/20">
                        <tr>
                            <th className="px-5 py-4 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase border-b border-neutral-800">Conta / Campanha</th>
                            <th className="px-5 py-4 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase text-right border-b border-neutral-800">Orçamento</th>
                            <th className="px-5 py-4 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase text-center border-b border-neutral-800">Status</th>
                            <th className="px-5 py-4 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase text-right border-b border-neutral-800">Cliques/Conv.</th>
                            <th className="px-5 py-4 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase text-right border-b border-neutral-800">Impr.</th>
                            <th className="px-5 py-4 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase text-right border-b border-neutral-800">Cliques</th>
                            <th className="px-5 py-4 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase text-right border-b border-neutral-800">CPC méd.</th>
                            <th className="px-5 py-4 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase text-right border-b border-neutral-800">Custo</th>
                            <th className="px-5 py-4 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase text-right border-b border-neutral-800">% Impr. (1ª pos)</th>
                            <th className="px-5 py-4 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase text-right border-b border-neutral-800">% Impr. (sup)</th>
                            <th className="px-5 py-4 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase text-right border-b border-neutral-800">Parc. Impr. Seg.</th>
                            <th className="px-5 py-4 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase text-right border-b border-neutral-800">Conversões</th>
                            <th className="px-5 py-4 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase text-right border-b border-neutral-800">Custo/Conv.</th>
                            <th className="px-5 py-4 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase text-right border-b border-neutral-800">Valor Conv.</th>
                            <th className="px-5 py-4 text-[10px] font-bold tracking-widest text-neutral-100 uppercase text-right border-b border-neutral-800">Lucro Net</th>
                            <th className="px-5 py-4 text-[10px] font-bold tracking-widest text-neutral-100 uppercase text-right border-b border-neutral-800">ROI %</th>
                            <th className="px-5 py-4 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase text-right border-b border-neutral-800">CPA des.</th>
                            <th className="px-5 py-4 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase text-right border-b border-neutral-800">CPA md. des.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/50">
                        {metrics.map((metric) => {
                            const formatCurrency = (val: number) =>
                                new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

                            const formatDecimal = (val: number) =>
                                new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

                            const formatPercent = (val: number) =>
                                new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2 }).format(val / 100);

                            const isProfitable = metric.profit > 0;
                            const isSelected = selectedCampaign === metric.campaign_name;

                            // Calculations
                            const conversionsCount = metric.conversions || 0;
                            const clicksPerConv = conversionsCount > 0 ? (metric.clicks / conversionsCount) : 0;
                            const avgCpc = metric.clicks > 0 ? (metric.cost / metric.clicks) : 0;
                            const costPerConv = conversionsCount > 0 ? (metric.cost / conversionsCount) : 0;
                            const roiPercent = metric.cost > 0 ? (metric.profit / metric.cost) * 100 : 0;

                            // Risk Management & Colors Logic (US-008 & US-009)
                            // Risk Management & Colors Logic (US-008 & US-009)
                            const nameMatch = metric.campaign_name.match(/\$\s*(\d+(\.\d+)?)/);
                            const extractedCommission = nameMatch ? parseFloat(nameMatch[1]) : 0;

                            const estimatedCommission = extractedCommission > 0
                                ? extractedCommission
                                : (metric.target_cpa && metric.target_cpa > 0
                                    ? metric.target_cpa
                                    : (conversionsCount > 0 ? metric.conversion_value / conversionsCount : 0));

                            let rowStyle = 'bg-transparent border-l-[3px] border-l-transparent';
                            let statusBadge = 'bg-neutral-800 text-neutral-400 border-neutral-700';
                            let statusLabel = 'NORMAL';

                            if (conversionsCount === 0) {
                                if (estimatedCommission > 0 && metric.cost > 0.7 * estimatedCommission) {
                                    rowStyle = 'bg-rose-900/20 border-l-[3px] border-l-rose-600';
                                    statusBadge = 'bg-rose-950 text-rose-400 border-rose-800';
                                    statusLabel = 'ABORTAR';
                                } else if (estimatedCommission > 0 && metric.cost > 0.5 * estimatedCommission) {
                                    rowStyle = 'bg-orange-900/20 border-l-[3px] border-l-orange-500';
                                    statusBadge = 'bg-orange-950 text-orange-400 border-orange-800';
                                    statusLabel = 'ALERTA';
                                } else if (metric.cost > 0) {
                                    rowStyle = 'bg-transparent border-l-[3px] border-l-neutral-700';
                                    statusBadge = 'bg-neutral-800 text-neutral-400 border-neutral-700';
                                    statusLabel = 'GASTANDO';
                                } else {
                                    statusLabel = 'OCIOSO';
                                }
                            } else {
                                if (metric.profit < 0) {
                                    rowStyle = 'bg-rose-900/20 border-l-[3px] border-l-rose-600';
                                    statusBadge = 'bg-rose-950 text-rose-400 border-rose-800';
                                    statusLabel = 'PREJUÍZO';
                                } else if (metric.profit < 0.4 * metric.conversion_value) {
                                    rowStyle = 'bg-yellow-900/10 border-l-[3px] border-l-yellow-500';
                                    statusBadge = 'bg-yellow-950 text-yellow-400 border-yellow-800';
                                    statusLabel = 'QUEDA ROI';
                                } else if (roiPercent > 100) {
                                    rowStyle = 'bg-emerald-900/20 border-l-[3px] border-l-emerald-500';
                                    statusBadge = 'bg-emerald-950 text-emerald-400 border-emerald-800';
                                    statusLabel = 'ROI BRUTAL';
                                } else {
                                    rowStyle = 'bg-emerald-900/5 border-l-[3px] border-l-emerald-400/50';
                                    statusBadge = 'bg-emerald-950/50 text-emerald-500 border-emerald-900/50';
                                    statusLabel = 'LUCRO';
                                }
                            }

                            return (
                                <tr key={metric.id} className={`transition-colors hover:bg-neutral-800/50 group ${isSelected ? 'bg-emerald-500/10 border-l-[3px] border-l-emerald-500' : rowStyle}`}>
                                    <td className="px-5 py-3 pl-4">
                                        <div className="flex flex-col">
                                            {metric.account ? (
                                                <span className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">
                                                    {metric.account.name} <span className="text-neutral-700">|</span> {metric.account.google_ads_account_id}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] uppercase tracking-wider text-neutral-600 mb-0.5">
                                                    Conta Não Vinculada
                                                </span>
                                            )}
                                            <a
                                                href={`?filter=${currentFilter || 'today'}&campaign=${encodeURIComponent(metric.campaign_name)}`}
                                                className="font-mono text-xs text-neutral-300 group-hover:text-emerald-400 transition-colors cursor-pointer hover:underline decoration-emerald-500/50 underline-offset-4"
                                            >
                                                {metric.campaign_name}
                                            </a>
                                            {(() => {
                                                if (extractedCommission > 0 && metric.cost > 0) {
                                                    const consumption = (metric.cost / extractedCommission) * 100;
                                                    let colorClass = 'text-emerald-500';
                                                    if (consumption >= 70) colorClass = 'text-rose-500';
                                                    else if (consumption >= 50) colorClass = 'text-yellow-500';

                                                    return (
                                                        <span className={`text-[9px] font-bold mt-1 ${colorClass}`}>
                                                            {conversionsCount > 0 ? 'ROI Potencial: ' : 'Consumo Margem: '}
                                                            {consumption.toFixed(1)}% de ${extractedCommission}
                                                        </span>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono text-xs text-neutral-400">{metric.budget ? formatCurrency(metric.budget) : '-'}</td>
                                    <td className="px-5 py-3 text-center text-xs">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${statusBadge}`}>
                                                {statusLabel}
                                            </span>
                                            {estimatedCommission > 0 && metric.cost > 0 && (
                                                <span className="text-[9px] font-mono text-neutral-500" title="Custo vs Comissão Estimada">
                                                    {formatCurrency(metric.cost)}/{formatCurrency(estimatedCommission)}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono text-xs text-neutral-400">{formatDecimal(clicksPerConv)}</td>
                                    <td className="px-5 py-3 text-right font-mono text-xs text-neutral-400">{metric.impressions ? new Intl.NumberFormat('pt-BR').format(metric.impressions) : '-'}</td>
                                    <td className="px-5 py-3 text-right font-mono text-xs text-neutral-400">{new Intl.NumberFormat('pt-BR').format(metric.clicks)}</td>
                                    <td className="px-5 py-3 text-right font-mono text-xs text-neutral-400">{formatCurrency(avgCpc)}</td>
                                    <td className="px-5 py-3 text-right font-mono text-xs text-rose-400/80">{formatCurrency(metric.cost)}</td>

                                    <td className="px-5 py-3 text-right font-mono text-xs text-neutral-400">{metric.search_absolute_top_impression_share ? formatPercent(metric.search_absolute_top_impression_share) : '-'}</td>
                                    <td className="px-5 py-3 text-right font-mono text-xs text-neutral-400">{metric.search_top_impression_share ? formatPercent(metric.search_top_impression_share) : '-'}</td>
                                    <td className="px-5 py-3 text-right font-mono text-xs text-neutral-400">{metric.search_impression_share ? formatPercent(metric.search_impression_share) : '-'}</td>

                                    <td className="px-5 py-3 text-right font-mono text-xs text-neutral-400">{conversionsCount > 0 ? formatDecimal(conversionsCount) : '-'}</td>
                                    <td className="px-5 py-3 text-right font-mono text-xs text-neutral-400">{formatCurrency(costPerConv)}</td>
                                    <td className="px-5 py-3 text-right font-mono text-xs text-emerald-400/80">{formatCurrency(metric.conversion_value)}</td>

                                    <td className={`px-5 py-3 text-right font-mono text-xs font-bold ${isProfitable ? 'text-emerald-400' : 'text-rose-500'}`}>
                                        {isProfitable ? '+' : ''}{formatCurrency(metric.profit)}
                                    </td>
                                    <td className={`px-5 py-3 text-right font-mono text-xs font-bold ${isProfitable ? 'text-emerald-400' : 'text-rose-500'}`}>
                                        {formatPercent(roiPercent)}
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono text-xs text-neutral-400">{metric.target_cpa ? formatCurrency(metric.target_cpa) : '-'}</td>
                                    <td className="px-5 py-3 text-right font-mono text-xs text-neutral-400">{metric.avg_target_cpa ? formatCurrency(metric.avg_target_cpa) : '-'}</td>
                                </tr>
                            );
                        })}

                        {metrics.length === 0 && (
                            <tr>
                                <td colSpan={18} className="px-6 py-12 text-center text-neutral-600 font-mono text-xs border-t border-neutral-800">
                                    [  Aguardando telemetria do Motor de Anúncios  ]
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
