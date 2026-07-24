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

// CHR-25: Build a visually distinct email depending on whether the bill is
// overdue (due_date is in the past) or upcoming/no-due-date.
//
// Overdue treatment:
//   - Subject: "Action required: your [type] bill is overdue — $X"
//   - Red header bar + "OVERDUE" badge
//   - Urgent body copy
//   - Red CTA button (#dc2626)
//
// Upcoming / no-due-date treatment (original behaviour):
//   - Subject: "Your [type] bill: $X due"
//   - Standard indigo header + no badge
//   - Neutral body copy
//   - Indigo CTA button (#4f46e5)
const buildEmailHtml = (split, billLink, isOverdue) => {
  const billType = escapeHtml(split.bills.bill_type);
  const tenantName = escapeHtml(split.tenant_name);
  const room = escapeHtml(split.room);
  const owedFormatted = `$${Number(split.owed_amount).toFixed(2)}`;
  const totalFormatted = `$${Number(split.bills.total_amount).toFixed(2)}`;

  if (isOverdue) {
    return `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <div style="background: #dc2626; border-radius: 6px 6px 0 0; padding: 16px 20px;">
          <span style="color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Overdue</span>
          <h2 style="color: #fff; margin: 4px 0 0; text-transform: capitalize; font-size: 20px;">${billType} Bill</h2>
        </div>
        <div style="border: 1px solid #fecaca; border-top: none; border-radius: 0 0 6px 6px; padding: 20px;">
          <p>Hi ${tenantName},</p>
          <p>Your share of the ${billType} bill for <strong>${split.bills.billing_period_start} to ${split.bills.billing_period_end}</strong> was due on <strong>${split.bills.due_date}</strong> and hasn't been marked as paid yet.</p>
          <p style="font-size: 28px; font-weight: bold; color: #dc2626;">${owedFormatted}</p>
          <p style="font-size: 13px; color: #64748b;">
            That's ${split.percentage}% of the total ${totalFormatted} bill, based on
            ${split.occupancy_days} day(s) of occupancy with ${split.number_of_occupants} occupant(s) in ${room}.
          </p>
          <p>
            <a href="${billLink}" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
              View breakdown &amp; confirm payment
            </a>
          </p>
          <p style="color:#94a3b8;font-size:12px;">If the button doesn't work, copy this link: ${billLink}</p>
        </div>
      </div>
    `;
  }

  // Upcoming / no due date — original neutral treatment
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
      <h2 style="text-transform: capitalize;">${billType} Bill</h2>
      <p>Hi ${tenantName},</p>
      <p>Your share of the ${billType} bill for ${split.bills.billing_period_start} to ${split.bills.billing_period_end} is:</p>
      <p style="font-size: 28px; font-weight: bold; color: #4f46e5;">${owedFormatted}</p>
      <p>That's ${split.percentage}% of the total ${totalFormatted} bill, based on
      ${split.occupancy_days} day(s) of occupancy with ${split.number_of_occupants} occupant(s) in ${room}.</p>
      ${split.bills.due_date ? `<p><strong>Due:</strong> ${split.bills.due_date}</p>` : ''}
      <p>
        <a href="${billLink}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
          View full breakdown &amp; confirm payment
        </a>
      </p>
      <p style="color:#888;font-size:12px;">If the button doesn't work, copy this link: ${billLink}</p>
    </div>
  `;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { splitId } = await req.json();
    if (!splitId) {
      return jsonResponse({ error: 'splitId is required' }, 400);
    }
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization' }, 401);
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: 'Invalid session' }, 401);
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: split, error: splitError } = await adminClient
      .from('bill_splits')
      .select('*, bills(*), tenants(email)')
      .eq('id', splitId)
      .single();
    if (splitError || !split) {
      return jsonResponse({ error: 'Bill split not found' }, 404);
    }
    if (split.landlord_id !== userData.user.id) {
      return jsonResponse({ error: 'Not authorized for this bill' }, 403);
    }
    const tenantEmail = split.tenants?.email;
    if (!tenantEmail) {
      return jsonResponse({ error: 'This tenant has no email on file' }, 400);
    }
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return jsonResponse({ error: 'Email service not configured' }, 500);
    }
    const appUrl = Deno.env.get('APP_URL') ?? 'https://settleroo.netlify.app';
    const billLink = `${appUrl}/bill/${split.access_token}`;

    // CHR-25: determine whether this bill is overdue at the moment of sending.
    // A bill is overdue if it has a due_date and that date is strictly before today.
    const today = new Date().toISOString().slice(0, 10);
    const isOverdue = !!(split.bills.due_date && split.bills.due_date < today);

    const html = buildEmailHtml(split, billLink, isOverdue);

    // CHR-25: subject line also reflects urgency
    const billType = split.bills.bill_type;
    const owedFormatted = `$${Number(split.owed_amount).toFixed(2)}`;
    const subject = isOverdue
      ? `Action required: your ${billType} bill is overdue — ${owedFormatted}`
      : `Your ${billType} bill: ${owedFormatted} due`;

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
    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      return jsonResponse({ error: 'Failed to send email', details: errBody }, 502);
    }
    const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    await adminClient
      .from('bill_splits')
      .update({ email_sent_at: new Date().toISOString(), expires_at: ninetyDaysFromNow })
      .eq('id', splitId);
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
