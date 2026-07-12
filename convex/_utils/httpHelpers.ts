// Pure helper functions — no "use node" needed, no Convex-specific imports.
// Imported by both http.ts (the router) and all httpAction handler files.

export function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

export function jsonResponse(body: any, status = 200): Response {
  const origin = process.env.FRONTEND_URL || "*";
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ message }, status);
}
