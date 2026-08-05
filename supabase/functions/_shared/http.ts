// Single copy of the CORS headers + JSON response helper — previously
// pasted independently into all 11 edge functions with small unexplained
// inconsistencies (ai-advisor alone set Allow-Methods; weekly-digest and
// debt-reminders alone allowed x-cron-secret). One shared allow-list is
// safe for every function even where a given header goes unused — a
// browser only sends what the client code actually asks for, so allowing
// more here doesn't loosen anything a real request could exploit.
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
