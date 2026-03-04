import { DashboardFilters } from "@/components/DashboardFilters";
import { MetricHeaderCard } from "@/components/MetricHeaderCard";
import { FilteredTableView } from "@/components/FilteredTableView";
import { PerformanceChart } from "@/components/PerformanceChart";
import { CampaignStatusGrid } from "@/components/CampaignStatusGrid";
import { Leaderboard } from "@/components/Leaderboard";
import { HourlyHeatmap } from "@/components/HourlyHeatmap";
import { ViewToggle } from "@/components/ViewToggle";
import { supabase } from "@/utils/supabase";
import { extractProductName } from "@/utils/helpers";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ filter?: string; campaign?: string; view?: string; from?: string; to?: string; days?: string; anchor?: string }> }) {
  const params = await searchParams;
  const filterKey = params?.filter || 'today';
  const selectedCampaignName = params?.campaign;
  const viewMode = params?.view === 'product' ? 'product' : 'campaign';

  // ─── Date resolution — UTC-noon strategy to avoid Vercel UTC edge issues ───
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const [month, day, year] = formatter.format(new Date()).split('/');
  const todayBR = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
  const yesterdayBR = new Date(todayBR.getTime() - 86400000);

  let startD = todayBR;
  let endD = todayBR;

  switch (filterKey) {
    // ── Single Day Presets ─────────────────────────────────────────
    case 'today':
      break;
    case 'yesterday':
      startD = yesterdayBR;
      endD = yesterdayBR;
      break;

    // ── Rolling Window Presets ─────────────────────────────────────
    case 'last_7_days':
      startD = new Date(todayBR.getTime() - 6 * 86400000);
      break;
    case 'last_14_days':
      startD = new Date(todayBR.getTime() - 13 * 86400000);
      break;
    case 'last_30_days':
      startD = new Date(todayBR.getTime() - 29 * 86400000);
      break;

    // ── Week-based Presets ─────────────────────────────────────────
    case 'this_week': {
      // Sunday to today
      const dow = todayBR.getUTCDay();
      startD = new Date(todayBR.getTime() - dow * 86400000);
      break;
    }
    case 'last_week': {
      // Previous Sunday to Saturday
      const dow = todayBR.getUTCDay();
      endD = new Date(todayBR.getTime() - (dow + 1) * 86400000);
      startD = new Date(endD.getTime() - 6 * 86400000);
      break;
    }

    // ── Month-based Presets ────────────────────────────────────────
    case 'this_month':
      startD = new Date(Date.UTC(Number(year), Number(month) - 1, 1, 12, 0, 0));
      break;
    case 'last_month': {
      let pm = Number(month) - 2;
      let py = Number(year);
      if (pm < 0) { pm = 11; py -= 1; }
      startD = new Date(Date.UTC(py, pm, 1, 12, 0, 0));
      endD = new Date(Date.UTC(py, pm + 1, 0, 12, 0, 0));
      break;
    }

    // ── Full Range ────────────────────────────────────────────────
    case 'all_time':
      startD = new Date(Date.UTC(2020, 0, 1, 12, 0, 0));
      break;

    // ── Custom: X days until today ────────────────────────────────
    case 'custom_days_today': {
      const days = Math.max(1, Math.min(999, parseInt(params?.days || '7', 10)));
      startD = new Date(todayBR.getTime() - (days - 1) * 86400000);
      endD = todayBR;
      break;
    }

    // ── Custom: X days until yesterday ────────────────────────────
    case 'custom_days_yesterday': {
      const days = Math.max(1, Math.min(999, parseInt(params?.days || '7', 10)));
      startD = new Date(yesterdayBR.getTime() - (days - 1) * 86400000);
      endD = yesterdayBR;
      break;
    }

    // ── Custom: Calendar range (from → to) ────────────────────────
    case 'custom_range': {
      const rawFrom = params?.from;
      const rawTo = params?.to;
      if (rawFrom && rawTo && /^\d{4}-\d{2}-\d{2}$/.test(rawFrom) && /^\d{4}-\d{2}-\d{2}$/.test(rawTo)) {
        const [fy, fm, fd] = rawFrom.split('-').map(Number);
        const [ty, tm, td] = rawTo.split('-').map(Number);
        startD = new Date(Date.UTC(fy, fm - 1, fd, 12, 0, 0));
        endD = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0));
        // Ensure start <= end
        if (startD > endD) {
          const tmp = startD;
          startD = endD;
          endD = tmp;
        }
        // Cap at today
        if (endD > todayBR) endD = todayBR;
      }
      break;
    }
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
  // Step 1: Daily IS averages per campaign (IS should be averaged per day, not per hourly entry)
  const dailyISMap: Record<string, Record<string, { absTop: number[]; top: number[]; is: number[] }>> = {};
  filteredMetrics.forEach((m: any) => {
    const key = m.campaign_name;
    const d = m.date as string;
    if (!dailyISMap[key]) dailyISMap[key] = {};
    if (!dailyISMap[key][d]) dailyISMap[key][d] = { absTop: [], top: [], is: [] };
    if (Number(m.search_absolute_top_impression_share)) dailyISMap[key][d].absTop.push(Number(m.search_absolute_top_impression_share));
    if (Number(m.search_top_impression_share)) dailyISMap[key][d].top.push(Number(m.search_top_impression_share));
    if (Number(m.search_impression_share)) dailyISMap[key][d].is.push(Number(m.search_impression_share));
  });

  function avgArr(arr: number[]): number {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  function computeDailyISAvg(campaignIS: Record<string, { absTop: number[]; top: number[]; is: number[] }>): { absTop: number; top: number; is: number } {
    const days = Object.values(campaignIS);
    if (days.length === 0) return { absTop: 0, top: 0, is: 0 };
    const dailyAvgs = days.map(d => ({ absTop: avgArr(d.absTop), top: avgArr(d.top), is: avgArr(d.is) }));
    return {
      absTop: avgArr(dailyAvgs.map(d => d.absTop)),
      top: avgArr(dailyAvgs.map(d => d.top)),
      is: avgArr(dailyAvgs.map(d => d.is)),
    };
  }

  // Step 2: Aggregate metrics per campaign
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
      acc[key].entry_count += 1;
      acc[key].budget = Math.max(acc[key].budget || 0, curr.budget || 0);
    }
    return acc;
  }, {});

  // Step 3: Apply correct daily-weighted IS averages
  const summaryMetrics = Object.values(summaryMap).map((m: any) => {
    const isAvg = computeDailyISAvg(dailyISMap[m.campaign_name] || {});
    return {
      ...m,
      search_absolute_top_impression_share: isAvg.absTop,
      search_top_impression_share: isAvg.top,
      search_impression_share: isAvg.is,
    };
  }) as any[];

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

  // ─── Previous period KPIs (for delta comparison) ────────────────────────
  const periodMs = endD.getTime() - startD.getTime();
  const periodDays = Math.round(periodMs / 86400000) + 1;
  const prevEndD = new Date(startD.getTime() - 86400000);
  const prevStartD = new Date(prevEndD.getTime() - (periodDays - 1) * 86400000);
  const prevStartStr = prevStartD.toISOString().split('T')[0];
  const prevEndStr = prevEndD.toISOString().split('T')[0];

  const { data: prevMetricsRaw } = await supabase
    .from('campaign_metrics')
    .select('profit, cost, conversion_value, clicks, conversions')
    .gte('date', prevStartStr)
    .lte('date', prevEndStr);

  const prevMetrics = (prevMetricsRaw || []) as any[];
  const prevProfit = prevMetrics.reduce((a: number, c: any) => a + (Number(c.profit) || 0), 0);
  const prevCost = prevMetrics.reduce((a: number, c: any) => a + (Number(c.cost) || 0), 0);
  const prevRevenue = prevMetrics.reduce((a: number, c: any) => a + (Number(c.conversion_value) || 0), 0);
  const prevClicks = prevMetrics.reduce((a: number, c: any) => a + (Number(c.clicks) || 0), 0);
  const prevConversions = prevMetrics.reduce((a: number, c: any) => a + (Number(c.conversions) || 0), 0);
  const prevROI = prevCost > 0 ? (prevProfit / prevCost) * 100 : 0;

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
            previousValue={prevProfit}
            isCurrency
            trend={totalProfit > 0 ? 'up' : 'down'}
            icon="profit"
          />
          <MetricHeaderCard
            title="Investimento"
            value={totalCost}
            previousValue={prevCost}
            isCurrency
            icon="cost"
          />
          <MetricHeaderCard
            title="Receita Bruta"
            value={totalRevenue}
            previousValue={prevRevenue}
            isCurrency
            icon="conversion"
          />
          <MetricHeaderCard
            title="ROI Global"
            value={totalROI}
            previousValue={prevROI}
            suffix="%"
            trend={totalROI > 0 ? 'up' : 'down'}
            icon="roi"
          />
          <MetricHeaderCard
            title="Conversões"
            value={totalConversions}
            previousValue={prevConversions}
            icon="conversions"
          />
          <MetricHeaderCard
            title="Total Cliques"
            value={totalClicks}
            previousValue={prevClicks}
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
