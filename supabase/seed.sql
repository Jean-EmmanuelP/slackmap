-- Demo workspace ("Acme Inc") — pre-extracted Slack data shown to landing-page
-- visitors so they can preview Slackmap before connecting their own workspace.
-- Realistic but fictional. UUID is hardcoded so the landing can deeplink to it.

-- Re-running this seed wipes and re-creates the demo workspace cleanly.
delete from workspaces where id = '00000000-0000-0000-0000-000000000001';

insert into workspaces (
  id, slack_team_id, slack_team_name, slack_team_domain,
  encrypted_bot_token, encrypted_user_token,
  installed_by_slack_user_id, installed_by_slack_user_name,
  backfill_status, backfill_progress, backfill_total
) values (
  '00000000-0000-0000-0000-000000000001',
  'T_DEMO_ACME',
  'Acme Inc',
  'acme',
  'demo-no-real-token',
  null,
  'U_DEMO_FOUNDER',
  'Sarah Kim',
  'ready',
  6, 6
);

-- ===== Channels =====
insert into channels (workspace_id, slack_channel_id, name, topic, purpose_native, purpose_extracted, category, message_count_6mo, unique_contributors, last_message_at, archived, is_private, mining_enabled, mining_status) values
('00000000-0000-0000-0000-000000000001', 'C_DEMO_GENERAL',     'general',      'Company-wide announcements', null,
  'Company-wide announcements, all-hands recaps, and welcoming new hires.',
  'announcements', 412, 24, now() - interval '2 hours', false, false, true, 'done'),
('00000000-0000-0000-0000-000000000001', 'C_DEMO_ENG',         'eng',          'Engineering team coordination', null,
  'Backend deploys, on-call rotations, code reviews, and infra incidents for the platform team.',
  'eng', 1840, 8, now() - interval '15 minutes', false, false, true, 'done'),
('00000000-0000-0000-0000-000000000001', 'C_DEMO_PRODUCT',     'product',      'Product roadmap and specs', null,
  'Roadmap reviews, specs feedback, and prioritization debates between product, design, and eng leads.',
  'product', 920, 6, now() - interval '1 hour', false, false, true, 'done'),
('00000000-0000-0000-0000-000000000001', 'C_DEMO_SUPPORT',     'support',      'Customer support inbound', null,
  'Customer-reported bugs, refund requests, and triage handoffs from Zendesk to engineering.',
  'support', 2150, 5, now() - interval '8 minutes', false, false, true, 'done'),
('00000000-0000-0000-0000-000000000001', 'C_DEMO_INCIDENTS',   'incidents',    'On-call & incident war room', null,
  'On-call coordination during production incidents — alert triage, root cause, post-mortem ownership.',
  'eng', 380, 6, now() - interval '3 days', false, true, true, 'done'),
('00000000-0000-0000-0000-000000000001', 'C_DEMO_LEADERSHIP',  'leadership',   'Founders + leadership decisions', null,
  'Strategic decisions, hiring approvals, fundraising updates, and board-prep among the leadership team.',
  'ops', 240, 4, now() - interval '5 hours', false, true, true, 'done');

-- ===== People (with extracted AI profiles) =====
insert into people (workspace_id, slack_user_id, display_name, real_name, title, email, is_bot, is_deleted,
                   role_extracted, summary, tools, expertise, top_channels,
                   message_count, last_seen_at, confidence, status) values
('00000000-0000-0000-0000-000000000001', 'U_DEMO_FOUNDER', 'Sarah Kim', 'Sarah Kim',
  'CEO & Co-founder', 'sarah@acme.example', false, false,
  'CEO',
  'Sarah leads Acme as CEO — drives fundraising, board comms, exec hiring, and unblocks deals. Stays close to product strategy and is the final approver on pricing exceptions above $50K ACV.',
  array['Notion', 'Linear', 'Pitch', 'Stripe Dashboard'],
  array['fundraising', 'GTM strategy', 'pricing decisions', 'exec hiring'],
  '[{"slack_channel_id":"C_DEMO_LEADERSHIP","name":"leadership","count":140},{"slack_channel_id":"C_DEMO_GENERAL","name":"general","count":85}]'::jsonb,
  340, now() - interval '5 hours', 0.95, 'active'),

