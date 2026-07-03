"use client";

import { create } from "zustand";

import {
  activeCorpusUserIds,
  corpusEventsFor,
  corpusLabels,
  corpusNormalizedString,
  corpusNormalizedStrings,
  corpusText,
  dateInput,
  loadCorpusEventsFor,
  stableNumber,
} from "@/lib/corpus-app-data";

export type HubSpotView = "contacts" | "deals" | "tasks";
export type DealStage = "Qualified" | "Proposal" | "Negotiation" | "Closed Won" | "Closed Lost";
export type LifecycleStage = "Lead" | "MQL" | "SQL" | "Customer";

export type Company = {
  id: string;
  name: string;
  domain: string;
  industry: string;
  ownerId: string;
  memberIds: string[];
};

export type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  companyId: string;
  ownerId: string;
  stage: LifecycleStage;
  lastActivityAt: number;
  notes: Note[];
};

export type Deal = {
  id: string;
  name: string;
  companyId: string;
  contactId: string;
  ownerId: string;
  stage: DealStage;
  amount: number;
  closeDate: string;
  probability: number;
  updatedAt: number;
  notes: Note[];
};

export type Task = {
  id: string;
  title: string;
  ownerId: string;
  contactId: string;
  dueDate: string;
  completed: boolean;
  priority: "High" | "Medium" | "Low";
};

export type Note = {
  id: string;
  authorId: string;
  body: string;
  timestamp: number;
};

export type HubSpotSnapshot = {
  companies: Record<string, Company>;
  contacts: Record<string, Contact>;
  deals: Record<string, Deal>;
  tasks: Record<string, Task>;
};

export type HubSpotState = HubSpotSnapshot & {
  loadCorpusPage: (page?: number) => Promise<void>;
  createContact: (input: {
    actorId: string;
    name: string;
    email: string;
    phone: string;
    title: string;
    companyId: string;
    stage: LifecycleStage;
  }) => string;
  createDeal: (input: {
    actorId: string;
    name: string;
    contactId: string;
    stage: DealStage;
    amount: number;
    closeDate: string;
    probability: number;
  }) => string;
  updateContact: (
    contactId: string,
    actorId: string,
    updates: Partial<Pick<Contact, "stage" | "ownerId" | "title" | "email" | "phone">>,
  ) => void;
  updateDeal: (
    dealId: string,
    actorId: string,
    updates: Partial<Pick<Deal, "amount" | "probability" | "closeDate" | "ownerId">>,
  ) => void;
  updateDealStage: (dealId: string, actorId: string, stage: DealStage) => void;
  createTask: (input: {
    actorId: string;
    contactId: string;
    title: string;
    dueDate: string;
    priority: "High" | "Medium" | "Low";
  }) => string;
  toggleTask: (taskId: string, actorId: string) => void;
  addContactNote: (contactId: string, actorId: string, body: string) => void;
  addDealNote: (dealId: string, actorId: string, body: string) => void;
};

export const hubspotViews: HubSpotView[] = ["contacts", "deals", "tasks"];
export const dealStages: DealStage[] = [
  "Qualified",
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];
export const lifecycleStages: LifecycleStage[] = ["Lead", "MQL", "SQL", "Customer"];

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function note(authorId: string, body: string, timestamp: number): Note {
  return { id: makeId("hs-note"), authorId, body, timestamp };
}

