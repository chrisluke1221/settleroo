import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Cron-triggered, not user-triggered — there's no landlord session here, so
// this is gated by a shared secret (set as CRON_SECRET on the function and
// as the `cron_secret` Vault entry the pg_cron job sends), not auth.getUser().
// Only re-notifies a split if it hasn't been reminded in the last 3 days, so
// a daily cron doesn't spam the same overdue bill every run.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get('CRON_SECRET');
  const authHeader = req.headers.get('Authorization') || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const appUrl = Deno.env.get('APP_URL') ?? 'https://roomietab.netlify.app';

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const today = new Date().toISOString().slice(0, 10);
    const reminderCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: overdueSplits, error: splitsError } = await admin
      .from('bill_splits')
      .select('*, bills!inner(bill_type, total_amount, billing_period_start, billing_period_end, due_date), tenants(email)')
      .neq('status', 'paid')
      .lt('bills.due_date', today)
      .or(`last_reminder_at.is.null,last_reminder_at.lt.${reminderCutoff}`);

    if (splitsError) throw splitsError;
    if (!overdueSplits || overdueSplits.length === 0) {
      return jsonResponse({ sent: 0 });
    }

    const landlordIds = [...new Set(overdueSplits.map((s) => s.landlord_id))];
    const { data: settingsRows } = await admin
      .from('landlord_settings')
      .select('landlord_id, notify_overdue')
      .in('landlord_id', landlordIds);
    const notifyByLandlord = new Map(
      landlordIds.map((id) => [id, settingsRows?.find((r) => r.landlord_id === id)?.notify_overdue ?? true])
    );

    let sent = 0;
    for (const split of overdueSplits) {
      if (!notifyByLandlord.get(split.landlord_id)) continue;
      const tenantEmail = split.tenants?.email;
      if (!tenantEmail || !resendApiKey) continue;

      const billLink = `${appUrl}/bill/${split.access_token}`;
      const billType = escapeHtml(split.bills.bill_type);
      const tenantName = escapeHtml(split.tenant_name);

      const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
          <h2 style="text-transform: capitalize;">Reminder: ${billType} bill overdue</h2>
          <p>Hi ${tenantName},</p>
          <p>Your share of the ${billType} bill (due ${split.bills.due_date}) hasn't been marked paid yet:</p>
          <p style="font-size: 28px; font-weight: bold; color: #0d9488;">$${Number(split.owed_amount).toFixed(2)}</p>
          <p>
            <a href="${billLink}" style="display:inline-block;background:#0d9488;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
              View breakdown &amp; confirm payment
            </a>
          </p>
          <p style="color:#888;font-size:12px;">If the button doesn't work, copy this link: ${billLink}</p>
        </div>
      `;

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: Deno.env.get('EMAIL_FROM') ?? 'RoomieTab <onboarding@resend.dev>',
          to: tenantEmail,
          subject: `Reminder: your ${split.bills.bill_type} bill is overdue`,
          html,
        }),
      });

      if (resendRes.ok) {
        sent += 1;
        await admin.from('bill_splits').update({ last_reminder_at: new Date().toISOString() }).eq('id', split.id);
      }
    }

    return jsonResponse({ sent, checked: overdueSplits.length });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
