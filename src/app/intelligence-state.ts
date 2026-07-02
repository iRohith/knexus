"use client";

import { create } from "zustand";

import { useConfluenceStore } from "@/app/confluence/confluence-state";
import { useFirefliesStore } from "@/app/fireflies/fireflies-state";
import { useGitHubStore } from "@/app/github/github-state";
import { useDriveStore } from "@/app/google-drive/drive-state";
import { useHubSpotStore } from "@/app/hubspot/hubspot-state";
import { useJiraStore } from "@/app/jira/jira-state";
import { useLinearStore } from "@/app/linear/linear-state";
import { useSlackStore } from "@/app/slack/slack-state";
import type { SourceApp } from "@/app/admin/activity-state";
import { normalizeCogneeQueryPayload } from "@/lib/cognee-adapter";
import type {
  CitationRole,
  CogneeQueryPayload,
  IntelligenceAnswer,
} from "@/lib/knowledge-graph-types";

type FixtureKey = "account-switch" | "export-request" | "quality-bar";

type FixtureEvidence = {
  nodeId: string;
  edgeId?: string;
  sourceApp: SourceApp;
  sourceEventId: string;
  sourceUrl: string;
  title: string;
  snippet: string;
  relationship: string;
  role: CitationRole;
};

type FixtureAnswerTemplate = {
  key: FixtureKey;
  question: string;
  answer: string;
  evidence: FixtureEvidence[];
};

function edgeId(source: string, target: string) {
  return `edge-${source}-${target}`;
}

function textSnippet(value: string | undefined, fallback: string) {
  const text = (value ?? fallback).replace(/\s+/g, " ").trim();
  return text.length > 150 ? `${text.slice(0, 147)}...` : text;
}

function slackUrl(message: {
  id: string;
  surfaceId: string;
  surfaceType: string;
  threadParentId?: string | null;
}) {
  const params =
    message.surfaceType === "channel" ? `channel=${message.surfaceId}` : `dm=${message.surfaceId}`;
  const thread = message.threadParentId ? `&thread=${message.threadParentId}` : "";
  return `/slack?${params}${thread}&message=${message.id}#${message.id}`;
}