function buildInitialSnapshot(corpusCompanies = corpusEventsFor("hubspot")): HubSpotSnapshot {
  if (corpusCompanies.length > 0) {
    const memberIds = activeCorpusUserIds();
    const companies: Record<string, Company> = {};
    const contacts: Record<string, Contact> = {};
    const deals: Record<string, Deal> = {};
    const tasks: Record<string, Task> = {};

    corpusCompanies.forEach((event, index) => {
      const companyId = event.sourceEntityId;
      const ownerId = event.actorId;
      const labels = corpusLabels(event, ["enterprise"]);
      const companyMembers = Array.from(new Set([ownerId, ...memberIds.slice(0, 8)]));
      const domain = corpusNormalizedString(
        event,
        "domain",
        `${event.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}.example`,
      );
      const industry = corpusNormalizedString(event, "industry", "");
      const stage = corpusNormalizedString(event, "stage", "");
      const notes = corpusNormalizedString(event, "notes", corpusText(event, 1400));
      const nextStep = corpusNormalizedString(event, "nextStep", "Follow up on customer evidence");
      const interestedProducts = corpusNormalizedStrings(event, "interestedProducts");
      companies[companyId] = {
        id: companyId,
        name: event.title,
        domain,
        industry:
          industry ||
          (labels.includes("security")
            ? "Security"
            : labels.includes("runtime")
              ? "AI Infrastructure"
              : "Enterprise Software"),
        ownerId,
        memberIds: companyMembers,
      };

      const contactId = `${companyId}-primary-contact`;
      contacts[contactId] = {
        id: contactId,
        name: `${event.title.split(" ")[0]} Sponsor`,
        email: `sponsor@${companies[companyId].domain}`,
        phone: "+1 415 555 0182",
        title: "Executive Sponsor",
        companyId,
        ownerId,
        stage: ["Lead", "MQL", "SQL", "Customer"].includes(stage)
          ? (stage as LifecycleStage)
          : (["Lead", "MQL", "SQL", "Customer"][stableNumber(event.id, 4)] as LifecycleStage),
        lastActivityAt: event.occurredAt,
        notes: [
          {
            id: `${contactId}-note-1`,
            authorId: ownerId,
            body: notes,
            timestamp: event.occurredAt,
          },
        ],
      };

      const dealId = `${companyId}-deal`;
      deals[dealId] = {
        id: dealId,
        name: `${event.title} - Redwood Private`,
        companyId,
        contactId,
        ownerId,
        stage: dealStages[stableNumber(event.id, dealStages.length)],
        amount: 85000 + stableNumber(event.id, 9) * 25000,
        closeDate: dateInput(
          event.occurredAt + (30 + stableNumber(event.id, 80)) * 24 * 60 * 60 * 1000,
        ),
        probability: [25, 40, 55, 75, 90][stableNumber(event.id, 5)],
        updatedAt: event.occurredAt,
        notes: [
          {
            id: `${dealId}-note-1`,
            authorId: ownerId,
            body:
              interestedProducts.length > 0
                ? `${notes}\n\nProducts: ${interestedProducts.join(", ")}`
                : notes,
            timestamp: event.occurredAt,
          },
        ],
      };

      tasks[`${companyId}-task`] = {
        id: `${companyId}-task`,
        title: nextStep,
        ownerId,
        contactId,
        dueDate: dateInput(event.occurredAt + (7 + index) * 24 * 60 * 60 * 1000),
        completed: index % 4 === 0,
        priority: ["High", "Medium", "Low"][stableNumber(event.id, 3)] as Task["priority"],
      };
    });

    return { companies, contacts, deals, tasks };
  }

  return { companies: {}, contacts: {}, deals: {}, tasks: {} };
}

export function canAccessCompany(company: Company | undefined, userId: string) {
  return Boolean(company?.memberIds.includes(userId));
}

export function canAccessContact(
  snapshot: HubSpotSnapshot,
  contact: Contact | undefined,
  userId: string,
) {
  return Boolean(contact && canAccessCompany(snapshot.companies[contact.companyId], userId));
}

export function canAccessDeal(snapshot: HubSpotSnapshot, deal: Deal | undefined, userId: string) {
  return Boolean(deal && canAccessCompany(snapshot.companies[deal.companyId], userId));
}

export function relativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return "just now";
  const hours = Math.max(1, Math.round(diff / (60 * 60 * 1000)));
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

const initialSnapshot = buildInitialSnapshot();

