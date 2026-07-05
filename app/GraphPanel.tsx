"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderToString } from "react-dom/server";
import {
  BrainCircuit,
  CircleDot,
  ExternalLink,
  FileText,
  Maximize2,
  MessageSquare,
  Network,
  RotateCcw,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTheme } from "next-themes";
import { FaSlack } from "react-icons/fa";
import {
  SiConfluence,
  SiFireflyiii,
  SiGmail,
  SiGoogledrive,
  SiGithub,
  SiHubspot,
  SiJira,
  SiLinear,
} from "react-icons/si";
import { GraphCanvas, type GraphCanvasRef, darkTheme, lightTheme } from "reagraph";

import { sourceAppMeta, sourceApps, type SourceApp } from "@/app/admin/activity-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { loadCogneeKnowledgeGraph } from "@/lib/cognee-static-graph";
import type {
  IntelligenceAnswer,
  KnowledgeEdge,
  KnowledgeGraph,
  KnowledgeNode,
  KnowledgeNodeType,
} from "@/lib/knowledge-graph-types";

type GraphPanelProps = {
  activeAnswer: IntelligenceAnswer | null;
  fullPage?: boolean;
  initialNodeId?: string | null;
  initialEdgeId?: string | null;
};

const appColors: Record<SourceApp, string> = {
  gmail: "#ea4335",
  slack: "#611f69",
  github: "#24292f",
  linear: "#5e6ad2",
  jira: "#0c66e4",
  hubspot: "#ff5c35",
  "google-drive": "#1a73e8",
  confluence: "#0c66e4",
  fireflies: "#6d5dfc",
};

const nodeTypes: KnowledgeNodeType[] = ["answer", "cognee_result", "evidence", "graph_node"];
const emptyCogneeGraph: KnowledgeGraph = {
  nodes: [],
  edges: [],
  generatedAt: 0,
  source: "cognee",
};

function formatType(value: string) {
  return value.replace(/_/g, " ");
}

function SourceAppIcon({ app, className }: { app: SourceApp; className?: string }) {
  if (app === "gmail") return <SiGmail className={className} />;
  if (app === "slack") return <FaSlack className={className} />;
  if (app === "github") return <SiGithub className={className} />;
  if (app === "linear") return <SiLinear className={className} />;
  if (app === "jira") return <SiJira className={className} />;
  if (app === "hubspot") return <SiHubspot className={className} />;
  if (app === "google-drive") return <SiGoogledrive className={className} />;
  if (app === "confluence") return <SiConfluence className={className} />;
  return <SiFireflyiii className={className} />;
}

function NodeTypeIcon({ type, className }: { type: KnowledgeNodeType; className?: string }) {
  if (type === "evidence") return <FileText className={className} />;
  if (type === "cognee_result") return <MessageSquare className={className} />;
  if (type === "answer") return <BrainCircuit className={className} />;
  return <CircleDot className={className} />;
}

