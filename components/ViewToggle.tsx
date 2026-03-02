interface ViewToggleProps {
    currentView: string;
    currentFilter: string;
}

export function ViewToggle({ currentView, currentFilter }: ViewToggleProps) {
    const base = 'text-[10px] px-3 py-1.5 rounded font-bold uppercase tracking-widest transition-colors';
    const active = 'bg-neutral-700 text-neutral-100';
    const inactive = 'text-neutral-600 hover:text-neutral-400';

    return (
        <div className="flex bg-neutral-900/50 p-1 rounded-lg border border-neutral-800">
            <a
                href={`/?filter=${currentFilter}&view=campaign`}
                className={`${base} ${currentView !== 'product' ? active : inactive}`}
            >
                Campanhas
            </a>
            <a
                href={`/?filter=${currentFilter}&view=product`}
                className={`${base} ${currentView === 'product' ? active : inactive}`}
            >
                Produtos
            </a>
        </div>
    );
}
