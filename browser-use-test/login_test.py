from browser_use import Agent, Browser
from browser_use import ChatAnthropic
from dotenv import load_dotenv
import asyncio

load_dotenv(dotenv_path="../.env")


async def main():
    browser = Browser(headless=False)

    agent = Agent(
        task="""
        1. Go to https://app.promptlycms.com/login
        2. Enter email: test@promptlycms.com
        3. Enter password: Testing123
        4. Click the Sign In button
        5. Wait for the page to load and confirm you are logged in by checking the URL contains /dashboard or seeing the main app interface
        6. Take a screenshot to confirm
        """,
        llm=ChatAnthropic(model="claude-sonnet-4-20250514"),
        browser=browser,
        calculate_cost=True,
    )

    history = await agent.run(max_steps=20)

    print("\n--- Results ---")
    print(f"Done: {history.is_done()}")
    print(f"Success: {history.is_successful()}")
    print(f"Final URL(s): {history.urls()[-3:]}")
    print(f"Steps: {history.number_of_steps()}")
    print(f"Duration: {history.total_duration_seconds():.1f}s")
    print(f"Errors: {[e for e in history.errors() if e]}")
    if history.usage:
        print(f"\n--- Token Usage ---")
        print(f"Usage: {history.usage}")


if __name__ == "__main__":
    asyncio.run(main())
