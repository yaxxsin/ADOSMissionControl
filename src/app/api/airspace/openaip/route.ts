/**
 * Server-side proxy for OpenAIP airspace data.
 *
 * Bypasses CORS restrictions — OpenAIP requires a custom x-openaip-api-key
 * header which triggers a CORS preflight that the API does not support.
 * The server fetches on behalf of the browser.
 */

import { NextRequest, NextResponse } from "next/server";

const OPENAIP_BASE = "https://api.core.openaip.net/api/airspaces";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const country = params.get("country");

  if (!country) {
    return NextResponse.json({ error: "Missing 'country' parameter" }, { status: 400 });
  }

  // Server env var takes priority, then client-provided fallback
  const apiKey = process.env.OPENAIP_API_KEY || params.get("apiKey");

  if (!apiKey) {
    return NextResponse.json(
      { error: "No OpenAIP API key configured" },
      { status: 500 },
    );
  }

  const upstream = new URLSearchParams({
    country,
    page: params.get("page") || "1",
    limit: params.get("limit") || "200",
  });

  // Forward type params (multiple values)
  const types = params.get("types");
  if (types) {
    for (const t of types.split(",")) {
      upstream.append("type", t.trim());
    }
  }

  try {
    const res = await fetch(`${OPENAIP_BASE}?${upstream.toString()}`, {
      headers: { "x-openaip-api-key": apiKey },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `OpenAIP returned ${res.status} ${res.statusText}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