('00000000-0000-0000-0000-000000000001', 'U_DEMO_CTO', 'Marc Petit', 'Marc Petit',
  'CTO & Co-founder', 'marc@acme.example', false, false,
  'CTO',
  'Marc owns the technical architecture, makes the final call on infra/stack decisions, and runs the on-call rotation for severity-1 incidents. Heavily involved in code reviews of changes touching billing or auth.',
  array['GitHub', 'Linear', 'Datadog', 'PagerDuty', 'Terraform', 'AWS'],
  array['Postgres', 'distributed systems', 'incident response', 'AWS infra'],
  '[{"slack_channel_id":"C_DEMO_ENG","name":"eng","count":520},{"slack_channel_id":"C_DEMO_INCIDENTS","name":"incidents","count":180},{"slack_channel_id":"C_DEMO_LEADERSHIP","name":"leadership","count":60}]'::jsonb,
  840, now() - interval '15 minutes', 0.96, 'active'),

('00000000-0000-0000-0000-000000000001', 'U_DEMO_HEAD_PRODUCT', 'Anna Schmidt', 'Anna Schmidt',
  'Head of Product', 'anna@acme.example', false, false,
  'Head of Product',
  'Anna runs the product org, owns the roadmap, and adjudicates priorities between design, eng, and customer feedback. She makes the call when an in-flight feature gets descoped to ship a release.',
  array['Linear', 'Figma', 'Notion', 'Amplitude', 'Maze'],
  array['roadmap planning', 'user research', 'feature prioritization', 'release management'],
  '[{"slack_channel_id":"C_DEMO_PRODUCT","name":"product","count":380},{"slack_channel_id":"C_DEMO_GENERAL","name":"general","count":42}]'::jsonb,
  490, now() - interval '1 hour', 0.92, 'active'),

('00000000-0000-0000-0000-000000000001', 'U_DEMO_HEAD_SUPPORT', 'Lisa Chen', 'Lisa Chen',
  'Head of Customer Support', 'lisa@acme.example', false, false,
  'Head of Support',
  'Lisa runs the 5-person support team, owns response-time SLAs, and decides refund cases up to $500 without escalation. She files tickets to engineering for bugs that recur 3+ times in a week.',
  array['Zendesk', 'Linear', 'Stripe Dashboard', 'Notion'],
  array['customer support operations', 'refund policy', 'escalation triage', 'support metrics'],
  '[{"slack_channel_id":"C_DEMO_SUPPORT","name":"support","count":680},{"slack_channel_id":"C_DEMO_PRODUCT","name":"product","count":120}]'::jsonb,
  820, now() - interval '8 minutes', 0.94, 'active'),

('00000000-0000-0000-0000-000000000001', 'U_DEMO_SENIOR_ENG', 'Diego Romero', 'Diego Romero',
  'Staff Engineer (Backend)', 'diego@acme.example', false, false,
  'Staff Engineer',
  'Diego owns the billing service end-to-end and is the de-facto incident commander for any payment-related outage. Reviews every PR touching Stripe or subscription logic.',
  array['GitHub', 'Stripe', 'Postgres', 'Datadog', 'Linear'],
  array['Stripe webhooks', 'subscription billing', 'database migrations', 'incident commander'],
  '[{"slack_channel_id":"C_DEMO_ENG","name":"eng","count":410},{"slack_channel_id":"C_DEMO_INCIDENTS","name":"incidents","count":95}]'::jsonb,
  580, now() - interval '40 minutes', 0.91, 'active'),

