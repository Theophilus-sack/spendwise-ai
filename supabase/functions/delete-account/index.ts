import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticate, AuthError } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  try {
    // Always the caller's own account — there is no legitimate reason for
    // this endpoint to ever act on a userId supplied by the request body.
    const { userId } = await authenticate(req);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Deleting the auth user cascades to every table via their existing
    // `ON DELETE CASCADE` foreign keys to auth.users — profile, expenses,
    // budgets, goals, income, debts, discipline scores, AI conversations, etc.
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;

    return json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    return json({ error: err.message }, 500);
  }
});

const corsHeaders = () => ({
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
