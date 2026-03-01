import { DashboardFilters } from "@/components/DashboardFilters";
import { MetricHeaderCard } from "@/components/MetricHeaderCard";
import { ProfitTable } from "@/components/ProfitTable";
import { PerformanceChart } from "@/components/PerformanceChart";
import { supabase } from "@/utils/supabase";
import { subDays, format } from "date-fns";

export const dynamic = 'force-dynamic'; // Prevent static generation errors on Vercel
export const revalidate = 0;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const params = await searchParams;
  const days = params?.days || '1';

  // Calculate the start date based on the selected filter
  const daysNum = parseInt(days, 10);
  // Se for "1", a gente subtrai 0 dias pra pegar só hoje.
  // Se for "7", a gente subtrai 6 dias, pra dar 7 dias contando com hoje.
  const daysToSubtract = daysNum > 0 ? daysNum - 1 : 0;

  // Utilizar o fuso de Brasília (America/Sao_Paulo) constante para evitar 
  // que o host (Vercel, que é UTC) mude a data 3 horas antes da meia-noite do Brasil.
  const dateToFormat = subDays(new Date(), daysToSubtract);
  const startDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateToFormat); // en-CA converte de forma nativa para YYYY-MM-DD

  // Fetch real data from Supabase
  const { data: metrics, error } = await supabase
    .from('campaign_metrics')
    .select(`
      *,
      account:accounts(
        name,
        google_ads_account_id
      )
    `)
    .gte('date', startDate)
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
          <DashboardFilters currentFilter={days} />
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
