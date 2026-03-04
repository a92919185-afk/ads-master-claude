'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useRef, useEffect, useCallback } from 'react';

interface DashboardFiltersProps {
    currentFilter: string;
}

// ─── Preset Configuration ────────────────────────────────────────────────────
interface PresetItem {
    label: string;
    value: string;
    isCustom?: boolean;
}
interface PresetGroup {
    items: PresetItem[];
}

const PRESET_GROUPS: PresetGroup[] = [
    {
        items: [
            { label: 'Personalizar', value: 'custom_range', isCustom: true },
        ],
    },
    {
        items: [
            { label: 'Hoje', value: 'today' },
            { label: 'Ontem', value: 'yesterday' },
        ],
    },
    {
        items: [
            { label: 'Últimos 7 dias', value: 'last_7_days' },
            { label: 'Últimos 14 dias', value: 'last_14_days' },
            { label: 'Últimos 30 dias', value: 'last_30_days' },
        ],
    },
    {
        items: [
            { label: 'Esta semana (dom até hoje)', value: 'this_week' },
            { label: 'Semana passada (dom a sáb)', value: 'last_week' },
        ],
    },
    {
        items: [
            { label: 'Este mês', value: 'this_month' },
            { label: 'Último mês', value: 'last_month' },
        ],
    },
    {
        items: [
            { label: 'Todo o período', value: 'all_time' },
        ],
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getTodayBR(): Date {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const [m, d, y] = formatter.format(new Date()).split('/');
    return new Date(Number(y), Number(m) - 1, Number(d));
}

function formatDateBR(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: 'short', year: 'numeric',
    }).format(date);
}