function getIconDataUrl(app: SourceApp): string {
  const color = appColors[app] ?? "#64748b";
  let svg: string;

  if (app === "gmail") svg = renderToString(<SiGmail size={48} color={color} />);
  else if (app === "slack") svg = renderToString(<FaSlack size={48} color={color} />);
  else if (app === "github") svg = renderToString(<SiGithub size={48} color={color} />);
  else if (app === "linear") svg = renderToString(<SiLinear size={48} color={color} />);
  else if (app === "jira") svg = renderToString(<SiJira size={48} color={color} />);
  else if (app === "hubspot") svg = renderToString(<SiHubspot size={48} color={color} />);
  else if (app === "google-drive") svg = renderToString(<SiGoogledrive size={48} color={color} />);
  else if (app === "confluence") svg = renderToString(<SiConfluence size={48} color={color} />);
  else svg = renderToString(<SiFireflyiii size={48} color={color} />);

  if (!svg.includes("xmlns=")) {
    svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function AppPill({ app }: { app: SourceApp }) {
  const meta = sourceAppMeta[app];

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
      style={{ borderColor: meta.color, color: meta.color }}
    >
      <SourceAppIcon app={app} className="size-3" />
      {meta.label}
    </span>
  );
}

function nodeSourceHref(node: KnowledgeNode | null) {
  if (!node) return "/";
  return (
    node.sourceUrl ||
    (node.primarySourceApp ? sourceAppMeta[node.primarySourceApp]?.route : "/") ||
    "/"
  );
}

function edgeSourceHref(edge: KnowledgeEdge | null, nodesById: Map<string, KnowledgeNode>) {
  if (!edge) return "/";
  const node = nodesById.get(edge.source) ?? nodesById.get(edge.target);
  return nodeSourceHref(node ?? null);
}

function cleanNodeText(rawText: string) {
  const parts = rawText.split("Content:");
  if (parts.length > 1) {
    return parts.slice(1).join("Content:").trim();
  }
  return rawText;
}

function GraphDetailsContent({
  selectedNode,
  selectedEdge,
  selectedEdgeSource,
  selectedEdgeTarget,
  nodesById,
}: {
  selectedNode: KnowledgeNode | null;
  selectedEdge: KnowledgeEdge | null;
  selectedEdgeSource: KnowledgeNode | null;
  selectedEdgeTarget: KnowledgeNode | null;
  nodesById: Map<string, KnowledgeNode>;
}) {
  if (!selectedNode && !selectedEdge) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Select a node or edge to inspect its provenance.
      </div>
    );
  }

  return (
    <>
      {selectedNode && (
        <section className="space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <NodeTypeIcon type={selectedNode.type} className="size-4" />
              <h2 className="font-semibold">{selectedNode.label}</h2>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedNode.sourceApps.map((app) => (
                <AppPill key={app} app={app} />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Memory Content
            </span>
            <p className="whitespace-pre-wrap break-words rounded-md border bg-muted/20 p-3 text-sm leading-6">
              {cleanNodeText(selectedNode.text)}
            </p>
          </div>

          {Object.keys(selectedNode.metadata).length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Metadata
              </span>
              <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/10 p-3">
                {Object.entries(selectedNode.metadata).map(([key, value]) => {
                  if (typeof value === "object" && value !== null) return null;
                  return (
                    <div key={key} className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                      <span className="truncate text-xs font-medium" title={String(value)}>
                        {String(value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Link
            className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer gap-2")}
            href={nodeSourceHref(selectedNode)}
          >
            Open source
            <ExternalLink className="size-3.5" />
          </Link>
        </section>
      )}

      {selectedEdge && (
        <section className="space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <BrainCircuit className="size-4" />
              <h2 className="font-semibold">{selectedEdge.label}</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {selectedEdgeSource?.label} {"->"} {selectedEdgeTarget?.label}
            </p>
          </div>
          <Badge variant="secondary" className="capitalize">
            {formatType(selectedEdge.type)}
          </Badge>
          <p className="text-sm leading-6 text-muted-foreground">
            This semantic relationship is part of the memory path used to explain why an answer
            follows from the source text.
          </p>
          <Link
            className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer gap-2")}
            href={edgeSourceHref(selectedEdge, nodesById)}
          >
            Open source
            <ExternalLink className="size-3.5" />
          </Link>
        </section>
      )}
    </>
  );
}

export function GraphPanel({
  activeAnswer,
  fullPage = false,
  initialNodeId = null,
  initialEdgeId = null,
}: GraphPanelProps) {
  const { resolvedTheme } = useTheme();
  const graphRef = useRef<GraphCanvasRef | null>(null);
  const graphSurfaceRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceApp | "all">("all");
  const [typeFilter, setTypeFilter] = useState<KnowledgeNodeType | "all">("all");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodeId);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(initialEdgeId);
  const [defaultGraph, setDefaultGraph] = useState<KnowledgeGraph | null>(null);
  const [isDefaultGraphLoading, setIsDefaultGraphLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadCogneeKnowledgeGraph()
      .then((graph) => {
        if (!cancelled) setDefaultGraph(graph);
      })
      .finally(() => {
        if (!cancelled) setIsDefaultGraphLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const graph = useMemo(
    () => activeAnswer?.graph ?? defaultGraph ?? emptyCogneeGraph,
    [activeAnswer?.graph, defaultGraph],
  );
  const nodesById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const edgesById = useMemo(
    () => new Map(graph.edges.map((edge) => [edge.id, edge])),
    [graph.edges],
  );
  const highlightedNodeIds = useMemo(
    () => new Set(activeAnswer?.highlightedNodeIds ?? []),
    [activeAnswer],
  );
  const highlightedEdgeIds = useMemo(
    () => new Set(activeAnswer?.highlightedEdgeIds ?? []),
    [activeAnswer],
  );

  const filteredNodeIds = useMemo(() => {
    if (!fullPage) return new Set(graph.nodes.map((node) => node.id));
    const query = search.trim().toLowerCase();

    return new Set(
      graph.nodes
        .filter((node) => {
          if (sourceFilter !== "all" && !node.sourceApps.includes(sourceFilter)) return false;
          if (typeFilter !== "all" && node.type !== typeFilter) return false;
          if (!query) return true;
          const haystack = [
            node.label,
            node.text,
            node.type,
            node.primarySourceApp ?? "",
            ...node.sourceApps,
            JSON.stringify(node.metadata),
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(query);
        })
        .map((node) => node.id),
    );
  }, [fullPage, graph.nodes, search, sourceFilter, typeFilter]);

  const visibleGraph = useMemo(() => {
    const visibleNodes = graph.nodes.filter((node) => filteredNodeIds.has(node.id));
    const visibleEdges = graph.edges.filter(
      (edge) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target),
    );

    const nodes = visibleNodes.map((node) => {
      const highlighted = highlightedNodeIds.has(node.id);
      const selected = selectedNodeId === node.id;
      const sourceApp = node.primarySourceApp ?? node.sourceApps[0];
      const isSourceNode = Boolean(sourceApp);
      return {
        id: node.id,
        label:
          (node.label || "").length > 28
            ? `${(node.label || "").slice(0, 25)}...`
            : node.label || "",
        fill: highlighted ? "#f59e0b" : sourceApp ? appColors[sourceApp] : "#8b5cf6",
        size: isSourceNode ? (highlighted || selected ? 20 : 16) : highlighted || selected ? 10 : 5,
        icon: sourceApp ? getIconDataUrl(sourceApp) : undefined,
        labelVisible: isSourceNode || highlighted || selected,
        subLabel: sourceApp ? sourceAppMeta[sourceApp].label : undefined,
        data: node,
      };
    });

    const edges = visibleEdges.map((edge) => {
      const highlighted = highlightedEdgeIds.has(edge.id);
      const selected = selectedEdgeId === edge.id;
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        fill: highlighted || selected ? "#f59e0b" : undefined,
        dashed: highlighted,
        data: edge,
      };
    });

    return { nodes, edges };
  }, [
    filteredNodeIds,
    graph.edges,
    graph.nodes,
    highlightedEdgeIds,
    highlightedNodeIds,
    selectedEdgeId,
    selectedNodeId,
  ]);

  const selectedNode = selectedNodeId ? (nodesById.get(selectedNodeId) ?? null) : null;
  const selectedEdge = selectedEdgeId ? (edgesById.get(selectedEdgeId) ?? null) : null;
  const selectedEdgeSource = selectedEdge ? (nodesById.get(selectedEdge.source) ?? null) : null;
  const selectedEdgeTarget = selectedEdge ? (nodesById.get(selectedEdge.target) ?? null) : null;
  const activePathCount = activeAnswer?.reasoningSteps.length ?? 0;
  const graphModeLabel = activeAnswer ? "Active answer" : "Saved Cognee graph";
  const hasVisibleNodes = visibleGraph.nodes.length > 0;

  const handleZoomIn = useCallback(() => graphRef.current?.zoomIn(), []);
  const handleZoomOut = useCallback(() => graphRef.current?.zoomOut(), []);
  const handleFit = useCallback(() => {
    if (!hasVisibleNodes) return;
    graphRef.current?.fitNodesInView(undefined, { animated: false });
  }, [hasVisibleNodes]);
  const handleReset = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    graphRef.current?.resetControls(false);
    if (!hasVisibleNodes) return;
    graphRef.current?.fitNodesInView(undefined, { animated: false });
  }, [hasVisibleNodes]);

  useEffect(() => {
    if (!hasVisibleNodes) return;
    const frame = window.requestAnimationFrame(() => {
      graphRef.current?.fitNodesInView(undefined, { animated: false });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hasVisibleNodes, visibleGraph.nodes.length, visibleGraph.edges.length]);

  useEffect(() => {
    const element = graphSurfaceRef.current;
    if (!element) return;

    const preventPageScroll = (event: WheelEvent) => {
      event.preventDefault();
    };

    element.addEventListener("wheel", preventPageScroll, { passive: false, capture: true });
    return () => element.removeEventListener("wheel", preventPageScroll, { capture: true });
  }, []);

  const reagraphTheme = useMemo(() => {
    const dark = resolvedTheme === "dark";
    const base = dark ? darkTheme : lightTheme;
    const background = dark ? "#0d1117" : "#f7f9fc";

    return {
      ...base,
      canvas: {
        ...base.canvas,
        background,
        fog: background,
      },
      node: {
        ...base.node,
        label: {
          ...base.node?.label,
          color: dark ? "#e5e7eb" : "#111827",
        },
      },
    };
  }, [resolvedTheme]);

  return (
    <div
      className={cn(
        "relative flex min-h-0 overflow-hidden bg-[#f7f9fc] text-sm dark:bg-[#0d1117]",
        "h-full w-full max-w-full",
      )}
    >
      {fullPage && (
        <aside className="hidden w-72 shrink-0 border-r bg-background lg:flex lg:flex-col">
          <div className="border-b p-4">
            <div className="flex items-center gap-2 font-semibold">
              <Network className="size-4" />
              Knowledge Graph
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeAnswer
                ? "Graph from the active answer payload."
                : "Saved Cognee graph snapshot."}
            </p>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-4 p-4">
              <section>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Query Focus
                </div>
                {activeAnswer ? (
                  <div className="rounded-md border p-3">
                    <div className="text-sm font-medium">{activeAnswer.question}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {activePathCount} dependency steps · {activeAnswer.citations.length} citations
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    Showing the saved Cognee graph snapshot. Ask a question to focus the graph on an
                    answer path.
                  </div>
                )}
              </section>
              <Separator />
              <section>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sources
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sourceApps.map((app) => (
                    <AppPill key={app} app={app} />
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </aside>
      )}

      <section className="relative min-w-0 flex-1">
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
          <Button
            size="icon-sm"
            variant="outline"
            className="cursor-pointer bg-background/90 backdrop-blur"
            onClick={handleZoomIn}
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            className="cursor-pointer bg-background/90 backdrop-blur"
            onClick={handleZoomOut}
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            className="cursor-pointer bg-background/90 backdrop-blur"
            disabled={!hasVisibleNodes}
            onClick={handleFit}
          >
            <Maximize2 className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            className="cursor-pointer bg-background/90 backdrop-blur"
            disabled={!hasVisibleNodes}
            onClick={handleReset}
          >
            <RotateCcw className="size-4" />
          </Button>
        </div>

        {fullPage && (
          <div className="absolute top-3 left-3 z-10 grid max-w-[calc(100%-5rem)] gap-2 rounded-md border bg-background/90 p-2 shadow-sm backdrop-blur md:grid-cols-[18rem_10rem_10rem]">
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-8"
                placeholder="Search graph"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select
              value={sourceFilter}
              onValueChange={(value) => setSourceFilter(value as SourceApp | "all")}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All apps</SelectItem>
                {sourceApps.map((app) => (
                  <SelectItem key={app} value={app}>
                    {sourceAppMeta[app].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={typeFilter}
              onValueChange={(value) => setTypeFilter(value as KnowledgeNodeType | "all")}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All memories</SelectItem>
                {nodeTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!fullPage && (
          <div className="absolute top-3 left-3 z-10 max-w-sm rounded-md border bg-background/90 p-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 font-medium">
              <Network className="size-4" />
              Cognee graph
            </div>
            <Badge variant="secondary" className="mt-2">
              {graphModeLabel}
            </Badge>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeAnswer
                ? `${activePathCount} evidence results from the active answer.`
                : isDefaultGraphLoading
                  ? "Loading saved graph snapshot..."
                  : `${graph.nodes.length} rendered nodes and ${graph.edges.length} relationships from the saved graph.`}
            </p>
            {activeAnswer && (
              <Link
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "mt-3 cursor-pointer gap-2",
                )}
                href={`/knowledge-graph?query=${encodeURIComponent(activeAnswer.id)}`}
              >
                Open graph
                <ExternalLink className="size-3" />
              </Link>
            )}
          </div>
        )}

        {hasVisibleNodes && (
          <div
            ref={graphSurfaceRef}
            className="absolute inset-0 overscroll-contain touch-none"
            onWheelCapture={(event) => event.preventDefault()}
          >
            <GraphCanvas
              ref={graphRef}
              nodes={visibleGraph.nodes}
              edges={visibleGraph.edges}
              actives={activeAnswer?.highlightedNodeIds ?? []}
              selections={[selectedNodeId, selectedEdgeId].filter(Boolean) as string[]}
              layoutType="forceDirected2d"
              layoutOverrides={{
                forceLinkDistance: 130,
                forceLinkStrength: 0.35,
                forceCharge: -520,
                nodeStrength: -180,
              }}
              theme={reagraphTheme}
              labelType="nodes"
              defaultNodeSize={5}
              minNodeSize={4}
              maxNodeSize={22}
              animated={false}
              cameraMode="pan"
              onNodeClick={(node) => {
                setSelectedNodeId(node.id);
                setSelectedEdgeId(null);
              }}
              onEdgeClick={(edge) => {
                setSelectedEdgeId(edge.id);
                setSelectedNodeId(null);
              }}
            />
          </div>
        )}

        {!isDefaultGraphLoading && graph.nodes.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm">
            <div className="max-w-md rounded-md border bg-background p-5 text-center shadow-sm">
              <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-muted">
                <Network className="size-5" />
              </div>
              <h2 className="mt-3 font-semibold">Cognee graph snapshot not found</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Run the read-only graph fetch script to create{" "}
                <span className="font-mono">public/cognee/graph.json</span>.
              </p>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap gap-1.5">
          {sourceApps.map((app) => (
            <Badge
              key={app}
              variant="outline"
              className="gap-1 bg-background/85 px-1.5 py-0.5 text-xs backdrop-blur"
              style={{ borderColor: sourceAppMeta[app].color, color: sourceAppMeta[app].color }}
            >
              <span
                className="inline-block size-1.5 rounded-full"
                style={{ backgroundColor: sourceAppMeta[app].color }}
              />
              {sourceAppMeta[app].label}
            </Badge>
          ))}
        </div>
        {!fullPage && (selectedNode || selectedEdge) && (
          <div className="absolute top-3 right-16 z-10 w-80 max-w-[calc(100vw-5rem)] overflow-hidden rounded-md border bg-background/95 shadow-md backdrop-blur">
            <div className="flex shrink-0 items-center justify-between border-b px-4 py-2 font-medium">
              Details
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={() => {
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
            <ScrollArea className="h-[400px] max-h-[calc(100vh-10rem)]">
              <div className="p-4">
                <GraphDetailsContent
                  selectedNode={selectedNode}
                  selectedEdge={selectedEdge}
                  selectedEdgeSource={selectedEdgeSource}
                  selectedEdgeTarget={selectedEdgeTarget}
                  nodesById={nodesById}
                />
              </div>
            </ScrollArea>
          </div>
        )}
      </section>

      {fullPage && (
        <aside className="hidden w-80 shrink-0 border-l bg-background lg:flex lg:flex-col">
          <div className="border-b p-4 font-medium">Details</div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-4 p-4">
              <GraphDetailsContent
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                selectedEdgeSource={selectedEdgeSource}
                selectedEdgeTarget={selectedEdgeTarget}
                nodesById={nodesById}
              />
            </div>
          </ScrollArea>
        </aside>
      )}
    </div>
  );
}
