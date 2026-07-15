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

// Tenants have no Supabase session, so they can't rely on owner-scoped
// storage RLS. This validates their bill token server-side (service role)
// and hands back a short-lived signed URL for just that one file.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token) {
      return jsonResponse({ error: 'token is required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: split, error: splitError } = await adminClient
      .from('bill_splits')
      .select('bill_id, expires_at, bills(attachment_path)')
      .eq('access_token', token)
      .single();

    if (splitError || !split) {
      return jsonResponse({ error: 'Invalid bill link' }, 404);
    }

    if (new Date(split.expires_at) <= new Date()) {
      return jsonResponse({ error: 'This bill link has expired' }, 410);
    }

    const attachmentPath = split.bills?.attachment_path;
    if (!attachmentPath) {
      return jsonResponse({ error: 'This bill has no attachment' }, 404);
    }

    const { data: signed, error: signError } = await adminClient.storage
      .from('bill-attachments')
      .createSignedUrl(attachmentPath, 3600);

    if (signError || !signed) {
      return jsonResponse({ error: 'Failed to create signed URL' }, 500);
    }

    return jsonResponse({ url: signed.signedUrl });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
