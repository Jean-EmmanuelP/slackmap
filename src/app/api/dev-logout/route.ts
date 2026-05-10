import { NextResponse, type NextRequest } from "next/server";

// Dev-only: clear the `ws` cookie via GET so it's reachable from the URL bar.
// Bounces to /. Returns 404 in production.
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("ws", "", { maxAge: 0, path: "/" });
  return res;
}
