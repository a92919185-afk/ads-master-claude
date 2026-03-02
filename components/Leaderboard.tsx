interface LeaderboardCampaign {
    id: string;
    campaign_name: string;
    profit: number;
    cost: number;
    conversions?: number;
}

interface LeaderboardProps {
    campaigns: LeaderboardCampaign[];
    currentFilter?: string;
    isProductView?: boolean;
}

export function Leaderboard({ campaigns, currentFilter, isProductView }: LeaderboardProps) {
    if (campaigns.length === 0) return null;

    const fmt = (v: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

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
        const name = c.campaign_name.length > 34 ? c.campaign_name.slice(0, 32) + '…' : c.campaign_name;
        const isLoss = c.profit < 0;
        const color = side === 'gain' ? 'rgba(16,185,129,0.07)' : 'rgba(244,63,94,0.07)';

        return (
            <a
                href={makeHref(c)}
                className="relative flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-800/40 transition-colors overflow-hidden group"
            >
                <div
                    className="absolute inset-y-0 left-0 transition-all group-hover:opacity-150"
                    style={{ width: `${pct}%`, background: color }}
                />
                <span className="relative text-[10px] font-mono text-neutral-700 w-5 shrink-0 text-right">#{index + 1}</span>
                <span className="relative text-[11px] font-mono text-neutral-300 flex-1 truncate">{name}</span>
                <span className={`relative text-[11px] font-bold font-mono shrink-0 ${side === 'gain' ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-orange-400'}`}>
                    {c.profit >= 0 ? '+' : ''}{fmt(c.profit)}
                </span>
            </a>
        );
    };

    return (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/20 overflow-hidden">
                <div className="border-b border-neutral-800 bg-neutral-900/40 px-4 py-3">
                    <h2 className="text-[10px] font-semibold tracking-widest text-emerald-400 uppercase">
                        Top 10 — Maiores Lucros
                    </h2>
                </div>
                <div className="divide-y divide-neutral-800/50">
                    {gainers.map((c, i) => <Row key={c.id || i} c={c} index={i} side="gain" />)}
                    {gainers.length === 0 && (
                        <div className="px-4 py-6 text-center text-neutral-700 text-xs font-mono">sem dados</div>
                    )}
                </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/20 overflow-hidden">
                <div className="border-b border-neutral-800 bg-neutral-900/40 px-4 py-3">
                    <h2 className="text-[10px] font-semibold tracking-widest text-rose-400 uppercase">
                        Top 10 — Maiores Perdas / Riscos
                    </h2>
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
