"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  Grid2X2,
  List,
  Menu,
  Plus,
  Search,
  Share2,
  Star,
  Trash2,
  Upload,
  ArrowLeft,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { captureActivityEvent } from "@/app/admin/activity-capture";
import { appUsers } from "@/lib/users";
import { useActiveUser } from "@/lib/user-store";
import { cn } from "@/lib/utils";
import {
  canAccessItem,
  driveKinds,
  driveViews,
  relativeTime,
  useDriveStore,
  type DriveItem,
  type DriveKind,
  type DriveView,
} from "@/app/google-drive/drive-state";

function normalizeView(value: string | null): DriveView {
  return driveViews.includes(value as DriveView) ? (value as DriveView) : "my-drive";
}

function initials(id: string) {
  return appUsers.find((user) => user.id === id)?.initials ?? "??";
}

function iconFor(kind: DriveKind) {
  if (kind === "folder") return <Folder className="size-5 text-[#fbbc04]" />;
  if (kind === "sheet") return <FileSpreadsheet className="size-5 text-[#0f9d58]" />;
  if (kind === "image") return <FileImage className="size-5 text-[#a142f4]" />;
  return <FileText className="size-5 text-[#4285f4]" />;
}

export function GoogleDriveApp({
  onAction,
}: { onAction?: (action: { type: string; payload: unknown }) => void } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeUser = useActiveUser();
  const items = useDriveStore((state) => state.items);
  const loadCorpusPage = useDriveStore((state) => state.loadCorpusPage);
  const createFolder = useDriveStore((state) => state.createFolder);
  const uploadFile = useDriveStore((state) => state.uploadFile);
  const toggleStar = useDriveStore((state) => state.toggleStar);
  const trashItem = useDriveStore((state) => state.trashItem);
  const restoreItem = useDriveStore((state) => state.restoreItem);
  const shareItem = useDriveStore((state) => state.shareItem);
  const renameItem = useDriveStore((state) => state.renameItem);
  const moveItem = useDriveStore((state) => state.moveItem);
  const deleteItem = useDriveStore((state) => state.deleteItem);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const previousUserId = useRef(activeUser.id);

  useEffect(() => {
    void loadCorpusPage(1);
  }, [loadCorpusPage]);

  const view = normalizeView(searchParams.get("view"));
  const folderId = searchParams.get("folder");
  const fileId = searchParams.get("file");
  const layout = searchParams.get("layout") === "list" ? "list" : "grid";
  const query = searchParams.get("q") ?? "";
  const normalizedQuery = query.trim().toLowerCase();

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
    router.replace(`${pathname}?view=my-drive`);
  }, [activeUser.id, pathname, router]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;
    if (
      folderId &&
      (!canAccessItem(items[folderId], activeUser.id) || items[folderId]?.kind !== "folder")
    ) {
      params.delete("folder");
      changed = true;
    }
    if (fileId && !canAccessItem(items[fileId], activeUser.id)) {
      params.delete("file");
      changed = true;
    }
    if (changed) router.replace(`${pathname}?${params.toString()}`);
  }, [activeUser.id, fileId, folderId, items, pathname, router, searchParams]);

  const visibleItems = useMemo(() => {
    return Object.values(items)
      .filter((item) => canAccessItem(item, activeUser.id))
      .filter((item) => {
        if (view === "trash") return item.trashed;
        if (item.trashed) return false;
        if (view === "shared")
          return item.ownerId !== activeUser.id && item.sharedWith.includes(activeUser.id);
        if (view === "starred") return item.starredBy.includes(activeUser.id);
        if (view === "recent") return true;
        return item.ownerId === activeUser.id && item.parentId === (folderId ?? null);
      })
      .filter(
        (item) =>
          !normalizedQuery ||
          [item.name, item.content, item.kind].join(" ").toLowerCase().includes(normalizedQuery),
      )
      .sort((a, b) => {
        if (view === "recent") return b.updatedAt - a.updatedAt;
        if (a.kind === "folder" && b.kind !== "folder") return -1;
        if (a.kind !== "folder" && b.kind === "folder") return 1;
        return a.name.localeCompare(b.name);
      });
  }, [activeUser.id, folderId, items, normalizedQuery, view]);
  const selectedItem = fileId && canAccessItem(items[fileId], activeUser.id) ? items[fileId] : null;

  return (
    <main className="flex h-[calc(100vh-3.5rem)] min-h-0 bg-[#f8fafd] text-sm text-[#1f1f1f] dark:bg-[#111315] dark:text-[#e8eaed]">
      <aside className="hidden w-72 shrink-0 border-r border-[#dadce0] bg-white lg:block dark:border-[#303134] dark:bg-[#1b1c1f]">
        <Sidebar
          view={view}
          onView={(next) => updateUrl({ view: next, folder: null, file: null, q: null })}
          onNewFolder={() => setNewFolderOpen(true)}
          onUpload={() => setUploadOpen(true)}
        />
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-80 border-[#dadce0] bg-white p-0 dark:border-[#303134] dark:bg-[#1b1c1f]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Drive navigation</SheetTitle>
          </SheetHeader>
          <Sidebar
            view={view}
            onView={(next) => {
              updateUrl({ view: next, folder: null, file: null, q: null });
              setSidebarOpen(false);
            }}
            onNewFolder={() => setNewFolderOpen(true)}
            onUpload={() => setUploadOpen(true)}
          />
        </SheetContent>
      </Sheet>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#dadce0] bg-white dark:border-[#303134] dark:bg-[#1b1c1f]">
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
              <div className="font-semibold">Google Drive</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 overflow-hidden">
                {folderId
                  ? (() => {
                      const path = [];
                      let current: DriveItem | undefined = items[folderId];
                      while (current) {
                        path.unshift(current);
                        current = current.parentId ? items[current.parentId] : undefined;
                      }
                      return (
                        <>
                          <button
                            className="hover:underline cursor-pointer"
                            onClick={() => updateUrl({ folder: null, file: null })}
                          >
                            My Drive
                          </button>
                          {path.map((item) => (
                            <span key={item.id} className="flex items-center gap-1">
                              <span>/</span>
                              <button
                                className="hover:underline cursor-pointer truncate max-w-30"
                                onClick={() => updateUrl({ folder: item.id, file: null })}
                              >
                                {item.name}
                              </button>
                            </span>
                          ))}
                        </>
                      );
                    })()
                  : viewLabel(view)}
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="cursor-pointer"
              onClick={() => updateUrl({ layout: layout === "grid" ? "list" : null })}
            >
              {layout === "grid" ? <List /> : <Grid2X2 />}
            </Button>
          </div>
          <div className="flex items-center gap-3 px-4 pb-3">
            <div className="relative min-w-56 flex-1 sm:max-w-md">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 rounded-full bg-[#f1f3f4] pl-9 dark:bg-[#303134]"
                value={query}
                placeholder="Search in Drive"
                onChange={(event) => updateUrl({ q: event.target.value || null, file: null })}
              />
            </div>
          </div>
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-4 p-4 xl:grid-cols-[1fr_22rem]">
            <div>
              {folderId && (
                <Button
                  variant="ghost"
                  className="mb-3 cursor-pointer"
                  onClick={() => updateUrl({ folder: null, file: null })}
                >
                  Back to My Drive
                </Button>
              )}
              <DriveItems
                items={visibleItems}
                layout={layout}
                activeUserId={activeUser.id}
                onOpen={(item) =>
                  item.kind === "folder"
                    ? updateUrl({ view: "my-drive", folder: item.id, file: null })
                    : updateUrl({ file: item.id })
                }
                onStar={(id) => {
                  toggleStar(id, activeUser.id);
                  const item = items[id];
                  captureActivityEvent({
                    sourceApp: "google-drive",
                    actorId: activeUser.id,
                    type: "file_action",
                    action: "Starred Google Drive item",
                    title: item?.name ?? "Drive item starred",
                    body: `${item?.kind ?? "item"} starred in Google Drive.`,
                    sourceEntityId: id,
                    sourceEntityType: item?.kind ?? "item",
                    sourceUrl: `/google-drive?view=starred&file=${id}`,
                    metadata: { kind: item?.kind ?? null, parentId: item?.parentId ?? null },
                  });
                }}
                onTrash={(id) => {
                  trashItem(id, activeUser.id);
                  const item = items[id];
                  captureActivityEvent({
                    sourceApp: "google-drive",
                    actorId: activeUser.id,
                    type: "file_action",
                    action: "Trashed Google Drive item",
                    title: item?.name ?? "Drive item trashed",
                    body: `${item?.kind ?? "item"} moved to trash.`,
                    sourceEntityId: id,
                    sourceEntityType: item?.kind ?? "item",
                    sourceUrl: `/google-drive?view=trash&file=${id}`,
                    metadata: { kind: item?.kind ?? null, parentId: item?.parentId ?? null },
                  });
                }}
                onRestore={(id) => {
                  restoreItem(id, activeUser.id);
                  const item = items[id];
                  captureActivityEvent({
                    sourceApp: "google-drive",
                    actorId: activeUser.id,
                    type: "file_action",
                    action: "Restored Google Drive item",
                    title: item?.name ?? "Drive item restored",
                    body: `${item?.kind ?? "item"} restored from trash.`,
                    sourceEntityId: id,
                    sourceEntityType: item?.kind ?? "item",
                    sourceUrl: `/google-drive?view=my-drive&file=${id}`,
                    metadata: { kind: item?.kind ?? null, parentId: item?.parentId ?? null },
                  });
                }}
              />
            </div>
            <Preview
              item={selectedItem}
              activeUserId={activeUser.id}
              folders={Object.values(items).filter(
                (item) => item.kind === "folder" && canAccessItem(item, activeUser.id),
              )}
              onStar={() => {
                if (!selectedItem) return;
                toggleStar(selectedItem.id, activeUser.id);
                captureActivityEvent({
                  sourceApp: "google-drive",
                  actorId: activeUser.id,
                  type: "file_action",
                  action: "Starred Google Drive item",
                  title: selectedItem.name,
                  body: `${selectedItem.kind} starred in Google Drive.`,
                  sourceEntityId: selectedItem.id,
                  sourceEntityType: selectedItem.kind,
                  sourceUrl: `/google-drive?view=starred&file=${selectedItem.id}`,
                  metadata: { kind: selectedItem.kind, parentId: selectedItem.parentId },
                });
              }}
              onTrash={() => {
                if (!selectedItem) return;
                trashItem(selectedItem.id, activeUser.id);
                captureActivityEvent({
                  sourceApp: "google-drive",
                  actorId: activeUser.id,
                  type: "file_action",
                  action: "Trashed Google Drive item",
                  title: selectedItem.name,
                  body: `${selectedItem.kind} moved to trash.`,
                  sourceEntityId: selectedItem.id,
                  sourceEntityType: selectedItem.kind,
                  sourceUrl: `/google-drive?view=trash&file=${selectedItem.id}`,
                  metadata: { kind: selectedItem.kind, parentId: selectedItem.parentId },
                });
              }}
              onShare={(userId) =>
                selectedItem &&
                (shareItem(selectedItem.id, activeUser.id, userId),
                captureActivityEvent({
                  sourceApp: "google-drive",
                  actorId: activeUser.id,
                  type: "share",
                  action: "Shared Google Drive item",
                  title: selectedItem.name,
                  body: `${selectedItem.kind} shared with ${userId}.`,
                  sourceEntityId: selectedItem.id,
                  sourceEntityType: selectedItem.kind,
                  sourceUrl: `/google-drive?view=shared&file=${selectedItem.id}`,
                  metadata: { kind: selectedItem.kind, sharedWith: userId },
                }))
              }
              onRename={(name) => selectedItem && renameItem(selectedItem.id, activeUser.id, name)}
              onMove={(parentId) =>
                selectedItem && moveItem(selectedItem.id, activeUser.id, parentId)
              }
              onDelete={() => {
                if (selectedItem) {
                  deleteItem(selectedItem.id, activeUser.id);
                  updateUrl({ file: null });
                }
              }}
            />
          </div>
        </ScrollArea>
      </section>
      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        onCreate={(name) => {
          const id = createFolder(activeUser.id, folderId ?? null, name);
          if (id) {
            setNewFolderOpen(false);
            onAction?.({
              type: "CREATE_FOLDER",
              payload: { id, name, authorId: activeUser.id, parentId: folderId ?? null },
            });
            captureActivityEvent({
              sourceApp: "google-drive",
              actorId: activeUser.id,
              type: "create",
              action: "Created Google Drive folder",
              title: name,
              body: `Folder created in Google Drive.`,
              sourceEntityId: id,
              sourceEntityType: "folder",
              sourceUrl: `/google-drive?view=my-drive&folder=${id}`,
              metadata: { parentId: folderId ?? null },
            });
          }
        }}
      />
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUpload={(input) => {
          const id = uploadFile({ ...input, actorId: activeUser.id, parentId: folderId ?? null });
          if (id) {
            setUploadOpen(false);
            onAction?.({
              type: "UPLOAD_FILE",
              payload: { id, ...input, authorId: activeUser.id, parentId: folderId ?? null },
            });
            captureActivityEvent({
              sourceApp: "google-drive",
              actorId: activeUser.id,
              type: "file_action",
              action: "Uploaded Google Drive file",
              title: input.name,
              body: input.content || `Uploaded ${input.kind} file.`,
              sourceEntityId: id,
              sourceEntityType: input.kind,
              sourceUrl: `/google-drive?view=my-drive&file=${id}`,
              metadata: { kind: input.kind, parentId: folderId ?? null },
            });
            updateUrl({ file: id });
          }
        }}
      />
      {selectedItem && selectedItem.kind !== "folder" && (
        <DocViewer item={selectedItem} onClose={() => updateUrl({ file: null })} />
      )}
    </main>
  );
}

function viewLabel(view: DriveView) {
  return view === "my-drive"
    ? "My Drive"
    : view === "shared"
      ? "Shared with me"
      : view[0].toUpperCase() + view.slice(1);
}

function Sidebar({
  view,
  onView,
  onNewFolder,
  onUpload,
}: {
  view: DriveView;
  onView: (view: DriveView) => void;
  onNewFolder: () => void;
  onUpload: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#dadce0] p-4 dark:border-[#303134]">
        <div className="font-semibold">Drive</div>
        <div className="text-xs text-muted-foreground">Files and folders</div>
      </div>
      <div className="space-y-2 p-3">
        <Button
          className="h-11 w-full cursor-pointer justify-start rounded-full bg-white text-[#1f1f1f] shadow-sm hover:bg-[#f1f3f4] dark:bg-[#2b2c30] dark:text-[#e3e3e3] dark:hover:bg-[#303134]"
          onClick={onUpload}
        >
          <Plus className="size-5" />
          New
        </Button>
        <Button
          variant="outline"
          className="w-full cursor-pointer justify-start"
          onClick={onNewFolder}
        >
          <Folder className="size-4" />
          New folder
        </Button>
        {driveViews.map((item) => (
          <button
            key={item}
            className={cn(
              "flex w-full cursor-pointer items-center gap-3 rounded-full px-3 py-2 text-left hover:bg-[#f1f3f4] dark:hover:bg-[#303134]",
              view === item && "bg-[#e8f0fe] text-[#1967d2] dark:bg-[#1f3a5f] dark:text-[#8ab4f8]",
            )}
            onClick={() => onView(item)}
            type="button"
          >
            {item === "starred" ? (
              <Star className="size-4" />
            ) : item === "trash" ? (
              <Trash2 className="size-4" />
            ) : (
              <Folder className="size-4" />
            )}
            {viewLabel(item)}
          </button>
        ))}
      </div>
    </div>
  );
}

function DriveItems({
  items,
  layout,
  activeUserId,
  onOpen,
  onStar,
  onTrash,
  onRestore,
}: {
  items: DriveItem[];
  layout: string;
  activeUserId: string;
  onOpen: (item: DriveItem) => void;
  onStar: (id: string) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  if (items.length === 0)
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-[#dadce0] bg-white text-muted-foreground dark:border-[#303134] dark:bg-[#1b1c1f]">
        No files match this view.
      </div>
    );
  if (layout === "list")
    return (
      <div className="overflow-hidden rounded-md border border-[#dadce0] bg-white dark:border-[#303134] dark:bg-[#1b1c1f]">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            activeUserId={activeUserId}
            onOpen={onOpen}
            onStar={onStar}
            onTrash={onTrash}
            onRestore={onRestore}
          />
        ))}
      </div>
    );
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="cursor-pointer rounded-xl border border-[#dadce0] bg-white p-3 text-left hover:border-[#1a73e8] dark:border-[#303134] dark:bg-[#1b1c1f]"
          onClick={() => onOpen(item)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onOpen(item)}
        >
          <div className="flex items-center gap-2">
            {iconFor(item.kind)}
            <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
          </div>
          <div className="mt-8 rounded-lg bg-[#f1f3f4] p-4 text-xs text-muted-foreground dark:bg-[#303134]">
            {item.content}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Avatar size="sm">
              <AvatarFallback>{initials(item.ownerId)}</AvatarFallback>
            </Avatar>
            <span>{relativeTime(item.updatedAt)}</span>
            <span className="ml-auto">{item.size}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ItemRow({
  item,
  activeUserId,
  onOpen,
  onStar,
  onTrash,
  onRestore,
}: {
  item: DriveItem;
  activeUserId: string;
  onOpen: (item: DriveItem) => void;
  onStar: (id: string) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  return (
    <div
      className="grid w-full cursor-pointer grid-cols-[1fr_auto] gap-3 border-b border-[#dadce0] p-3 text-left last:border-b-0 hover:bg-[#f8fafd] md:grid-cols-[1fr_8rem_8rem_8rem_auto] dark:border-[#303134] dark:hover:bg-[#303134]"
      onClick={() => onOpen(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen(item)}
    >
      <div className="flex min-w-0 items-center gap-3">
        {iconFor(item.kind)}
        <span className="truncate font-medium">{item.name}</span>
      </div>
      <span className="hidden text-xs text-muted-foreground md:block">
        {item.ownerId === activeUserId ? "me" : "shared"}
      </span>
      <span className="hidden text-xs text-muted-foreground md:block">
        {relativeTime(item.updatedAt)}
      </span>
      <span className="hidden text-xs text-muted-foreground md:block">{item.size}</span>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="cursor-pointer"
          onClick={(event) => {
            event.stopPropagation();
            onStar(item.id);
          }}
        >
          <Star
            className={cn(
              item.starredBy.includes(activeUserId) && "fill-yellow-400 text-yellow-500",
            )}
          />
        </Button>
        {item.trashed ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            onClick={(event) => {
              event.stopPropagation();
              onRestore(item.id);
            }}
          >
            Restore
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            disabled={item.ownerId !== activeUserId}
            onClick={(event) => {
              event.stopPropagation();
              onTrash(item.id);
            }}
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </div>
  );
}

function Preview({
  item,
  activeUserId,
  folders,
  onStar,
  onTrash,
  onShare,
  onRename,
  onMove,
  onDelete,
}: {
  item: DriveItem | null;
  activeUserId: string;
  folders: DriveItem[];
  onStar: () => void;
  onTrash: () => void;
  onShare: (userId: string) => void;
  onRename: (name: string) => void;
  onMove: (parentId: string | null) => void;
  onDelete: () => void;
}) {
  if (!item)
    return (
      <aside className="hidden rounded-xl border border-[#dadce0] bg-white p-4 text-muted-foreground xl:block dark:border-[#303134] dark:bg-[#1b1c1f]">
        Select a file to preview details.
      </aside>
    );
  return (
    <aside className="rounded-xl border border-[#dadce0] bg-white p-4 dark:border-[#303134] dark:bg-[#1b1c1f]">
      <div className="flex items-center gap-2">
        {iconFor(item.kind)}
        <Input
          value={item.name}
          onChange={(e) => onRename(e.target.value)}
          className="h-8 font-semibold text-sm min-w-0"
          disabled={item.ownerId !== activeUserId}
        />
      </div>
      <div className="mt-4 rounded-lg bg-[#f1f3f4] p-5 text-sm leading-6 dark:bg-[#303134]">
        {item.content}
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <div>Owner: {item.ownerId === activeUserId ? "me" : item.ownerId}</div>
        <div>Updated: {relativeTime(item.updatedAt)}</div>
        <div>Shared: {item.sharedWith.length}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" className="cursor-pointer" onClick={onStar}>
          <Star
            className={cn(
              "size-4",
              item.starredBy.includes(activeUserId) && "fill-yellow-400 text-yellow-500",
            )}
          />
          Star
        </Button>
        <Select onValueChange={(value) => typeof value === "string" && onShare(value)}>
          <SelectTrigger className="cursor-pointer">
            <Share2 className="size-4" />
            <SelectValue placeholder="Share" />
          </SelectTrigger>
          <SelectContent>
            {appUsers
              .filter((user) => user.id !== activeUserId)
              .map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {item.trashed ? (
          <Button
            variant="destructive"
            className="cursor-pointer"
            disabled={item.ownerId !== activeUserId}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
            Delete Forever
          </Button>
        ) : (
          <>
            <Select
              onValueChange={(val: string | null) =>
                onMove(val === "root" ? null : (val as string | null))
              }
            >
              <SelectTrigger className="cursor-pointer" disabled={item.ownerId !== activeUserId}>
                <SelectValue placeholder="Move to..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">My Drive</SelectItem>
                {folders
                  .filter((f) => f.id !== item.id)
                  .map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={item.ownerId !== activeUserId}
              onClick={onTrash}
            >
              <Trash2 className="size-4" />
              Trash
            </Button>
          </>
        )}
      </div>
    </aside>
  );
}

function NewFolderDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName("");
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Folder name"
        />
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="cursor-pointer bg-[#1a73e8] text-white hover:bg-[#1765cc]"
            disabled={!name.trim()}
            onClick={() => onCreate(name)}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  onUpload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (input: { name: string; kind: DriveKind; content: string }) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<DriveKind>("doc");
  const [content, setContent] = useState("");
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName("");

      setKind("doc");

      setContent("");
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload file</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="File name"
          />
          <Select value={kind} onValueChange={(value) => value && setKind(value as DriveKind)}>
            <SelectTrigger className="cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {driveKinds.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Preview content"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="cursor-pointer bg-[#1a73e8] text-white hover:bg-[#1765cc]"
            disabled={!name.trim()}
            onClick={() => onUpload({ name, kind, content })}
          >
            <Upload className="size-4" />
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function DocViewer({ item, onClose }: { item: DriveItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f8f9fa] dark:bg-[#1f1f1f]">
      <header className="flex h-16 items-center gap-4 border-b border-[#dadce0] bg-white px-4 dark:border-[#303134] dark:bg-[#2b2c30]">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="cursor-pointer rounded-full"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex items-center gap-3">
          {iconFor(item.kind)}
          <span className="text-lg font-medium">{item.name}</span>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4 sm:p-8">
        <div className="mx-auto min-h-full max-w-4xl rounded-lg border border-[#dadce0] bg-white p-8 text-[#1f1f1f] shadow-sm dark:border-[#303134] dark:bg-[#2b2c30] dark:text-[#e3e3e3] sm:p-12">
          <div className="whitespace-pre-wrap font-serif text-lg leading-relaxed">
            {item.content || "Empty document"}
          </div>
        </div>
      </main>
    </div>
  );
}
