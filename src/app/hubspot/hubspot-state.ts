"use client";

import { create } from "zustand";

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

const now = Date.now() - 25 * 60 * 1000;

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function note(authorId: string, body: string, timestamp: number): Note {
  return { id: makeId("hs-note"), authorId, body, timestamp };
}

function buildInitialSnapshot(): HubSpotSnapshot {
  const companies: Record<string, Company> = {
    northstar: {
      id: "northstar",
      name: "Northstar Analytics",
      domain: "northstar.example",
      industry: "Analytics",
      ownerId: "maya",
      memberIds: ["maya", "ari"],
    },
    atlas: {
      id: "atlas",
      name: "Atlas Works",
      domain: "atlas.example",
      industry: "Manufacturing",
      ownerId: "riley",
      memberIds: ["riley", "maya"],
    },
    prism: {
      id: "prism",
      name: "Prism Health",
      domain: "prism.example",
      industry: "Healthcare",
      ownerId: "ari",
      memberIds: ["riley", "ari"],
    },
  };
  const contacts: Record<string, Contact> = {};
  const deals: Record<string, Deal> = {};
  const tasks: Record<string, Task> = {};
  const names = [
    "Morgan Lee",
    "Sam Rivera",
    "Nina Patel",
    "Jordan Kim",
    "Taylor Brooks",
    "Casey Wong",
    "Avery Stone",
    "Jamie Cruz",
  ];
  Object.values(companies).forEach((company, companyIndex) => {
    for (let index = 0; index < 8; index += 1) {
      const ownerId = company.memberIds[(index + companyIndex) % company.memberIds.length];
      const timestamp = now - (companyIndex * 8 + index + 1) * 4 * 60 * 60 * 1000;
      const contactId = `${company.id}-contact-${index + 1}`;
      contacts[contactId] = {
        id: contactId,
        name: names[(index + companyIndex) % names.length],
        email: `${names[(index + companyIndex) % names.length].toLowerCase().replace(/\s+/g, ".")}@${company.domain}`,
        phone: `+1 415 555 ${String(1200 + index + companyIndex * 80)}`,
        title: ["VP Product", "RevOps Lead", "Engineering Manager", "COO"][index % 4],
        companyId: company.id,
        ownerId,
        stage: lifecycleStages[(index + companyIndex) % lifecycleStages.length],
        lastActivityAt: timestamp,
        notes:
          index % 3 === 0
            ? [note(ownerId, "Discovery call completed. Follow-up proposal requested.", timestamp)]
            : [],
      };
      const dealId = `${company.id}-deal-${index + 1}`;
      deals[dealId] = {
        id: dealId,
        name: `${company.name} expansion ${index + 1}`,
        companyId: company.id,
        contactId,
        ownerId,
        stage: dealStages[(index + companyIndex) % dealStages.length],
        amount: 12000 + index * 4500 + companyIndex * 8000,
        closeDate: `2026-07-${String(10 + ((index + companyIndex) % 18)).padStart(2, "0")}`,
        probability: [20, 40, 60, 80, 100][(index + companyIndex) % 5],
        updatedAt: timestamp + 45 * 60 * 1000,
        notes:
          index % 2 === 0
            ? [
                note(
                  ownerId,
                  "Commercial terms reviewed with stakeholder.",
                  timestamp + 45 * 60 * 1000,
                ),
              ]
            : [],
      };
      tasks[`${company.id}-task-${index + 1}`] = {
        id: `${company.id}-task-${index + 1}`,
        title: [
          "Send proposal",
          "Book technical review",
          "Update close plan",
          "Prepare renewal notes",
        ][index % 4],
        ownerId,
        contactId,
        dueDate: `2026-07-${String(5 + ((index + companyIndex) % 20)).padStart(2, "0")}`,
        completed: index % 5 === 0,
        priority: ["High", "Medium", "Low"][index % 3] as Task["priority"],
      };
    }
  });
  return { companies, contacts, deals, tasks };
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