('00000000-0000-0000-0000-000000000001', 'U_DEMO_SALES', 'Ben Carter', 'Ben Carter',
  'Account Executive', 'ben@acme.example', false, false,
  'Account Executive',
  'Ben handles mid-market deals ($10K-$100K ACV). Pings the leadership channel for pricing exceptions and works closely with Lisa on customer-success handoffs after close.',
  array['HubSpot', 'Notion', 'DocuSign', 'Loom'],
  array['mid-market sales', 'discount approvals', 'demo facilitation', 'pipeline forecasting'],
  '[{"slack_channel_id":"C_DEMO_LEADERSHIP","name":"leadership","count":40},{"slack_channel_id":"C_DEMO_GENERAL","name":"general","count":62}]'::jsonb,
  180, now() - interval '12 hours', 0.78, 'active');

-- ===== Glossary =====
insert into glossary_entries (workspace_id, term, definition, category, first_seen_channel_id, first_seen_ts, occurrences) values
('00000000-0000-0000-0000-000000000001', 'ACV',  'Annual Contract Value — total contract revenue over 12 months. Used to size deals.', 'acronym', 'C_DEMO_LEADERSHIP', '1700000001.000', 38),
('00000000-0000-0000-0000-000000000001', 'ARR',  'Annual Recurring Revenue — sum of all active subscriptions annualized.', 'acronym', 'C_DEMO_LEADERSHIP', '1700000002.000', 52),
('00000000-0000-0000-0000-000000000001', 'MRR',  'Monthly Recurring Revenue — subset of ARR / 12. Tracked weekly in #leadership.', 'acronym', 'C_DEMO_LEADERSHIP', '1700000003.000', 41),
('00000000-0000-0000-0000-000000000001', 'CAC',  'Customer Acquisition Cost — total sales+marketing spend divided by new customers acquired.', 'acronym', 'C_DEMO_LEADERSHIP', '1700000004.000', 19),
('00000000-0000-0000-0000-000000000001', 'LTV',  'Customer Lifetime Value — projected total revenue from a customer over their lifetime.', 'acronym', 'C_DEMO_LEADERSHIP', '1700000005.000', 14),
('00000000-0000-0000-0000-000000000001', 'NPS',  'Net Promoter Score — survey metric, score from -100 to 100. Sent quarterly via Hotjar.', 'acronym', 'C_DEMO_PRODUCT', '1700000006.000', 22),
('00000000-0000-0000-0000-000000000001', 'P0',   'Severity 0 incident — production down, all hands stop. Owner = on-call + Marc as IC.', 'jargon', 'C_DEMO_INCIDENTS', '1700000007.000', 31),
('00000000-0000-0000-0000-000000000001', 'P1',   'Severity 1 incident — major degradation, one team paused until resolved. 30-min response SLA.', 'jargon', 'C_DEMO_INCIDENTS', '1700000008.000', 47),
('00000000-0000-0000-0000-000000000001', 'P2',   'Severity 2 incident — feature impaired, fix within 24h, no all-hands.', 'jargon', 'C_DEMO_INCIDENTS', '1700000009.000', 28),
('00000000-0000-0000-0000-000000000001', 'SLA',  'Service Level Agreement — contractual uptime/response commitment. We guarantee 99.95%.', 'acronym', 'C_DEMO_INCIDENTS', '1700000010.000', 24),
('00000000-0000-0000-0000-000000000001', 'SLO',  'Service Level Objective — internal target slightly stricter than SLA (99.97% on payments service).', 'acronym', 'C_DEMO_ENG', '1700000011.000', 18),
('00000000-0000-0000-0000-000000000001', 'GTM',  'Go-To-Market — refers to launch motion, sales motion, or the GTM team specifically.', 'acronym', 'C_DEMO_LEADERSHIP', '1700000012.000', 33),
('00000000-0000-0000-0000-000000000001', 'ICP',  'Ideal Customer Profile — Acme targets B2B SaaS companies with 50-500 employees.', 'acronym', 'C_DEMO_LEADERSHIP', '1700000013.000', 17),
('00000000-0000-0000-0000-000000000001', 'PMF',  'Product-Market Fit — Sarah uses this loosely to mean "customers pulling us forward".', 'acronym', 'C_DEMO_LEADERSHIP', '1700000014.000', 12),
('00000000-0000-0000-0000-000000000001', 'OKR',  'Objectives and Key Results — quarterly. Posted in #general by Sarah at the start of each quarter.', 'acronym', 'C_DEMO_GENERAL', '1700000015.000', 26),
('00000000-0000-0000-0000-000000000001', 'KPI',  'Key Performance Indicator — leading indicators tracked weekly: NDR, CSAT, deploy frequency.', 'acronym', 'C_DEMO_GENERAL', '1700000016.000', 21),
('00000000-0000-0000-0000-000000000001', 'NDR',  'Net Dollar Retention — Acme tracks gross + net retention monthly. Target 115% NDR.', 'acronym', 'C_DEMO_LEADERSHIP', '1700000017.000', 13),
('00000000-0000-0000-0000-000000000001', 'CSAT', 'Customer Satisfaction Score — collected after every support resolution. 4.2/5 average.', 'acronym', 'C_DEMO_SUPPORT', '1700000018.000', 36),
('00000000-0000-0000-0000-000000000001', 'CSM',  'Customer Success Manager — Acme has 3 CSMs covering accounts >$50K ACV.', 'acronym', 'C_DEMO_SUPPORT', '1700000019.000', 29),
('00000000-0000-0000-0000-000000000001', 'PR',   'Pull Request — code change up for review on GitHub. Required: 1 approval + green CI.', 'acronym', 'C_DEMO_ENG', '1700000020.000', 78),
('00000000-0000-0000-0000-000000000001', 'RFC',  'Request for Comments — design doc circulated before non-trivial eng work. Stored in Notion.', 'acronym', 'C_DEMO_ENG', '1700000021.000', 19),
('00000000-0000-0000-0000-000000000001', 'IC',   'Incident Commander — single decision-maker during a P0/P1, defaults to Marc or Diego.', 'acronym', 'C_DEMO_INCIDENTS', '1700000022.000', 24),
('00000000-0000-0000-0000-000000000001', 'TTR',  'Time To Resolve — measured from incident open to all-clear. Target: P0 < 1h, P1 < 4h.', 'acronym', 'C_DEMO_INCIDENTS', '1700000023.000', 16),
('00000000-0000-0000-0000-000000000001', 'A/B',  'A/B test — split-traffic experiment, run via Statsig. Default duration 2 weeks.', 'jargon', 'C_DEMO_PRODUCT', '1700000024.000', 21),
('00000000-0000-0000-0000-000000000001', 'DAU',  'Daily Active Users — tracked in Amplitude, weekly in #product (currently ~12K).', 'acronym', 'C_DEMO_PRODUCT', '1700000025.000', 18),
('00000000-0000-0000-0000-000000000001', 'WAU',  'Weekly Active Users — primary engagement metric (currently ~38K).', 'acronym', 'C_DEMO_PRODUCT', '1700000026.000', 12),
('00000000-0000-0000-0000-000000000001', 'NRR',  'Net Revenue Retention — retention including expansion, target 110%+.', 'acronym', 'C_DEMO_LEADERSHIP', '1700000027.000', 15),
('00000000-0000-0000-0000-000000000001', 'AE',   'Account Executive — closes deals. Acme has 3 AEs, Ben covers mid-market.', 'acronym', 'C_DEMO_LEADERSHIP', '1700000028.000', 14),
('00000000-0000-0000-0000-000000000001', 'BDR',  'Business Development Rep — outbound prospecting role, 1 hire planned Q3.', 'acronym', 'C_DEMO_LEADERSHIP', '1700000029.000', 9);