function buildFixtureTemplates(): FixtureAnswerTemplate[] {
  const slack = useSlackStore.getState();
  const jira = useJiraStore.getState();
  const github = useGitHubStore.getState();
  const confluence = useConfluenceStore.getState();
  const hubspot = useHubSpotStore.getState();
  const fireflies = useFirefliesStore.getState();
  const linear = useLinearStore.getState();
  const drive = useDriveStore.getState();

  const slackMessages = Object.values(slack.messages);
  const jiraIssues = Object.values(jira.issues);
  const pulls = Object.values(github.pulls);
  const pages = Object.values(confluence.pages);
  const deals = Object.values(hubspot.deals);
  const meetings = Object.values(fireflies.meetings);
  const linearIssues = Object.values(linear.issues);
  const driveItems = Object.values(drive.items).filter((item) => !item.trashed);

  const accountSlack = slackMessages[0];
  const accountJira = jiraIssues[0];
  const accountPr = pulls[0];
  const accountPage = pages[0];

  const accountNodes = {
    slack: accountSlack ? `slack-msg-${accountSlack.id}` : "slack-msg-missing",
    jira: accountJira ? `jira-issue-${accountJira.id}` : "jira-issue-missing",
    pr: accountPr ? `github-pr-${accountPr.id}` : "github-pr-missing",
    page: accountPage ? `conf-page-${accountPage.id}` : "conf-page-missing",
  };

  const exportDeal = deals[0];
  const exportMeeting = meetings[0];
  const exportIssue = linearIssues[0];
  const exportDoc = driveItems[0];
  const exportPr = pulls[1] ?? pulls[0];

  const exportNodes = {
    deal: exportDeal ? `hs-deal-${exportDeal.id}` : "hs-deal-missing",
    meeting: exportMeeting ? `ff-meeting-${exportMeeting.id}` : "ff-meeting-missing",
    issue: exportIssue ? `linear-issue-${exportIssue.id}` : "linear-issue-missing",
    doc: exportDoc ? `drive-${exportDoc.id}` : "drive-missing",
    pr: exportPr ? `github-pr-${exportPr.id}` : "github-pr-missing",
  };

  const qualityPage = pages[2] ?? pages[0];
  const qualitySlack = slackMessages[2] ?? slackMessages[0];
  const qualityJira = jiraIssues[2] ?? jiraIssues[0];
  const qualityPr = pulls[2] ?? pulls[0];

  const qualityNodes = {
    page: qualityPage ? `conf-page-${qualityPage.id}` : "conf-page-quality-missing",
    slack: qualitySlack ? `slack-msg-${qualitySlack.id}` : "slack-msg-quality-missing",
    jira: qualityJira ? `jira-issue-${qualityJira.id}` : "jira-issue-quality-missing",
    pr: qualityPr ? `github-pr-${qualityPr.id}` : "github-pr-quality-missing",
  };

  return [
    {
      key: "account-switch",
      question: "Why did we change account-switch URL cleanup?",
      answer:
        "The URL cleanup changed because the source text shows a privacy problem: account switching could leave a stale detail route visible after the active user changed. The supporting memory path moves from the reproduction note, to the implementation requirement, to the code change, and then to the decision note that records the privacy contract.",
      evidence: [
        {
          nodeId: accountNodes.slack,
          edgeId: edgeId(accountNodes.slack, accountNodes.jira),
          sourceApp: "slack",
          sourceEventId: accountSlack ? `seeded-slack-${accountSlack.id}` : "seeded-slack-missing",
          sourceUrl: accountSlack ? slackUrl(accountSlack) : "/slack",
          title: accountSlack
            ? textSnippet(accountSlack.body, "Stale route reproduction")
            : "Stale route reproduction",
          snippet: textSnippet(
            accountSlack?.body,
            "The team reproduced stale route state after account switching.",
          ),
          relationship: "reported the stale route behavior",
          role: "supports",
        },
        {
          nodeId: accountNodes.jira,
          edgeId: edgeId(accountNodes.jira, accountNodes.pr),
          sourceApp: "jira",
          sourceEventId: accountJira ? `seeded-jira-${accountJira.id}` : "seeded-jira-missing",
          sourceUrl: accountJira
            ? `/jira?project=${accountJira.projectId}&view=board&issue=${accountJira.id}`
            : "/jira",
          title: accountJira?.summary ?? "Jira privacy ticket",
          snippet: textSnippet(accountJira?.description, "Jira tracked the privacy fix."),
          relationship: "converted the observed problem into required work",
          role: "tracks",
        },
        {
          nodeId: accountNodes.pr,
          edgeId: edgeId(accountNodes.pr, accountNodes.page),
          sourceApp: "github",
          sourceEventId: accountPr
            ? `seeded-github-pr-${accountPr.id}`
            : "seeded-github-pr-missing",
          sourceUrl: accountPr
            ? `/github?repo=${accountPr.repoId}&tab=pulls&pr=${accountPr.id}#${accountPr.id}-body`
            : "/github",
          title: accountPr?.title ?? "GitHub implementation",
          snippet: textSnippet(accountPr?.body, "GitHub implemented the route reset behavior."),
          relationship: "resolved the required behavior",
          role: "implements",
        },
        {
          nodeId: accountNodes.page,
          sourceApp: "confluence",
          sourceEventId: accountPage
            ? `seeded-confluence-${accountPage.id}`
            : "seeded-confluence-missing",
          sourceUrl: accountPage
            ? `/confluence?space=${accountPage.spaceId}&page=${accountPage.id}`
            : "/confluence",
          title: accountPage?.title ?? "Confluence decision",
          snippet: textSnippet(accountPage?.body, "Confluence documented the decision."),
          relationship: "records the final decision",
          role: "documents",
        },
      ],
    },
    {
      key: "export-request",
      question: "Which customer asked for export improvements?",
      answer:
        "The export request is supported by a chain of source text: customer context in HubSpot, meeting notes in Fireflies, implementation requirements in Linear, written requirements in Drive, and the GitHub change that follows from those requirements. The answer depends on that semantic path, not a single isolated record.",
      evidence: [
        {
          nodeId: exportNodes.deal,
          edgeId: edgeId(exportNodes.deal, exportNodes.meeting),
          sourceApp: "hubspot",
          sourceEventId: exportDeal
            ? `seeded-hubspot-deal-${exportDeal.id}`
            : "seeded-hubspot-deal-missing",
          sourceUrl: exportDeal ? `/hubspot?view=deals&deal=${exportDeal.id}` : "/hubspot",
          title: exportDeal?.name ?? "HubSpot customer request",
          snippet: textSnippet(exportDeal?.name, "A customer request was recorded in HubSpot."),
          relationship: "establishes the customer context",
          role: "requested",
        },
        {
          nodeId: exportNodes.meeting,
          edgeId: edgeId(exportNodes.meeting, exportNodes.issue),
          sourceApp: "fireflies",
          sourceEventId: exportMeeting
            ? `seeded-fireflies-${exportMeeting.id}`
            : "seeded-fireflies-missing",
          sourceUrl: exportMeeting
            ? `/fireflies?view=all&meeting=${exportMeeting.id}`
            : "/fireflies",
          title: exportMeeting?.title ?? "Customer meeting",
          snippet: textSnippet(
            exportMeeting?.summary,
            "The customer request was discussed in a meeting.",
          ),
          relationship: "adds meeting evidence",
          role: "supports",
        },
        {
          nodeId: exportNodes.issue,
          edgeId: edgeId(exportNodes.issue, exportNodes.doc),
          sourceApp: "linear",
          sourceEventId: exportIssue ? `seeded-linear-${exportIssue.id}` : "seeded-linear-missing",
          sourceUrl: exportIssue
            ? `/linear?team=${exportIssue.teamId}&view=list&issue=${exportIssue.id}`
            : "/linear",
          title: exportIssue?.title ?? "Linear implementation issue",
          snippet: textSnippet(exportIssue?.description, "Linear tracked the implementation work."),
          relationship: "turns the request into implementation requirements",
          role: "tracks",
        },
        {
          nodeId: exportNodes.doc,
          edgeId: edgeId(exportNodes.doc, exportNodes.pr),
          sourceApp: "google-drive",
          sourceEventId: exportDoc ? `seeded-drive-${exportDoc.id}` : "seeded-drive-missing",
          sourceUrl: exportDoc
            ? exportDoc.kind === "folder"
              ? `/google-drive?view=my-drive&folder=${exportDoc.id}`
              : `/google-drive?view=my-drive&file=${exportDoc.id}`
            : "/google-drive",
          title: exportDoc?.name ?? "Drive requirements",
          snippet: textSnippet(exportDoc?.content, "Drive captured requirements for the change."),
          relationship: "refines the requirements text",
          role: "documents",
        },
        {
          nodeId: exportNodes.pr,
          sourceApp: "github",
          sourceEventId: exportPr ? `seeded-github-pr-${exportPr.id}` : "seeded-github-pr-missing",
          sourceUrl: exportPr
            ? `/github?repo=${exportPr.repoId}&tab=pulls&pr=${exportPr.id}#${exportPr.id}-body`
            : "/github",
          title: exportPr?.title ?? "GitHub implementation",
          snippet: textSnippet(exportPr?.body, "GitHub implemented the requested work."),
          relationship: "implements the requested behavior",
          role: "implements",
        },
      ],
    },
    {
      key: "quality-bar",
      question: "What work implemented the app quality bar?",
      answer:
        "The app quality bar is supported by a semantic path from the written standard, through discussion evidence, into required parity work, and then into implementation. The relevant memories show how the standard became concrete engineering changes.",
      evidence: [
        {
          nodeId: qualityNodes.page,
          edgeId: edgeId(qualityNodes.page, qualityNodes.slack),
          sourceApp: "confluence",
          sourceEventId: qualityPage
            ? `seeded-confluence-${qualityPage.id}`
            : "seeded-confluence-quality-missing",
          sourceUrl: qualityPage
            ? `/confluence?space=${qualityPage.spaceId}&page=${qualityPage.id}`
            : "/confluence",
          title: qualityPage?.title ?? "Quality standard",
          snippet: textSnippet(
            qualityPage?.body,
            "Confluence documented the app quality standard.",
          ),
          relationship: "states the standard",
          role: "documents",
        },
        {
          nodeId: qualityNodes.slack,
          edgeId: edgeId(qualityNodes.slack, qualityNodes.jira),
          sourceApp: "slack",
          sourceEventId: qualitySlack
            ? `seeded-slack-${qualitySlack.id}`
            : "seeded-slack-quality-missing",
          sourceUrl: qualitySlack ? slackUrl(qualitySlack) : "/slack",
          title: qualitySlack
            ? textSnippet(qualitySlack.body, "Quality bar discussion")
            : "Quality bar discussion",
          snippet: textSnippet(qualitySlack?.body, "Slack reviewed the user-visible standard."),
          relationship: "adds discussion evidence",
          role: "supports",
        },
        {
          nodeId: qualityNodes.jira,
          edgeId: edgeId(qualityNodes.jira, qualityNodes.pr),
          sourceApp: "jira",
          sourceEventId: qualityJira
            ? `seeded-jira-${qualityJira.id}`
            : "seeded-jira-quality-missing",
          sourceUrl: qualityJira
            ? `/jira?project=${qualityJira.projectId}&view=board&issue=${qualityJira.id}`
            : "/jira",
          title: qualityJira?.summary ?? "Jira parity gap",
          snippet: textSnippet(qualityJira?.description, "Jira tracked the quality gap."),
          relationship: "turns the standard into required work",
          role: "tracks",
        },
        {
          nodeId: qualityNodes.pr,
          sourceApp: "github",
          sourceEventId: qualityPr
            ? `seeded-github-pr-${qualityPr.id}`
            : "seeded-github-pr-quality-missing",
          sourceUrl: qualityPr
            ? `/github?repo=${qualityPr.repoId}&tab=pulls&pr=${qualityPr.id}#${qualityPr.id}-body`
            : "/github",
          title: qualityPr?.title ?? "GitHub implementation",
          snippet: textSnippet(qualityPr?.body, "GitHub implemented the quality bar changes."),
          relationship: "implements the required work",
          role: "implements",
        },
      ],
    },
  ];
}

