import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    return url && key ? createClient(url, key) : null;
})();

// POST /api/archive — archive a campaign (hide from all reports)
export async function POST(req: Request) {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

    const { campaign_name } = await req.json();
    if (!campaign_name) return NextResponse.json({ error: 'Missing campaign_name' }, { status: 400 });

    const { error } = await supabaseAdmin
        .from('archived_campaigns')
        .upsert({ campaign_name }, { onConflict: 'campaign_name' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}

// DELETE /api/archive — unarchive a campaign (restore to reports)
export async function DELETE(req: Request) {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

    const { campaign_name } = await req.json();
    if (!campaign_name) return NextResponse.json({ error: 'Missing campaign_name' }, { status: 400 });

    const { error } = await supabaseAdmin
        .from('archived_campaigns')
        .delete()
        .eq('campaign_name', campaign_name);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
