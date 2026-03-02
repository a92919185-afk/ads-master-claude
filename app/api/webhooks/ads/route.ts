import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Utilizando service_role_key para o backend poder dar bypass no RLS e inserir/atualizar
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

interface WebhookPayload {
    google_ads_account_id: string; // ID oriundo do Ads Script para ligar a conta
    account_name?: string;         // Opcional, nome da conta
    campaign_name: string;
    budget?: number;
    status?: string;
    impressions?: number;
    clicks: number;
    cost: number;
    conversions?: number;
    conversion_value: number;
    search_absolute_top_impression_share?: number;
    search_top_impression_share?: number;
    search_impression_share?: number;
    target_cpa?: number;
    avg_target_cpa?: number;
    date: string; // YYYY-MM-DD
    hour?: number; // 0-23
}

export async function POST(req: Request) {
    try {
        // 1. Validar a API_KEY do header
        const apiKey = req.headers.get('x-api-key')?.trim();
        const expectedKey = process.env.WEBHOOK_API_KEY?.trim();

        if (!apiKey || apiKey !== expectedKey) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fazer o parse do payload recebido do Google Ads Script
        const rawPayload = await req.json();
        // Lidar tanto com o array que o novo script envia, quanto old scripts q enviavam objeto único
        const payloadArray: WebhookPayload[] = Array.isArray(rawPayload) ? rawPayload : [rawPayload];

        if (payloadArray.length === 0) {
            return NextResponse.json({ error: 'Payload vazio ou fora do formato esperado' }, { status: 400 });
        }

        // Validar pelo menos o primeiro item do array por segurança
        if (!payloadArray[0].google_ads_account_id || !payloadArray[0].campaign_name || !payloadArray[0].date) {
            return NextResponse.json({ error: 'Faltam campos essenciais no payload (account, campaign ou date)' }, { status: 400 });
        }

        // 2.5 Verificar se o Supabase Admin foi iniciado corretamente
        if (!supabaseAdmin) {
            return NextResponse.json({
                error: 'Internal Configuration Error',
                details: 'As variáveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não foram encontradas na Vercel.'
            }, { status: 500 });
        }

        // 3. Garantir que a Conta (Account) existe. Se não, criar
        // Cachear as contas no mapa durante esse request para evitar calls repetidas no DB
        const uniqueAccounts: Record<string, string> = {};

        for (const pd of payloadArray) {
            if (!uniqueAccounts[pd.google_ads_account_id]) {
                const { data: accountData, error: accountError } = await supabaseAdmin
                    .from('accounts')
                    .select('id')
                    .eq('google_ads_account_id', pd.google_ads_account_id)
                    .single();

                let accountId = accountData?.id;

                if (accountError && accountError.code === 'PGRST116') { // PGRST116: Nenhum registro retornado
                    const { data: newAccount, error: createError } = await supabaseAdmin
                        .from('accounts')
                        .insert({
                            google_ads_account_id: pd.google_ads_account_id,
                            name: pd.account_name || `Conta - ${pd.google_ads_account_id}`,
                        })
                        .select('id')
                        .single();

                    if (createError) throw createError;
                    accountId = newAccount.id;
                } else if (accountError) {
                    throw accountError;
                }

                // Armazenar localmente para os próximos
                if (accountId) {
                    uniqueAccounts[pd.google_ads_account_id] = accountId;
                }
            }
        }

        // 4. Preparar e Calcular o Profit dos blocos
        const rowsToInsert = payloadArray.map(dataItem => {
            const cost = Number(dataItem.cost) || 0;
            const conversion_value = Number(dataItem.conversion_value) || 0;
            const profit = conversion_value - cost;
            const clicks = Number(dataItem.clicks) || 0;
            const accId = uniqueAccounts[dataItem.google_ads_account_id];

            return {
                account_id: accId,
                campaign_name: dataItem.campaign_name,
                budget: dataItem.budget ? Number(dataItem.budget) : 0,
                status: dataItem.status || 'UNKNOWN',
                impressions: dataItem.impressions ? Number(dataItem.impressions) : 0,
                clicks: clicks,
                cost: cost,
                conversions: dataItem.conversions ? Number(dataItem.conversions) : 0,
                conversion_value: conversion_value,
                profit: profit,
                // Shares que adicionamos recentemente
                search_absolute_top_impression_share: dataItem.search_absolute_top_impression_share ? Number(dataItem.search_absolute_top_impression_share) : 0,
                search_top_impression_share: dataItem.search_top_impression_share ? Number(dataItem.search_top_impression_share) : 0,
                search_impression_share: dataItem.search_impression_share ? Number(dataItem.search_impression_share) : 0,
                target_cpa: dataItem.target_cpa ? Number(dataItem.target_cpa) : 0,
                avg_target_cpa: dataItem.avg_target_cpa ? Number(dataItem.avg_target_cpa) : 0,
                date: dataItem.date,
                hour: dataItem.hour !== undefined ? Number(dataItem.hour) : 0,
            };
        });

        // 5. Inserir ou Sobrescrever os dados no BD em Lote
        // Utiliza a chave primária UPSERT baseada na UNIQUE(account_id, campaign_name, date)
        const { error: insertError } = await supabaseAdmin
            .from('campaign_metrics')
            .upsert(rowsToInsert, {
                onConflict: 'account_id,campaign_name,date,hour',
                ignoreDuplicates: false // Precisamos atualizar valores, não ignorar
            });

        if (insertError) throw insertError;

        // Retorna status e quantos registos injetou
        return NextResponse.json({ success: true, processed: rowsToInsert.length }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Webhook Error:', errorMessage);
        return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
    }
}