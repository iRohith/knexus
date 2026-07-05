#!/usr/bin/env python3
"""Fetch a snapshot of Cognee search answers for example questions."""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TMP_DIR = Path(__file__).resolve().parent
CORP_DATA_MANIFEST = ROOT / "public" / "seed" / "manifest.json"
DEFAULT_OUTPUT = ROOT / "public" / "cognee" / "answers.json"

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

EXAMPLE_PROMPTS = [
    ("private-upgrades", "What evidence explains the private-upgrade requirements for enterprise customers?"),
    ("audit-retention", "Which customer signals influenced audit logging and retention work?"),
    ("runtime-routing", "How did runtime latency, routing, and dedicated capacity decisions connect across teams?"),
    ("rbac-console", "What source records support the current RBAC and console-query direction?"),
]

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

def search_cognee(service_url: str, api_key: str, dataset_name: str, query: str):
    url = f"{service_url.rstrip('/')}/api/v1/search"
    payload = {
        "query": query,
        "search_type": "CHUNKS",
        "datasets": [dataset_name]
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"X-Api-Key": api_key, "Content-Type": "application/json", "Accept": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Search failed ({error.code}): {body}") from error

def search_cognee_completion(service_url: str, api_key: str, dataset_name: str, query: str):
    url = f"{service_url.rstrip('/')}/api/v1/search"
    payload = {
        "query": query,
        "search_type": "GRAPH_COMPLETION",
        "datasets": [dataset_name]
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"X-Api-Key": api_key, "Content-Type": "application/json", "Accept": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Completion failed ({error.code}): {body}") from error

def main():
    load_env()
    service_url = os.environ.get("COGNEE_BASE_URL")
    api_key = os.environ.get("COGNEE_API_KEY")
    dataset_name = read_dataset_name()
    if not service_url or not api_key:
        print("COGNEE_BASE_URL or COGNEE_API_KEY missing.")
        sys.exit(1)

    answers = []
    for key, question in EXAMPLE_PROMPTS:
        print(f"Fetching chunks for '{key}'...")
        start_time = time.time()
        results_chunks = search_cognee(service_url, api_key, dataset_name, question)
        print(f"Fetching completion for '{key}'...")
        results_completion = search_cognee_completion(service_url, api_key, dataset_name, question)
        duration_ms = int((time.time() - start_time) * 1000)
        
        # Parse CHUNKS response
        recall = []
        if isinstance(results_chunks, list):
            for res_item in results_chunks:
                # API returns list of dicts with dataset_id and search_result array
                for chunk in res_item.get("search_result", []):
                    if isinstance(chunk, dict) and "text" in chunk:
                        recall.append({
                            "source": "graph",
                            "kind": "chunk",
                            "search_type": "CHUNKS",
                            "text": chunk.get("text", ""),
                            "dataset_name": dataset_name,
                            "dataset_id": res_item.get("dataset_id"),
                            "metadata": chunk.get("metadata", {}),
                            "raw": chunk,
                            "structured": None
                        })
        
        # Parse GRAPH_COMPLETION response
        answer_text = "Answer not generated."
        if isinstance(results_completion, list):
            for res_item in results_completion:
                for item in res_item.get("search_result", []):
                    if isinstance(item, str):
                        answer_text = item
                        break
                if answer_text != "Answer not generated.":
                    break
        
        payload = {
            "queryId": f"corpus-{key}-{int(time.time())}",
            "queryKey": key,
            "question": question,
            "answer": answer_text,
            "responseTimeMs": duration_ms,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": "cognee-cloud",
            "datasetName": dataset_name,
            "raw": {
                "recall": recall
            }
        }
        answers.append(payload)

    out_file = DEFAULT_OUTPUT
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(answers, indent=2, ensure_ascii=False), "utf-8")
    print(f"Wrote {len(answers)} answers to {out_file}")

if __name__ == "__main__":
    main()
