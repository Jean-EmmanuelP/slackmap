import { buildOAuthUrl } from "@/lib/slack";
import { randomBytes } from "node:crypto";
import { ConnectToolsClient } from "@/components/ConnectToolsClient";

export const dynamic = "force-dynamic";

export default async function ConnectToolsPage() {
  const state = randomBytes(16).toString("hex");
  const slackOAuthUrl = buildOAuthUrl(state);

  return <ConnectToolsClient slackOAuthUrl={slackOAuthUrl} />;
}