function matchFixture(question: string): FixtureAnswerTemplate | null {
  const q = question.toLowerCase();
  const templates = buildFixtureTemplates();

  if (q.includes("account") || q.includes("url") || q.includes("switch") || q.includes("privacy")) {
    return templates.find((template) => template.key === "account-switch") ?? null;
  }

  if (q.includes("export") || q.includes("customer") || q.includes("who asked")) {
    return templates.find((template) => template.key === "export-request") ?? null;
  }

  if (
    q.includes("quality") ||
    q.includes("bar") ||
    q.includes("standard") ||
    q.includes("implemented")
  ) {
    return templates.find((template) => template.key === "quality-bar") ?? null;
  }

  return null;
}

function toCogneeFixturePayload(
  template: FixtureAnswerTemplate,
  question: string,
  now: number,
): CogneeQueryPayload {
  const datasetName = "corp-os-demo-20260702-172327";

  return {
    queryId: `fixture-${template.key}-${now}`,
    question,
    answer: template.answer,
    responseTimeMs: 640,
    timestamp: new Date(now).toISOString(),
    source: "fixture",
    datasetName,
    raw: {
      remember: {
        status: "completed",
        dataset_name: datasetName,
        note: "Fixture shaped like Cognee Cloud remember output.",
      },
      recall: [
        {
          source: "graph",
          kind: "graph_completion",
          search_type: "GRAPH_COMPLETION",
          text: template.answer,
          dataset_name: datasetName,
          dataset_id: "fixture-dataset",
          metadata: {},
          raw: { value: template.answer },
          structured: null,
        },
        ...template.evidence.map((item, index) => ({
          source: "graph" as const,
          kind: "chunk",
          search_type: "CHUNKS" as const,
          text: [
            `Source event id: ${item.sourceEventId}`,
            `Source app: ${item.sourceApp}`,
            `Source URL: ${item.sourceUrl}`,
            "Content:",
            item.snippet,
          ].join("\n"),
          dataset_name: datasetName,
          dataset_id: "fixture-dataset",
          metadata: {
            data_id: `${template.key}-data-${index + 1}`,
            chunk_id: `${template.key}-chunk-${index + 1}`,
            chunk_index: index,
            document_name: "fixture",
          },
          raw: {
            text: item.snippet,
            document_name: "fixture",
            chunk_index: index,
          },
          structured: null,
        })),
      ],
    },
  };
}

