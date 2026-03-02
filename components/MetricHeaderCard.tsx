import { ArrowDownRight, ArrowUpRight, Activity, MousePointer2 } from 'lucide-react';

interface MetricHeaderCardProps {
    title: string;
    value: string | number;
    subValue?: string;
    isCurrency?: boolean;
    suffix?: string;
    trend?: 'up' | 'down' | 'neutral';
    icon: 'click' | 'cost' | 'profit' | 'conversion' | 'roi' | 'conversions';
}

export function MetricHeaderCard({ title, value, subValue, isCurrency, suffix, trend, icon }: MetricHeaderCardProps) {
    const getIcon = () => {
        switch (icon) {
            case 'click': return <MousePointer2 className="h-4 w-4 text-neutral-400" strokeWidth={1.5} />;
            case 'cost': return <ArrowDownRight className="h-4 w-4 text-rose-500" strokeWidth={1.5} />;
            case 'profit': return <ArrowUpRight className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />;
            case 'conversion': return <Activity className="h-4 w-4 text-blue-400" strokeWidth={1.5} />;
            case 'roi': return <ArrowUpRight className="h-4 w-4 text-violet-400" strokeWidth={1.5} />;
            case 'conversions': return <Activity className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />;
        }
    };

    const formattedValue = isCurrency
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value))
        : new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Number(value));

    // Determine the text color for the value based strictly on trend or fallback to neutral white
    const valueColor = trend === 'down'
        ? 'text-rose-500'
        : trend === 'up'
            ? 'text-emerald-400'
            : 'text-neutral-100';

    return (
        <div className="group relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 transition-all hover:bg-neutral-800/60 hover:border-neutral-700">
            {/* Minimalist glow effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-br from-neutral-800 to-transparent opacity-0 group-hover:opacity-100 transition duration-500 z-0 blur"></div>

            <div className="relative z-10 flex items-center justify-between mb-4">
                <p className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">{title}</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-950/50 border border-neutral-800">
                    {getIcon()}
                </div>
            </div>

            <div className="relative z-10 flex items-baseline gap-2">
                <h3 className={`text-3xl font-light tracking-tight ${valueColor}`}>
                    {formattedValue}{suffix && <span className="text-xl ml-0.5">{suffix}</span>}
                </h3>
                {subValue && (
                    <span className="text-xs font-medium text-neutral-600">
                        {subValue}
                    </span>
                )}
            </div>
        </div>
    );
}
