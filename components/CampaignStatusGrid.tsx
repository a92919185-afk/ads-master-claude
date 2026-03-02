interface GridCampaign {
    id: string;
    campaign_name: string;
    cost: number;
    profit: number;
    conversions?: number;
    conversion_value: number;
    target_cpa?: number;
}

interface CampaignStatusGridProps {
    campaigns: GridCampaign[];
    currentFilter?: string;
    isProductView?: boolean;
}

function getStatus(c: GridCampaign) {
    const conv = c.conversions ?? 0;
    const nameMatch = c.campaign_name.match(/\$(\d+(\.\d+)?)/);
    const commission = nameMatch ? parseFloat(nameMatch[1]) : (c.target_cpa ?? 0);
    const roi = c.cost > 0 ? (c.profit / c.cost) * 100 : 0;

    if (conv === 0) {
        if (commission > 0 && c.cost > 0.7 * commission)
            return { label: 'ABORTAR', card: 'bg-rose-950/70 border-rose-800/60', dot: 'bg-rose-500', value: 'text-rose-400' };
        if (commission > 0 && c.cost > 0.5 * commission)
            return { label: 'ALERTA', card: 'bg-orange-950/60 border-orange-800/50', dot: 'bg-orange-500', value: 'text-orange-400' };
        if (c.cost > 0)
            return { label: 'GASTANDO', card: 'bg-neutral-900/70 border-neutral-800', dot: 'bg-neutral-600', value: 'text-neutral-500' };
        return { label: 'OCIOSO', card: 'bg-neutral-900/30 border-neutral-800/40', dot: 'bg-neutral-700', value: 'text-neutral-600' };
    }

    if (c.profit < 0)
        return { label: 'PREJUÍZO', card: 'bg-rose-950/70 border-rose-800/60', dot: 'bg-rose-500', value: 'text-rose-400' };
    if (c.profit < 0.4 * c.conversion_value)
        return { label: 'QUEDA ROI', card: 'bg-yellow-950/50 border-yellow-800/40', dot: 'bg-yellow-500', value: 'text-yellow-400' };
    if (roi > 100)
        return { label: 'ROI BRUTAL', card: 'bg-emerald-900/50 border-emerald-700/60', dot: 'bg-emerald-400', value: 'text-emerald-300' };
    return { label: 'LUCRO', card: 'bg-emerald-950/35 border-emerald-800/35', dot: 'bg-emerald-600', value: 'text-emerald-400' };
}

export function CampaignStatusGrid({ campaigns, currentFilter, isProductView }: CampaignStatusGridProps) {
    if (campaigns.length === 0) return null;

    const fmt = (v: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

    return (
        <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">Command Center</h2>
                <span className="text-[9px] font-mono text-neutral-700 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
                    {campaigns.length} {isProductView ? 'produtos' : 'campanhas'}
                </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-12 gap-1.5">
                {campaigns.map((c) => {
                    const status = getStatus(c);
                    const roi = c.cost > 0 ? (c.profit / c.cost) * 100 : 0;
                    const short = c.campaign_name.length > 22 ? c.campaign_name.slice(0, 20) + '…' : c.campaign_name;
                    const href = isProductView
                        ? `/?filter=${currentFilter || 'today'}&view=product`
                        : `/?filter=${currentFilter || 'today'}&campaign=${encodeURIComponent(c.campaign_name)}`;

                    return (
                        <a
                            key={c.id}
                            href={href}
                            title={c.campaign_name}
                            className={`flex flex-col gap-1.5 p-2.5 rounded-lg border ${status.card} hover:opacity-75 transition-opacity`}
                        >
                            <div className="flex items-center gap-1">
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.dot}`} />
                                <span className={`text-[7px] font-bold uppercase tracking-wider truncate ${status.value}`}>
                                    {status.label}
                                </span>
                            </div>
                            <span className="text-[9px] font-mono text-neutral-400 leading-tight line-clamp-2">{short}</span>
                            <div className="mt-auto pt-1 border-t border-neutral-800/50">
                                <div className={`text-[11px] font-bold font-mono ${c.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {c.profit >= 0 ? '+' : ''}{fmt(c.profit)}
                                </div>
                                <div className="text-[8px] font-mono text-neutral-600">ROI {roi.toFixed(0)}%</div>
                            </div>
                        </a>
                    );
                })}
            </div>
        </div>
    );
}