-- ===== Skills (executable procedures) =====
insert into skills (workspace_id, type, slug, title, trigger, steps_md, decision_criteria, escalation, citations,
                   source_count, confidence, last_observed_at, first_observed_at, status) values

('00000000-0000-0000-0000-000000000001', 'process', 'handle-customer-refund', 'Handle a customer refund request',
  'When a customer asks for a refund (via Zendesk ticket, Slack #support, or email).',
  '1. Look up the customer in Stripe Dashboard. Verify the subscription and last charge.
2. Check the refund policy:
   - Faulty product: refund regardless of date.
   - Within 14 days of charge and customer dissatisfied: refund.
   - 14-30 days: refund only with reasonable justification.
   - 30+ days: refer to escalation (see below).
3. If refund amount < $500 and within 30 days: process directly via Stripe Dashboard. Note the reason in Zendesk.
4. If $500-$2,000 or >30 days: ping @lisa for approval before processing.
5. After processing: reply to the customer with confirmation + 5-7 business days disclaimer.',
  'Faulty product → always refund regardless of date.
Customer canceled within trial → automated refund (no human approval).
> $2,000 → requires founder approval (Sarah or Marc).',
  'Amount > $500: escalate to @lisa.
Amount > $2,000 or beyond 30 days: escalate to @sarah.',
  '[{"channel_id":"C_DEMO_SUPPORT","ts":"1700000100.000","snippet":"Lisa: refund policy clarified — 30 day window, faulty product always refunded"}, {"channel_id":"C_DEMO_LEADERSHIP","ts":"1700000150.000","snippet":"Sarah: any refund > $2K needs my sign-off going forward"}]'::jsonb,
  7, 0.92, now() - interval '3 days', now() - interval '4 months', 'active'),

