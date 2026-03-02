import { DashboardFilters } from "@/components/DashboardFilters";
import { MetricHeaderCard } from "@/components/MetricHeaderCard";
import { ProfitTable } from "@/components/ProfitTable";
import { PerformanceChart } from "@/components/PerformanceChart";
import { supabase } from "@/utils/supabase";

export const dynamic = 'force-dynamic'; // Prevent static generation errors on Vercel
export const revalidate = 0;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ filter?: string, campaign?: string }> }) {
  const params = await searchParams;
  const filterKey = params?.filter || 'today';
  const selectedCampaignName = params?.campaign;

  // Mapeamento Blindado de Datas (Resolvendo Fusos da Vercel que rodam em UTC)
  // 1. Descobrir qual é o dia atual no Brasil Exatamente Agora
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const [month, day, year] = formatter.format(new Date()).split('/');

  // 2. Criamos o dia de "Hoje" fixado em meio-dia (12:00 UTC) 
  // Isso impede que subtrair/adicionar dias pule para o dia anterior por erro de horas.
  const todayBR = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));

  let startD = todayBR;
  let endD = todayBR;

  switch (filterKey) {
    case 'today':
      break;
    case 'yesterday':
      startD = new Date(todayBR.getTime() - 1 * 86400000);
      endD = new Date(todayBR.getTime() - 1 * 86400000);
      break;
    case 'this_week': {
      // 0 = Dom, 1 = Seg ...
      const dayOfWeek = todayBR.getUTCDay();
      startD = new Date(todayBR.getTime() - dayOfWeek * 86400000);
      break;
    }
    case 'last_7_days':
      startD = new Date(todayBR.getTime() - 6 * 86400000);
      break;
    case 'last_week': {
      const dayOfWeek = todayBR.getUTCDay();
      // O final da semana passada é o sábado passado
      endD = new Date(todayBR.getTime() - (dayOfWeek + 1) * 86400000);
      // O início da semana passada é o domingo antes do sábado
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
      let prevMonth = Number(month) - 2; // -1 porque o JS é index=0, e -1 pq queremos o anterior
      let prevYear = Number(year);
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear -= 1;
      }
      startD = new Date(Date.UTC(prevYear, prevMonth, 1, 12, 0, 0));
      endD = new Date(Date.UTC(prevYear, prevMonth + 1, 0, 12, 0, 0)); // dia 0 volta pro último dia do prevMonth
      break;
    }
    case 'all_time':
      startD = new Date(Date.UTC(2020, 0, 1, 12, 0, 0));
      break;
  }

  // Com as datas em UTC-Noon fixas, extrair o YYYY-MM-DD é 100% à prova de falhas na Vercel
  const startStr = startD.toISOString().split('T')[0];
  const endStr = endD.toISOString().split('T')[0];

  console.log(`Filtro: ${filterKey} | Start: ${startStr} | End: ${endStr}`);

  // Fetch real data from Supabase within bounds
  const { data: metrics, error } = await supabase
    .from('campaign_metrics')
    .select(`
      *,
      account:accounts(
        name,
        google_ads_account_id
      )
    `)
    .gte('date', startStr)
    .lte('date', endStr)
    .order('date', { ascending: false })
    .order('hour', { ascending: false });

  if (error) {
    console.error('Error fetching metrics:', error);
  }

  const campaignMetrics = metrics || [];

  // 3. Filter by selected campaign if applicable (for chart and cards)
  const filteredMetrics = selectedCampaignName
    ? campaignMetrics.filter((m: any) => m.campaign_name === selectedCampaignName)
    : campaignMetrics;

  // 4. Aggregate metrics for the Table (1 row per campaign)
  const summaryMap = filteredMetrics.reduce((acc: Record<string, any>, curr: any) => {
    const key = curr.campaign_name;
    if (!acc[key]) {
      acc[key] = { ...curr };
    } else {
      acc[key].impressions += Number(curr.impressions) || 0;
      acc[key].clicks += Number(curr.clicks) || 0;
      acc[key].cost += Number(curr.cost) || 0;
      acc[key].conversions += Number(curr.conversions) || 0;
      acc[key].conversion_value += Number(curr.conversion_value) || 0;
      acc[key].profit += Number(curr.profit) || 0;
      // Budget/Status/shares: we keep the latest one from the first occurrence (since we ordered by date/hour desc)
    }
    return acc;
  }, {});

  const summaryMetrics = Object.values(summaryMap) as any[];

  // Calculate Aggregates based on filtered data (for Cards)
  const totalProfit = filteredMetrics.reduce((acc: number, curr: any) => acc + (Number(curr.profit) || 0), 0);
  const totalCost = filteredMetrics.reduce((acc: number, curr: any) => acc + (Number(curr.cost) || 0), 0);
  const totalRevenue = filteredMetrics.reduce((acc: number, curr: any) => acc + (Number(curr.conversion_value) || 0), 0);
  const totalClicks = filteredMetrics.reduce((acc: number, curr: any) => acc + (Number(curr.clicks) || 0), 0);

  // Simple trend logic for demo
  const profitTrend = totalProfit > 0 ? "up" : "down";

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-neutral-800">
      <div className="mx-auto max-w-7xl p-8">

        {/* Header Section */}
        <div className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end border-b border-neutral-900 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-4 w-4 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-100">
                {selectedCampaignName ? "Detalhes da Campanha" : "AdsMaster"}
              </h1>
            </div>
            <p className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
              {selectedCampaignName ? (
                <span className="flex items-center gap-2">
                  <span className="text-emerald-400 font-mono">{selectedCampaignName}</span>
                  <a href={`/?filter=${filterKey}`} className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-0.5 rounded transition-colors normal-case">
                    Limpar Filtro ×
                  </a>
                </span>
              ) : (
                "Terminal de Lucro Consolidado"
              )}
            </p>
          </div>
          <DashboardFilters currentFilter={filterKey} />
        </div>

        {/* Cards Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricHeaderCard
            title="LUCRO LÍQUIDO"
            value={totalProfit}
            isCurrency
            trend={profitTrend}
            icon="profit"
          />
          <MetricHeaderCard
            title="INVESTIMENTO (CUSTO)"
            value={totalCost}
            isCurrency
            icon="cost"
          />
          <MetricHeaderCard
            title="RECEITA BRUTA"
            value={totalRevenue}
            isCurrency
            icon="conversion"
          />
          <MetricHeaderCard
            title="TOTAL DE CLIQUES"
            value={totalClicks}
            icon="click"
          />
        </div>

        {/* Chart Section */}
        <PerformanceChart metrics={filteredMetrics} dateRange={{ start: startStr, end: endStr }} />

        {/* Table Section */}
        <ProfitTable
          metrics={summaryMetrics}
          selectedCampaign={selectedCampaignName}
          currentFilter={filterKey}
        />

        {campaignMetrics.length === 0 && !error && (
          <div className="mt-12 text-center py-20 border border-dashed border-neutral-800 rounded-2xl">
            <p className="text-neutral-500 font-mono text-sm uppercase tracking-widest">
              [ NENHUMA TELEMETRIA DE DADOS DETECTADA NO PERÍODO SELECIONADO ]
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
