import asyncio
import os
import cognee
from dotenv import load_dotenv

load_dotenv(".env.local")
async def main():
    service_url = os.environ.get("COGNEE_BASE_URL")
    api_key = os.environ.get("COGNEE_API_KEY")
    client = await cognee.serve(url=service_url, api_key=api_key)
    print("Calling forget(everything=True)...")
    await client.forget(everything=True)
    print("Forgot everything successfully!")

asyncio.run(main())
