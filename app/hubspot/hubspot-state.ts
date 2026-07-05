/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { create } from "zustand";

import { SeedCard, loadAppCorpus } from "@/lib/seed-data";
import { usePatchStore, getGlobalPatchesForApp } from "@/lib/stores/patch-store";
import { useUserStore } from "@/lib/stores/user-store";
import { appUsers } from "@/lib/users";

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
  createdAt: number;
  updatedAt: number;
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
  createdAt: number;
  updatedAt: number;
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
  createdAt: number;
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
  loadCorpusPage: () => Promise<void>;
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

function buildInitialSnapshot(cards: SeedCard[] = []): HubSpotSnapshot {
  const companies: Record<string, Company> = {};
  const contacts: Record<string, Contact> = {};
  const deals: Record<string, Deal> = {};
  const tasks: Record<string, Task> = {};

  if (cards.length > 0) {
    const memberIds = appUsers.map((u) => u.id);

    cards.forEach((card, index) => {
      const companyId = card.id;
      const ownerId = card.peopleIds[0] ?? memberIds[0];
      const domain = `${card.title.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`;

      companies[companyId] = {
        id: companyId,
        name: card.title || "Company",
        domain,
        industry: "Technology",
        ownerId,
        memberIds: [ownerId, ...memberIds.slice(0, 8)],
        createdAt: card.occurredAt - 24 * 60 * 60 * 1000,
        updatedAt: card.occurredAt,
      };

      const contactId = `${companyId}-contact`;
      contacts[contactId] = {
        id: contactId,
        companyId,
        ownerId,
        name: "Primary Contact",
        title: "Director",
        email: `contact@${domain}`,
        phone: "+1 (555) 000-0000",
        stage: "Lead",
        lastActivityAt: card.occurredAt,
        createdAt: card.occurredAt,
        updatedAt: card.occurredAt,
        notes: [{ id: "n1", authorId: ownerId, body: card.text || "", timestamp: card.occurredAt }],
      };

      const dealId = `${companyId}-deal`;
      deals[dealId] = {
        id: dealId,
        companyId,
        contactId,
        ownerId,
        name: `${card.title} Partnership`,
        stage:
          ((card.source as any)?.deal_stage as DealStage) || dealStages[index % dealStages.length],
        amount: Number((card.source as any)?.amount) || 50000 + index * 10000,
        probability: 50,
        closeDate: new Date(card.occurredAt + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        createdAt: card.occurredAt,
        updatedAt: card.occurredAt,
        notes: [],
      };
    });
  }

  return { companies, contacts, deals, tasks };
}

function applyPatch(state: any, patch: any) {
  if ((patch as any).type === "CREATE_CONTACT") {
    const { id, name, companyId, actorId, email, phone, title, stage } = patch.payload;
    state.contacts[id] = {
      id,
      name,
      companyId,
      ownerId: actorId,
      email,
      phone,
      title,
      stage,
      lastActivityAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      notes: [note(actorId, "Contact created", Date.now())],
    };
  } else if ((patch as any).type === "CREATE_DEAL") {
    const { id, name, companyId, contactId, actorId, stage, amount, closeDate, probability } =
      patch.payload;
    state.deals[id] = {
      id,
      name,
      companyId,
      contactId,
      ownerId: actorId,
      stage,
      amount,
      closeDate,
      probability,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      notes: [note(actorId, "Deal created", Date.now())],
    };
  }
}

usePatchStore.subscribe((state, prevState) => {
  if (state.batches === prevState.batches) return;
  const newBatches = state.batches.filter((b) => !prevState.batches.includes(b));
  if (newBatches.length === 0) return;
  const newPatches = newBatches.flatMap((b) => b.patches).filter((p) => p.app === "hubspot");
  if (newPatches.length === 0) return;

  useHubSpotStore.setState((draftState: any) => {
    const nextState = JSON.parse(JSON.stringify(draftState));
    newPatches.forEach((patch) => applyPatch(nextState, patch));
    return nextState;
  });
});

const initialSnapshot = buildInitialSnapshot();

export const useHubSpotStore = create<HubSpotState>((set) => ({
  ...initialSnapshot,
  loadCorpusPage: async () => {
    const activeUserId = useUserStore.getState().activeUserId;
    if (!activeUserId) return;
    const pageData = await loadAppCorpus("hubspot", activeUserId);
    if (!pageData) return;
    const snapshot = buildInitialSnapshot(pageData);

    const stateWithPatches = JSON.parse(JSON.stringify(snapshot)) as HubSpotSnapshot;
    const patches = getGlobalPatchesForApp("hubspot");
    patches.forEach((patch) => applyPatch(stateWithPatches, patch));

    set((state: any) => ({
      companies: { ...state.companies, ...stateWithPatches.companies },
      contacts: { ...state.contacts, ...stateWithPatches.contacts },
      deals: { ...state.deals, ...stateWithPatches.deals },
      tasks: { ...state.tasks, ...stateWithPatches.tasks },
    }));
  },
  createContact: (input) => {
    const name = input.name.trim();
    if (!name) return "";
    const id = makeId("hs-contact");
    usePatchStore.getState().appendPatch({
      app: "hubspot",
      targetId: id,
      actorId: input.actorId,
      op: "update",
      scope: "dummy",
      payload: { ...input, id, name },
    });
    return id;
  },
  createDeal: (input) => {
    const name = input.name.trim();
    if (!name) return "";
    const id = makeId("hs-deal");
    usePatchStore.getState().appendPatch({
      app: "hubspot",
      targetId: id,
      actorId: input.actorId,
      op: "update",
      scope: "dummy",
      payload: { ...input, id, name },
    });
    return id;
  },
  updateDealStage: (dealId, actorId, stage) => {
    set((state) => {
      const deal = state.deals[dealId];
      if (!canAccessDeal()) return state;
      return { deals: { ...state.deals, [dealId]: { ...deal, stage, updatedAt: Date.now() } } };
    });
  },
  updateContact: (contactId, actorId, updates) => {
    set((state) => {
      const contact = state.contacts[contactId];
      if (!canAccessContact()) return state;
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
      if (!canAccessDeal()) return state;
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
      if (!canAccessContact()) return state;
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
      if (!task || task.ownerId !== actorId || !canAccessContact()) return state;
      return { tasks: { ...state.tasks, [taskId]: { ...task, completed: !task.completed } } };
    });
  },
  addContactNote: (contactId, actorId, body) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    set((state) => {
      const contact = state.contacts[contactId];
      if (!canAccessContact()) return state;
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
      if (!canAccessDeal()) return state;
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

export function canAccessCompany() {
  return true;
}
export function canAccessContact() {
  return true;
}
export function canAccessDeal() {
  return true;
}
export function relativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return "just now";
  const hours = Math.max(1, Math.round(diff / (60 * 60 * 1000)));
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}
