import { getGridStatus } from '@/utils/campaignStatus';
import { fmtCurrencyCompact } from '@/utils/formatters';

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

export function CampaignStatusGrid({ campaigns, currentFilter, isProductView }: CampaignStatusGridProps) {
    if (campaigns.length === 0) return null;

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
                    const status = getGridStatus(c);
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
                                    {c.profit >= 0 ? '+' : ''}{fmtCurrencyCompact(c.profit)}
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
