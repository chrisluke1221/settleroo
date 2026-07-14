import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const { splitId } = await req.json();
    if (!splitId) {
      return new Response(JSON.stringify({ error: 'splitId is required' }), { status: 400 });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: split, error: splitError } = await adminClient
      .from('bill_splits')
      .select('*, bills(*), tenants(email)')
      .eq('id', splitId)
      .single();

    if (splitError || !split) {
      return new Response(JSON.stringify({ error: 'Bill split not found' }), { status: 404 });
    }

    if (split.landlord_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: 'Not authorized for this bill' }), { status: 403 });
    }

    const tenantEmail = split.tenants?.email;
    if (!tenantEmail) {
      return new Response(JSON.stringify({ error: 'This tenant has no email on file' }), { status: 400 });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500 });
    }

    const appUrl = Deno.env.get('APP_URL') ?? 'https://roomietab.netlify.app';
    const billLink = `${appUrl}/bill/${split.access_token}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <h2 style="text-transform: capitalize;">${split.bills.bill_type} Bill</h2>
        <p>Hi ${split.tenant_name},</p>
        <p>Your share of the ${split.bills.bill_type} bill for ${split.bills.billing_period_start} to ${split.bills.billing_period_end} is:</p>
        <p style="font-size: 28px; font-weight: bold; color: #4f46e5;">$${Number(split.owed_amount).toFixed(2)}</p>
        <p>That's ${split.percentage}% of the total $${Number(split.bills.total_amount).toFixed(2)} bill, based on
        ${split.occupancy_days} day(s) of occupancy with ${split.number_of_occupants} occupant(s) in ${split.room}.</p>
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
        from: Deno.env.get('EMAIL_FROM') ?? 'RoomTab <onboarding@resend.dev>',
        to: tenantEmail,
        subject: `Your ${split.bills.bill_type} bill: $${Number(split.owed_amount).toFixed(2)} due`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      return new Response(JSON.stringify({ error: 'Failed to send email', details: errBody }), { status: 502 });
    }

    await adminClient
      .from('bill_splits')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('id', splitId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500 });
  }
});
