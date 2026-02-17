/**
 * Scenario+ Load Test Script for k6
 * 
 * Tests three scenarios:
 *   1. Browsing load — unauthenticated page/asset requests
 *   2. API load — authenticated API calls (scenario listing, session reads)
 *   3. Agent stress — authenticated AI turn submissions (the real bottleneck)
 *
 * Prerequisites:
 *   - Install k6: https://grafana.com/docs/k6/latest/get-started/installation/
 *   - Set your published app URL below
 *   - For authenticated tests, set a valid session cookie (see INSTRUCTIONS.md)
 *
 * Usage:
 *   # Quick smoke test (2 users, 30 seconds)
 *   k6 run --env BASE_URL=https://your-app.replit.app k6-load-test.js
 *
 *   # Classroom simulation (20 students, 2 minutes)
 *   k6 run --env BASE_URL=https://your-app.replit.app --env STUDENTS=20 --env DURATION=2m k6-load-test.js
 *
 *   # Only run browsing test (no auth needed)
 *   k6 run --env BASE_URL=https://your-app.replit.app --env SCENARIO=browsing k6-load-test.js
 *
 *   # Only run agent stress test
 *   k6 run --env BASE_URL=https://your-app.replit.app --env SCENARIO=agents --env STUDENTS=20 k6-load-test.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

// ============================================================
// CONFIGURATION — UPDATE THESE VALUES
// ============================================================

const BASE_URL = __ENV.BASE_URL || "https://YOUR-APP-NAME.replit.app";

// Session cookie for authenticated tests.
// How to get: log in via browser, DevTools > Application > Cookies > copy "connect.sid" value
const SESSION_COOKIE = __ENV.SESSION_COOKIE || "";

// A valid scenario ID for agent stress test.
// Find by visiting /api/scenarios while logged in
const TEST_SCENARIO_ID = __ENV.SCENARIO_ID || "";

// ============================================================
// CUSTOM METRICS
// ============================================================

const pageLoadTime = new Trend("page_load_time", true);
const apiResponseTime = new Trend("api_response_time", true);
const agentResponseTime = new Trend("agent_response_time", true);
const agentErrorRate = new Rate("agent_error_rate");
const totalRequests = new Counter("total_requests");
const agentTimeouts = new Counter("agent_timeouts");

// ============================================================
// TEST OPTIONS
// ============================================================

const students = parseInt(__ENV.STUDENTS || "5");
const duration = __ENV.DURATION || "1m";
const scenario = __ENV.SCENARIO || "all";

export const options = {
  scenarios: {},
  thresholds: {
    page_load_time: ["p(95)<3000"],
    api_response_time: ["p(95)<2000"],
    agent_response_time: ["p(95)<60000"],
    agent_error_rate: ["rate<0.1"],
    http_req_failed: ["rate<0.05"],
  },
};

if (scenario === "all" || scenario === "browsing") {
  options.scenarios.browsing = {
    executor: "constant-vus",
    vus: Math.max(2, Math.floor(students / 2)),
    duration: duration,
    exec: "browsingTest",
    tags: { test_type: "browsing" },
  };
}

if (scenario === "all" || scenario === "api") {
  options.scenarios.api_load = {
    executor: "constant-vus",
    vus: students,
    duration: duration,
    exec: "apiTest",
    startTime: "5s",
    tags: { test_type: "api" },
  };
}

if (scenario === "all" || scenario === "agents") {
  options.scenarios.agent_stress = {
    executor: "ramping-vus",
    startVUs: 1,
    stages: [
      { duration: "15s", target: Math.floor(students / 2) },
      { duration: "30s", target: students },
      { duration: duration, target: students },
      { duration: "10s", target: 0 },
    ],
    exec: "agentStressTest",
    startTime: "10s",
    tags: { test_type: "agents" },
  };
}

// ============================================================
// HELPERS
// ============================================================

function getRequestParams(extraOptions) {
  const params = {
    headers: {},
  };

  if (SESSION_COOKIE) {
    params.headers["Cookie"] = `connect.sid=${SESSION_COOKIE}`;
  }
  params.headers["Content-Type"] = "application/json";

  if (extraOptions) {
    Object.assign(params, extraOptions);
  }

  return params;
}

function randomDecision() {
  const decisions = [
    "Voy a priorizar la calidad del producto y retrasar el lanzamiento dos semanas para corregir los bugs criticos. Considero que el impacto en la reputacion seria peor si lanzamos con errores.",
    "Propongo reducir el alcance del proyecto en un 20% para cumplir con la fecha de entrega. Los features menos criticos pueden lanzarse en la siguiente version.",
    "Necesitamos contratar dos desarrolladores temporales para reforzar el equipo. El costo adicional se justifica por el valor del proyecto para la empresa.",
    "Voy a ser transparente con el cliente sobre los desafios y negociar una extension del plazo de 10 dias habiles. La honestidad fortalece la relacion comercial.",
    "Implementare turnos rotativos de trabajo intensivo pero con compensacion adicional para el equipo, asegurando que nadie trabaje mas de 10 horas al dia.",
    "Propongo un lanzamiento parcial con las funcionalidades core y el resto en una actualizacion posterior. Asi mostramos progreso sin comprometer calidad.",
    "Voy a reasignar recursos del proyecto B para apoyar este proyecto temporalmente. El impacto en proyecto B es menor porque esta en fase de mantenimiento.",
    "Sugiero invertir en automatizacion de pruebas ahora para acelerar las entregas futuras. Es una inversion a mediano plazo que reducira costos.",
    "Convoco una reunion de emergencia con todos los stakeholders para realinear expectativas y prioridades. Necesitamos consenso antes de actuar.",
    "Decido invertir el 15% del presupuesto restante en capacitacion del equipo para mejorar la productividad y reducir errores en el proceso.",
  ];
  return decisions[Math.floor(Math.random() * decisions.length)];
}

const MAX_REVISION_RETRIES = 3;

// ============================================================
// SCENARIO 1: BROWSING TEST (no auth required)
// Simulates students loading public pages
// ============================================================

export function browsingTest() {
  group("Page Loads", () => {
    // Homepage (serves the SPA index.html via Vite)
    let res = http.get(`${BASE_URL}/`);
    totalRequests.add(1);
    pageLoadTime.add(res.timings.duration);
    check(res, {
      "homepage loads (200)": (r) => r.status === 200,
      "homepage has HTML content": (r) => r.body && r.body.includes("<div id="),
    });
    sleep(1 + Math.random() * 2);

    // Explore page (SPA route — served as same index.html)
    res = http.get(`${BASE_URL}/explore`);
    totalRequests.add(1);
    pageLoadTime.add(res.timings.duration);
    check(res, {
      "explore page loads (200)": (r) => r.status === 200,
    });
    sleep(1 + Math.random() * 2);

    // Simulation start page (SPA route)
    res = http.get(`${BASE_URL}/simulation/start/test`);
    totalRequests.add(1);
    pageLoadTime.add(res.timings.duration);
    check(res, {
      "simulation page loads (200)": (r) => r.status === 200,
    });
    sleep(0.5 + Math.random());

    // Auth check endpoint (lightweight API call every page does)
    res = http.get(`${BASE_URL}/api/auth/user`);
    totalRequests.add(1);
    apiResponseTime.add(res.timings.duration);
    check(res, {
      "auth check responds": (r) => r.status === 200 || r.status === 401,
    });
    sleep(0.5);
  });
}

// ============================================================
// SCENARIO 2: API TEST (requires auth)
// Simulates authenticated API usage
// ============================================================

export function apiTest() {
  if (!SESSION_COOKIE) {
    console.warn("SESSION_COOKIE not set - skipping API test. See INSTRUCTIONS.md");
    sleep(5);
    return;
  }

  const params = getRequestParams();

  group("API Calls", () => {
    // Check auth status
    let res = http.get(`${BASE_URL}/api/auth/user`, params);
    totalRequests.add(1);
    apiResponseTime.add(res.timings.duration);
    const isAuthed = check(res, {
      "auth check succeeds (200)": (r) => r.status === 200,
      "user data returned": (r) => {
        try { return JSON.parse(r.body).id !== undefined; } catch { return false; }
      },
    });

    if (!isAuthed) {
      console.error("Authentication failed - check SESSION_COOKIE value");
      sleep(5);
      return;
    }
    sleep(0.5);

    // List scenarios
    res = http.get(`${BASE_URL}/api/scenarios`, params);
    totalRequests.add(1);
    apiResponseTime.add(res.timings.duration);
    check(res, {
      "scenarios list succeeds (200)": (r) => r.status === 200,
      "scenarios is array": (r) => {
        try { return Array.isArray(JSON.parse(r.body)); } catch { return false; }
      },
    });
    sleep(1);

    // Get a specific scenario (if we have the ID)
    if (TEST_SCENARIO_ID) {
      res = http.get(`${BASE_URL}/api/scenarios/${TEST_SCENARIO_ID}`, params);
      totalRequests.add(1);
      apiResponseTime.add(res.timings.duration);
      check(res, {
        "scenario detail succeeds": (r) => r.status === 200,
      });
      sleep(0.5);
    }

    // List user sessions
    res = http.get(`${BASE_URL}/api/simulations/sessions`, params);
    totalRequests.add(1);
    apiResponseTime.add(res.timings.duration);
    check(res, {
      "sessions list succeeds (200)": (r) => r.status === 200,
    });
    sleep(1 + Math.random() * 2);
  });
}

// ============================================================
// SCENARIO 3: AGENT STRESS TEST (requires auth + scenario ID)
// Simulates students going through the full 3-decision + reflection flow
// ============================================================

export function agentStressTest() {
  if (!SESSION_COOKIE || !TEST_SCENARIO_ID) {
    console.warn("SESSION_COOKIE and SCENARIO_ID required for agent test. See INSTRUCTIONS.md");
    sleep(5);
    return;
  }

  const params = getRequestParams({ timeout: "120s" });

  group("Agent Stress - Full Simulation Flow", () => {
    // 1. Start a new simulation session
    let res = http.post(
      `${BASE_URL}/api/simulations/start`,
      JSON.stringify({ scenarioId: TEST_SCENARIO_ID }),
      params
    );
    totalRequests.add(1);

    const startOk = check(res, {
      "simulation started (201)": (r) => r.status === 201,
    });

    if (!startOk) {
      console.error(`Failed to start simulation: ${res.status} - ${res.body}`);
      agentErrorRate.add(1);
      sleep(3);
      return;
    }

    let sessionData;
    try {
      sessionData = JSON.parse(res.body);
    } catch {
      console.error("Invalid JSON from start endpoint");
      agentErrorRate.add(1);
      sleep(3);
      return;
    }

    const sessionId = sessionData.sessionId;
    let revisionAttempts = 0;
    sleep(1 + Math.random());

    // 2. Submit 3 decisions (the core simulation loop)
    for (let decision = 1; decision <= 3; decision++) {
      let accepted = false;
      revisionAttempts = 0;

      // Loop to handle depth revision requests (AI may ask for more detail)
      while (!accepted && revisionAttempts <= MAX_REVISION_RETRIES) {
        const decisionText = revisionAttempts === 0
          ? randomDecision()
          : randomDecision() + " Ademas, considero los riesgos a largo plazo y el impacto en todos los stakeholders.";

        const payload = JSON.stringify({
          input: decisionText,
          revisionAttempts: revisionAttempts,
        });

        console.log(`VU ${__VU} | Decision ${decision}/3 (attempt ${revisionAttempts + 1}): "${decisionText.substring(0, 50)}..."`);

        res = http.post(
          `${BASE_URL}/api/simulations/${sessionId}/turn`,
          payload,
          params
        );

        totalRequests.add(1);
        agentResponseTime.add(res.timings.duration);

        if (res.status !== 200) {
          agentErrorRate.add(1);
          if (res.status === 503 || res.status === 429) {
            console.warn(`VU ${__VU} | Decision ${decision} got ${res.status} (rate limited/overloaded) after ${(res.timings.duration / 1000).toFixed(1)}s`);
          } else if (res.timings.duration >= 90000) {
            agentTimeouts.add(1);
            console.error(`VU ${__VU} | Decision ${decision} timed out after ${(res.timings.duration / 1000).toFixed(1)}s`);
          } else {
            console.error(`VU ${__VU} | Decision ${decision} failed: ${res.status}`);
          }
          sleep(3);
          break; // Move on to next decision
        }

        // Parse response to check if revision is needed
        let turnData;
        try {
          turnData = JSON.parse(res.body);
        } catch {
          agentErrorRate.add(1);
          break;
        }

        if (turnData.requiresRevision) {
          // AI wants more depth — retry with enhanced answer
          revisionAttempts++;
          console.log(`VU ${__VU} | Decision ${decision} needs revision (attempt ${revisionAttempts})`);
          sleep(2 + Math.random() * 2); // Think time before revision
          continue;
        }

        // Decision accepted
        accepted = true;
        agentErrorRate.add(0);

        const hasNarrative = turnData.narrative && turnData.narrative.text;
        const hasIndicators = turnData.indicatorDeltas && Object.keys(turnData.indicatorDeltas).length > 0;

        check(res, {
          [`decision ${decision} has narrative`]: () => !!hasNarrative,
          [`decision ${decision} has indicator changes`]: () => !!hasIndicators,
          [`decision ${decision} under 30s`]: () => res.timings.duration < 30000,
        });

        console.log(`VU ${__VU} | Decision ${decision} completed in ${(res.timings.duration / 1000).toFixed(1)}s`);
      }

      // Simulate student reading the narrative + thinking about next decision
      sleep(3 + Math.random() * 5);
    }

    // 3. Submit reflection (Step 4)
    const reflectionText = "He aprendido que las decisiones empresariales siempre tienen trade-offs y que es importante considerar multiples perspectivas antes de actuar. Lo que haria distinto es consultar mas con el equipo antes de tomar decisiones rapidas.";

    res = http.post(
      `${BASE_URL}/api/simulations/${sessionId}/turn`,
      JSON.stringify({ input: reflectionText, revisionAttempts: 0 }),
      params
    );
    totalRequests.add(1);
    agentResponseTime.add(res.timings.duration);

    check(res, {
      "reflection submitted (200)": (r) => r.status === 200,
    });

    sleep(1);

    // 4. Fetch final results
    res = http.get(`${BASE_URL}/api/simulations/${sessionId}`, params);
    totalRequests.add(1);
    apiResponseTime.add(res.timings.duration);
    check(res, {
      "session results accessible (200)": (r) => r.status === 200,
    });

    res = http.get(`${BASE_URL}/api/simulations/${sessionId}/history`, params);
    totalRequests.add(1);
    apiResponseTime.add(res.timings.duration);
    check(res, {
      "turn history accessible (200)": (r) => r.status === 200,
    });

    sleep(2);
  });
}

// ============================================================
// SUMMARY HANDLER
// ============================================================

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    config: {
      base_url: BASE_URL,
      virtual_users: students,
      duration: duration,
      scenario: scenario,
    },
    results: {
      total_requests: data.metrics.total_requests ? data.metrics.total_requests.values.count : 0,
      http_failures: data.metrics.http_req_failed
        ? `${(data.metrics.http_req_failed.values.rate * 100).toFixed(1)}%`
        : "0%",
    },
  };

  if (data.metrics.page_load_time) {
    summary.results.page_load = {
      avg: `${data.metrics.page_load_time.values.avg.toFixed(0)}ms`,
      p95: `${data.metrics.page_load_time.values["p(95)"].toFixed(0)}ms`,
      max: `${data.metrics.page_load_time.values.max.toFixed(0)}ms`,
    };
  }

  if (data.metrics.api_response_time) {
    summary.results.api = {
      avg: `${data.metrics.api_response_time.values.avg.toFixed(0)}ms`,
      p95: `${data.metrics.api_response_time.values["p(95)"].toFixed(0)}ms`,
      max: `${data.metrics.api_response_time.values.max.toFixed(0)}ms`,
    };
  }

  if (data.metrics.agent_response_time) {
    summary.results.agents = {
      avg: `${(data.metrics.agent_response_time.values.avg / 1000).toFixed(1)}s`,
      p95: `${(data.metrics.agent_response_time.values["p(95)"] / 1000).toFixed(1)}s`,
      max: `${(data.metrics.agent_response_time.values.max / 1000).toFixed(1)}s`,
      error_rate: data.metrics.agent_error_rate
        ? `${(data.metrics.agent_error_rate.values.rate * 100).toFixed(1)}%`
        : "0%",
      timeouts: data.metrics.agent_timeouts ? data.metrics.agent_timeouts.values.count : 0,
    };
  }

  console.log("\n" + "=".repeat(60));
  console.log("  SCENARIO+ LOAD TEST RESULTS");
  console.log("=".repeat(60));
  console.log(JSON.stringify(summary, null, 2));
  console.log("=".repeat(60) + "\n");

  return {
    stdout: JSON.stringify(summary, null, 2),
    "load-test-results.json": JSON.stringify(summary, null, 2),
  };
}
