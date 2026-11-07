const axios = require('axios');

class CaptchaSolver {
    static async getFullToken(sitekey, rqdata, openRouterKey) {
        try {
            console.log(`[Captcha-Python] Requesting AI solve for sitekey: ${sitekey}`);

            // 1. Trigger the Python API to orchestrate the headless browser
            const discordUrl = 'https://discord.com';
            const reqUrl = `http://localhost:5001/solve?url=${encodeURIComponent(discordUrl)}&sitekey=${encodeURIComponent(sitekey)}&rqdata=${encodeURIComponent(rqdata || '')}&apikey=${encodeURIComponent(openRouterKey || '')}`;

            console.log(`[Captcha-Python] Hitting local AI API: ${reqUrl}`);
            const initResponse = await axios.get(reqUrl).catch(e => e.response);

            if (!initResponse || initResponse.status !== 200 || !initResponse.data.taskid) {
                console.error(`[Captcha-Python] Failed to start AI solver or missing taskid.`);
                return null;
            }

            const taskId = initResponse.data.taskid;
            console.log(`[Captcha-Python] AI Task started! Task ID: ${taskId}`);

            // 2. Poll the Python API every 2 seconds until it finishes
            let attempt = 0;
            const maxAttempts = 60; // 2 mins timeout

            while (attempt < maxAttempts) {
                attempt++;
                await new Promise(r => setTimeout(r, 2000));

                const statusRes = await axios.get(`http://localhost:5001/task/${taskId}`).catch(e => e.response);
                if (!statusRes || statusRes.status !== 200) {
                    console.error(`[Captcha-Python] Error checking task status.`);
                    continue; // Skip this iteration, it might be a temporary hiccup
                }

                const data = statusRes.data;
                // e.g. {"status": "processing"} or {"status": "success", "token": "...", "cookies": {...}} or {"status": "error"}

                if (data.status === "processing") {
                    console.log(`[Captcha-Python] AI is thinking... (Attempt ${attempt}/${maxAttempts})`);
                } else if (data.status === "success") {
                    const solvedToken = data.token || data.uuid;
                    if (!solvedToken) {
                        console.error(`[Captcha-Python] Success reported but token is missing! Data:`, JSON.stringify(data));
                        return null;
                    }
                    console.log(`[Captcha-Python] AI SOLVED IT! Token: ${solvedToken.substring(0, 15)}...`);
                    return solvedToken;
                } else if (data.status === "error") {
                    console.error(`[Captcha-Python] AI reported error:`, JSON.stringify(data));
                    return null;
                }
            }

            console.error(`[Captcha-Python] Timed out waiting for AI to solve.`);
            return null;

        } catch (e) {
            console.error(`[Captcha-Python] Core Error:`, e.message);
            return null;
        }
    }
}

module.exports = CaptchaSolver;
