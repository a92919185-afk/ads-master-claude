import { fmtCurrency } from '@/utils/formatters';

interface LeaderboardCampaign {
    id: string;
    campaign_name: string;
    profit: number;
    cost: number;
    conversions?: number;
    conversion_value: number;
    target_cpa?: number;
    status?: string; // 'ENABLED' | 'PAUSED' | 'REMOVED'
}

interface LeaderboardProps {
    campaigns: LeaderboardCampaign[];
    currentFilter?: string;
    isProductView?: boolean;
}

// Extract commission per sale from campaign name ($XX pattern)
// Fallback: target_cpa > avg conversion value
function extractCommission(c: LeaderboardCampaign): number {
    const match = c.campaign_name.match(/\$\s*(\d+(\.\d+)?)/);
    if (match) return parseFloat(match[1]);
    if (c.target_cpa && c.target_cpa > 0) return c.target_cpa;
    if ((c.conversions ?? 0) > 0) return (c.conversion_value ?? 0) / (c.conversions ?? 1);
    return 0;
}

export function Leaderboard({ campaigns, currentFilter, isProductView }: LeaderboardProps) {
    if (campaigns.length === 0) return null;

    const sorted = [...campaigns].sort((a, b) => b.profit - a.profit);
    const gainers = sorted.slice(0, 10);
    const losers = [...sorted].reverse().slice(0, 10);
    const maxAbs = Math.max(...campaigns.map(c => Math.abs(c.profit)), 1);

    const makeHref = (c: LeaderboardCampaign) =>
        isProductView
            ? `/?filter=${currentFilter || 'today'}&view=product`
            : `/?filter=${currentFilter || 'today'}&campaign=${encodeURIComponent(c.campaign_name)}`;

    const Row = ({ c, index, side }: { c: LeaderboardCampaign; index: number; side: 'gain' | 'loss' }) => {
        const pct = (Math.abs(c.profit) / maxAbs) * 100;
        const name = c.campaign_name.length > 28 ? c.campaign_name.slice(0, 26) + '…' : c.campaign_name;
        const isLoss = c.profit < 0;
        const color = side === 'gain' ? 'rgba(16,185,129,0.07)' : 'rgba(244,63,94,0.07)';
        const roi = c.cost > 0 ? (c.profit / c.cost) * 100 : 0;
        const roiColor = roi > 100 ? 'text-emerald-300' : roi > 0 ? 'text-emerald-500' : roi < -50 ? 'text-rose-400' : 'text-rose-500';

        // Commission per sale (from $XX in campaign name)
        const commission = extractCommission(c);
        const conv = c.conversions ?? 0;

        // Total revenue based on conversions × commission
        const totalRevenue = conv > 0 ? conv * commission : 0;

        // % Gasto calculation:
        // - With conversions: cost / (conversions × commission) → shows ad cost as % of revenue
        // - Without conversions: cost / commission → shows how far toward needing 1 sale to break even
        const revenueBase = conv > 0 ? totalRevenue : commission;
        const spentPct = revenueBase > 0 ? (c.cost / revenueBase) * 100 : 0;

        // Color coding for % gasto
        const spentColor = conv > 0
            // With conversions: lower = better margin to scale
            ? spentPct <= 40 ? 'text-emerald-300' : spentPct <= 70 ? 'text-emerald-500' : spentPct <= 100 ? 'text-orange-400' : 'text-rose-400'
            // Without conversions: how close to burning 1 commission
            : spentPct >= 70 ? 'text-rose-400' : spentPct >= 50 ? 'text-orange-400' : 'text-emerald-500';

        return (
            <a
                href={makeHref(c)}
                className="relative flex items-center gap-2 px-4 py-2.5 hover:bg-neutral-800/40 transition-colors overflow-hidden group"
            >
                <div
                    className="absolute inset-y-0 left-0 transition-all group-hover:opacity-150"
                    style={{ width: `${pct}%`, background: color }}
                />
                {/* Rank */}
                <span className="relative text-[10px] font-mono text-neutral-700 w-5 shrink-0 text-right">#{index + 1}</span>
                {/* Status badge: Ativa / Pausada */}
                {c.status && (
                    <span className={`relative text-[8px] font-bold font-mono px-1.5 py-0.5 rounded shrink-0 ${c.status === 'PAUSED'
                        ? 'bg-yellow-950/60 text-yellow-500 border border-yellow-800/60'
                        : c.status === 'ENABLED'
                            ? 'bg-emerald-950/40 text-emerald-600 border border-emerald-900/60'
                            : 'bg-neutral-900 text-neutral-600 border border-neutral-800'
                        }`}>
                        {c.status === 'PAUSED' ? 'PAUSADA' : c.status === 'ENABLED' ? 'ATIVA' : c.status}
                    </span>
                )}
                {/* Name */}
                <span className="relative text-[11px] font-mono text-neutral-300 flex-1 truncate">{name}</span>
                {/* ROI% */}
                <span className={`relative text-[10px] font-mono font-bold shrink-0 w-14 text-right ${roiColor}`}>
                    {roi >= 0 ? '+' : ''}{roi.toFixed(0)}%
                </span>
                {/* Commission per sale */}
                <span className="relative text-[10px] font-mono text-neutral-500 shrink-0 w-14 text-right">
                    {commission > 0 ? fmtCurrency(commission) : '—'}
                </span>
                {/* % Spent relative to revenue/commission */}
                <span className={`relative text-[9px] font-mono font-bold shrink-0 w-14 text-right ${commission > 0 ? spentColor : 'text-neutral-700'}`}>
                    {commission > 0
                        ? conv > 0
                            ? `${spentPct.toFixed(0)}%/${conv}`
                            : `${spentPct.toFixed(0)}%`
                        : '—'
                    }
                </span>
                {/* Cost */}
                <span className="relative text-[10px] font-mono text-neutral-600 shrink-0 w-16 text-right">
                    {fmtCurrency(c.cost)}
                </span>
                {/* Profit */}
                <span className={`relative text-[11px] font-bold font-mono shrink-0 w-20 text-right ${side === 'gain' ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-orange-400'}`}>
                    {c.profit >= 0 ? '+' : ''}{fmtCurrency(c.profit)}
                </span>
            </a>
        );
    };

    return (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/20 overflow-hidden">
                <div className="border-b border-neutral-800 bg-neutral-900/40 px-4 py-3 flex items-center justify-between">
                    <h2 className="text-[10px] font-semibold tracking-widest text-emerald-400 uppercase">
                        Top 10 — Maiores Lucros
                    </h2>
                    <div className="flex items-center gap-3 text-[8px] font-mono text-neutral-700 uppercase tracking-wider">
                        <span className="w-14 text-right">ROI</span>
                        <span className="w-14 text-right">Comis.</span>
                        <span className="w-14 text-right">% Gasto</span>
                        <span className="w-16 text-right">Custo</span>
                        <span className="w-20 text-right">Lucro</span>
                    </div>
                </div>
                <div className="divide-y divide-neutral-800/50">
                    {gainers.map((c, i) => <Row key={c.id || i} c={c} index={i} side="gain" />)}
                    {gainers.length === 0 && (
                        <div className="px-4 py-6 text-center text-neutral-700 text-xs font-mono">sem dados</div>
                    )}
                </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/20 overflow-hidden">
                <div className="border-b border-neutral-800 bg-neutral-900/40 px-4 py-3 flex items-center justify-between">
                    <h2 className="text-[10px] font-semibold tracking-widest text-rose-400 uppercase">
                        Top 10 — Maiores Perdas / Riscos
                    </h2>
                    <div className="flex items-center gap-3 text-[8px] font-mono text-neutral-700 uppercase tracking-wider">
                        <span className="w-14 text-right">ROI</span>
                        <span className="w-14 text-right">Comis.</span>
                        <span className="w-14 text-right">% Gasto</span>
                        <span className="w-16 text-right">Custo</span>
                        <span className="w-20 text-right">Lucro</span>
                    </div>
                </div>
                <div className="divide-y divide-neutral-800/50">
                    {losers.map((c, i) => <Row key={c.id || i} c={c} index={i} side="loss" />)}
                    {losers.length === 0 && (
                        <div className="px-4 py-6 text-center text-neutral-700 text-xs font-mono">sem dados</div>
                    )}
                </div>
            </div>
        </div>
    );
}