function toAnswer(template: FixtureAnswerTemplate, question: string): IntelligenceAnswer {
  const now = Date.now();
  const payload = toCogneeFixturePayload(template, question, now);
  const normalized = normalizeCogneeQueryPayload(payload);

  return {
    id: payload.queryId,
    queryKey: template.key,
    question,
    answer: normalized.answer,
    createdAt: now,
    source: "fixture",
    responseTimeMs: payload.responseTimeMs ?? 0,
    citations: normalized.citations,
    cognee: {
      datasetName: payload.datasetName,
      recall: payload.raw?.recall ?? [],
      raw: payload.raw,
    },
    graph: normalized.graph,
    highlightedNodeIds: normalized.highlightedNodeIds,
    highlightedEdgeIds: normalized.highlightedEdgeIds,
    reasoningSteps: normalized.reasoningSteps,
  };
}

type IntelligenceState = {
  answers: IntelligenceAnswer[];
  activeAnswerId: string | null;
  isLoading: boolean;
  askQuestion: (text: string) => void;
  setActiveAnswer: (id: string | null) => void;
  clearAnswers: () => void;
};

export const EXAMPLE_PROMPTS = [
  "Why did we change account-switch URL cleanup?",
  "Which customer asked for export improvements?",
  "What work implemented the app quality bar?",
  "What evidence supports the billing migration decision?",
];