function formatYMD(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

function getFilterLabel(filter: string, searchParams: URLSearchParams): string {
    // Check for custom display labels
    const customFrom = searchParams.get('from');
    const customTo = searchParams.get('to');
    const customDays = searchParams.get('days');
    const anchor = searchParams.get('anchor');

    if (filter === 'custom_range' && customFrom && customTo) {
        const from = new Date(customFrom + 'T12:00:00');
        const to = new Date(customTo + 'T12:00:00');
        return `${formatDateBR(from)} – ${formatDateBR(to)}`;
    }
    if (filter === 'custom_days_today' && customDays) {
        return `Últimos ${customDays} dias (até hoje)`;
    }
    if (filter === 'custom_days_yesterday' && customDays) {
        return `Últimos ${customDays} dias (até ontem)`;
    }

    const all = PRESET_GROUPS.flatMap(g => g.items);
    const found = all.find(f => f.value === filter);
    if (found) {
        if (filter === 'today') {
            return `Hoje (${formatDateBR(getTodayBR())})`;
        }
        if (filter === 'yesterday') {
            const d = new Date(getTodayBR().getTime() - 86400000);
            return `Ontem (${formatDateBR(d)})`;
        }
        return found.label;
    }

    return 'Hoje';
}

// ─── Mini Calendar Component ─────────────────────────────────────────────────
function MiniCalendar({
    selectedFrom,
    selectedTo,
    onSelect,
    month,
    year,
    onMonthChange,
}: {
    selectedFrom: Date | null;
    selectedTo: Date | null;
    onSelect: (date: Date) => void;
    month: number;
    year: number;
    onMonthChange: (m: number, y: number) => void;
}) {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
    const dayNames = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    const today = getTodayBR();
    const todayStr = formatYMD(today);

    const prevMonth = () => {
        if (month === 0) onMonthChange(11, year - 1);
        else onMonthChange(month - 1, year);
    };
    const nextMonth = () => {
        if (month === 11) onMonthChange(0, year + 1);
        else onMonthChange(month + 1, year);
    };

    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];

    const isInRange = (day: number): boolean => {
        if (!selectedFrom || !selectedTo) return false;
        const d = new Date(year, month, day);
        return d >= selectedFrom && d <= selectedTo;
    };

    const isStart = (day: number): boolean => {
        if (!selectedFrom) return false;
        return formatYMD(new Date(year, month, day)) === formatYMD(selectedFrom);
    };

    const isEnd = (day: number): boolean => {
        if (!selectedTo) return false;
        return formatYMD(new Date(year, month, day)) === formatYMD(selectedTo);
    };

    return (
        <div className="select-none">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-2 px-1">
                <button onClick={prevMonth} className="text-neutral-400 hover:text-white p-1 rounded hover:bg-neutral-700 transition-colors text-xs">
                    ◂
                </button>
                <span className="text-xs font-medium text-neutral-200">
                    {monthNames[month]} {year}
                </span>
                <button onClick={nextMonth} className="text-neutral-400 hover:text-white p-1 rounded hover:bg-neutral-700 transition-colors text-xs">
                    ▸
                </button>
            </div>

            {/* Day Names */}
            <div className="grid grid-cols-7 gap-0 mb-1">
                {dayNames.map((d, i) => (
                    <div key={i} className="text-center text-[10px] text-neutral-500 font-medium py-1">
                        {d}
                    </div>
                ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-0">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-7" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = formatYMD(new Date(year, month, day));
                    const isFuture = dateStr > todayStr;
                    const inRange = isInRange(day);
                    const start = isStart(day);
                    const end = isEnd(day);
                    const isToday = dateStr === todayStr;

                    return (
                        <button
                            key={day}
                            disabled={isFuture}
                            onClick={() => !isFuture && onSelect(new Date(year, month, day))}
                            className={`
                                h-7 text-[11px] relative transition-all duration-100
                                ${isFuture ? 'text-neutral-700 cursor-not-allowed' : 'hover:bg-neutral-600 cursor-pointer'}
                                ${inRange && !start && !end ? 'bg-emerald-500/15 text-emerald-300' : ''}
                                ${start || end ? 'bg-emerald-500 text-black font-bold rounded' : ''}
                                ${start && !end ? 'rounded-r-none' : ''}
                                ${end && !start ? 'rounded-l-none' : ''}
                                ${!inRange && !start && !end && !isFuture ? 'text-neutral-300' : ''}
                                ${isToday && !start && !end ? 'ring-1 ring-emerald-500/50 rounded' : ''}
                            `}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function DashboardFilters({ currentFilter }: DashboardFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isOpen, setIsOpen] = useState(false);
    const [activeSection, setActiveSection] = useState<'presets' | 'custom_days' | 'calendar'>('presets');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Custom days state
    const [customDaysValue, setCustomDaysValue] = useState('7');
    const [customDaysAnchor, setCustomDaysAnchor] = useState<'today' | 'yesterday'>('today');

    // Calendar state
    const today = getTodayBR();
    const [calFrom, setCalFrom] = useState<Date | null>(null);
    const [calTo, setCalTo] = useState<Date | null>(null);
    const [calSelectStep, setCalSelectStep] = useState<'from' | 'to'>('from');
    const [calMonth, setCalMonth] = useState(today.getMonth());
    const [calYear, setCalYear] = useState(today.getFullYear());

    // Compare state
    const [compareEnabled, setCompareEnabled] = useState(false);

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const navigate = useCallback((filter: string, extra?: Record<string, string>) => {
        const params = new URLSearchParams();
        const campaign = searchParams.get('campaign');
        const view = searchParams.get('view');
        params.set('filter', filter);
        if (campaign) params.set('campaign', campaign);
        if (view) params.set('view', view);
        if (extra) {
            for (const [k, v] of Object.entries(extra)) {
                params.set(k, v);
            }
        }
        router.push(`/?${params.toString()}`);
        setIsOpen(false);
    }, [router, searchParams]);

    const handlePresetClick = (value: string) => {
        if (value === 'custom_range') {
            setActiveSection('calendar');
            setCalFrom(null);
            setCalTo(null);
            setCalSelectStep('from');
            return;
        }
        navigate(value);
    };

    const handleCustomDaysApply = () => {
        const days = parseInt(customDaysValue, 10);
        if (isNaN(days) || days < 1 || days > 999) return;
        const filter = customDaysAnchor === 'today' ? 'custom_days_today' : 'custom_days_yesterday';
        navigate(filter, { days: String(days), anchor: customDaysAnchor });
    };

    const handleCalendarSelect = (date: Date) => {
        if (calSelectStep === 'from') {
            setCalFrom(date);
            setCalTo(null);
            setCalSelectStep('to');
        } else {
            if (calFrom && date < calFrom) {
                // If selected "to" is before "from", swap
                setCalTo(calFrom);
                setCalFrom(date);
            } else {
                setCalTo(date);
            }
            setCalSelectStep('from');
        }
    };

    const handleCalendarApply = () => {
        if (!calFrom || !calTo) return;
        navigate('custom_range', {
            from: formatYMD(calFrom),
            to: formatYMD(calTo),
        });
    };

    const displayLabel = getFilterLabel(currentFilter, searchParams);

    return (
        <div className="relative" ref={dropdownRef}>
            {/* ── Trigger Button ─────────────────────────────────────── */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-100 text-xs px-4 py-2.5 rounded-lg border border-neutral-700 hover:border-neutral-600 transition-all duration-200 min-w-[240px] shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
            >
                {/* Calendar Icon */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-400 shrink-0">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className="flex-1 text-left truncate">{displayLabel}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`text-neutral-500 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {/* ── Dropdown Panel ──────────────────────────────────────── */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 bg-neutral-900 border border-neutral-700 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 min-w-[380px]">
                    {/* Tab Bar */}
                    <div className="flex border-b border-neutral-800 bg-neutral-900/50">
                        <button
                            onClick={() => setActiveSection('presets')}
                            className={`flex-1 px-4 py-2.5 text-[11px] font-medium tracking-wide transition-colors ${activeSection === 'presets' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            Períodos
                        </button>
                        <button
                            onClick={() => setActiveSection('custom_days')}
                            className={`flex-1 px-4 py-2.5 text-[11px] font-medium tracking-wide transition-colors ${activeSection === 'custom_days' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            X Dias
                        </button>
                        <button
                            onClick={() => { setActiveSection('calendar'); }}
                            className={`flex-1 px-4 py-2.5 text-[11px] font-medium tracking-wide transition-colors ${activeSection === 'calendar' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            Calendário
                        </button>
                    </div>

                    {/* ── Presets Section ──────────────────────────────── */}
                    {activeSection === 'presets' && (
                        <div className="p-2 max-h-[400px] overflow-y-auto">
                            {PRESET_GROUPS.map((group, gi) => (
                                <div key={gi}>
                                    {gi > 0 && <div className="h-px bg-neutral-800 my-1 mx-2" />}
                                    {group.items.map((item) => (
                                        <button
                                            key={item.value}
                                            onClick={() => handlePresetClick(item.value)}
                                            className={`
                                                w-full text-left px-3 py-2 text-xs rounded-lg transition-all duration-100
                                                ${currentFilter === item.value
                                                    ? 'bg-emerald-500/15 text-emerald-400 font-medium'
                                                    : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
                                                }
                                                ${item.isCustom ? 'text-emerald-400/80 font-medium' : ''}
                                            `}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Custom Days Section ─────────────────────────── */}
                    {activeSection === 'custom_days' && (
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-2 font-medium">
                                    Quantidade de dias
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={999}
                                    value={customDaysValue}
                                    onChange={(e) => setCustomDaysValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCustomDaysApply()}
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="Ex: 7"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-2 font-medium">
                                    Âncora de fim
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCustomDaysAnchor('today')}
                                        className={`flex-1 py-2 px-3 text-xs rounded-lg border transition-all ${customDaysAnchor === 'today'
                                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 font-medium'
                                            : 'border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300'
                                            }`}
                                    >
                                        Até hoje
                                    </button>
                                    <button
                                        onClick={() => setCustomDaysAnchor('yesterday')}
                                        className={`flex-1 py-2 px-3 text-xs rounded-lg border transition-all ${customDaysAnchor === 'yesterday'
                                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 font-medium'
                                            : 'border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300'
                                            }`}
                                    >
                                        Até ontem
                                    </button>
                                </div>
                            </div>

                            <div className="pt-1 text-[10px] text-neutral-600 leading-relaxed">
                                Preview: <span className="text-neutral-400">
                                    {(() => {
                                        const days = parseInt(customDaysValue, 10);
                                        if (isNaN(days) || days < 1) return '—';
                                        const t = getTodayBR();
                                        const anchorDate = customDaysAnchor === 'yesterday' ? new Date(t.getTime() - 86400000) : t;
                                        const from = new Date(anchorDate.getTime() - (days - 1) * 86400000);
                                        return `${formatDateBR(from)} – ${formatDateBR(anchorDate)}`;
                                    })()}
                                </span>
                            </div>

                            <button
                                onClick={handleCustomDaysApply}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium py-2.5 rounded-lg transition-colors"
                            >
                                Aplicar
                            </button>
                        </div>
                    )}

                    {/* ── Calendar Section ─────────────────────────────── */}
                    {activeSection === 'calendar' && (
                        <div className="p-4 space-y-3">
                            {/* Range Display */}
                            <div className="flex items-center gap-2 text-[11px]">
                                <div className={`flex-1 bg-neutral-800 border rounded-lg px-3 py-2 text-center transition-colors ${calSelectStep === 'from' ? 'border-emerald-500 text-emerald-400' : 'border-neutral-700 text-neutral-400'}`}>
                                    {calFrom ? formatDateBR(calFrom) : 'Data início'}
                                </div>
                                <span className="text-neutral-600">→</span>
                                <div className={`flex-1 bg-neutral-800 border rounded-lg px-3 py-2 text-center transition-colors ${calSelectStep === 'to' ? 'border-emerald-500 text-emerald-400' : 'border-neutral-700 text-neutral-400'}`}>
                                    {calTo ? formatDateBR(calTo) : 'Data fim'}
                                </div>
                            </div>

                            {/* Calendar Grid */}
                            <MiniCalendar
                                selectedFrom={calFrom}
                                selectedTo={calTo}
                                onSelect={handleCalendarSelect}
                                month={calMonth}
                                year={calYear}
                                onMonthChange={(m, y) => { setCalMonth(m); setCalYear(y); }}
                            />

                            {/* Apply */}
                            <button
                                onClick={handleCalendarApply}
                                disabled={!calFrom || !calTo}
                                className={`w-full text-xs font-medium py-2.5 rounded-lg transition-colors ${calFrom && calTo
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                    : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                                    }`}
                            >
                                {calFrom && calTo
                                    ? `Aplicar: ${formatDateBR(calFrom)} – ${formatDateBR(calTo)}`
                                    : calFrom
                                        ? 'Selecione a data fim'
                                        : 'Selecione a data início'
                                }
                            </button>
                        </div>
                    )}

                    {/* ── Compare Toggle (footer) ─────────────────────── */}
                    <div className="border-t border-neutral-800 px-4 py-3 flex items-center justify-between">
                        <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-medium">Comparar</span>
                        <button
                            onClick={() => setCompareEnabled(!compareEnabled)}
                            className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${compareEnabled ? 'bg-emerald-500' : 'bg-neutral-700'}`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${compareEnabled ? 'translate-x-4' : ''}`} />
                        </button>
                    </div>
                    {compareEnabled && (
                        <div className="border-t border-neutral-800 px-4 py-3 bg-neutral-900/50">
                            <p className="text-[10px] text-neutral-500 mb-2">Comparar com período anterior (em breve)</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