('00000000-0000-0000-0000-000000000001', 'process', 'production-incident-response', 'Respond to a production incident (P0/P1)',
  'When PagerDuty fires a sev-0 or sev-1 alert, OR a customer reports total outage.',
  '1. Acknowledge the page in PagerDuty within 5 minutes.
2. Open a thread in #incidents with `[P0]` or `[P1]` prefix and a 1-line description.
3. Assign Incident Commander (default: Marc; if Marc unavailable, Diego).
4. Spin up the dedicated war-room voice channel.
5. Update the public status page (statuspage.io) within 10 minutes.
6. Every 30 min: post a status update in #incidents (even if "still investigating").
7. Once resolved: post all-clear in #incidents, mark statuspage resolved.
8. Within 48h: write a post-mortem doc in Notion using the template.',
  'P0 = full outage / data loss risk → all hands.
P1 = major degradation, one team paused.
P2 = handle async, no war room.
If billing or auth involved: Diego is auto-paged regardless of rotation.',
  'P0 unresolved at 1h: page Marc + Sarah.
Customer-impact > 100 paying customers: Sarah notified for comms.',
  '[{"channel_id":"C_DEMO_INCIDENTS","ts":"1700000200.000","snippet":"Marc: from now on every P0 gets a war room voice channel + 30min updates"}, {"channel_id":"C_DEMO_INCIDENTS","ts":"1700000250.000","snippet":"Diego: I should be paged for all billing incidents — added auto-route"}]'::jsonb,
  12, 0.96, now() - interval '6 days', now() - interval '5 months', 'active'),

