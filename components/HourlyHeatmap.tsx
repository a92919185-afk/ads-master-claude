import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HourlyHeatmapProps {
    dates: string[];           // YYYY-MM-DD sorted
    grid: number[][];          // [dateIndex][hour 0-23] = profit
    costs: number[][];         // [dateIndex][hour 0-23] = cost
    maxAbs: number;
}

function getProfitStyle(profit: number, cost: number, maxAbs: number): string {
    if (cost === 0 && profit === 0) return 'rgba(23,23,23,0.4)'; // no data
    if (maxAbs === 0) return 'rgba(38,38,38,0.5)';

    const ratio = profit / maxAbs;
    if (ratio > 0) {
        const alpha = 0.12 + Math.min(ratio, 1) * 0.75;
        return `rgba(16,185,129,${alpha.toFixed(2)})`;
    }
    if (ratio < 0) {
        const alpha = 0.12 + Math.min(Math.abs(ratio), 1) * 0.75;
        return `rgba(244,63,94,${alpha.toFixed(2)})`;
    }
    return 'rgba(38,38,38,0.3)';
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function HourlyHeatmap({ dates, grid, costs, maxAbs }: HourlyHeatmapProps) {
    if (dates.length === 0) return null;

    const fmt = (v: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v);

    return (
        <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/20 overflow-hidden">
            <div className="border-b border-neutral-800 bg-neutral-900/40 px-5 py-3 flex items-center justify-between">
                <h2 className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
                    Heatmap de Performance — Hora × Dia
                </h2>
                <div className="flex items-center gap-3 text-[9px] font-mono text-neutral-600">
                    <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'rgba(16,185,129,0.7)' }} />
                        lucro
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'rgba(244,63,94,0.7)' }} />
                        perda
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'rgba(23,23,23,0.4)' }} />
                        sem dado
                    </span>
                </div>
            </div>

            <div className="overflow-x-auto p-4">
                <table className="border-separate border-spacing-[2px] w-full min-w-[700px]">
                    <thead>
                        <tr>
                            <th className="text-[9px] font-mono text-neutral-700 text-left pr-3 pb-1 w-20 shrink-0">DATA</th>
                            {HOURS.map(h => (
                                <th key={h} className="text-[8px] font-mono text-neutral-700 text-center pb-1 w-6">
                                    {String(h).padStart(2, '0')}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {dates.map((date, di) => {
                            let dateLabel = date;
                            try {
                                dateLabel = format(parseISO(date), 'dd/MM', { locale: ptBR });
                            } catch { /* keep raw */ }

                            return (
                                <tr key={date}>
                                    <td className="text-[9px] font-mono text-neutral-600 pr-3 whitespace-nowrap">{dateLabel}</td>
                                    {HOURS.map(h => {
                                        const profit = grid[di]?.[h] ?? 0;
                                        const cost = costs[di]?.[h] ?? 0;
                                        const bg = getProfitStyle(profit, cost, maxAbs);
                                        const tip = cost === 0 && profit === 0
                                            ? `${dateLabel} ${String(h).padStart(2, '0')}:00 — sem dados`
                                            : `${dateLabel} ${String(h).padStart(2, '0')}:00 — Lucro: ${fmt(profit)} | Custo: ${fmt(cost)}`;

                                        return (
                                            <td key={h} title={tip}>
                                                <div
                                                    className="w-5 h-5 rounded-sm"
                                                    style={{ background: bg }}
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
