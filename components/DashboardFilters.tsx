'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface DashboardFiltersProps {
    currentFilter: string;
}

export function DashboardFilters({ currentFilter }: DashboardFiltersProps) {
    const router = useRouter();

    const filters = [
        { label: 'Hoje', value: 'today' },
        { label: 'Ontem', value: 'yesterday' },
        { label: 'Esta semana (dom. até Hoje)', value: 'this_week' },
        { label: '7 dias atrás', value: 'last_7_days' },
        { label: 'Semana passada (de dom. a sáb.)', value: 'last_week' },
        { label: '14 dias atrás', value: 'last_14_days' },
        { label: 'Este mês', value: 'this_month' },
        { label: '30 dias atrás', value: 'last_30_days' },
        { label: 'Último mês', value: 'last_month' },
        { label: 'Todo o período', value: 'all_time' },
    ];

    return (
        <div className="flex bg-neutral-900/50 p-1.5 rounded-lg border border-neutral-800 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
            <select
                className="bg-neutral-800/80 text-neutral-100 text-xs px-3 py-2 rounded border border-neutral-700 outline-none focus:border-neutral-500 w-full min-w-[240px] appearance-none"
                style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg fill="%23737373" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>')`, backgroundRepeat: 'no-repeat', backgroundPositionX: '100%', backgroundPositionY: 'center' }}
                value={currentFilter}
                onChange={(e) => {
                    router.push(`/?filter=${e.target.value}`);
                }}
            >
                {filters.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                ))}
            </select>
        </div>
    );
}
