import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "slackmap" });

// Event payload shapes (sent via inngest.send) — kept as plain types since
// EventSchemas was removed in Inngest 4.x. Functions cast event.data as needed.
export type BackfillRequestedData = { workspaceId: string };
export type SkillsExtractRequestedData = { workspaceId: string };
export type MineChannelRequestedData = {
  workspaceId: string;
  channelDbId: string;
};
export type PeopleExtractRequestedData = { workspaceId: string };
export type PersonReExtractData = {
  workspaceId: string;
  slackUserId: string;
  hint: string | null;
};

export type SlackEventData = {
  teamId: string;
  eventId: string;
  event: {
    type: string;
    channel?: string | { id: string; name?: string; purpose?: string };
    user?: string;
    ts?: string;
    text?: string;
    subtype?: string;
    [key: string]: unknown;
  };
};
