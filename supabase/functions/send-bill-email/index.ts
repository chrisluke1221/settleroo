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

    const billType = escapeHtml(split.bills.bill_type);
    const tenantName = escapeHtml(split.tenant_name);
    const room = escapeHtml(split.room);

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <h2 style="text-transform: capitalize;">${billType} Bill</h2>
        <p>Hi ${tenantName},</p>
        <p>Your share of the ${billType} bill for ${split.bills.billing_period_start} to ${split.bills.billing_period_end} is:</p>
        <p style="font-size: 28px; font-weight: bold; color: #4f46e5;">$${Number(split.owed_amount).toFixed(2)}</p>
        <p>That's ${split.percentage}% of the total $${Number(split.bills.total_amount).toFixed(2)} bill, based on
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

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('EMAIL_FROM') ?? 'Settleroo <onboarding@resend.dev>',
        to: tenantEmail,
        subject: `Your ${split.bills.bill_type} bill: $${Number(split.owed_amount).toFixed(2)} due`,
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
