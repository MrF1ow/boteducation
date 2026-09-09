import { mcpLimiter } from '@/lib/rate-limit';
import { isJwt } from '@/lib/mcp/pat-jwt';
import { resolvePatProxyHeaders } from '@/lib/mcp/pat-proxy';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://127.0.0.1:3001';
const MCP_PROXY_SECRET = process.env.MCP_PROXY_SECRET;

/**
 * Catch-all MCP Proxy Route (Multi-Tenant Aware)
 *
 * This proxy sits between MCP clients and the internal MCP server.
 * It handles three access patterns:
 *
 * 1. **OAuth (claude.ai custom connectors, Claude Desktop)** — /.well-known/*, /mcp
 *    Protected-resource metadata served here (tenant-aware); the authorization
 *    server is Supabase's OAuth 2.1 server (hosts /authorize, /token, DCR).
 *    Consent screen is the Next.js /oauth/consent page.
 *
 * 2. **Professor / CLI API tokens** — Bearer PAT on `/api/mcp` and `/cli`
 *    Validates via validate_mcp_api_token(), mints a user JWT so LmsSession
 *    can build an RLS client, then proxies. `/cli` is an alias of `/mcp`.
 *    X-User-* headers are not auth.
 *
 * 3. **Session (Web UI)** — / (root, no subpath)
 *    Forwards the caller's Authorization JWT to the MCP server.
 *
 * Multi-tenancy:
 * - OAuth metadata uses request Host header for per-tenant URLs
 * - MCP server reads X-Origin header for consent page redirects
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function getOrigin(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

function getSubpath(request: NextRequest): string {
  const path = new URL(request.url).pathname;
  return path.replace(/^\/api\/mcp/, '') || '/mcp';
}

// ─── OAuth Metadata (RFC 9728, tenant-aware) ────────────────────────────────
// Supabase's OAuth 2.1 server is the authorization server — it hosts
// /authorize, /token, /register and dynamic client registration. We only
// advertise it; the consent screen is the Next.js /oauth/consent page.

function supabaseIssuer(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`;
}

function serveProtectedResourceMetadata(request: NextRequest): NextResponse {
  const origin = getOrigin(request);

  return NextResponse.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [supabaseIssuer()],
    scopes_supported: ['openid', 'profile', 'email'],
    bearer_methods_supported: ['header'],
    resource_name: 'LMS MCP Server',
  }, {
    headers: {
      'cache-control': 'public, max-age=3600',
      'access-control-allow-origin': '*',
    },
  });
}

async function serveAuthorizationServerMetadata(): Promise<NextResponse> {
  // Legacy-client fallback: pass through Supabase's real metadata verbatim.
  try {
    const upstream = await fetch(
      `${supabaseIssuer()}/.well-known/oauth-authorization-server`,
      { next: { revalidate: 3600 } }
    );
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    return new NextResponse(await upstream.text(), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=3600',
        'access-control-allow-origin': '*',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'server_error', error_description: 'Failed to fetch authorization server metadata' },
      { status: 502 }
    );
  }
}

// ─── Professor / CLI PAT → user JWT ────────────────────────────────────────

function jsonRpcError(status: number, code: number, message: string): NextResponse {
  return NextResponse.json(
    { jsonrpc: '2.0', error: { code, message } },
    { status },
  );
}

/**
 * If Authorization is a PAT (not a JWT), validate it and return headers that
 * replace it with a minted user JWT. JWTs pass through unchanged. Missing
 * Bearer is not an error here — OAuth clients get WWW-Authenticate from MCP.
 */
async function extraHeadersForPat(
  request: NextRequest,
): Promise<Record<string, string> | NextResponse | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return jsonRpcError(401, -32001, 'Unauthorized: Missing Authorization: Bearer <token> header');
  if (isJwt(token)) return null;

  let resolved: Awaited<ReturnType<typeof resolvePatProxyHeaders>>;
  try {
    resolved = await resolvePatProxyHeaders(token);
  } catch (err) {
    console.error('[MCP PAT] mint failed', err);
    return jsonRpcError(
      500,
      -32603,
      'Failed to mint a user session for this token',
    );
  }

  if (!resolved.ok) {
    return jsonRpcError(resolved.status, resolved.status === 403 ? -32002 : -32001, resolved.message);
  }

  const { headers, pat } = resolved;

  try {
    await mcpLimiter.check(100, pat.userId);
  } catch {
    return jsonRpcError(429, -32003, 'Rate limit exceeded (100 req/min)');
  }

  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';
  const tokenId = pat.tokenId;
  Promise.resolve().then(async () => {
    try {
      const admin = createAdminClient();
      await admin.rpc('update_token_last_used', {
        token_id_input: tokenId,
        ip_input: clientIp,
      });
    } catch {
      /* last-used is non-critical */
    }
  });

  return headers;
}

