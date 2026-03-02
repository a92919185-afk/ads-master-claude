/**
 * AdsMaster - Google Ads Ingestion Script (V2 - Robusto)
 * Este script deve ser colado dentro do seu Google Ads (Ferramentas > Scripts).
 * Ele percorre os dados dos últimos 30 dias + hoje e envia para o seu Dashboard.
 */

const CONFIG = {
    WEBHOOK_URL: 'https://adsmaster-s4u5.vercel.app/api/webhooks/ads',
    API_KEY: '681049',
    ACCOUNT_ID: AdsApp.currentAccount().getCustomerId(),
    DAYS_BACK: 30 // Quantos dias de histórico buscar além de hoje
};

function main() {
    Logger.log('Iniciando extração de dados para a conta: ' + CONFIG.ACCOUNT_ID);

    // Definir intervalo de datas: de (hoje - DAYS_BACK) até hoje
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - CONFIG.DAYS_BACK);

    const formatDate = (date) => Utilities.formatDate(date, AdsApp.currentAccount().getTimeZone(), "yyyyMMdd");
    const startDateStr = formatDate(pastDate);
    const endDateStr = formatDate(today);

    Logger.log('Período: ' + startDateStr + ' até ' + endDateStr);

    const query = `
        SELECT
            campaign.name,
            campaign.status,
            campaign_budget.amount_micros,
            campaign.target_cpa.target_cpa_micros,
            metrics.average_target_cpa_micros,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value,
            metrics.search_absolute_top_impression_share,
            metrics.search_top_impression_share,
            metrics.search_impression_share,
            segments.date,
            segments.hour
        FROM campaign
        WHERE campaign.status IN ('ENABLED', 'PAUSED')
          AND segments.date BETWEEN '${startDateStr}' AND '${endDateStr}'
    `;

    const report = AdsApp.search(query);
    const accountName = AdsApp.currentAccount().getName();

    let payloads = [];
    let totalProcessed = 0;

    while (report.hasNext()) {
        const row = report.next();

        // Formatar valores de micros para valores reais
        const budget = row.campaignBudget && row.campaignBudget.amountMicros ? row.campaignBudget.amountMicros / 1000000 : 0;
        const targetCpa = row.campaign && row.campaign.targetCpa && row.campaign.targetCpa.targetCpaMicros ? row.campaign.targetCpa.targetCpaMicros / 1000000 : 0;
        const avgTargetCpa = row.metrics && row.metrics.averageTargetCpaMicros ? row.metrics.averageTargetCpaMicros / 1000000 : 0;
        const cost = row.metrics && row.metrics.costMicros ? row.metrics.costMicros / 1000000 : 0;

        const absTopIS = row.metrics && row.metrics.searchAbsoluteTopImpressionShare ? row.metrics.searchAbsoluteTopImpressionShare * 100 : 0;
        const topIS = row.metrics && row.metrics.searchTopImpressionShare ? row.metrics.searchTopImpressionShare * 100 : 0;
        const imShare = row.metrics && row.metrics.searchImpressionShare ? row.metrics.searchImpressionShare * 100 : 0;

        const payload = {
            google_ads_account_id: CONFIG.ACCOUNT_ID,
            account_name: accountName,
            campaign_name: row.campaign.name,
            budget: budget,
            status: row.campaign.status,
            impressions: row.metrics.impressions || 0,
            clicks: row.metrics.clicks || 0,
            cost: cost,
            conversions: row.metrics.conversions || 0,
            conversion_value: row.metrics.conversionsValue || 0,
            search_absolute_top_impression_share: absTopIS,
            search_top_impression_share: topIS,
            search_impression_share: imShare,
            target_cpa: targetCpa,
            avg_target_cpa: avgTargetCpa,
            date: row.segments.date, // formato YYYY-MM-DD
            hour: row.segments.hour || 0
        };

        payloads.push(payload);
        totalProcessed++;

        if (payloads.length >= 50) {
            sendDataBulk(payloads);
            payloads = [];
        }
    }

    if (payloads.length > 0) {
        sendDataBulk(payloads);
    }

    Logger.log('Concluído! Total de registros enviados: ' + totalProcessed);
}

function sendDataBulk(payloads) {
    const options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
            'x-api-key': CONFIG.API_KEY
        },
        payload: JSON.stringify(payloads),
        muteHttpExceptions: true
    };

    try {
        const response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
        Logger.log('Lote enviado (' + payloads.length + ' regs) | HTTP: ' + response.getResponseCode());
    } catch (e) {
        Logger.log('Erro ao enviar lote: ' + e.toString());
    }
}
