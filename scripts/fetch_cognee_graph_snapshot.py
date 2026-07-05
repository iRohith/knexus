#!/usr/bin/env python3
"""Fetch the already-built Cognee Cloud graph as a static frontend asset.

This script is intentionally read-only. It only calls:

- GET /api/v1/datasets
- GET /api/v1/datasets/{dataset_id}/graph
- GET /api/v1/visualize/inventory

It never calls add, remember, forget, cognify, improve, or any other mutating
operation. The output is written to public/cognee/graph.json so the static
frontend can render the saved Cognee graph without browser-side credentials.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - script still works if env is exported
    load_dotenv = None


ROOT = Path(__file__).resolve().parent.parent
TMP_DIR = Path(__file__).resolve().parent
CORP_DATA_MANIFEST = ROOT / "public" / "corp-os-data" / "manifest.json"
DEFAULT_OUTPUT = ROOT / "public" / "cognee" / "graph.json"
DEFAULT_MAX_NODES = 250
DEFAULT_MAX_EDGES = 600


def load_env() -> None:
    if load_dotenv is None:
        return
    for path in [ROOT / ".env", ROOT / ".env.local", TMP_DIR / ".env", ROOT.parent / ".env.local"]:
        if path.exists():
            load_dotenv(path, override=False)


def read_dataset_name() -> str:
    if os.environ.get("COGNEE_DATASET_NAME"):
        return os.environ["COGNEE_DATASET_NAME"]
    if CORP_DATA_MANIFEST.exists():
        manifest = json.loads(CORP_DATA_MANIFEST.read_text("utf-8"))
        dataset_name = manifest.get("datasetName")
        if isinstance(dataset_name, str) and dataset_name:
            return dataset_name
    return "knexus-activity"


def json_safe(value: Any) -> Any:
    try:
        json.dumps(value)
        return value
    except TypeError:
        if isinstance(value, dict):
            return {str(key): json_safe(item) for key, item in value.items()}
        if isinstance(value, list):
            return [json_safe(item) for item in value]
        return str(value)


def request_json(service_url: str, api_key: str, path: str, query: dict[str, Any] | None = None):
    url = f"{service_url.rstrip('/')}{path}"
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"
    req = urllib.request.Request(url, headers={"X-Api-Key": api_key, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GET {path} failed ({error.code}): {body}") from error


def resolve_dataset(service_url: str, api_key: str, dataset_name: str) -> dict[str, Any]:
    datasets = request_json(service_url, api_key, "/api/v1/datasets")
    if not isinstance(datasets, list):
        raise RuntimeError("GET /api/v1/datasets did not return a list")

    exact = next((item for item in datasets if item.get("name") == dataset_name), None)
    if exact:
        return exact

    available = ", ".join(str(item.get("name")) for item in datasets[:20])
    raise RuntimeError(f"Dataset {dataset_name!r} not found. Available datasets: {available}")


def bounded_graph(graph: dict[str, Any], max_nodes: int, max_edges: int) -> dict[str, Any]:
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    if not isinstance(nodes, list) or not isinstance(edges, list):
        return graph
    if max_nodes <= 0 or len(nodes) <= max_nodes:
        return graph

    degree: dict[str, int] = {str(node.get("id")): 0 for node in nodes if isinstance(node, dict)}
    for edge in edges:
        if not isinstance(edge, dict):
            continue
        source = str(edge.get("source"))
        target = str(edge.get("target"))
        degree[source] = degree.get(source, 0) + 1
        degree[target] = degree.get(target, 0) + 1

    kept_nodes = sorted(
        [node for node in nodes if isinstance(node, dict)],
        key=lambda node: degree.get(str(node.get("id")), 0),
        reverse=True,
    )[:max_nodes]
    kept_ids = {str(node.get("id")) for node in kept_nodes}
    kept_edges = [
        edge
        for edge in edges
        if isinstance(edge, dict)
        and str(edge.get("source")) in kept_ids
        and str(edge.get("target")) in kept_ids
    ][:max_edges]

    return {
        **graph,
        "nodes": kept_nodes,
        "edges": kept_edges,
    }


def build_snapshot(args: argparse.Namespace) -> dict[str, Any]:
    load_env()
    service_url = os.environ.get("COGNEE_BASE_URL")
    api_key = os.environ.get("COGNEE_API_KEY")
    dataset_name = args.dataset or read_dataset_name()

    if not service_url:
        raise RuntimeError("COGNEE_BASE_URL is not set")
    if not api_key:
        raise RuntimeError("COGNEE_API_KEY is not set")

    dataset = resolve_dataset(service_url, api_key, dataset_name)
    dataset_id = str(dataset["id"])
    graph = request_json(service_url, api_key, f"/api/v1/datasets/{dataset_id}/graph")
    full_node_count = len(graph.get("nodes", [])) if isinstance(graph, dict) else 0
    full_edge_count = len(graph.get("edges", [])) if isinstance(graph, dict) else 0
    graph = bounded_graph(graph, args.max_nodes, args.max_edges) if isinstance(graph, dict) else graph

    inventory: Any = []
    try:
        inventory = request_json(
            service_url,
            api_key,
            "/api/v1/visualize/inventory",
            {"dataset_id": dataset_id, "samples_per_type": args.samples_per_type},
        )
    except Exception as error:
        inventory = {"error": str(error)}

    return {
        "snapshotId": f"cognee-graph-{int(time.time())}",
        "source": "cognee-cloud",
        "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "dataset": json_safe(dataset),
        "datasetName": dataset_name,
        "datasetId": dataset_id,
        "graphData": json_safe(graph),
        "fullGraph": {
            "nodeCount": full_node_count,
            "edgeCount": full_edge_count,
        },
        "renderedGraph": {
            "nodeCount": len(graph.get("nodes", [])) if isinstance(graph, dict) else 0,
            "edgeCount": len(graph.get("edges", [])) if isinstance(graph, dict) else 0,
            "selection": "highest_degree",
            "maxNodes": args.max_nodes,
            "maxEdges": args.max_edges,
        },
        "schemaInventory": json_safe(inventory),
        "readonly": True,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", default=None, help="Dataset name. Defaults to manifest/.env.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--samples-per-type", type=int, default=8)
    parser.add_argument("--max-nodes", type=int, default=DEFAULT_MAX_NODES)
    parser.add_argument("--max-edges", type=int, default=DEFAULT_MAX_EDGES)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        snapshot = build_snapshot(args)
    except Exception as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.output.with_suffix(f"{args.output.suffix}.tmp")
    tmp.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False), "utf-8")
    tmp.replace(args.output)
    graph = snapshot.get("graphData", {})
    nodes = len(graph.get("nodes", [])) if isinstance(graph, dict) else 0
    edges = len(graph.get("edges", [])) if isinstance(graph, dict) else 0
    print(f"Wrote {args.output} ({nodes} nodes, {edges} edges)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
