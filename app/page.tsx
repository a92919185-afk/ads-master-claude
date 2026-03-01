import { DashboardFilters } from "@/components/DashboardFilters";
import { MetricHeaderCard } from "@/components/MetricHeaderCard";
import { ProfitTable } from "@/components/ProfitTable";
import { PerformanceChart } from "@/components/PerformanceChart";
import { supabase } from "@/utils/supabase";
import { subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";

export const dynamic = 'force-dynamic'; // Prevent static generation errors on Vercel
export const revalidate = 0;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const params = await searchParams;
  const filterKey = params?.filter || 'today';

  const tz = 'America/Sao_Paulo';
  // Criar uma data "Hoje" já simulada no timezone do brasil usando date-fns-tz ou simples
  // Simplificando o Locale String Date parsing
  const now = new Date();
  const todayBR = new Date(new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(now));

  let startD = todayBR;
  let endD = todayBR;

  switch (filterKey) {
    case 'today':
      startD = todayBR;
      endD = todayBR;
      break;
    case 'yesterday':
      startD = subDays(todayBR, 1);
      endD = subDays(todayBR, 1);
      break;
    case 'this_week': // (dom até Hoje)
      startD = startOfWeek(todayBR, { weekStartsOn: 0 });
      endD = todayBR;
      break;
    case 'last_7_days':
      startD = subDays(todayBR, 6); // 7 dias incluindo hoje é -6
      endD = todayBR;
      break;
    case 'last_week': // Semana passada (dom a sab)
      startD = startOfWeek(subDays(todayBR, 7), { weekStartsOn: 0 });
      endD = endOfWeek(subDays(todayBR, 7), { weekStartsOn: 0 });
      break;
    case 'last_14_days':
      startD = subDays(todayBR, 13);
      endD = todayBR;
      break;
    case 'this_month':
      startD = startOfMonth(todayBR);
      endD = todayBR;
      break;
    case 'last_30_days':
      startD = subDays(todayBR, 29);
      endD = todayBR;
      break;
    case 'last_month': // Último mês completo (dia 1 até o ultimo dia)
      startD = startOfMonth(subMonths(todayBR, 1));
      endD = endOfMonth(subMonths(todayBR, 1));
      break;
    case 'all_time':
      startD = new Date('2020-01-01');
      endD = todayBR;
      break;
    default:
      startD = todayBR;
      endD = todayBR;
      break;
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  };

  const startStr = formatDate(startD);
  const endStr = formatDate(endD);

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
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching metrics:', error);
  }

  const campaignMetrics = metrics || [];

  // Calculate Aggregates
  const totalProfit = campaignMetrics.reduce((acc: number, curr: any) => acc + (Number(curr.profit) || 0), 0);
  const totalCost = campaignMetrics.reduce((acc: number, curr: any) => acc + (Number(curr.cost) || 0), 0);
  const totalRevenue = campaignMetrics.reduce((acc: number, curr: any) => acc + (Number(curr.conversion_value) || 0), 0);
  const totalClicks = campaignMetrics.reduce((acc: number, curr: any) => acc + (Number(curr.clicks) || 0), 0);

  // Simple trend logic for demo (comparing to a static baseline or just showing up if profit > 0)
  const profitTrend = totalProfit > 0 ? "up" : "down";

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-neutral-800">
      <div className="mx-auto max-w-7xl p-8">

        {/* Header Section */}
        <div className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end border-b border-neutral-900 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-4 w-4 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-100">AdsMaster</h1>
            </div>
            <p className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
              Terminal de Lucro Consolidado
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
        <PerformanceChart metrics={campaignMetrics} />

        {/* Table Section */}
        <ProfitTable metrics={campaignMetrics} />

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
