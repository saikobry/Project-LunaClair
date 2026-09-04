/**
 * Standardized HTTP response helpers for the LunaClair Worker.
 */

export function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

export function binary(
  data: BodyInit | null,
  contentType: string,
  headers: Record<string, string> = {},
  status = 200,
): Response {
  return new Response(data, {
    status,
    headers: {
      'content-type': contentType,
      ...headers,
    },
  });
}

export function badRequest(
  message = 'Bad request',
  corsHeaders: Record<string, string> = {},
): Response {
  return json({ error: message }, 400, corsHeaders);
}

export function unauthorized(
  message = 'Unauthorized',
  corsHeaders: Record<string, string> = {},
): Response {
  return json({ error: message }, 401, corsHeaders);
}

export function forbidden(
  message = 'Forbidden',
  corsHeaders: Record<string, string> = {},
): Response {
  return json({ error: message }, 403, corsHeaders);
}

export function notFound(
  message = 'Not found',
  corsHeaders: Record<string, string> = {},
): Response {
  return json({ error: message }, 404, corsHeaders);
}

export function methodNotAllowed(
  corsHeaders: Record<string, string> = {},
  allowedMethods?: string[],
): Response {
  const headers = { ...corsHeaders };
  if (allowedMethods && allowedMethods.length > 0) {
    headers['allow'] = allowedMethods.join(', ');
  }
  return json({ error: 'Method not allowed' }, 405, headers);
}

export function conflict(
  message = 'Conflict',
  corsHeaders: Record<string, string> = {},
): Response {
  return json({ error: message }, 409, corsHeaders);
}

export function payloadTooLarge(
  message = 'Payload too large',
  corsHeaders: Record<string, string> = {},
): Response {
  return json({ error: message }, 413, corsHeaders);
}

export function serverError(
  message = 'Internal server error',
  corsHeaders: Record<string, string> = {},
): Response {
  return json({ error: message }, 500, corsHeaders);
}

export function noContent(
  corsHeaders: Record<string, string> = {},
): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
