import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Slackmap — Your company's brain, extracted from Slack.";

// Open Graph image used when slackmap.io is shared on Twitter / Slack / LinkedIn.
// Cream paper background matching the landing, brand mark on the left, hero
// tagline on the right — same aesthetic as the site so the link feels native.
export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "#f5f1ea",
          padding: "0 100px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: 36,
            background: "#5170ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 130,
            fontWeight: 500,
            letterSpacing: "-3px",
            marginRight: 60,
          }}
        >
          M
        </div>
        <div style={{ display: "flex", flexDirection: "column", color: "#16140f" }}>
          <div
            style={{
              fontSize: 22,
              textTransform: "uppercase",
              letterSpacing: "5px",
              color: "#71717a",
              marginBottom: 20,
            }}
          >
            Slackmap
          </div>
          <div
            style={{
              fontSize: 78,
              lineHeight: 1.05,
              fontWeight: 400,
              maxWidth: 760,
              fontStyle: "italic",
            }}
          >
            Your company&apos;s brain, extracted from Slack.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
