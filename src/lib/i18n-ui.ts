// UI string translations ("chrome" — labels, headings, button text). The
// data-side translations are stored in each row's translations JSONB; this
// module covers everything else: section headings, button labels, helper
// copy, AI action recommendations, etc.
//
// Add keys as you encounter hardcoded English strings in components. Keys
// are prefixed by feature area for grep-ability ("dashboard.*", "tools.*").
//
// Usage:
//   import { t } from "@/lib/i18n-ui";
//   <span>{t("tools.sources", lang)}</span>
//   <span>{t("emerging.skillsCount", lang, { n: 12 })}</span>

type Messages = Record<string, string>;

const MESSAGES: Record<string, Messages> = {
  en: {
    // Dashboard chrome
    "dashboard.orgTag": "Organization",
    "dashboard.subtitle": "Your company brain — connect your tools to extract knowledge.",

    // Company context card
    "company.contextLabel": "Company context · grounded by Linkup",
    "company.operatesIn": "Operates in",
    "company.industry": "Industry",
    "company.audience": "Audience",
    "company.tools": "Tools",
    "company.rerunWizard": "Re-run wizard",
    "company.scope.worldwide": "🌍 Worldwide",
    "company.scope.country": "📍 {country}",
    "company.confirmRerun": "Re-run the onboarding wizard? Your current company context will be cleared.",

    // Tool strip
    "tools.sources": "Sources",
    "tools.connect": "connect →",
    "tools.soon": "soon",
    "tools.runOnboarding": "Run onboarding →",
    "tools.unknownStack": "We don't know your stack yet — run the onboarding to tell us.",
    "tools.skillsCount": "{n} skills",

    // Live signals section
    "signals.slack": "Slack",
    "signals.freshdesk": "Freshdesk",
    "signals.lastMined": "Last mined",
    "signals.lastPersonUpdated": "Last person updated",
    "signals.noActivity": "No recent activity yet.",
    "signals.connected": "connected",
    "signals.recentAutomations": "Recent automations detected",
    "signals.recentAutomationsHint": "Procedures the brain has just extracted — install any one as a Claude skill.",
    "signals.downloadAll": "Download all ↓",
    "signals.copyInstall": "Copy install",
    "signals.copied": "Copied",

    // Emerging patterns
    "emerging.title": "Emerging patterns · last 14 days",
    "emerging.subtitle": "Domains where the brain has detected ≥3 procedures recently — across both Slack and Freshdesk.",
    "emerging.skillsCount": "{n} skills",
    "emerging.aiAction": "Suggested AI action",
    "emerging.runsOn": "↳ runs on {surface}",

    // High-recurrence Freshdesk patterns
    "recurring.title": "High-recurrence Freshdesk patterns",
    "recurring.subtitle": "These intents come up across many tickets — install one as a Claude skill and an agent can auto-draft replies.",
    "recurring.ticketsLabel": "× tickets",
    "recurring.agentUsed": "agent used",
    "recurring.viewSkill": "View skill →",

    // Stale skills warning
    "stale.skill": "skill",
    "stale.skills": "skills",
    "stale.haventBeenSeen": "haven't been re-observed recently — your team may have changed how they work.",
    "stale.review": "Review →",

    // Stats strip
    "stat.channels": "Channels",
    "stat.channels.hint": "{n} mined",
    "stat.people": "People",
    "stat.skills": "Skills",
    "stat.skills.hint": "exportable",
    "stat.glossary": "Glossary",
    "stat.glossary.hint": "terms",
    "stat.entities": "Entities",
    "stat.entities.hint": "mapped",

    // Extraction sections
    "extraction.progress": "Extraction progress",
    "extraction.progressHint": "{done} of {total} channels mined — extracting entities, relationships, and skills from each.",
    "extraction.engine": "Extraction engine",
    "extraction.anthropicSet": "Anthropic key active",
    "extraction.anthropicMissing": "No Anthropic key yet",
    "extraction.anthropicSetHint": "Skills + people extraction runs automatically when you mine channels.",
    "extraction.anthropicMissingHint": "Add your sk-ant-... key in the Atlas toolbar to enable extraction.",

    // Skills export bundle
    "skillsBundle.title": "Skills bundle",
    "skillsBundle.downloadAll": "Download all",
    "skillsBundle.ready": "{n} skills · ready for Claude",
    "skillsBundle.path": "~/.claude/skills/<workspace>/ — restart Claude Code to load.",
    "skillsBundle.whatsInside": "What's inside",
    "skillsBundle.refunds": "Refund procedures & exceptions",
    "skillsBundle.deploy": "Deploy & incident playbooks",
    "skillsBundle.escalation": "Escalation paths & owners",
    "skillsBundle.implicit": "Implicit rules & workarounds",
    "skillsBundle.exportTitle": "Use your skills in any AI agent",
    "skillsBundle.exportSubtitle": "Drop your extracted skills into Claude Code, Cursor, or any agent. They run with your company's rules.",
    "skillsBundle.copy": "Copy",

    // Live signals — extracted relative time prefix
    "signals.extractedPrefix": "extracted",

    // Freshdesk signals panel
    "fdSignals.title": "Freshdesk early warnings",
    "fdSignals.subtitle": "Brain insight on the support queue — what your dev/ops team should see, not the inbox itself.",
    "fdSignals.runScan": "Run scan",
    "fdSignals.scanning": "Scanning…",
    "fdSignals.noSignals": "No active signals. Hit Run scan to triage your latest tickets.",
    "fdSignals.window.1": "Last 24h",
    "fdSignals.window.2": "Last 2 days",
    "fdSignals.window.7": "Last 7 days",
    "fdSignals.window.30": "Last 30 days",
    "fdSignals.ack": "Ack",
    "fdSignals.resolved": "Resolved",
    "fdSignals.dismiss": "Dismiss",
    "fdSignals.skillMatch": "↳ skill match",

    // Sidebar nav
    "nav.home": "Home",
    "nav.knowledge": "Knowledge",
    "nav.atlas": "Atlas",
    "nav.people": "People",
    "nav.skills": "Skills",
    "nav.glossary": "Glossary",
    "nav.vault": "Vault",
    "nav.agent": "Agent",
    "nav.tools": "Connected tools",
    "nav.freshdesk": "Freshdesk",
    "nav.stripe": "Stripe",
    "nav.disconnect": "Disconnect",

    // Freshdesk page — inbox (live tickets + AI drafts side by side)
    "fdInbox.title": "Inbox",
    "fdInbox.subtitle": "Latest tickets with the AI draft alongside. Click a row to review, edit, send. Every send teaches the brain.",
    "fdInbox.empty": "No drafts yet. The hourly cron will queue new tickets here — or hit Scan now.",
    "fdInbox.viewAll": "Open queue →",
    "fdInbox.scanNow": "Scan now",
    "fdInbox.scanning": "Scanning…",
    "fdInbox.pending": "pending",
    "fdInbox.sent": "sent",
    "fdInbox.rejected": "rejected",
    "fdInbox.noDraft": "No draft yet",
    "fdInbox.statusPending": "PENDING REVIEW",
    "fdInbox.statusSent": "SENT",
    "fdInbox.statusRejected": "REJECTED",
    "fdInbox.statusFailed": "FAILED",
    "fdInbox.safetyNote": "Drafts are reviewed before send — never auto-sent.",
    // Stripe nudge on /freshdesk
    "fdStripe.title": "Connect Stripe to ground billing drafts in real data",
    "fdStripe.body": "Around 30% of support tickets are billing (refunds, subscriptions, payments). With Stripe connected, the agent cites actual subscription status, last invoice, and refund eligibility — instead of generic policy answers.",
    "fdStripe.cta": "Paste Stripe key",
    "fdStripe.connected": "Stripe connected · agent will use billing context",
    // Legacy keys (compat) — alias to inbox copy
    "fdAgent.title": "Inbox",
    "fdAgent.subtitle": "Latest tickets with the AI draft alongside. Click a row to review, edit, send. Every send teaches the brain.",
    "fdAgent.empty": "No drafts yet. The hourly cron will queue new tickets here — or hit Scan now.",
    "fdAgent.viewAll": "Open queue →",
    "fdAgent.scanNow": "Scan now",
    "fdAgent.scanning": "Scanning…",
    "fdAgent.pending": "pending",

    // Domain → AI action recommendations
    "domain.support.action": "Auto-triage incoming tickets and draft first-line replies",
    "domain.support.surface": "Freshdesk",
    "domain.refund.action": "Pre-validate refund requests, auto-approve under threshold",
    "domain.refund.surface": "Freshdesk + Stripe",
    "domain.billing.action": "Resolve recurring billing/pricing questions without an agent",
    "domain.billing.surface": "Freshdesk",
    "domain.onboarding.action": "AI buddy that answers new-hire process questions",
    "domain.onboarding.surface": "Slack",
    "domain.deploy.action": "Notify on deploys, propose rollbacks based on past incidents",
    "domain.deploy.surface": "Slack + GitHub",
    "domain.ops.action": "Daily ops summary, escalation routing",
    "domain.ops.surface": "Slack",
    "domain.product.action": "Surface user feedback themes weekly with auto-tagging",
    "domain.product.surface": "Slack + Linear",
    "domain.engineering.action": "Code review with company conventions, incident playbook",
    "domain.engineering.surface": "GitHub + Slack",
    "domain.pricing.action": "Auto-validate promo codes against your pricing rules",
    "domain.pricing.surface": "Stripe",
    "domain.marketing.action": "Draft campaign briefs grounded in past launches",
    "domain.marketing.surface": "Slack",
    "domain.hr.action": "Resolve HR / payroll questions from past Slack precedents",
    "domain.hr.surface": "Slack",
    "domain.fallback.action": "Run a Claude agent grounded in your {domain} procedures",
    "domain.fallback.surface": "Any agent",
  },
  fr: {
    // Dashboard chrome
    "dashboard.orgTag": "Organisation",
    "dashboard.subtitle": "Le brain de ta boîte — connecte tes outils pour extraire la connaissance.",

    // Company context card
    "company.contextLabel": "Contexte société · enrichi par Linkup",
    "company.operatesIn": "Opère dans",
    "company.industry": "Industrie",
    "company.audience": "Audience",
    "company.tools": "Outils",
    "company.rerunWizard": "Relancer l'onboarding",
    "company.scope.worldwide": "🌍 Mondial",
    "company.scope.country": "📍 {country}",
    "company.confirmRerun": "Relancer le wizard d'onboarding ? Le contexte société actuel sera effacé.",

    // Tool strip
    "tools.sources": "Sources",
    "tools.connect": "connecter →",
    "tools.soon": "bientôt",
    "tools.runOnboarding": "Lancer l'onboarding →",
    "tools.unknownStack": "On ne connaît pas encore ta stack — lance l'onboarding pour nous dire.",
    "tools.skillsCount": "{n} skills",

    // Live signals section
    "signals.slack": "Slack",
    "signals.freshdesk": "Freshdesk",
    "signals.lastMined": "Dernier minage",
    "signals.lastPersonUpdated": "Dernière personne mise à jour",
    "signals.noActivity": "Pas d'activité récente.",
    "signals.connected": "connecté",
    "signals.recentAutomations": "Automatisations détectées récemment",
    "signals.recentAutomationsHint": "Procédures que le brain vient d'extraire — installe-en une comme skill Claude.",
    "signals.downloadAll": "Tout télécharger ↓",
    "signals.copyInstall": "Copier install",
    "signals.copied": "Copié",

    // Emerging patterns
    "emerging.title": "Patterns émergents · 14 derniers jours",
    "emerging.subtitle": "Domaines où le brain a détecté ≥3 procédures récentes — à travers Slack et Freshdesk.",
    "emerging.skillsCount": "{n} skills",
    "emerging.aiAction": "Action IA suggérée",
    "emerging.runsOn": "↳ tourne sur {surface}",

    // High-recurrence Freshdesk patterns
    "recurring.title": "Patterns Freshdesk à forte récurrence",
    "recurring.subtitle": "Ces intentions reviennent dans de nombreux tickets — installe-les comme skill Claude et un agent rédige les réponses.",
    "recurring.ticketsLabel": "× tickets",
    "recurring.agentUsed": "agent utilisé",
    "recurring.viewSkill": "Voir skill →",

    // Stale skills warning
    "stale.skill": "skill",
    "stale.skills": "skills",
    "stale.haventBeenSeen": "n'ont pas été ré-observées récemment — l'équipe a peut-être changé sa façon de travailler.",
    "stale.review": "Revoir →",

    // Stats strip
    "stat.channels": "Channels",
    "stat.channels.hint": "{n} minés",
    "stat.people": "Personnes",
    "stat.skills": "Skills",
    "stat.skills.hint": "exportables",
    "stat.glossary": "Glossaire",
    "stat.glossary.hint": "termes",
    "stat.entities": "Entités",
    "stat.entities.hint": "mappées",

    // Extraction sections
    "extraction.progress": "Progression extraction",
    "extraction.progressHint": "{done} sur {total} channels minés — extraction d'entités, relations et skills.",
    "extraction.engine": "Moteur d'extraction",
    "extraction.anthropicSet": "Clé Anthropic active",
    "extraction.anthropicMissing": "Pas de clé Anthropic",
    "extraction.anthropicSetHint": "L'extraction des skills + personnes tourne dès qu'on mine des channels.",
    "extraction.anthropicMissingHint": "Ajoute ta clé sk-ant-... dans la toolbar Atlas pour activer l'extraction.",

    // Skills export bundle
    "skillsBundle.title": "Bundle de skills",
    "skillsBundle.downloadAll": "Tout télécharger",
    "skillsBundle.ready": "{n} skills · prêts pour Claude",
    "skillsBundle.path": "~/.claude/skills/<workspace>/ — relance Claude Code pour charger.",
    "skillsBundle.whatsInside": "Ce qu'il y a dedans",
    "skillsBundle.refunds": "Procédures de remboursement et exceptions",
    "skillsBundle.deploy": "Playbooks deploy et incidents",
    "skillsBundle.escalation": "Chemins d'escalade et responsables",
    "skillsBundle.implicit": "Règles implicites et workarounds",
    "skillsBundle.exportTitle": "Utilise tes skills dans n'importe quel agent IA",
    "skillsBundle.exportSubtitle": "Déploie tes skills extraits dans Claude Code, Cursor ou tout autre agent. Ils tournent avec les règles de ta boîte.",
    "skillsBundle.copy": "Copier",

    // Live signals — extracted relative time prefix
    "signals.extractedPrefix": "extrait",

    // Freshdesk signals panel
    "fdSignals.title": "Alertes précoces Freshdesk",
    "fdSignals.subtitle": "Vision brain sur la file support — ce que ton équipe dev/ops doit voir, pas l'inbox elle-même.",
    "fdSignals.runScan": "Lancer scan",
    "fdSignals.scanning": "Scan en cours…",
    "fdSignals.noSignals": "Aucun signal actif. Clique Lancer scan pour trier les derniers tickets.",
    "fdSignals.window.1": "24 dernières h",
    "fdSignals.window.2": "2 derniers jours",
    "fdSignals.window.7": "7 derniers jours",
    "fdSignals.window.30": "30 derniers jours",
    "fdSignals.ack": "Vu",
    "fdSignals.resolved": "Résolu",
    "fdSignals.dismiss": "Écarter",
    "fdSignals.skillMatch": "↳ skill matché",

    // Sidebar nav
    "nav.home": "Accueil",
    "nav.knowledge": "Connaissances",
    "nav.atlas": "Atlas",
    "nav.people": "Personnes",
    "nav.skills": "Skills",
    "nav.glossary": "Glossaire",
    "nav.vault": "Coffre",
    "nav.agent": "Agent",
    "nav.tools": "Outils connectés",
    "nav.freshdesk": "Freshdesk",
    "nav.stripe": "Stripe",
    "nav.disconnect": "Déconnexion",

    // Freshdesk page — inbox (live tickets + AI drafts side by side)
    "fdInbox.title": "Inbox",
    "fdInbox.subtitle": "Derniers tickets avec le brouillon IA à côté. Clique sur une ligne pour relire, éditer, envoyer. Chaque envoi enseigne au brain.",
    "fdInbox.empty": "Aucun brouillon pour l'instant. Le cron horaire ajoutera les nouveaux tickets — ou clique sur Scanner.",
    "fdInbox.viewAll": "Ouvrir la queue →",
    "fdInbox.scanNow": "Scanner",
    "fdInbox.scanning": "Scan en cours…",
    "fdInbox.pending": "en attente",
    "fdInbox.sent": "envoyés",
    "fdInbox.rejected": "rejetés",
    "fdInbox.noDraft": "Pas encore de brouillon",
    "fdInbox.statusPending": "À RELIRE",
    "fdInbox.statusSent": "ENVOYÉ",
    "fdInbox.statusRejected": "REJETÉ",
    "fdInbox.statusFailed": "ÉCHEC",
    "fdInbox.safetyNote": "Les brouillons sont relus avant envoi — jamais auto-envoyés.",
    // Stripe nudge on /freshdesk
    "fdStripe.title": "Connecte Stripe pour ancrer les brouillons billing sur des données réelles",
    "fdStripe.body": "Environ 30 % des tickets support sont billing (remboursements, abonnements, paiements). Une fois Stripe connecté, l'agent cite le statut d'abonnement réel, la dernière facture, l'éligibilité au remboursement — au lieu de réponses génériques.",
    "fdStripe.cta": "Coller la clé Stripe",
    "fdStripe.connected": "Stripe connecté · l'agent utilise le contexte billing",
    // Legacy keys (compat) — alias to inbox copy
    "fdAgent.title": "Inbox",
    "fdAgent.subtitle": "Derniers tickets avec le brouillon IA à côté. Clique sur une ligne pour relire, éditer, envoyer.",
    "fdAgent.empty": "Aucun brouillon pour l'instant. Le cron horaire ajoutera les nouveaux tickets ici — ou clique sur Scanner.",
    "fdAgent.viewAll": "Ouvrir la queue →",
    "fdAgent.scanNow": "Scanner",
    "fdAgent.scanning": "Scan en cours…",
    "fdAgent.pending": "en attente",

    // Domain → AI action recommendations
    "domain.support.action": "Auto-trier les tickets entrants et rédiger les premières réponses",
    "domain.support.surface": "Freshdesk",
    "domain.refund.action": "Pré-valider les demandes de remboursement, auto-approuver sous seuil",
    "domain.refund.surface": "Freshdesk + Stripe",
    "domain.billing.action": "Résoudre les questions récurrentes de facturation sans agent",
    "domain.billing.surface": "Freshdesk",
    "domain.onboarding.action": "Assistant IA qui répond aux questions d'onboarding des nouveaux",
    "domain.onboarding.surface": "Slack",
    "domain.deploy.action": "Notifier les déploiements, proposer des rollbacks basés sur les incidents passés",
    "domain.deploy.surface": "Slack + GitHub",
    "domain.ops.action": "Résumé ops quotidien, routage des escalades",
    "domain.ops.surface": "Slack",
    "domain.product.action": "Faire ressortir les thèmes de feedback utilisateurs chaque semaine avec auto-tag",
    "domain.product.surface": "Slack + Linear",
    "domain.engineering.action": "Revue de code aux conventions de la boîte, playbook incident",
    "domain.engineering.surface": "GitHub + Slack",
    "domain.pricing.action": "Auto-valider les codes promo selon vos règles tarifaires",
    "domain.pricing.surface": "Stripe",
    "domain.marketing.action": "Rédiger les briefs de campagne basés sur les lancements passés",
    "domain.marketing.surface": "Slack",
    "domain.hr.action": "Résoudre les questions RH / paie depuis les précédents Slack",
    "domain.hr.surface": "Slack",
    "domain.fallback.action": "Lancer un agent Claude ancré dans vos procédures {domain}",
    "domain.fallback.surface": "N'importe quel agent",
  },
};

export function t(
  key: string,
  lang: string | null | undefined,
  vars?: Record<string, string | number>,
): string {
  const code = (lang ?? "en").toLowerCase();
  let msg = MESSAGES[code]?.[key] ?? MESSAGES.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      msg = msg.replace(`{${k}}`, String(v));
    }
  }
  return msg;
}
