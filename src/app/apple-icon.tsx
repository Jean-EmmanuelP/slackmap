import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple home-screen icon — 180x180 PNG generated via Next.js ImageResponse.
// Same brand mark as the logo: blue square with white "M" centered.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#5170ff",
          color: "white",
          fontSize: 120,
          fontWeight: 500,
          fontFamily: "system-ui, -apple-system, Helvetica, sans-serif",
          letterSpacing: "-2px",
          borderRadius: 36,
        }}
      >
        M
      </div>
    ),
    { ...size },
  );
}