('00000000-0000-0000-0000-000000000001', 'process', 'deploy-to-production', 'Deploy a change to production',
  'When a PR is approved and ready to ship.',
  '1. Confirm the PR has 1 approval + green CI. PRs touching billing or auth need Diego or Marc as approver.
2. Merge to main. CI auto-deploys to staging.
3. Verify staging: smoke test the affected feature within 10 minutes.
4. Trigger production deploy via the GitHub Actions "Deploy prod" workflow.
5. Post in #eng: "Deploying X to prod" with PR link.
6. Watch Datadog dashboards for 15 min post-deploy. Roll back if error rate > 2x baseline.
7. Update CHANGELOG.md if customer-facing.',
  'Billing / auth changes: extra approval from Diego or Marc.
Deploy freeze: never deploy on Fridays after 3pm or before holidays.
Hotfix during incident: skip staging, deploy direct (with IC approval).',
  'Production rollback needed: page Marc immediately + post in #incidents.',
  '[{"channel_id":"C_DEMO_ENG","ts":"1700000300.000","snippet":"Marc: deploy freeze 3pm Fridays — no exceptions unless P0 hotfix"}, {"channel_id":"C_DEMO_ENG","ts":"1700000310.000","snippet":"Diego: any PR touching Stripe needs me to review"}]'::jsonb,
  18, 0.97, now() - interval '15 minutes', now() - interval '6 months', 'active'),

('00000000-0000-0000-0000-000000000001', 'policy', 'pricing-exception', 'Approve a non-standard pricing or discount',
  'When a sales rep needs to offer a price below the standard tier (or longer trial, custom terms).',
  '1. Sales rep posts the request in #leadership with: customer, ACV, requested discount, justification.
2. < 15% discount on $10K-$50K deal: AE has authority — proceed.
3. 15-30% discount, OR $50K-$100K deal: requires Sarah approval in thread.
4. > 30% discount, OR > $100K deal, OR multi-year prepay: requires Sarah + Marc approval.
5. Custom contract terms (legal redlines): always loop in Sarah.',
  'Strategic logo (named target ICP, willing to do case study): up to 35% discount approved by Sarah alone.
Renewal customer: max 10% discount ever, no exceptions.
Free pilot > 30 days: Sarah + Marc approval required.',
  'Multi-year prepay > $300K: Sarah loops in board observer for input.',
  '[{"channel_id":"C_DEMO_LEADERSHIP","ts":"1700000400.000","snippet":"Sarah: 30% is my hard ceiling without Marc"}, {"channel_id":"C_DEMO_LEADERSHIP","ts":"1700000410.000","snippet":"Sarah: renewals max 10% — we lose pricing power otherwise"}]'::jsonb,
  9, 0.88, now() - interval '2 days', now() - interval '3 months', 'active'),

('00000000-0000-0000-0000-000000000001', 'process', 'customer-onboarding', 'Onboard a new paying customer',
  'When a deal closes (Stripe subscription created with ACV > $10K).',
  '1. Stripe webhook auto-fires → CSM rotation assigns Lisa or one of the 3 CSMs.
2. CSM sends a welcome email within 24h with kickoff call link.
3. Within 5 business days: kickoff call (60min). Map customer goals to features.
4. Set up shared Slack Connect channel with the customer admin.
5. Create the customer in Linear with their named feature requests.
6. 14-day check-in: usage data review (Amplitude), CSAT ping.
7. 30-day check-in: ROI summary email + invite to user community.',
  'Deals < $10K ACV: skip the kickoff call, send self-serve onboarding sequence via Customer.io.
Strategic logo: Sarah joins the kickoff call.
International customer: assign CSM in matching timezone.',
  'Customer churns within 60 days: post-mortem with Sarah + Lisa + the deal AE.',
  '[{"channel_id":"C_DEMO_SUPPORT","ts":"1700000500.000","snippet":"Lisa: deals > $10K get a kickoff call within 5 days, no exceptions"}, {"channel_id":"C_DEMO_LEADERSHIP","ts":"1700000510.000","snippet":"Sarah: I want to join all strategic-logo kickoffs"}]'::jsonb,
  6, 0.85, now() - interval '5 days', now() - interval '4 months', 'active'),

