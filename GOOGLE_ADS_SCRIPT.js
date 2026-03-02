/**
 * AdsMaster - Google Ads Ingestion Script (V2.4 - Final Resilient Version)
 * Resolve problemas de extração de CPA Desejado e Impression Shares.
 */

const CONFIG = {
    WEBHOOK_URL: 'https://adsmaster-s4u5.vercel.app/api/webhooks/ads',
    API_KEY: '681049',
    ACCOUNT_ID: AdsApp.currentAccount().getCustomerId(),
    DAYS_BACK: 30
};

function main() {
    Logger.log('Iniciando extração V2.4 para a conta: ' + CONFIG.ACCOUNT_ID);

    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - CONFIG.DAYS_BACK);

    const formatDate = (date) => Utilities.formatDate(date, AdsApp.currentAccount().getTimeZone(), "yyyyMMdd");
    const startDateStr = formatDate(pastDate);
    const endDateStr = formatDate(today);

    // 1. Coletar Métricas Diárias de Configuração (IS, CPA, Orçamento)
    const dailyMap = {};
    const dailyQuery = `
        SELECT
            campaign.name,
            campaign.status,
            campaign_budget.amount_micros,
            campaign.target_cpa.target_cpa_micros,
            metrics.average_target_cpa_micros,
            metrics.search_absolute_top_impression_share,
            metrics.search_top_impression_share,
            metrics.search_impression_share,
            segments.date
        FROM campaign
        WHERE campaign.status IN ('ENABLED', 'PAUSED')
          AND segments.date BETWEEN '${startDateStr}' AND '${endDateStr}'
    `;

    const dailyReport = AdsApp.search(dailyQuery);
    while (dailyReport.hasNext()) {
        const row = dailyReport.next();
        const key = row.campaign.name + '_' + row.segments.date;

        // Extração segura de CPA (Tenta configuração, depois média da métrica)
        const configCpa = (row.campaign && row.campaign.targetCpa && row.campaign.targetCpa.targetCpaMicros) ? row.campaign.targetCpa.targetCpaMicros / 1000000 : 0;
        const metricCpa = (row.metrics && row.metrics.averageTargetCpaMicros) ? row.metrics.averageTargetCpaMicros / 1000000 : 0;
        const finalCpa = configCpa || metricCpa || 0;

        dailyMap[key] = {
            budget: (row.campaignBudget && row.campaignBudget.amountMicros) ? row.campaignBudget.amountMicros / 1000000 : 0,
            status: row.campaign.status,
            target_cpa: finalCpa,
            avg_target_cpa: metricCpa || finalCpa,
            absTopIS: row.metrics ? parseShare(row.metrics.searchAbsoluteTopImpressionShare) * 100 : 0,
            topIS: row.metrics ? parseShare(row.metrics.searchTopImpressionShare) * 100 : 0,
            imShare: row.metrics ? parseShare(row.metrics.searchImpressionShare) * 100 : 0
        };
    }

    // 2. Coletar Métricas de Performance Horária
    const hourlyQuery = `
        SELECT
            campaign.name,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value,
            segments.date,
            segments.hour
        FROM campaign
        WHERE campaign.status IN ('ENABLED', 'PAUSED')
          AND segments.date BETWEEN '${startDateStr}' AND '${endDateStr}'
    `;

    const hourlyReport = AdsApp.search(hourlyQuery);
    const accountName = AdsApp.currentAccount().getName();
    let payloads = [];
    let processed = 0;

    while (hourlyReport.hasNext()) {
        const row = hourlyReport.next();
        const dailyKey = row.campaign.name + '_' + row.segments.date;
        const dailyData = dailyMap[dailyKey] || {
            budget: 0, status: row.campaign.status || 'UNKNOWN', target_cpa: 0, avg_target_cpa: 0,
            absTopIS: 0, topIS: 0, imShare: 0
        };

        const payload = {
            google_ads_account_id: CONFIG.ACCOUNT_ID,
            account_name: accountName,
            campaign_name: row.campaign.name,
            budget: Number(dailyData.budget) || 0,
            status: dailyData.status,
            impressions: Number(row.metrics.impressions) || 0,
            clicks: Number(row.metrics.clicks) || 0,
            cost: row.metrics.costMicros ? Number(row.metrics.costMicros) / 1000000 : 0,
            conversions: Number(row.metrics.conversions) || 0,
            conversion_value: Number(row.metrics.conversionsValue) || 0,
            search_absolute_top_impression_share: Number(dailyData.absTopIS) || 0,
            search_top_impression_share: Number(dailyData.topIS) || 0,
            search_impression_share: Number(dailyData.imShare) || 0,
            target_cpa: Number(dailyData.target_cpa) || 0,
            avg_target_cpa: Number(dailyData.avg_target_cpa) || 0,
            date: row.segments.date,
            hour: Number(row.segments.hour) || 0
        };

        payloads.push(payload);
        processed++;

        if (payloads.length >= 50) {
            sendDataBulk(payloads);
            payloads = [];
        }
    }

    if (payloads.length > 0) {
        sendDataBulk(payloads);
    }

    Logger.log('Integração V2.4 concluída. Registros: ' + processed);
}

function parseShare(val) {
    if (!val || val === '--' || val === ' < 10%' || val === ' > 90%') {
        if (val === ' < 10%') return 0.05;
        if (val === ' > 90%') return 0.95;
        return 0;
    }
    if (typeof val === 'string') {
        return parseFloat(val.replace('%', '').replace(',', '.')) / 100;
    }
    return parseFloat(val);
}

function sendDataBulk(payloads) {
    const options = {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-api-key': CONFIG.API_KEY },
        payload: JSON.stringify(payloads),
        muteHttpExceptions: true
    };
    try {
        UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    } catch (e) {
        Logger.log('Erro no envio: ' + e.message);
    }
}