// ─── Generic Proxy to MCP Server ───────────────────────────────────────────

async function proxyToMcp(
  request: NextRequest,
  subpath: string,
  extraHeaders?: Record<string, string> | null,
): Promise<Response> {
  const targetUrl = new URL(subpath, MCP_SERVER_URL);

  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const headers = new Headers();
  for (const name of ['content-type', 'content-length', 'accept', 'authorization', 'x-tenant-id', 'x-forwarded-for', 'x-real-ip', 'mcp-session-id', 'mcp-protocol-version', 'last-event-id']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Client-supplied course scope is ignored. Only a validated PAT sets this.
  headers.delete('x-mcp-course-ids');
  if (extraHeaders) {
    for (const [name, value] of Object.entries(extraHeaders)) {
      headers.set(name, value);
    }
  }
  if (MCP_PROXY_SECRET) headers.set('x-mcp-secret', MCP_PROXY_SECRET);

  // Pass origin info for multi-tenant consent redirects
  const origin = getOrigin(request);
  headers.set('x-forwarded-host', request.headers.get('host') || 'localhost:3000');
  headers.set('x-forwarded-proto', request.headers.get('x-forwarded-proto') || 'https');
  headers.set('x-origin', origin);

  if ((request.method === 'POST' || request.method === 'PUT') && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  try {
    let body: BodyInit | null = null;
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'DELETE') {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json') || contentType.includes('application/x-www-form-urlencoded')) {
        body = await request.text();
      } else {
        body = await request.arrayBuffer();
      }
    }

    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    });

    // Pass through redirects
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        return NextResponse.redirect(location, response.status as 301 | 302 | 303 | 307 | 308);
      }
    }

    const responseHeaders = new Headers();
    for (const name of ['content-type', 'cache-control', 'set-cookie', 'mcp-session-id']) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    // The MCP server builds WWW-Authenticate from its internal baseUrl —
    // rewrite resource_metadata to this tenant's public /api/mcp base so
    // clients discover OAuth metadata at the URL they actually connected to.
    const wwwAuth = response.headers.get('www-authenticate');
    if (wwwAuth) {
      responseHeaders.set(
        'www-authenticate',
        wwwAuth.replace(
          /resource_metadata="[^"]*"/,
          `resource_metadata="${origin}/api/mcp/.well-known/oauth-protected-resource"`
        )
      );
    }

    responseHeaders.set('access-control-allow-origin', '*');
    responseHeaders.set('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
    responseHeaders.set('access-control-allow-headers', 'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version');
    responseHeaders.set('access-control-expose-headers', 'Mcp-Session-Id, WWW-Authenticate');

    // Stream the body through — MCP streamable HTTP can respond with SSE.
    return new NextResponse(response.body, { status: response.status, headers: responseHeaders });
  } catch (error) {
    console.error(`[MCP Proxy] Error forwarding to ${targetUrl}:`, error);
    return NextResponse.json(
      { error: 'proxy_error', error_description: 'Failed to connect to MCP server' },
      { status: 502 }
    );
  }
}

// ─── Route Handlers ────────────────────────────────────────────────────────

async function proxyAfterPat(request: NextRequest, subpath: string): Promise<Response> {
  const extra = await extraHeadersForPat(request);
  if (extra instanceof NextResponse) return extra;
  const target = subpath === '/cli' ? '/mcp' : subpath;
  return proxyToMcp(request, target, extra);
}

export async function GET(request: NextRequest) {
  const subpath = getSubpath(request);

  // OAuth metadata — protected-resource is tenant-aware, auth-server is Supabase's
  if (subpath.startsWith('/.well-known/oauth-authorization-server') ||
      subpath.startsWith('/.well-known/openid-configuration')) {
    return serveAuthorizationServerMetadata();
  }
  if (subpath.startsWith('/.well-known/oauth-protected-resource')) {
    return serveProtectedResourceMetadata(request);
  }

  return proxyAfterPat(request, subpath);
}

export async function POST(request: NextRequest) {
  return proxyAfterPat(request, getSubpath(request));
}

export async function DELETE(request: NextRequest) {
  return proxyAfterPat(request, getSubpath(request));
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version',
      'Access-Control-Max-Age': '86400',
    },
  });
}
