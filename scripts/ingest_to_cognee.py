import json
import os
import uuid
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from typing import Any
from tqdm import tqdm

try:
    from dotenv import load_dotenv
    # Knexus uses .env.local for local development
    load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")
except ImportError:
    pass

import cognee

BATCH_SIZE = 10
DATA_DIR = Path(__file__).resolve().parent.parent / "public" / "seed"
RUNS_FILE = DATA_DIR / "processing_runs.json"

def event_to_memory_text(event: dict[str, Any]) -> str:
    content = "\n\n".join(filter(bool, [event.get("title", ""), event.get("text", "")]))
    return "\n".join([
        f"Source event id: {event.get('id')}",
        f"Source app: {event.get('app') or event.get('sourceApp')}",
        f"Source path: {event.get('sourcePath') or event.get('sourceUrl')}",
        f"Actor: {event.get('peopleIds')}",
        f"Occurred at: {event.get('occurredAt')}",
        "Content:",
        content,
    ])

import io

class NamedBytesIO(io.BytesIO):
    def __init__(self, name: str, *args, **kwargs):
        self.name = name
        super().__init__(*args, **kwargs)

async def process_batch(client: Any, batch_items: list[dict[str, Any]], dataset_name: str, batch_index: int) -> str:
    # 1. Format for Cognee
    memories = [event_to_memory_text(event) for event in batch_items]
    file_content = "\n\n---\n\n".join(memories).encode("utf-8")
    
    # 2. Fake a file object with a proper name to bypass the SDK's hardcoded "data.txt"
    f = NamedBytesIO(f"batch_{batch_index:03d}.txt", file_content)
    
    # 3. Remote API upload via SDK
    await client.add([f], dataset_name=dataset_name)
    
    # 4. Create a Processing Run record for the UI
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    now = int(datetime.now(timezone.utc).timestamp() * 1000)
    run_record = {
        "id": run_id,
        "status": "completed",
        "createdAt": now,
        "updatedAt": now,
        "completedAt": now,
        "eventIds": [event["id"] for event in batch_items],
        "items": [
            {
                "id": event["id"],
                "sourceApp": event.get("app") or event.get("sourceApp"),
                "actorId": event.get("peopleIds", [])[0] if event.get("peopleIds") else "system",
                "occurredAt": event.get("occurredAt"),
                "action": "created",
                "title": event.get("title"),
                "sourceUrl": event.get("sourcePath") or event.get("sourceUrl")
            }
            for event in batch_items
        ]
    }
    return run_id, run_record

async def main():
    service_url = os.environ.get("COGNEE_BASE_URL", "https://api.cognee.ai")
    api_key = os.environ.get("COGNEE_API_KEY")
    
    if not api_key:
        print("Error: COGNEE_API_KEY not set.")
        return
        
    client = await cognee.serve(url=service_url, api_key=api_key)

    print("Skipping clearing all existing datasets to save time...")
    # await client.forget(everything=True)

    manifest_path = DATA_DIR / "manifest.json"
    if not manifest_path.exists():
        print(f"Dataset not found at {DATA_DIR}")
        return

    manifest = json.loads(manifest_path.read_text("utf-8"))
    dataset_name = os.environ.get("COGNEE_DATASET_NAME", "knexus-activity")
    
    all_events = []
    
    # Load all events
    print("Loading events from pages...")
    for route_name, route_data in manifest.get("routes", {}).items():
        page_count = route_data.get("pageCount", 1)
        for page_idx in range(1, page_count + 1):
            page_path = DATA_DIR / f"{route_name}/page-{page_idx:04d}.json"
            if page_path.exists():
                events = json.loads(page_path.read_text("utf-8"))
                all_events.extend(events)
                
    # Sort events organically
    all_events.sort(key=lambda x: x.get("occurredAt", 0), reverse=True)
    processed_ids = set()
    runs = {}
    if RUNS_FILE.exists():
        runs = json.loads(RUNS_FILE.read_text("utf-8"))
        for run in runs.values():
            if run.get("status") == "completed":
                for item in run.get("items", []):
                    processed_ids.add(item["id"])
                    
    unprocessed_events = [e for e in all_events if e["id"] not in processed_ids]
    print(f"Total events: {len(all_events)} ({len(unprocessed_events)} unprocessed)")
    all_events = unprocessed_events
    
    # Process in batches
    try:
        batch_index = 1
        for i in tqdm(range(0, len(all_events), BATCH_SIZE), desc="Ingesting Batches"):
            batch = all_events[i:i + BATCH_SIZE]
            run_id, run_record = await process_batch(client, batch, dataset_name, batch_index)
            runs[run_id] = run_record
            # Save the runs for the UI after each batch to ensure crash resumability
            RUNS_FILE.write_text(json.dumps(runs, indent=2), "utf-8")
            batch_index += 1
            
        print(f"Generated {len(runs)} processing runs for the UI at {RUNS_FILE}")
        
        if len(all_events) > 0:
            print("Triggering graph processing (cognify) on the cloud...")
            await client.cognify(datasets=[dataset_name])
            print("Cognify triggered successfully!")
            
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())

if __name__ == "__main__":
    asyncio.run(main())
