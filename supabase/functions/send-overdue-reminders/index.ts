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

// CHR-41 arrears autopilot v1: three fixed templates (no AI/LLM call in
// this version — Chris's call, 2026-07-31: ship the escalation mechanics
// first, AI-drafted tone is a later fast-follow). The stage is a pure
// function of days overdue, so nothing new needs to be stored per split —
// last_reminder_at (already tracked) is all the state this needs.
const STAGES = [
  { key: 'friendly', minDays: 0 },
  { key: 'firm', minDays: 15 },
  { key: 'final', minDays: 30 },
];

const stageForDaysOverdue = (daysOverdue) => {
  let stage = STAGES[0];
  for (const s of STAGES) {
    if (daysOverdue >= s.minDays) stage = s;
  }
  return stage.key;
};

const TEMPLATES = {
  friendly: {
    subject: (billType) => `Reminder: your ${billType} bill is overdue`,
    heading: 'Reminder: bill overdue',
    body: (tenantName, billType, dueDate) =>
      `<p>Hi ${tenantName},</p><p>Just a friendly reminder — your share of the ${billType} bill (due ${dueDate}) hasn't been marked paid yet:</p>`,
    cta: 'View breakdown &amp; confirm payment',
  },
  firm: {
    subject: (billType) => `Your ${billType} bill is now overdue — please action`,
    heading: 'Overdue — please action',
    body: (tenantName, billType, dueDate) =>
      `<p>Hi ${tenantName},</p><p>Your share of the ${billType} bill (due ${dueDate}) is now well overdue. Please settle it as soon as you can, or reach out to your landlord if there's an issue:</p>`,
    cta: 'View breakdown &amp; confirm payment',
  },
  final: {
    subject: (billType) => `Final reminder: ${billType} bill significantly overdue`,
    heading: 'Final reminder',
    body: (tenantName, billType, dueDate) =>
      `<p>Hi ${tenantName},</p><p>This is a final reminder — your share of the ${billType} bill (due ${dueDate}) remains unpaid and is now significantly overdue. Please settle it urgently, or contact your landlord directly:</p>`,
    cta: 'View breakdown &amp; confirm payment',
  },
};

const buildEmailHtml = (stageKey, tenantName, billType, dueDate, amount, billLink) => {
  const t = TEMPLATES[stageKey];
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
      <h2 style="text-transform: capitalize;">${t.heading}</h2>
      ${t.body(tenantName, billType, dueDate)}
      <p style="font-size: 28px; font-weight: bold; color: #0d9488;">$${amount}</p>
      <p>
        <a href="${billLink}" style="display:inline-block;background:#0d9488;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
          ${t.cta}
        </a>
      </p>
      <p style="color:#888;font-size:12px;">If the button doesn't work, copy this link: ${billLink}</p>
    </div>
  `;
};

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
    const appUrl = Deno.env.get('APP_URL') ?? 'https://settleroo.netlify.app';

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const todayDate = new Date();
    const today = todayDate.toISOString().slice(0, 10);
    const reminderCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: overdueSplits, error: splitsError } = await admin
      .from('bill_splits')
      .select('*, bills!inner(bill_type, total_amount, billing_period_start, billing_period_end, due_date), tenants(email)')
      .neq('status', 'paid')
      // Round 2: a split whose remainder has already been carried forward
      // into a later bill is resolved, not overdue — the tenant already got
      // (or will get) a reminder for the new bill that now carries this amount.
      .is('carried_forward_into_split_id', null)
      .lt('bills.due_date', today)
      .or(`last_reminder_at.is.null,last_reminder_at.lt.${reminderCutoff}`);

    if (splitsError) throw splitsError;
    if (!overdueSplits || overdueSplits.length === 0) {
      return jsonResponse({ sent: 0 });
    }

    const landlordIds = [...new Set(overdueSplits.map((s) => s.landlord_id))];
    const { data: settingsRows } = await admin
      .from('landlord_settings')
      .select('landlord_id, notify_overdue, arrears_autopilot_enabled')
      .in('landlord_id', landlordIds);
    const notifyByLandlord = new Map(
      landlordIds.map((id) => [id, settingsRows?.find((r) => r.landlord_id === id)?.notify_overdue ?? true])
    );
    const autopilotByLandlord = new Map(
      landlordIds.map((id) => [id, settingsRows?.find((r) => r.landlord_id === id)?.arrears_autopilot_enabled ?? false])
    );

    let sent = 0;
    for (const split of overdueSplits) {
      if (!notifyByLandlord.get(split.landlord_id)) continue;
      const tenantEmail = split.tenants?.email;
      if (!tenantEmail || !resendApiKey) continue;

      const billLink = `${appUrl}/bill/${split.access_token}`;
      const billType = escapeHtml(split.bills.bill_type);
      const tenantName = escapeHtml(split.tenant_name);
      const amount = Number(split.owed_amount).toFixed(2);

      const daysOverdue = Math.floor((todayDate.getTime() - new Date(split.bills.due_date).getTime()) / 86400000);
      // Autopilot off (default): keep the exact original single template —
      // fully backward-compatible, zero behavior change unless opted in.
      const stageKey = autopilotByLandlord.get(split.landlord_id)
        ? stageForDaysOverdue(daysOverdue)
        : 'friendly';

      const html = buildEmailHtml(stageKey, tenantName, billType, split.bills.due_date, amount, billLink);
      const subject = TEMPLATES[stageKey].subject(split.bills.bill_type);

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: Deno.env.get('EMAIL_FROM') ?? 'Settleroo <onboarding@resend.dev>',
          to: tenantEmail,
          subject,
          html,
        }),
      });

      if (resendRes.ok) {
        sent += 1;
        await admin.from('bill_splits').update({ last_reminder_at: new Date().toISOString() }).eq('id', split.id);
        await admin.from('bill_events').insert({
          bill_id: split.bill_id,
          event_type: 'reminder_sent',
          actor_type: 'system',
          payload: { split_id: split.id, stage: stageKey, days_overdue: daysOverdue },
        });
      }
    }

    return jsonResponse({ sent, checked: overdueSplits.length });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