export const useIntelligenceStore = create<IntelligenceState>((set, get) => ({
  answers: [],
  activeAnswerId: null,
  isLoading: false,

  askQuestion: (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().isLoading) return;

    set({ isLoading: true, activeAnswerId: null });

    window.setTimeout(() => {
      const match = matchFixture(trimmed);

      if (!match) {
        const now = Date.now();
        const answer: IntelligenceAnswer = {
          id: `answer-empty-${now}`,
          queryKey: "no-match",
          question: trimmed,
          answer:
            "No local sample answer matches this question yet. When Cognee is connected, the same surface will show the returned answer, citations, and reasoning path.",
          createdAt: now,
          source: "fixture",
          responseTimeMs: 520,
          citations: [],
          cognee: { recall: [], raw: {} },
          graph: {
            nodes: [],
            edges: [],
            generatedAt: now,
            source: "fixture",
          },
          highlightedNodeIds: [],
          highlightedEdgeIds: [],
          reasoningSteps: [],
        };

        set((state) => ({
          isLoading: false,
          answers: [answer, ...state.answers],
          activeAnswerId: answer.id,
        }));
        return;
      }

      const answer = toAnswer(match, trimmed);
      set((state) => ({
        isLoading: false,
        answers: [answer, ...state.answers],
        activeAnswerId: answer.id,
      }));
    }, 650);
  },

  setActiveAnswer: (id) => set({ activeAnswerId: id }),

  clearAnswers: () => set({ answers: [], activeAnswerId: null }),
}));
