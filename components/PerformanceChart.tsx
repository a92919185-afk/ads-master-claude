"use client";

import { useMemo } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CampaignMetric {
    date: string;
    hour: number;
    cost: number;
    conversion_value: number;
    profit: number;
}

interface PerformanceChartProps {
    metrics: CampaignMetric[];
    dateRange?: { start: string; end: string };
    commissionValue?: number;
}

export function PerformanceChart({ metrics, dateRange, commissionValue }: PerformanceChartProps) {
    const isSingleDay = dateRange && dateRange.start === dateRange.end;

    const chartData = useMemo(() => {
        const grouped: Record<string, { label: string; cost: number; revenue: number; profit: number; fullDate?: string }> = {};

        if (isSingleDay && dateRange) {
            // Only create buckets for hours that actually have metrics
            metrics.forEach((curr) => {
                const hourKey = (curr.hour || 0).toString();
                const hourLabel = `${String(curr.hour || 0).padStart(2, '0')}:00`;

                if (!grouped[hourKey]) {
                    grouped[hourKey] = { label: hourLabel, cost: 0, revenue: 0, profit: 0, fullDate: dateRange.start };
                }

                grouped[hourKey].cost += Number(curr.cost) || 0;
                grouped[hourKey].revenue += Number(curr.conversion_value) || 0;
                grouped[hourKey].profit += Number(curr.profit) || 0;
            });

            return Object.values(grouped).sort((a, b) => {
                return parseInt(a.label) - parseInt(b.label);
            });
        }

        // Default: Daily grouping
        const dailyGrouped: Record<string, { label: string; cost: number; revenue: number; profit: number }> = {};

        if (dateRange && dateRange.start && dateRange.end) {
            let [sy, sm, sd] = dateRange.start.split('-');
            let [ey, em, ed] = dateRange.end.split('-');
            const startDate = new Date(Date.UTC(Number(sy), Number(sm) - 1, Number(sd), 12, 0, 0));
            const endDate = new Date(Date.UTC(Number(ey), Number(em) - 1, Number(ed), 12, 0, 0));
            const currDate = new Date(startDate.getTime());

            while (currDate <= endDate) {
                const dateKey = currDate.toISOString().split("T")[0];
                dailyGrouped[dateKey] = { label: dateKey, cost: 0, revenue: 0, profit: 0 };
                currDate.setDate(currDate.getDate() + 1);
            }
        }

        metrics.forEach((curr) => {
            const dateKey = curr.date;
            if (!dailyGrouped[dateKey]) {
                dailyGrouped[dateKey] = { label: dateKey, cost: 0, revenue: 0, profit: 0 };
            }
            dailyGrouped[dateKey].cost += Number(curr.cost) || 0;
            dailyGrouped[dateKey].revenue += Number(curr.conversion_value) || 0;
            dailyGrouped[dateKey].profit += Number(curr.profit) || 0;
        });

        return Object.values(dailyGrouped).sort((a, b) => a.label.localeCompare(b.label));
    }, [metrics, dateRange, isSingleDay]);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

    return (
        <div className="h-72 w-full mt-8 p-4 rounded-xl border border-neutral-800 bg-neutral-900/20 backdrop-blur-sm">
            <div className="mb-4">
                <h2 className="text-sm font-semibold tracking-wide text-neutral-300 uppercase">
                    Timeline de Performance Global
                </h2>
            </div>
            <ResponsiveContainer width="100%" height="80%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    {/* Linha de grid removida completamente */}
                    <XAxis
                        dataKey="label"
                        tickFormatter={(str) => {
                            if (isSingleDay) return str; // Já é "HH:00"
                            try {
                                return format(parseISO(str), "dd/MM");
                            } catch {
                                return str;
                            }
                        }}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#737373", fontSize: 10 }}
                        dy={10}
                        minTickGap={20}
                        interval={isSingleDay ? 2 : "preserveStartEnd"}
                    />
                    <YAxis
                        yAxisId="left"
                        tickFormatter={(val) => `$${val}`}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#737373", fontSize: 12 }}
                        width={70}
                    />
                    {commissionValue && commissionValue > 0 && (
                        <ReferenceLine
                            yAxisId="left"
                            y={commissionValue}
                            stroke="#f43f5e"
                            strokeDasharray="3 3"
                            label={{
                                value: `Ref. $${commissionValue}`,
                                fill: '#f43f5e',
                                position: 'right',
                                fontSize: 10,
                                fontWeight: 'bold'
                            }}
                        />
                    )}
                    <Tooltip
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-neutral-900 border border-neutral-800 p-3 rounded-lg shadow-xl">
                                        <p className="text-neutral-400 text-xs mb-2">
                                            {isSingleDay
                                                ? `${payload[0]?.payload?.fullDate === new Date().toISOString().split('T')[0] ? 'Hoje' : 'Ontem'}, às ${label}`
                                                : label ? format(parseISO(String(label)), "dd 'de' MMMM", { locale: ptBR }) : ''
                                            }
                                        </p>
                                        {payload.map((entry: { name: string; value: number; color: string }) => (
                                            <div key={entry.name} className="flex items-center gap-3 mb-1">
                                                <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: entry.color }}
                                                />
                                                <span className="text-xs text-neutral-300 font-medium w-16">
                                                    {entry.name === "revenue" && "Receita"}
                                                    {entry.name === "cost" && "Custo"}
                                                    {entry.name === "profit" && "Lucro"}
                                                </span>
                                                <span
                                                    className={`text-xs font-mono font-semibold ${entry.name === "profit"
                                                        ? entry.value >= 0
                                                            ? "text-emerald-400"
                                                            : "text-rose-400"
                                                        : "text-neutral-100"
                                                        }`}
                                                >
                                                    {formatCurrency(entry.value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                        name="revenue"
                        dot={false}
                        activeDot={{ r: 6, strokeWidth: 0, fill: "#10b981" }}
                    />
                    <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="cost"
                        stroke="#f43f5e"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorCost)"
                        name="cost"
                        dot={false}
                        activeDot={{ r: 6, strokeWidth: 0, fill: "#f43f5e" }}
                    />
                    <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="profit"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorProfit)"
                        name="profit"
                        dot={false}
                        activeDot={{ r: 6, strokeWidth: 0, fill: "#3b82f6" }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