('00000000-0000-0000-0000-000000000001', 'process', 'code-review', 'Review a teammate''s pull request',
  'When you''re tagged on a PR or it''s in your team''s queue.',
  '1. Check PR scope: < 400 lines net changes preferred. If larger, request author splits.
2. Verify CI green. If red, comment "blocked by CI" and unsubscribe.
3. Run locally if the PR touches user-facing flows or DB migrations.
4. Comment style: prefix with [nit] for cosmetic, [blocking] for must-fix, [praise] for great work.
5. Approve only when: tests cover the change, no blocking comments unresolved, intent is clear.
6. Hold turnaround under 24h business-time. If you can''t, reassign.',
  'PRs touching billing → Diego must be one of the approvers.
PRs touching auth → Marc must be one of the approvers.
DB migrations → require staging dry-run before approval.
Hotfix PRs (during incident): expedite, single approval OK.',
  'PR sits > 48h without review: ping the team lead in #eng.',
  '[{"channel_id":"C_DEMO_ENG","ts":"1700000600.000","snippet":"Marc: keep PRs under 400 LOC — easier review, fewer bugs"}, {"channel_id":"C_DEMO_ENG","ts":"1700000620.000","snippet":"Diego: I want eyes on every billing PR"}]'::jsonb,
  22, 0.94, now() - interval '40 minutes', now() - interval '6 months', 'active'),

('00000000-0000-0000-0000-000000000001', 'decision', 'descope-feature-from-release', 'Decide to descope a feature from a release',
  'When a feature in the release scope is at risk of slipping the deadline.',
  '1. PM (Anna) raises the risk in #product 5 days before release.
2. Eng lead provides a confidence percentage on shipping.
3. If confidence < 70%: trigger descope discussion in #product.
4. Anna decides: descope, slip the release, or cut scope of the feature.
5. Communicate the decision to the team in #product + update Linear.',
  'Strategic feature (committed to a customer or board): slip release rather than descope.
Tactical feature: descope without hesitation, ship the rest on time.
Bug fixes: never descope, always ship.',
  'Anna unavailable: Marc decides if eng-related, Sarah if customer-committed.',
  '[{"channel_id":"C_DEMO_PRODUCT","ts":"1700000700.000","snippet":"Anna: 5-day rule — if a feature isn''t looking confident 5 days out, we descope"}]'::jsonb,
  5, 0.79, now() - interval '8 days', now() - interval '3 months', 'active'),

('00000000-0000-0000-0000-000000000001', 'escalation', 'support-bug-to-eng', 'Escalate a customer bug from support to engineering',
  'When the same bug is reported by 3+ customers in a week, OR by a strategic customer.',
  '1. Lisa or a support agent triages the report — verify it''s a real bug, not a misuse.
2. Reproduce in staging if possible. Attach repro steps to a Linear ticket.
3. File the ticket under "Bugs" project in Linear, tag the affected eng team.
4. If recurring (3+ in a week): post in #eng with urgency tag. Eng lead acknowledges within 4h.
5. If strategic customer: ping Diego (billing) or Marc (other) directly + cc Sarah.
6. Track the fix back to the customer ticket and notify them when shipped.',
  'Single customer bug, no repro: stays in support queue, low priority.
3+ customers in a week: bumped to eng priority queue.
Strategic customer ($50K+ ACV): immediate eng attention regardless of count.
Data loss / billing error: P1 incident process applies.',
  'Eng doesn''t acknowledge in 4h: Lisa pings Marc directly.',
  '[{"channel_id":"C_DEMO_SUPPORT","ts":"1700000800.000","snippet":"Lisa: 3-strikes-in-a-week rule — that''s when we ping eng with urgency"}, {"channel_id":"C_DEMO_SUPPORT","ts":"1700000810.000","snippet":"Lisa: any strategic-logo bug skips the queue, goes direct to Diego or Marc"}]'::jsonb,
  8, 0.87, now() - interval '14 hours', now() - interval '4 months', 'active');
