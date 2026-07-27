import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export class AuthError extends Error {}

export interface AuthContext {
  /** The verified caller's own user id. Empty when isService is true. */
  userId: string;
  /** True when the request was authenticated with the project service-role key
   *  (a trusted server-to-server caller, e.g. a scheduled batch job) rather than
   *  a real user session. Service callers may act on a userId they supply themselves. */
  isService: boolean;
}

/**
 * Verifies the caller's session JWT against Supabase Auth and returns their
 * own user id — never trust a userId supplied in a request body, since the
 * body is client-controlled and the function typically runs with a
 * service-role client that bypasses row-level security.
 */
export async function authenticate(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (token && serviceRoleKey && token === serviceRoleKey) {
    return { userId: '', isService: true };
  }

  const authClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data, error } = await authClient.auth.getUser();
  if (error || !data?.user) {
    throw new AuthError('Unauthorized — no valid session.');
  }

  return { userId: data.user.id, isService: false };
}
