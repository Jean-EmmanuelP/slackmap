import { NextRequest, NextResponse } from "next/server";
import { getRegionContext } from "@/lib/linkup/region";

// Returns the user's best-guess country based on Vercel edge headers (prod)
// or Accept-Language (local). Used by the wizard to pre-fill the country
// picker on the region step.
export async function GET(req: NextRequest) {
  const region = getRegionContext(req);
  return NextResponse.json(region);
}
