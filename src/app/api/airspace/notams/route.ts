/**
 * Server-side proxy for FAA NOTAM Search API.
 *
 * Bypasses CORS restrictions — FAA does not serve CORS headers,
 * so browser fetch() calls are blocked. The server fetches on
 * behalf of the browser.
 */

import { NextRequest, NextResponse } from "next/server";

const FAA_NOTAM_URL = "https://notams.aim.faa.gov/notamSearch/search";

export async function GET(request: NextRequest) {
  const icao = request.nextUrl.searchParams.get("icao");

  if (!icao) {
    return NextResponse.json(
      { error: "Missing 'icao' parameter" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(FAA_NOTAM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        searchType: "0",
        designatorsForLocation: icao,
        notamType: "D",
        radius: "10",
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `FAA returned ${res.status} ${res.statusText}` },
        { status: 502 },
      );
    }

    const text = await res.text();
    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
