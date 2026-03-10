# Academium Load Testing Guide

## Quick Start

### 1. Install k6

**macOS:**
```bash
brew install k6
```

**Windows:**
```bash
choco install k6
# or download from https://grafana.com/docs/k6/latest/get-started/installation/
```

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### 2. Get Your Published App URL

Your published URL looks like: `https://your-app-name.replit.app`

### 3. Get Your Session Cookie (for authenticated tests)

1. Open your published app in a browser
2. Log in as a student or professor
3. Open browser DevTools (F12 or Cmd+Shift+I)
4. Go to **Application** tab > **Cookies** > your app URL
5. Find the cookie named `connect.sid`
6. Copy its **Value** (it will be a long string like `s%3Aabc123...`)

### 4. Get a Scenario ID (for agent stress test)

1. While logged in, open DevTools > **Network** tab
2. Navigate to the homepage or student dashboard
3. Look for the request to `/api/scenarios`
4. In the response, find an `id` field from any scenario (it will be a number or UUID)

---

## Running the Tests

### Test 1: Browsing Only (no authentication needed)

Tests how well the server handles page loads from many users:

```bash
k6 run \
  --env BASE_URL=https://your-app.replit.app \
  --env SCENARIO=browsing \
  --env STUDENTS=20 \
  --env DURATION=1m \
  k6-load-test.js
```

### Test 2: API Load (needs session cookie)

Tests authenticated API endpoints (listing scenarios, sessions):

```bash
k6 run \
  --env BASE_URL=https://your-app.replit.app \
  --env SESSION_COOKIE="s%3Ayour-cookie-value-here" \
  --env SCENARIO=api \
  --env STUDENTS=20 \
  --env DURATION=1m \
  k6-load-test.js
```

### Test 3: Agent Stress Test (needs session cookie + scenario ID)

The critical test. Simulates students submitting decisions to the AI agents simultaneously:

```bash
k6 run \
  --env BASE_URL=https://your-app.replit.app \
  --env SESSION_COOKIE="s%3Ayour-cookie-value-here" \
  --env SCENARIO_ID="your-scenario-id" \
  --env SCENARIO=agents \
  --env STUDENTS=20 \
  --env DURATION=2m \
  k6-load-test.js
```

### Test 4: Full Combined Test (all three at once)

```bash
k6 run \
  --env BASE_URL=https://your-app.replit.app \
  --env SESSION_COOKIE="s%3Ayour-cookie-value-here" \
  --env SCENARIO_ID="your-scenario-id" \
  --env STUDENTS=20 \
  --env DURATION=2m \
  k6-load-test.js
```

---

## Understanding Results

After the test runs, you will see a summary like this:

```
ACADEMIUM LOAD TEST RESULTS
============================================================
{
  "results": {
    "page_load": { "avg": "120ms", "p95": "350ms" },
    "api": { "avg": "80ms", "p95": "200ms" },
    "agents": {
      "avg": "8.2s",       <-- Average AI response time
      "p95": "25.3s",      <-- 95% of requests completed within this time
      "error_rate": "2%",  <-- Percentage of failed AI requests
      "timeouts": 0        <-- Number of requests that timed out (>90s)
    }
  }
}
```

### What Good Results Look Like

| Metric | Good | Acceptable | Concerning |
|--------|------|-----------|------------|
| Page load p95 | < 1s | 1-3s | > 3s |
| API p95 | < 500ms | 500ms-2s | > 2s |
| Agent avg | < 10s | 10-30s | > 30s |
| Agent error rate | < 1% | 1-5% | > 10% |
| Agent timeouts | 0 | 1-2 | > 3 |

### What the Agent Times Mean for Students

- **Under 10 seconds**: Students see a brief "thinking" animation. Good experience.
- **10-30 seconds**: Students wait a bit but the animation keeps them engaged. Acceptable for a classroom.
- **30-60 seconds**: Students might think something is broken. Consider reducing class size or staggering submissions.
- **Over 60 seconds / timeouts**: Too many students at once. Split into smaller groups.

---

## Recommended Test Progression

1. **Smoke test** (2 students): Verify the script works
   ```bash
   k6 run --env STUDENTS=2 --env DURATION=30s ...
   ```

2. **Small class** (10 students): Typical tutorial group
   ```bash
   k6 run --env STUDENTS=10 --env DURATION=2m ...
   ```

3. **Full class** (20-25 students): Standard classroom
   ```bash
   k6 run --env STUDENTS=20 --env DURATION=3m ...
   ```

4. **Stress test** (40-50 students): Multiple classes or worst case
   ```bash
   k6 run --env STUDENTS=50 --env DURATION=5m ...
   ```

---

## Important Notes

- **Session cookie expiration**: The session cookie may expire after some time. If you see authentication errors, get a fresh cookie.
- **Test sessions are real**: The agent stress test creates real simulation sessions in your database. You may want to clean these up after testing.
- **AI costs**: Each simulated student decision triggers real AI API calls. A full test with 20 students x 3 decisions = 60 AI interactions.
- **Run from your laptop**: Always run k6 from your own computer, not from the Replit server. Running load tests from the same server that hosts the app gives inaccurate results.
- **Rate limiting**: The app has a built-in rate limiter (8 concurrent AI requests per provider). If you see 429 errors or slow responses during agent tests, it means the AI providers are at capacity.
