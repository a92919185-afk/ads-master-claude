import { DashboardFilters } from "@/components/DashboardFilters";
import { MetricHeaderCard } from "@/components/MetricHeaderCard";
import { FilteredTableView } from "@/components/FilteredTableView";
import { PerformanceChart } from "@/components/PerformanceChart";
import { CampaignStatusGrid } from "@/components/CampaignStatusGrid";
import { Leaderboard } from "@/components/Leaderboard";
import { HourlyHeatmap } from "@/components/HourlyHeatmap";
import { ViewToggle } from "@/components/ViewToggle";
import { supabase } from "@/utils/supabase";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Extract product name from campaign name
// e.g. "Ozoku - Search - $150" → "Ozoku"
// e.g. "RYOKO_BR_EXACT_$180" → "RYOKO"
function extractProductName(campaignName: string): string {
  const clean = campaignName.replace(/\$\s*\d+(\.\d+)?/g, '').trim();
  const parts = clean.split(/\s*[-|_/\\]\s*/).map(p => p.trim()).filter(p => p.length >= 2);
  return parts.length > 0 ? parts[0] : campaignName.trim();
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ filter?: string; campaign?: string; view?: string }> }) {
  const params = await searchParams;
  const filterKey = params?.filter || 'today';
  const selectedCampaignName = params?.campaign;
  const viewMode = params?.view === 'product' ? 'product' : 'campaign';

  // Date calculation — UTC-noon strategy to avoid Vercel UTC edge issues
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const [month, day, year] = formatter.format(new Date()).split('/');
  const todayBR = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));

  let startD = todayBR;
  let endD = todayBR;

  switch (filterKey) {
    case 'today': break;
    case 'yesterday':
      startD = new Date(todayBR.getTime() - 86400000);
      endD = new Date(todayBR.getTime() - 86400000);
      break;
    case 'this_week': {
      const dow = todayBR.getUTCDay();
      startD = new Date(todayBR.getTime() - dow * 86400000);
      break;
    }
    case 'last_7_days':
      startD = new Date(todayBR.getTime() - 6 * 86400000);
      break;
    case 'last_week': {
      const dow = todayBR.getUTCDay();
      endD = new Date(todayBR.getTime() - (dow + 1) * 86400000);
      startD = new Date(endD.getTime() - 6 * 86400000);
      break;
    }
    case 'last_14_days':
      startD = new Date(todayBR.getTime() - 13 * 86400000);
      break;
    case 'this_month':
      startD = new Date(Date.UTC(Number(year), Number(month) - 1, 1, 12, 0, 0));
      break;
    case 'last_30_days':
      startD = new Date(todayBR.getTime() - 29 * 86400000);
      break;
    case 'last_month': {
      let pm = Number(month) - 2;
      let py = Number(year);
      if (pm < 0) { pm = 11; py -= 1; }
      startD = new Date(Date.UTC(py, pm, 1, 12, 0, 0));
      endD = new Date(Date.UTC(py, pm + 1, 0, 12, 0, 0));
      break;
    }
    case 'all_time':
      startD = new Date(Date.UTC(2020, 0, 1, 12, 0, 0));
      break;
  }

  const startStr = startD.toISOString().split('T')[0];
  const endStr = endD.toISOString().split('T')[0];

  const { data: metrics, error } = await supabase
    .from('campaign_metrics')
    .select(`*, account:accounts(name, google_ads_account_id)`)
    .gte('date', startStr)
    .lte('date', endStr)
    .order('date', { ascending: false })
    .order('hour', { ascending: false });

  if (error) console.error('Error fetching metrics:', error);

  const campaignMetrics = metrics || [];

  const filteredMetrics = selectedCampaignName
    ? campaignMetrics.filter((m: any) => m.campaign_name === selectedCampaignName)
    : campaignMetrics;

  // ─── Aggregate per campaign (table & grid) ───────────────────────────────
  const summaryMap = filteredMetrics.reduce((acc: Record<string, any>, curr: any) => {
    const key = curr.campaign_name;
    if (!acc[key]) {
      acc[key] = { ...curr, entry_count: 1 };
    } else {
      acc[key].impressions += Number(curr.impressions) || 0;
      acc[key].clicks += Number(curr.clicks) || 0;
      acc[key].cost += Number(curr.cost) || 0;
      acc[key].conversions += Number(curr.conversions) || 0;
      acc[key].conversion_value += Number(curr.conversion_value) || 0;
      acc[key].profit += Number(curr.profit) || 0;
      acc[key].search_absolute_top_impression_share += Number(curr.search_absolute_top_impression_share) || 0;
      acc[key].search_top_impression_share += Number(curr.search_top_impression_share) || 0;
      acc[key].search_impression_share += Number(curr.search_impression_share) || 0;
      // Use most recent target_cpa / status / budget (data is sorted desc by date+hour)
      // Keep first value (most recent) since reduce processes in order
      acc[key].entry_count += 1;
      acc[key].budget = Math.max(acc[key].budget || 0, curr.budget || 0);
    }
    return acc;
  }, {});

  const summaryMetrics = Object.values(summaryMap).map((m: any) => ({
    ...m,
    search_absolute_top_impression_share: m.entry_count > 0 ? m.search_absolute_top_impression_share / m.entry_count : 0,
    search_top_impression_share: m.entry_count > 0 ? m.search_top_impression_share / m.entry_count : 0,
    search_impression_share: m.entry_count > 0 ? m.search_impression_share / m.entry_count : 0,
  })) as any[];

  // ─── Product grouping ────────────────────────────────────────────────────
  const productMap: Record<string, any> = {};
  summaryMetrics.forEach((m: any) => {
    const product = extractProductName(m.campaign_name);
    if (!productMap[product]) {
      productMap[product] = {
        id: product,
        campaign_name: product,
        cost: 0, profit: 0, clicks: 0,
        conversions: 0, conversion_value: 0, impressions: 0,
        budget: 0, target_cpa: 0, avg_target_cpa: 0,
        search_absolute_top_impression_share: 0,
        search_top_impression_share: 0,
        search_impression_share: 0,
        date: m.date,
        account: m.account,
        _count: 0,
      };
    }
    const p = productMap[product];
    p.cost += Number(m.cost) || 0;
    p.profit += Number(m.profit) || 0;
    p.clicks += Number(m.clicks) || 0;
    p.conversions += Number(m.conversions) || 0;
    p.conversion_value += Number(m.conversion_value) || 0;
    p.impressions += Number(m.impressions) || 0;
    p.budget = Math.max(p.budget, Number(m.budget) || 0);
    p._count += 1;
  });
  const productMetrics = Object.values(productMap) as any[];

  const displayMetrics = viewMode === 'product' ? productMetrics : summaryMetrics;

  // ─── Summary KPIs ────────────────────────────────────────────────────────
  const totalProfit = filteredMetrics.reduce((acc: number, c: any) => acc + (Number(c.profit) || 0), 0);
  const totalCost = filteredMetrics.reduce((acc: number, c: any) => acc + (Number(c.cost) || 0), 0);
  const totalRevenue = filteredMetrics.reduce((acc: number, c: any) => acc + (Number(c.conversion_value) || 0), 0);
  const totalClicks = filteredMetrics.reduce((acc: number, c: any) => acc + (Number(c.clicks) || 0), 0);
  const totalConversions = filteredMetrics.reduce((acc: number, c: any) => acc + (Number(c.conversions) || 0), 0);
  const totalROI = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  // ─── Sparkline data: last 7 daily profits per campaign ──────────────────
  const dailyByCampaign: Record<string, Record<string, number>> = {};
  filteredMetrics.forEach((m: any) => {
    if (!dailyByCampaign[m.campaign_name]) dailyByCampaign[m.campaign_name] = {};
    if (!dailyByCampaign[m.campaign_name][m.date]) dailyByCampaign[m.campaign_name][m.date] = 0;
    dailyByCampaign[m.campaign_name][m.date] += Number(m.profit) || 0;
  });
  const sparklineData: Record<string, number[]> = {};
  for (const [name, dateMap] of Object.entries(dailyByCampaign)) {
    const sorted = Object.keys(dateMap).sort();
    sparklineData[name] = sorted.slice(-7).map(d => dateMap[d]);
  }

  // ─── Heatmap data: profit & cost by (date × hour), last 14 days ─────────
  const heatmapRaw: Record<string, { profit: number[]; cost: number[] }> = {};
  filteredMetrics.forEach((m: any) => {
    const d = m.date as string;
    if (!heatmapRaw[d]) {
      heatmapRaw[d] = { profit: new Array(24).fill(0), cost: new Array(24).fill(0) };
    }
    const h = Math.min(23, Math.max(0, Number(m.hour) || 0));
    heatmapRaw[d].profit[h] += Number(m.profit) || 0;
    heatmapRaw[d].cost[h] += Number(m.cost) || 0;
  });
  const heatmapDates = Object.keys(heatmapRaw).sort().slice(-14);
  const heatmapGrid = heatmapDates.map(d => heatmapRaw[d].profit);
  const heatmapCosts = heatmapDates.map(d => heatmapRaw[d].cost);
  const heatmapMaxAbs = Math.max(
    ...heatmapGrid.flat().map(Math.abs),
    0.01
  );

  // Max commission for chart reference line
  const maxCommission = summaryMetrics.reduce((max: number, m: any) => {
    const match = m.campaign_name.match(/\$\s*(\d+(\.\d+)?)/);
    return Math.max(max, match ? parseFloat(match[1]) : 0);
  }, 0);

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-neutral-800">
      <div className="mx-auto max-w-[1800px] p-6">

        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end border-b border-neutral-900 pb-5">
          <div>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mb-1.5">
              <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.5)] shrink-0" />
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-100 whitespace-nowrap">
                {selectedCampaignName ? 'Campanha: ' : 'AdsMaster'}
              </h1>
              {selectedCampaignName && (
                <span className="text-lg font-mono text-emerald-400 break-all">{selectedCampaignName}</span>
              )}
            </div>
            <p className="text-[11px] font-medium tracking-widest text-neutral-600 uppercase">
              {viewMode === 'product' ? 'Visão por Produto' : 'Terminal de Lucro Consolidado'}
              {selectedCampaignName && (
                <a href={`/?filter=${filterKey}`} className="ml-3 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-0.5 rounded transition-colors normal-case">
                  Limpar ×
                </a>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ViewToggle currentView={viewMode} currentFilter={filterKey} />
            <DashboardFilters currentFilter={filterKey} />
          </div>
        </div>

        {/* ─── Summary Cards (6 KPIs) ──────────────────────────────────────── */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <MetricHeaderCard
            title="Lucro Líquido"
            value={totalProfit}
            isCurrency
            trend={totalProfit > 0 ? 'up' : 'down'}
            icon="profit"
          />
          <MetricHeaderCard
            title="Investimento"
            value={totalCost}
            isCurrency
            icon="cost"
          />
          <MetricHeaderCard
            title="Receita Bruta"
            value={totalRevenue}
            isCurrency
            icon="conversion"
          />
          <MetricHeaderCard
            title="ROI Global"
            value={totalROI}
            suffix="%"
            trend={totalROI > 0 ? 'up' : 'down'}
            icon="roi"
          />
          <MetricHeaderCard
            title="Conversões"
            value={totalConversions}
            icon="conversions"
          />
          <MetricHeaderCard
            title="Total Cliques"
            value={totalClicks}
            icon="click"
          />
        </div>

        {/* ─── Performance Chart ────────────────────────────────────────────── */}
        <PerformanceChart
          metrics={filteredMetrics}
          dateRange={{ start: startStr, end: endStr }}
          commissionValue={maxCommission}
        />

        {/* ─── Command Center Grid ──────────────────────────────────────────── */}
        <CampaignStatusGrid
          campaigns={displayMetrics}
          currentFilter={filterKey}
          isProductView={viewMode === 'product'}
        />

        {/* ─── Leaderboard ─────────────────────────────────────────────────── */}
        <Leaderboard
          campaigns={displayMetrics}
          currentFilter={filterKey}
          isProductView={viewMode === 'product'}
        />

        {/* ─── Hourly Heatmap ───────────────────────────────────────────────── */}
        {heatmapDates.length > 0 && (
          <HourlyHeatmap
            dates={heatmapDates}
            grid={heatmapGrid}
            costs={heatmapCosts}
            maxAbs={heatmapMaxAbs}
          />
        )}

        {/* ─── Full Table + Filters ─────────────────────────────────────────── */}
        <FilteredTableView
          metrics={displayMetrics}
          selectedCampaign={selectedCampaignName}
          currentFilter={filterKey}
          sparklineData={sparklineData}
        />

        {campaignMetrics.length === 0 && !error && (
          <div className="mt-10 text-center py-16 border border-dashed border-neutral-800 rounded-2xl">
            <p className="text-neutral-600 font-mono text-xs uppercase tracking-widest">
              [ Nenhuma Telemetria Detectada no Período ]
            </p>
            <p className="text-neutral-700 text-xs mt-2">
              Aguardando envio de dados do Script do Google Ads...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
