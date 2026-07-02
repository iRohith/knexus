"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  ClipboardCheck,
  Menu,
  MessageSquare,
  Plus,
  Search,
  UserRound,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { captureActivityEvent } from "@/app/admin/activity-capture";
import { appUsers } from "@/lib/users";
import { useActiveUser } from "@/lib/user-store";
import { cn } from "@/lib/utils";
import {
  canAccessCompany,
  canAccessContact,
  canAccessDeal,
  dealStages,
  hubspotViews,
  lifecycleStages,
  relativeTime,
  useHubSpotStore,
  type Company,
  type Contact,
  type Deal,
  type DealStage,
  type HubSpotSnapshot,
  type HubSpotView,
  type LifecycleStage,
  type Task,
} from "@/app/hubspot/hubspot-state";

function normalizeView(value: string | null): HubSpotView {
  return hubspotViews.includes(value as HubSpotView) ? (value as HubSpotView) : "contacts";
}

function userName(id: string | null) {
  if (!id) return "Unassigned";
  return appUsers.find((user) => user.id === id)?.name ?? "Unknown";
}

function initials(id: string | null) {
  if (!id) return "UA";
  return appUsers.find((user) => user.id === id)?.initials ?? "??";
}

function money(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function HubSpotApp({
  onAction,
}: { onAction?: (action: { type: string; payload: unknown }) => void } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeUser = useActiveUser();
  const companies = useHubSpotStore((state) => state.companies);
  const contacts = useHubSpotStore((state) => state.contacts);
  const deals = useHubSpotStore((state) => state.deals);
  const tasks = useHubSpotStore((state) => state.tasks);
  const createContact = useHubSpotStore((state) => state.createContact);
  const createDeal = useHubSpotStore((state) => state.createDeal);
  const updateContact = useHubSpotStore((state) => state.updateContact);
  const updateDeal = useHubSpotStore((state) => state.updateDeal);
  const updateDealStage = useHubSpotStore((state) => state.updateDealStage);
  const createTask = useHubSpotStore((state) => state.createTask);
  const toggleTask = useHubSpotStore((state) => state.toggleTask);
  const addContactNote = useHubSpotStore((state) => state.addContactNote);
  const addDealNote = useHubSpotStore((state) => state.addDealNote);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [noteState, setNoteState] = useState({ key: "", value: "" });
  const previousUserId = useRef(activeUser.id);

  const snapshot = useMemo<HubSpotSnapshot>(
    () => ({ companies, contacts, deals, tasks }),
    [companies, contacts, deals, tasks],
  );
  const accessibleCompanies = useMemo(
    () => Object.values(companies).filter((company) => canAccessCompany(company, activeUser.id)),
    [activeUser.id, companies],
  );
  const view = normalizeView(searchParams.get("view"));
  const contactId = searchParams.get("contact");
  const dealId = searchParams.get("deal");
  const companyId = searchParams.get("company");
  const query = searchParams.get("q") ?? "";
  const stageFilter = searchParams.get("stage") ?? "all";
  const normalizedQuery = query.trim().toLowerCase();
  const detailKey = contactId ? `contact:${contactId}` : dealId ? `deal:${dealId}` : "list";
  const noteDraft = noteState.key === detailKey ? noteState.value : "";

  function setNoteDraft(value: string) {
    setNoteState({ key: detailKey, value });
  }

  function updateUrl(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (!value) params.delete(key);
      else params.set(key, value);
    });
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (previousUserId.current === activeUser.id) return;
    previousUserId.current = activeUser.id;
    router.replace(`${pathname}?view=contacts`);
  }, [activeUser.id, pathname, router]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;
    if (contactId && !canAccessContact(snapshot, contacts[contactId], activeUser.id)) {
      params.delete("contact");
      changed = true;
    }
    if (dealId && !canAccessDeal(snapshot, deals[dealId], activeUser.id)) {
      params.delete("deal");
      changed = true;
    }
    if (view !== "contacts" && params.has("contact")) {
      params.delete("contact");
      changed = true;
    }
    if (view !== "deals" && params.has("deal")) {
      params.delete("deal");
      changed = true;
    }
    if (changed) router.replace(`${pathname}?${params.toString()}`);
  }, [
    activeUser.id,
    contactId,
    contacts,
    dealId,
    deals,
    pathname,
    router,
    searchParams,
    snapshot,
    view,
  ]);

  const visibleContacts = Object.values(contacts)
    .filter((contact) => canAccessContact(snapshot, contact, activeUser.id))
    .filter((contact) => {
      if (!normalizedQuery) return true;
      const company = companies[contact.companyId];
      return [contact.name, contact.email, contact.title, company?.name, contact.stage]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  const visibleDeals = Object.values(deals)
    .filter((deal) => canAccessDeal(snapshot, deal, activeUser.id))
    .filter((deal) => stageFilter === "all" || deal.stage === stageFilter)
    .filter((deal) => {
      if (!normalizedQuery) return true;
      return [
        deal.name,
        companies[deal.companyId]?.name,
        contacts[deal.contactId]?.name,
        deal.stage,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const visibleTasks = Object.values(tasks)
    .filter(
      (task) =>
        task.ownerId === activeUser.id &&
        canAccessContact(snapshot, contacts[task.contactId], activeUser.id),
    )
    .filter(
      (task) =>
        !normalizedQuery ||
        [task.title, contacts[task.contactId]?.name]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
    )
    .sort(
      (a, b) => Number(a.completed) - Number(b.completed) || a.dueDate.localeCompare(b.dueDate),
    );
  const selectedContact =
    contactId && canAccessContact(snapshot, contacts[contactId], activeUser.id)
      ? contacts[contactId]
      : null;
  const selectedDeal =
    dealId && canAccessDeal(snapshot, deals[dealId], activeUser.id) ? deals[dealId] : null;

  return (
    <main className="flex h-[calc(100vh-3.5rem)] min-h-0 bg-[#f6f9fc] text-sm text-[#213343] dark:bg-[#111827] dark:text-[#eef6ff]">
      <aside className="hidden w-72 shrink-0 border-r border-[#d5e1ea] bg-white lg:block dark:border-[#263445] dark:bg-[#17202c]">
        <Sidebar companies={accessibleCompanies} contacts={visibleContacts} deals={visibleDeals} />
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-80 border-[#d5e1ea] bg-white p-0 dark:border-[#263445] dark:bg-[#17202c]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>HubSpot navigation</SheetTitle>
          </SheetHeader>
          <Sidebar
            companies={accessibleCompanies}
            contacts={visibleContacts}
            deals={visibleDeals}
          />
        </SheetContent>
      </Sheet>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#d5e1ea] bg-white dark:border-[#263445] dark:bg-[#17202c]">
          <div className="flex h-14 items-center gap-3 px-4">
            <Button
              variant="ghost"
              size="icon"
              className="cursor-pointer lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold">HubSpot CRM</div>
              <div className="text-xs text-muted-foreground">
                Contacts, deals, tasks, and activity
              </div>
            </div>
            <Button
              variant="outline"
              className="cursor-pointer"
              size="sm"
              onClick={() => setCreateDealOpen(true)}
            >
              <CircleDollarSign className="size-4" />
              Deal
            </Button>
            <Button
              className="cursor-pointer bg-[#ff5c35] text-white hover:bg-[#e64a24]"
              size="sm"
              onClick={() => setCreateContactOpen(true)}
            >
              <Plus className="size-4" />
              Contact
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 px-4 pb-3">
            <Tabs
              value={view}
              onValueChange={(value) => updateUrl({ view: value, contact: null, deal: null })}
            >
              <TabsList className="bg-[#eaf0f6] dark:bg-[#223043]">
                <TabsTrigger value="contacts" className="cursor-pointer gap-2">
                  <UserRound className="size-4" />
                  Contacts
                </TabsTrigger>
                <TabsTrigger value="deals" className="cursor-pointer gap-2">
                  <CircleDollarSign className="size-4" />
                  Deals
                </TabsTrigger>
                <TabsTrigger value="tasks" className="cursor-pointer gap-2">
                  <ClipboardCheck className="size-4" />
                  Tasks
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative min-w-56 flex-1 sm:max-w-sm">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 bg-white pl-9 dark:bg-[#111827]"
                value={query}
                placeholder="Search CRM"
                onChange={(event) =>
                  updateUrl({ q: event.target.value || null, contact: null, deal: null })
                }
              />
            </div>
            {view === "deals" && (
              <MiniSelect
                value={stageFilter}
                items={["all", ...dealStages]}
                onValueChange={(value) =>
                  updateUrl({ stage: value === "all" ? null : value, deal: null })
                }
              />
            )}
          </div>
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">
            {selectedContact ? (
              <ContactDetail
                contact={selectedContact}
                companies={companies}
                deals={visibleDeals}
                noteDraft={noteDraft}
                onNoteDraft={setNoteDraft}
                onBack={() => updateUrl({ contact: null })}
                onNote={() => {
                  addContactNote(selectedContact.id, activeUser.id, noteDraft);
                  captureActivityEvent({
                    sourceApp: "hubspot",
                    actorId: activeUser.id,
                    type: "crm_action",
                    action: "Added HubSpot contact note",
                    title: selectedContact.name,
                    body: noteDraft,
                    sourceEntityId: selectedContact.id,
                    sourceEntityType: "contact",
                    sourceUrl: `/hubspot?view=contacts&contact=${selectedContact.id}`,
                    metadata: { companyId: selectedContact.companyId },
                  });
                  setNoteDraft("");
                }}
                onUpdateContact={(updates) =>
                  updateContact(selectedContact.id, activeUser.id, updates)
                }
                onCreateTask={(title) => {
                  const id = createTask({
                    actorId: activeUser.id,
                    contactId: selectedContact.id,
                    title,
                    dueDate: "2026-07-22",
                    priority: "Medium",
                  });
                  if (id) {
                    onAction?.({
                      type: "CREATE_TASK",
                      payload: {
                        id,
                        contactId: selectedContact.id,
                        title,
                        authorId: activeUser.id,
                      },
                    });
                    captureActivityEvent({
                      sourceApp: "hubspot",
                      actorId: activeUser.id,
                      type: "create",
                      action: "Created HubSpot task",
                      title,
                      body: `Task created for ${selectedContact.name}.`,
                      sourceEntityId: id,
                      sourceEntityType: "task",
                      sourceUrl: `/hubspot?view=tasks`,
                      metadata: { contactId: selectedContact.id },
                    });
                  }
                }}
                onCompany={(id) => updateUrl({ company: id })}
              />
            ) : selectedDeal ? (
              <DealDetail
                deal={selectedDeal}
                companies={companies}
                contacts={contacts}
                noteDraft={noteDraft}
                onNoteDraft={setNoteDraft}
                onBack={() => updateUrl({ deal: null })}
                onStage={(stage) => {
                  updateDealStage(selectedDeal.id, activeUser.id, stage);
                  captureActivityEvent({
                    sourceApp: "hubspot",
                    actorId: activeUser.id,
                    type: "crm_action",
                    action: `Moved HubSpot deal to ${stage}`,
                    title: selectedDeal.name,
                    body: `Deal stage changed to ${stage}.`,
                    sourceEntityId: selectedDeal.id,
                    sourceEntityType: "deal",
                    sourceUrl: `/hubspot?view=deals&deal=${selectedDeal.id}`,
                    metadata: { stage, companyId: selectedDeal.companyId },
                  });
                }}
                onNote={() => {
                  addDealNote(selectedDeal.id, activeUser.id, noteDraft);
                  captureActivityEvent({
                    sourceApp: "hubspot",
                    actorId: activeUser.id,
                    type: "crm_action",
                    action: "Added HubSpot deal note",
                    title: selectedDeal.name,
                    body: noteDraft,
                    sourceEntityId: selectedDeal.id,
                    sourceEntityType: "deal",
                    sourceUrl: `/hubspot?view=deals&deal=${selectedDeal.id}`,
                    metadata: {
                      companyId: selectedDeal.companyId,
                      contactId: selectedDeal.contactId,
                    },
                  });
                  setNoteDraft("");
                }}
                onUpdateDeal={(updates) => updateDeal(selectedDeal.id, activeUser.id, updates)}
                onCreateTask={(title) => {
                  const id = createTask({
                    actorId: activeUser.id,
                    contactId: selectedDeal.contactId,
                    title,
                    dueDate: "2026-07-22",
                    priority: "Medium",
                  });
                  if (id) {
                    onAction?.({
                      type: "CREATE_TASK",
                      payload: {
                        id,
                        contactId: selectedDeal.contactId,
                        title,
                        authorId: activeUser.id,
                      },
                    });
                  }
                }}
              />
            ) : view === "deals" ? (
              <DealsPipeline
                deals={visibleDeals}
                companies={companies}
                contacts={contacts}
                onOpen={(id) => updateUrl({ deal: id })}
                onStage={(id, stage) => {
                  updateDealStage(id, activeUser.id, stage);
                  const deal = deals[id];
                  captureActivityEvent({
                    sourceApp: "hubspot",
                    actorId: activeUser.id,
                    type: "crm_action",
                    action: `Moved HubSpot deal to ${stage}`,
                    title: deal?.name ?? "HubSpot deal moved",
                    body: `Deal stage changed to ${stage}.`,
                    sourceEntityId: id,
                    sourceEntityType: "deal",
                    sourceUrl: `/hubspot?view=deals&deal=${id}`,
                    metadata: { stage, companyId: deal?.companyId ?? null },
                  });
                }}
              />
            ) : view === "tasks" ? (
              <TaskList
                tasks={visibleTasks}
                contacts={contacts}
                onToggle={(id) => {
                  toggleTask(id, activeUser.id);
                  const task = tasks[id];
                  captureActivityEvent({
                    sourceApp: "hubspot",
                    actorId: activeUser.id,
                    type: "update",
                    action: "Toggled HubSpot task",
                    title: task?.title ?? "HubSpot task updated",
                    body: `Task marked ${task?.completed ? "open" : "complete"}.`,
                    sourceEntityId: id,
                    sourceEntityType: "task",
                    sourceUrl: "/hubspot?view=tasks",
                    metadata: { contactId: task?.contactId ?? null },
                  });
                }}
              />
            ) : (
              <ContactList
                contacts={visibleContacts}
                companies={companies}
                onOpen={(id) => updateUrl({ contact: id })}
              />
            )}
          </div>
        </ScrollArea>
      </section>
      <CreateContactDialog
        open={createContactOpen}
        companies={accessibleCompanies}
        onOpenChange={setCreateContactOpen}
        onCreate={(input) => {
          const id = createContact({ ...input, actorId: activeUser.id });
          if (id) {
            setCreateContactOpen(false);
            onAction?.({
              type: "CREATE_CONTACT",
              payload: { id, ...input, authorId: activeUser.id },
            });
            captureActivityEvent({
              sourceApp: "hubspot",
              actorId: activeUser.id,
              type: "create",
              action: "Created HubSpot contact",
              title: input.name,
              body: `${input.name} was added to HubSpot.`,
              sourceEntityId: id,
              sourceEntityType: "contact",
              sourceUrl: `/hubspot?view=contacts&contact=${id}`,
              metadata: { companyId: input.companyId, email: input.email },
            });
            updateUrl({ view: "contacts", contact: id, q: null });
          }
        }}
      />
      <CreateDealDialog
        open={createDealOpen}
        contacts={visibleContacts}
        onOpenChange={setCreateDealOpen}
        onCreate={(input) => {
          const id = createDeal({ ...input, actorId: activeUser.id });
          if (id) {
            setCreateDealOpen(false);
            onAction?.({ type: "CREATE_DEAL", payload: { id, ...input, authorId: activeUser.id } });
            captureActivityEvent({
              sourceApp: "hubspot",
              actorId: activeUser.id,
              type: "create",
              action: "Created HubSpot deal",
              title: input.name,
              body: `${input.name} was added to the pipeline.`,
              sourceEntityId: id,
              sourceEntityType: "deal",
              sourceUrl: `/hubspot?view=deals&deal=${id}`,
              metadata: {
                companyId: contacts[input.contactId]?.companyId ?? null,
                contactId: input.contactId,
                amount: input.amount,
              },
            });
            updateUrl({ view: "deals", deal: id, q: null });
          }
        }}
      />
      {companyId && companies[companyId] && (
        <CompanyDetailDialog
          open
          company={companies[companyId]}
          onOpenChange={(open) => !open && updateUrl({ company: null })}
        />
      )}
    </main>
  );
}

function Sidebar({
  companies,
  contacts,
  deals,
}: {
  companies: Company[];
  contacts: Contact[];
  deals: Deal[];
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#d5e1ea] p-4 dark:border-[#263445]">
        <div className="font-semibold">HubSpot</div>
        <div className="text-xs text-muted-foreground">Sales workspace</div>
      </div>
      <div className="space-y-3 p-3">
        <Metric icon={<UserRound className="size-4" />} label="Contacts" value={contacts.length} />
        <Metric
          icon={<CircleDollarSign className="size-4" />}
          label="Open pipeline"
          value={money(
            deals
              .filter((deal) => !deal.stage.startsWith("Closed"))
              .reduce((sum, deal) => sum + deal.amount, 0),
          )}
        />
        <div className="px-2 pt-2 text-xs font-medium text-muted-foreground">Companies</div>
        {companies.map((company) => (
          <div key={company.id} className="rounded-md px-2 py-1.5">
            <div className="truncate font-medium">{company.name}</div>
            <div className="truncate text-xs text-muted-foreground">{company.industry}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-md bg-[#f6f9fc] p-3 dark:bg-[#223043]">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function MiniSelect({
  value,
  items,
  onValueChange,
  renderItem,
}: {
  value: string;
  items: string[];
  onValueChange: (value: string | null) => void;
  renderItem?: (item: string) => string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger size="sm" className="cursor-pointer bg-white dark:bg-[#111827]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item} value={item}>
            {item === "all" ? "All stages" : renderItem ? renderItem(item) : item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ContactList({
  contacts,
  companies,
  onOpen,
}: {
  contacts: Contact[];
  companies: Record<string, Company>;
  onOpen: (id: string) => void;
}) {
  if (contacts.length === 0) return <Empty label="No contacts match this view." />;
  return (
    <div className="overflow-hidden rounded-md border border-[#d5e1ea] bg-white dark:border-[#263445] dark:bg-[#17202c]">
      {contacts.map((contact) => (
        <button
          key={contact.id}
          className="grid w-full cursor-pointer grid-cols-[1fr_auto] gap-3 border-b border-[#d5e1ea] p-3 text-left last:border-b-0 hover:bg-[#f6f9fc] md:grid-cols-[1fr_12rem_9rem_8rem_auto] dark:border-[#263445] dark:hover:bg-[#223043]"
          onClick={() => onOpen(contact.id)}
          type="button"
        >
          <div className="min-w-0">
            <div className="font-medium">{contact.name}</div>
            <div className="truncate text-xs text-muted-foreground">{contact.email}</div>
          </div>
          <span className="hidden truncate text-xs md:block">
            {companies[contact.companyId]?.name}
          </span>
          <Badge variant="secondary" className="hidden justify-center md:inline-flex">
            {contact.stage}
          </Badge>
          <span className="hidden text-xs text-muted-foreground md:block">
            {relativeTime(contact.lastActivityAt)}
          </span>
          <Avatar size="sm">
            <AvatarFallback>{initials(contact.ownerId)}</AvatarFallback>
          </Avatar>
        </button>
      ))}
    </div>
  );
}

function DealsPipeline({
  deals,
  companies,
  contacts,
  onOpen,
  onStage,
}: {
  deals: Deal[];
  companies: Record<string, Company>;
  contacts: Record<string, Contact>;
  onOpen: (id: string) => void;
  onStage: (id: string, stage: DealStage) => void;
}) {
  return (
    <div className="grid min-w-245 gap-3 xl:min-w-0 xl:grid-cols-5">
      {dealStages.map((stage) => {
        const columnDeals = deals.filter((deal) => deal.stage === stage);
        return (
          <section
            key={stage}
            className="min-h-136 rounded-md border border-[#d5e1ea] bg-[#eaf0f6] dark:border-[#263445] dark:bg-[#1d2a3a]"
          >
            <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
              <span>{stage}</span>
              <Badge variant="secondary">
                {money(columnDeals.reduce((sum, deal) => sum + deal.amount, 0))}
              </Badge>
            </div>
            <div className="space-y-2 p-2">
              {columnDeals.map((deal) => (
                <button
                  key={deal.id}
                  className="w-full cursor-pointer rounded-md border border-[#d5e1ea] bg-white p-3 text-left shadow-xs hover:border-[#ff5c35] dark:border-[#263445] dark:bg-[#17202c]"
                  onClick={() => onOpen(deal.id)}
                  type="button"
                >
                  <div className="font-medium">{deal.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {companies[deal.companyId]?.name} · {contacts[deal.contactId]?.name}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-semibold">{money(deal.amount)}</span>
                    <Avatar size="sm">
                      <AvatarFallback>{initials(deal.ownerId)}</AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <MiniSelect
                      value={stage}
                      items={dealStages}
                      onValueChange={(val) => val && onStage(deal.id, val as DealStage)}
                    />
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TaskList({
  tasks,
  contacts,
  onToggle,
}: {
  tasks: Task[];
  contacts: Record<string, Contact>;
  onToggle: (id: string) => void;
}) {
  if (tasks.length === 0) return <Empty label="No tasks match this view." />;
  return (
    <div className="overflow-hidden rounded-md border border-[#d5e1ea] bg-white dark:border-[#263445] dark:bg-[#17202c]">
      {tasks.map((task) => (
        <button
          key={task.id}
          className="flex w-full cursor-pointer items-center gap-3 border-b border-[#d5e1ea] p-3 text-left last:border-b-0 hover:bg-[#f6f9fc] dark:border-[#263445] dark:hover:bg-[#223043]"
          onClick={() => onToggle(task.id)}
          type="button"
        >
          <CheckCircle2
            className={cn("size-5", task.completed ? "text-emerald-600" : "text-muted-foreground")}
          />
          <div className="min-w-0 flex-1">
            <div
              className={cn("font-medium", task.completed && "line-through text-muted-foreground")}
            >
              {task.title}
            </div>
            <div className="text-xs text-muted-foreground">
              {contacts[task.contactId]?.name} · due {task.dueDate}
            </div>
          </div>
          <Badge variant={task.priority === "High" ? "destructive" : "secondary"}>
            {task.priority}
          </Badge>
        </button>
      ))}
    </div>
  );
}

function ContactDetail({
  contact,
  companies,
  deals,
  noteDraft,
  onNoteDraft,
  onBack,
  onNote,
  onUpdateContact,
  onCreateTask,
  onCompany,
}: {
  contact: Contact;
  companies: Record<string, Company>;
  deals: Deal[];
  noteDraft: string;
  onNoteDraft: (value: string) => void;
  onBack: () => void;
  onNote: () => void;
  onUpdateContact: (
    updates: Partial<Pick<Contact, "stage" | "ownerId" | "title" | "email" | "phone">>,
  ) => void;
  onCreateTask: (title: string) => void;
  onCompany: (companyId: string) => void;
}) {
  const [taskDraft, setTaskDraft] = useState("");
  const relatedDeals = deals.filter((deal) => deal.contactId === contact.id);
  return (
    <DetailShell
      title={contact.name}
      subtitle={`${contact.title} at ${companies[contact.companyId]?.name}`}
      onBack={onBack}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Panel title="Activity notes">
            <Notes
              notes={contact.notes}
              draft={noteDraft}
              onDraft={onNoteDraft}
              onSubmit={onNote}
            />
          </Panel>
          <Panel title="Related deals">
            {relatedDeals.map((deal) => (
              <div key={deal.id} className="mb-2 rounded-md bg-[#f6f9fc] p-3 dark:bg-[#223043]">
                <div className="font-medium">{deal.name}</div>
                <div className="text-xs text-muted-foreground">
                  {deal.stage} · {money(deal.amount)}
                </div>
              </div>
            ))}
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Contact properties">
            <Field label="Stage">
              <MiniSelect
                value={contact.stage}
                items={lifecycleStages}
                onValueChange={(val) => val && onUpdateContact({ stage: val as LifecycleStage })}
              />
            </Field>
            <Field label="Email">
              <Input
                value={contact.email}
                onChange={(e) => onUpdateContact({ email: e.target.value })}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={contact.phone}
                onChange={(e) => onUpdateContact({ phone: e.target.value })}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Title">
              <Input
                value={contact.title}
                onChange={(e) => onUpdateContact({ title: e.target.value })}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Owner">
              <MiniSelect
                value={contact.ownerId}
                items={companies[contact.companyId]?.memberIds || []}
                onValueChange={(val) => val && onUpdateContact({ ownerId: val })}
                renderItem={userName}
              />
            </Field>
            <button
              className="mt-3 flex items-center gap-2 text-sm text-left hover:text-[#ff5c35] cursor-pointer w-full"
              onClick={() => onCompany(contact.companyId)}
              type="button"
            >
              <span className="text-muted-foreground">
                <Building2 className="size-4" />
              </span>
              <span className="w-16 text-muted-foreground">Company</span>
              <span className="min-w-0 flex-1 truncate">{companies[contact.companyId]?.name}</span>
            </button>
          </Panel>
          <Panel title="Tasks">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (taskDraft.trim()) {
                  onCreateTask(taskDraft);
                  setTaskDraft("");
                }
              }}
            >
              <Input
                placeholder="New task..."
                value={taskDraft}
                onChange={(e) => setTaskDraft(e.target.value)}
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                className="h-8 cursor-pointer"
                type="submit"
                disabled={!taskDraft.trim()}
              >
                Add
              </Button>
            </form>
          </Panel>
        </div>
      </div>
    </DetailShell>
  );
}

function DealDetail({
  deal,
  companies,
  contacts,
  noteDraft,
  onNoteDraft,
  onBack,
  onStage,
  onNote,
  onUpdateDeal,
  onCreateTask,
}: {
  deal: Deal;
  companies: Record<string, Company>;
  contacts: Record<string, Contact>;
  noteDraft: string;
  onNoteDraft: (value: string) => void;
  onBack: () => void;
  onStage: (stage: DealStage) => void;
  onNote: () => void;
  onUpdateDeal: (
    updates: Partial<Pick<Deal, "amount" | "probability" | "closeDate" | "ownerId">>,
  ) => void;
  onCreateTask: (title: string) => void;
}) {
  const [taskDraft, setTaskDraft] = useState("");
  return (
    <DetailShell
      title={deal.name}
      subtitle={`${companies[deal.companyId]?.name} · ${contacts[deal.contactId]?.name}`}
      onBack={onBack}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Panel title="Deal notes">
          <Notes notes={deal.notes} draft={noteDraft} onDraft={onNoteDraft} onSubmit={onNote} />
        </Panel>
        <div className="space-y-4">
          <Panel title="Deal properties">
            <Field label="Stage">
              <MiniSelect
                value={deal.stage}
                items={dealStages}
                onValueChange={(value) => value && onStage(value as DealStage)}
              />
            </Field>
            <Field label="Amount ($)">
              <Input
                type="number"
                value={deal.amount}
                onChange={(e) => onUpdateDeal({ amount: parseInt(e.target.value) || 0 })}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Probability (%)">
              <Input
                type="number"
                value={deal.probability}
                onChange={(e) => onUpdateDeal({ probability: parseInt(e.target.value) || 0 })}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Close date">
              <Input
                type="date"
                value={deal.closeDate}
                onChange={(e) => onUpdateDeal({ closeDate: e.target.value })}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Owner">
              <MiniSelect
                value={deal.ownerId}
                items={companies[deal.companyId]?.memberIds || []}
                onValueChange={(val) => val && onUpdateDeal({ ownerId: val })}
                renderItem={userName}
              />
            </Field>
          </Panel>
          <Panel title="Tasks">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (taskDraft.trim()) {
                  onCreateTask(taskDraft);
                  setTaskDraft("");
                }
              }}
            >
              <Input
                placeholder="New task..."
                value={taskDraft}
                onChange={(e) => setTaskDraft(e.target.value)}
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                className="h-8 cursor-pointer"
                type="submit"
                disabled={!taskDraft.trim()}
              >
                Add
              </Button>
            </form>
          </Panel>
        </div>
      </div>
    </DetailShell>
  );
}

function DetailShell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <Button variant="ghost" className="mb-3 cursor-pointer" onClick={onBack}>
        Back
      </Button>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-[#d5e1ea] bg-white p-4 dark:border-[#263445] dark:bg-[#17202c]">
      <div className="mb-3 font-semibold">{title}</div>
      {children}
    </div>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="w-16 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Notes({
  notes,
  draft,
  onDraft,
  onSubmit,
}: {
  notes: Array<{ id: string; authorId: string; body: string; timestamp: number }>;
  draft: string;
  onDraft: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div>
      <div className="space-y-3">
        {notes.map((note) => (
          <div key={note.id} id={note.id} className="flex gap-3">
            <Avatar>
              <AvatarFallback>{initials(note.authorId)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 rounded-md bg-[#f6f9fc] p-3 dark:bg-[#223043]">
              <div className="text-xs text-muted-foreground">
                {userName(note.authorId)} · {relativeTime(note.timestamp)}
              </div>
              <p className="mt-1 whitespace-pre-line">{note.body}</p>
            </div>
          </div>
        ))}
      </div>
      <form
        className="mt-4 flex gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <MessageSquare className="mt-2 size-5 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <Textarea
            placeholder="Add note"
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
          />
          <Button
            className="mt-2 cursor-pointer bg-[#ff5c35] text-white hover:bg-[#e64a24]"
            size="sm"
            disabled={!draft.trim()}
            type="submit"
          >
            Save note
          </Button>
        </div>
      </form>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-72 items-center justify-center rounded-md border border-[#d5e1ea] bg-white text-muted-foreground dark:border-[#263445] dark:bg-[#17202c]">
      {label}
    </div>
  );
}

function CompanyDetailDialog({
  open,
  company,
  onOpenChange,
}: {
  open: boolean;
  company: Company | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!company) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{company.name}</DialogTitle>
          <DialogDescription>{company.industry}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          <Info icon={<Building2 className="size-4" />} label="Domain" value={company.domain} />
          <Info
            icon={<UserRound className="size-4" />}
            label="Owner"
            value={userName(company.ownerId)}
          />
          <Info
            icon={<Circle className="size-4" />}
            label="Members"
            value={company.memberIds.map(userName).join(", ")}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateContactDialog({
  open,
  companies,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  companies: Company[];
  onOpenChange: (open: boolean) => void;
  onCreate: (input: {
    name: string;
    email: string;
    phone: string;
    title: string;
    companyId: string;
    stage: LifecycleStage;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [stage, setStage] = useState<LifecycleStage>("Lead");

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName("");
      setEmail("");
      setPhone("");
      setTitle("");
      setCompanyId(companies[0]?.id ?? "");
      setStage("Lead");
    }
  }, [open, companies]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create contact</DialogTitle>
          <DialogDescription>Add a CRM contact owned by the active user.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Input
            autoFocus
            placeholder="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            placeholder="Phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <Input
            placeholder="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <MiniSelect
            value={companyId}
            items={companies.map((company) => company.id)}
            onValueChange={(value) => value && setCompanyId(value)}
          />
          <MiniSelect
            value={stage}
            items={lifecycleStages}
            onValueChange={(value) => value && setStage(value as LifecycleStage)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="cursor-pointer bg-[#ff5c35] text-white hover:bg-[#e64a24]"
            disabled={!name.trim()}
            onClick={() => onCreate({ name, email, phone, title, companyId, stage })}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateDealDialog({
  open,
  contacts,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  contacts: Contact[];
  onOpenChange: (open: boolean) => void;
  onCreate: (input: {
    name: string;
    contactId: string;
    stage: DealStage;
    amount: number;
    closeDate: string;
    probability: number;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [stage, setStage] = useState<DealStage>("Qualified");
  const [amount, setAmount] = useState("25000");
  const [closeDate, setCloseDate] = useState("2026-07-24");

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName("");
      setContactId(contacts[0]?.id ?? "");
      setStage("Qualified");
      setAmount("25000");
      setCloseDate("2026-07-24");
    }
  }, [open, contacts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create deal</DialogTitle>
          <DialogDescription>Attach a new deal to a visible contact.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Input
            autoFocus
            placeholder="Deal name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <MiniSelect
            value={contactId}
            items={contacts.map((contact) => contact.id)}
            onValueChange={(value) => value && setContactId(value)}
          />
          <MiniSelect
            value={stage}
            items={dealStages}
            onValueChange={(value) => value && setStage(value as DealStage)}
          />
          <Input value={amount} onChange={(event) => setAmount(event.target.value)} />
          <Input
            type="date"
            value={closeDate}
            onChange={(event) => setCloseDate(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="cursor-pointer bg-[#ff5c35] text-white hover:bg-[#e64a24]"
            disabled={!name.trim() || !contactId}
            onClick={() =>
              onCreate({
                name,
                contactId,
                stage,
                amount: Number(amount) || 0,
                closeDate,
                probability: stage === "Closed Won" ? 100 : 40,
              })
            }
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
