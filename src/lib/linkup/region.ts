// Detect the user's region from the incoming HTTP request, then convert it
// into a prompt fragment we can inject into Linkup queries to bias the search
// toward their country. Without this, generic company names (e.g. "BeStrong")
// resolve to whichever brand has the loudest English-language web presence —
// usually a US one — which is wrong for non-US tenants.
//
// Resolution order:
//   1. Vercel edge headers (x-vercel-ip-country, x-vercel-ip-city) — present
//      on production and preview deploys, never spoofed by the client.
//   2. Accept-Language header — fallback for local dev. "fr-FR,fr;q=0.9" → FR.
//   3. Unknown — no hint injected; Linkup behaves as before.

import type { NextRequest } from "next/server";

export type RegionContext = {
  countryCode: string | null; // ISO 3166-1 alpha-2 (e.g. 'FR')
  countryName: string | null; // 'France'
  city: string | null;
  source: "vercel-ip" | "accept-language" | "unknown";
};

const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

function safeRegionName(code: string): string | null {
  try {
    return REGION_NAMES.of(code) ?? null;
  } catch {
    return null;
  }
}

export function getRegionContext(req: NextRequest): RegionContext {
  // 1. Vercel — most reliable, set at the edge before our code runs.
  const ipCountry = req.headers.get("x-vercel-ip-country");
  if (ipCountry && /^[A-Z]{2}$/.test(ipCountry)) {
    const ipCity = req.headers.get("x-vercel-ip-city");
    return {
      countryCode: ipCountry,
      countryName: safeRegionName(ipCountry),
      city: ipCity ? safeDecode(ipCity) : null,
      source: "vercel-ip",
    };
  }

  // 2. Accept-Language fallback — local dev or non-Vercel hosts.
  const lang = req.headers.get("accept-language")?.split(",")[0]?.trim();
  if (lang && lang.includes("-")) {
    const cc = lang.split("-")[1]?.toUpperCase();
    if (cc && /^[A-Z]{2}$/.test(cc)) {
      return {
        countryCode: cc,
        countryName: safeRegionName(cc),
        city: null,
        source: "accept-language",
      };
    }
  }

  return { countryCode: null, countryName: null, city: null, source: "unknown" };
}

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

// Build the prompt fragment that biases a Linkup query toward the user's region.
// Returns an empty string when no region was detected, so callers can blindly
// concatenate it into their query template.
export function regionHintForPrompt(region: RegionContext): string {
  if (!region.countryName || !region.countryCode) return "";
  const where = region.city ? `${region.city}, ${region.countryName}` : region.countryName;
  const tld = region.countryCode.toLowerCase();
  return (
    ` IMPORTANT regional context: the person running this search is in ${where} (${region.countryCode}).` +
    ` Strongly bias toward companies based in or primarily operating in ${region.countryName}` +
    ` unless evidence overwhelmingly indicates the company is headquartered elsewhere.` +
    ` Prefer ${region.countryName}-based candidates, country-specific TLDs (.${tld}),` +
    ` and content in the local language. A US company with the same name should NOT win` +
    ` over a smaller ${region.countryName}-based one when the regional context matches.`
  );
}

// Same idea but driven by the workspace's user-confirmed scope + country
// (set in step 1 of the wizard) rather than the request IP. This is the
// stronger signal — the user explicitly told us where their business operates.
export function regionHintFromWorkspace(scope: string | null | undefined, countryCode: string | null | undefined): string {
  if (scope === "worldwide") {
    return (
      ` Geographic scope: this is a WORLDWIDE / global company. Do not bias` +
      ` toward any specific country.`
    );
  }
  if (scope === "national" && countryCode && /^[A-Z]{2}$/.test(countryCode)) {
    const name = safeRegionName(countryCode);
    if (!name) return "";
    const tld = countryCode.toLowerCase();
    return (
      ` HARD CONSTRAINT — the company operates in ${name} (${countryCode}).` +
      ` Only return candidates that are based in or primarily operate in ${name}.` +
      ` Strongly prefer ${name}-based candidates, country-specific TLDs (.${tld}),` +
      ` and content in the local language. Discard same-named companies headquartered` +
      ` in other countries (e.g. a US "${name === "United States" ? "" : "BrandName"}" company` +
      ` is the wrong answer when the user's company is ${name}-based).`
    );
  }
  return "";
}
