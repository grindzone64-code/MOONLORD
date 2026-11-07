import asyncio
import time

class FrameUtils:
    @staticmethod
    async def find_frame(page, selector_checker, timeout=30):
        start = time.time()
        while time.time() - start < timeout:
            for iframe in await page.query_selector_all("iframe"):
                src = await iframe.get_attribute("src")
                if not src or "hcaptcha.com" not in src:
                    continue
                frame = await iframe.content_frame()
                if not frame:
                    continue
                if await selector_checker(frame):
                    return frame
            await asyncio.sleep(0.2)
        return None

    @staticmethod
    async def click_checkbox(page):
        async def checker(frame):
            return await frame.evaluate(
                "() => !!document.querySelector('div#checkbox')"
            )

        frame = await FrameUtils.find_frame(page, checker)
        if not frame:
            return False

        await frame.evaluate("""
            const cb = document.querySelector('div#checkbox');
            if (cb && cb.getAttribute('aria-checked') === 'false') {
                cb.click();
            }
        """)
        return True

    @staticmethod
    async def find_challenge_frame(page):
        async def checker(frame):
            return await frame.evaluate(
                "() => !!document.querySelector('#menu-info')"
            )

        return await FrameUtils.find_frame(page, checker)

    @staticmethod
    async def solve_accessibility(frame, ai):
        # Click the 3-dot menu button
        await frame.wait_for_selector("#menu-info", timeout=20_000)
        await asyncio.sleep(0.5 + (0.5 * (hash(str(time.time())) % 2))) # Random jitter
        await frame.locator("#menu-info").click()
        await asyncio.sleep(0.8) # Wait for menu to appear

        # Click "Accessibility Challenge"
        # The user's image shows the text as "Accessibility Challenge"
        # We try to find it by text if the ID fails or is unstable
        try:
            challenge_button = frame.locator("text='Accessibility Challenge'")
            if await challenge_button.count() > 0:
                await challenge_button.click()
            else:
                await frame.locator("#text_challenge").click()
        except Exception:
            # Fallback to selector if text locator fails
            pass

        await asyncio.sleep(1.5) # Wait for challenge content to load

        last_question = None
        start_time = time.time()

        while True:
            if frame.is_detached():
                break

            try:
                # Find the question prompt
                question_el = await frame.query_selector('[id^="prompt-text"], .challenge-container .prompt-text')
                if not question_el:
                    await asyncio.sleep(0.5)
                    continue

                question = (await question_el.inner_text()).strip()
                if not question or question == last_question:
                    await asyncio.sleep(0.5)
                    continue

                print(f"[Solver] Question: {question}")
                last_question = question
                answer = await ai.answer(question)
                print(f"[Solver] AI Answer: {answer}")

                # Find the input box and type naturally
                input_el = await frame.query_selector("div.challenge-input input, input[type='text']")
                if input_el:
                    await input_el.click()
                    await asyncio.sleep(0.3)
                    await input_el.fill("") # Clear if needed
                    await input_el.type(answer, delay=100) # Type with delay
                    await asyncio.sleep(0.5)

                # Click submit
                submit = await frame.query_selector(".button-submit, .challenge-container .submit")
                if submit:
                    await submit.click()
                    await asyncio.sleep(1.0)
            except Exception as e:
                print(f"[Solver] Interaction error: {e}")
                break

        return time.time() - start_time
