import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    return url && key ? createClient(url, key) : null;
})();

// DELETE /api/delete — permanently delete all metrics for a campaign
export async function DELETE(req: Request) {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

    const { campaign_name } = await req.json();
    if (!campaign_name) return NextResponse.json({ error: 'Missing campaign_name' }, { status: 400 });

    // Also remove from archived_campaigns if it exists there
    await supabaseAdmin
        .from('archived_campaigns')
        .delete()
        .eq('campaign_name', campaign_name);

    // Delete all metrics for this campaign
    const { error } = await supabaseAdmin
        .from('campaign_metrics')
        .delete()
        .eq('campaign_name', campaign_name);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