export const useHubSpotStore = create<HubSpotState>((set) => ({
  ...initialSnapshot,
  loadCorpusPage: async (page = 1) => {
    const events = await loadCorpusEventsFor("hubspot", page);
    const snapshot = buildInitialSnapshot(events);
    set((state) => ({
      companies: { ...state.companies, ...snapshot.companies },
      contacts: { ...state.contacts, ...snapshot.contacts },
      deals: { ...state.deals, ...snapshot.deals },
      tasks: { ...state.tasks, ...snapshot.tasks },
    }));
  },
  createContact: (input) => {
    let id = "";
    const name = input.name.trim();
    if (!name) return "";
    set((state) => {
      const company = state.companies[input.companyId];
      if (!canAccessCompany(company, input.actorId)) return state;
      id = makeId("hs-contact");
      const timestamp = Date.now();
      return {
        contacts: {
          ...state.contacts,
          [id]: {
            id,
            name,
            email: input.email.trim(),
            phone: input.phone.trim(),
            title: input.title.trim(),
            companyId: input.companyId,
            ownerId: input.actorId,
            stage: input.stage,
            lastActivityAt: timestamp,
            notes: [note(input.actorId, "Contact created.", timestamp)],
          },
        },
      };
    });
    return id;
  },
  createDeal: (input) => {
    let id = "";
    const name = input.name.trim();
    if (!name) return "";
    set((state) => {
      const contact = state.contacts[input.contactId];
      if (!canAccessContact(state, contact, input.actorId)) return state;
      id = makeId("hs-deal");
      const timestamp = Date.now();
      return {
        deals: {
          ...state.deals,
          [id]: {
            id,
            name,
            companyId: contact.companyId,
            contactId: input.contactId,
            ownerId: input.actorId,
            stage: input.stage,
            amount: input.amount,
            closeDate: input.closeDate,
            probability: input.probability,
            updatedAt: timestamp,
            notes: [note(input.actorId, "Deal created.", timestamp)],
          },
        },
      };
    });
    return id;
  },
  updateDealStage: (dealId, actorId, stage) => {
    set((state) => {
      const deal = state.deals[dealId];
      if (!canAccessDeal(state, deal, actorId)) return state;
      return { deals: { ...state.deals, [dealId]: { ...deal, stage, updatedAt: Date.now() } } };
    });
  },
  updateContact: (contactId, actorId, updates) => {
    set((state) => {
      const contact = state.contacts[contactId];
      if (!canAccessContact(state, contact, actorId)) return state;
      return {
        contacts: {
          ...state.contacts,
          [contactId]: { ...contact, ...updates, lastActivityAt: Date.now() },
        },
      };
    });
  },
  updateDeal: (dealId, actorId, updates) => {
    set((state) => {
      const deal = state.deals[dealId];
      if (!canAccessDeal(state, deal, actorId)) return state;
      return {
        deals: { ...state.deals, [dealId]: { ...deal, ...updates, updatedAt: Date.now() } },
      };
    });
  },
  createTask: (input) => {
    let id = "";
    const title = input.title.trim();
    if (!title) return "";
    set((state) => {
      const contact = state.contacts[input.contactId];
      if (!canAccessContact(state, contact, input.actorId)) return state;
      id = makeId("hs-task");
      return {
        tasks: {
          ...state.tasks,
          [id]: {
            id,
            title,
            ownerId: input.actorId,
            contactId: input.contactId,
            dueDate: input.dueDate,
            completed: false,
            priority: input.priority,
          },
        },
      };
    });
    return id;
  },
  toggleTask: (taskId, actorId) => {
    set((state) => {
      const task = state.tasks[taskId];
      const contact = state.contacts[task?.contactId];
      if (!task || task.ownerId !== actorId || !canAccessContact(state, contact, actorId))
        return state;
      return { tasks: { ...state.tasks, [taskId]: { ...task, completed: !task.completed } } };
    });
  },
  addContactNote: (contactId, actorId, body) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    set((state) => {
      const contact = state.contacts[contactId];
      if (!canAccessContact(state, contact, actorId)) return state;
      const timestamp = Date.now();
      return {
        contacts: {
          ...state.contacts,
          [contactId]: {
            ...contact,
            lastActivityAt: timestamp,
            notes: [...contact.notes, note(actorId, trimmed, timestamp)],
          },
        },
      };
    });
  },
  addDealNote: (dealId, actorId, body) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    set((state) => {
      const deal = state.deals[dealId];
      if (!canAccessDeal(state, deal, actorId)) return state;
      const timestamp = Date.now();
      return {
        deals: {
          ...state.deals,
          [dealId]: {
            ...deal,
            updatedAt: timestamp,
            notes: [...deal.notes, note(actorId, trimmed, timestamp)],
          },
        },
      };
    });
  },
}));
