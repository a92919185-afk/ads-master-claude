/**
 * ADSMASTER SCRIPT V2.6 - REAL-TIME FOCUS
 * Fuso horário sincronizado com a conta para capturar conversões de HOJE.
 */

const CONFIG = {
    WEBHOOK_URL: 'https://ads-master-claude.vercel.app/api/webhooks/ads',
    API_KEY: PropertiesService.getScriptProperties().getProperty('API_KEY') || '681049',
    ACCOUNT_ID: AdsApp.currentAccount().getCustomerId(),
    ACCOUNT_TZ: AdsApp.currentAccount().getTimeZone(),
    DAYS_BACK: 2
};

function main() {
    Logger.log('Iniciando sincronização AdsMaster V2.6...');
    Logger.log('Fuso Horário da Conta: ' + CONFIG.ACCOUNT_TZ);

    const allMetrics = [];
    const dates = getDateRange();

    dates.forEach(date => {
        Logger.log('--- Processando Data: ' + date + ' ---');

        // 1. Configurações (CPA, IS, Orçamento)
        const dailyConfig = getDailyConfig(date);

        // 2. Performance (Cliques, Custo, CONVERSÕES) - Nível Horário
        const hourlyStats = getHourlyStats(date);

        hourlyStats.forEach(stat => {
            const config = dailyConfig[stat.campaign_name] || {};
            allMetrics.push({
                ...stat,
                budget: config.budget || 0,
                status: config.status || 'ENABLED',
                search_impression_share: config.search_impression_share || 0,
                search_top_impression_share: config.search_top_impression_share || 0,
                search_absolute_top_impression_share: config.search_absolute_top_impression_share || 0,
                target_cpa: config.target_cpa || 0,
                avg_target_cpa: config.avg_target_cpa || 0,
                account_id: CONFIG.ACCOUNT_ID,
                account_name: AdsApp.currentAccount().getName()
            });
        });
    });

    if (allMetrics.length > 0) {
        Logger.log('Enviando ' + allMetrics.length + ' registros horários...');
        sendToWebhook(allMetrics);
    } else {
        Logger.log('Nada para enviar. Verifique se houve gasto hoje.');
    }
}

function getDailyConfig(date) {
    const configMap = {};
    const query = `
        SELECT 
            campaign.name, campaign.status, campaign_budget.amount_micros,
            metrics.search_impression_share, metrics.search_top_impression_share,
            metrics.search_absolute_top_impression_share,
            metrics.average_target_cpa_micros, campaign.target_cpa.target_cpa_micros
        FROM campaign 
        WHERE segments.date = '${date}' 
          AND campaign.status != 'REMOVED'`;

    const report = AdsApp.search(query);
    while (report.hasNext()) {
        const row = report.next();
        configMap[row.campaign.name] = {
            status: row.campaign.status,
            budget: row.campaignBudget.amountMicros / 1000000,
            search_impression_share: parseShare(row.metrics.searchImpressionShare),
            search_top_impression_share: parseShare(row.metrics.searchTopImpressionShare),
            search_absolute_top_impression_share: parseShare(row.metrics.searchAbsoluteTopImpressionShare),
            target_cpa: (row.campaign.targetCpa ? row.campaign.targetCpa.targetCpaMicros : row.metrics.averageTargetCpaMicros) / 1000000,
            avg_target_cpa: row.metrics.averageTargetCpaMicros / 1000000
        };
    }
    return configMap;
}

function getHourlyStats(date) {
    const stats = [];
    const query = `
        SELECT 
            campaign.name, segments.hour, metrics.clicks, 
            metrics.cost_micros, metrics.conversions, 
            metrics.conversions_value, metrics.impressions
        FROM campaign 
        WHERE segments.date = '${date}' AND metrics.cost_micros > 0`;

    const report = AdsApp.search(query);
    while (report.hasNext()) {
        const row = report.next();
        stats.push({
            campaign_name: row.campaign.name,
            date: date,
            hour: row.segments.hour,
            clicks: parseInt(row.metrics.clicks),
            impressions: parseInt(row.metrics.impressions),
            cost: row.metrics.costMicros / 1000000,
            conversions: parseFloat(row.metrics.conversions),
            conversion_value: parseFloat(row.metrics.conversionsValue)
        });
    }
    return stats;
}

function parseShare(val) {
    if (!val || val === '--' || val.includes('<') || val.includes('>')) {
        if (val && val.includes('< 10')) return 5;
        if (val && val.includes('> 90')) return 95;
        return 0;
    }
    return parseFloat(val.replace('%', ''));
}

function getDateRange() {
    const dates = [];
    const now = new Date();
    for (let i = 0; i < CONFIG.DAYS_BACK; i++) {
        const d = new Date(now.getTime() - i * 86400000);
        // Usa o fuso horário real da sua conta Google Ads
        dates.push(Utilities.formatDate(d, CONFIG.ACCOUNT_TZ, 'yyyy-MM-dd'));
    }
    return dates;
}

function sendToWebhook(payload) {
    const options = {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-api-key': CONFIG.API_KEY },
        payload: JSON.stringify({ account_id: CONFIG.ACCOUNT_ID, metrics: payload }),
        muteHttpExceptions: true
    };
    try {
        const res = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
        Logger.log('Webhook OK (' + res.getResponseCode() + ')');
    } catch (e) {
        Logger.log('Erro no Webhook: ' + e);
    }
}
