/**
 * Academium Canonical Case Generator
 * 
 * STRUCTURE LOCKED for POC v1.0
 * See server/agents/constants.ts for version roadmap.
 * 
 * Any modifications to the canonical structure require:
 * 1. Explicit documentation of the change
 * 2. Version tag update (v2.x, v3.x)
 * 3. Backward compatibility where possible
 */

import type { 
  GeneratedScenarioData,
  InitialState,
  KPIs,
  Rubric,
  DecisionPoint,
  Indicator,
  CaseFramework
} from "@shared/schema";
import { getCanonicalKPIs } from "@shared/schema";
import { generateChatCompletion } from "../openai";
import { POC_VERSION, STRUCTURE_LOCK_NOTICE, DEFAULT_DECISIONS, MIN_DECISIONS, MAX_DECISIONS } from "./constants";
import { sanitizeFrameworks, mergeRegeneratedKeywords } from "./frameworkKeywordSanitizer";

/**
 * Phase 1b: lightweight language-leakage detector. Returns the share of
 * "off-language" tokens across the user-facing strings in a generated case.
 * Numerals and short tokens (<3 chars) are ignored. Stopword presence is the
 * only signal — sufficient to flag obvious leaks (e.g. Spanish chunks inside
 * an English case) without false-positives on brand names.
 */
function offLanguageRatio(parsed: any, target: "es" | "en"): number {
  if (!parsed || typeof parsed !== "object") return 0;
  const ES_STOPWORDS = new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "y", "o", "que", "en", "para", "por", "con", "es", "son", "se", "su", "sus", "lo", "como", "pero", "más", "este", "esta", "estos", "estas", "ser", "muy", "también", "sobre", "entre", "todo", "todos", "cada", "cuando", "donde", "porque", "qué", "cuál", "tiene", "tienen", "hay", "fue", "fueron", "será", "serán", "puede", "pueden", "debe", "deben", "después", "antes"]);
  const EN_STOPWORDS = new Set(["the", "and", "or", "of", "to", "in", "on", "for", "with", "is", "are", "was", "were", "be", "been", "being", "by", "as", "at", "from", "this", "that", "these", "those", "an", "a", "but", "not", "no", "if", "then", "than", "which", "who", "whom", "whose", "what", "when", "where", "why", "how", "can", "could", "should", "would", "may", "might", "must", "have", "has", "had", "do", "does", "did", "will", "shall"]);
  const offSet = target === "en" ? ES_STOPWORDS : EN_STOPWORDS;
  const targetSet = target === "en" ? EN_STOPWORDS : ES_STOPWORDS;

  const samples: string[] = [];
  const collect = (v: any) => {
    if (typeof v === "string" && v.trim().length > 0) samples.push(v);
    else if (Array.isArray(v)) v.forEach(collect);
  };
  collect(parsed.title);
  collect(parsed.description);
  collect(parsed.caseContext);
  collect(parsed.coreChallenge);
  collect(parsed.role);
  collect(parsed.objective);
  collect(parsed.timelineContext);
  collect(parsed.industry);
  collect(parsed.keyConstraints);
  collect(parsed.learningObjectives);
  collect(parsed.reflectionPrompt);
  if (Array.isArray(parsed.decisionPoints)) {
    for (const dp of parsed.decisionPoints) {
      collect(dp?.prompt);
      collect(dp?.options);
      collect(dp?.focusCue);
      collect(dp?.thinkingScaffold);
    }
  }
  if (Array.isArray(parsed.indicators)) {
    for (const ind of parsed.indicators) {
      collect(ind?.label);
      collect(ind?.description);
    }
  }
  if (Array.isArray(parsed.frameworks)) {
    for (const fw of parsed.frameworks) {
      collect(fw?.name);
      collect(fw?.domainKeywords);
    }
  }

  let off = 0;
  let on = 0;
  for (const sample of samples) {
    // Keep short stopwords (de, la, el, to, in, an…) — they're the highest-signal language markers.
    const tokens = sample.toLowerCase().replace(/[^a-zA-Z\u00C0-\u024F\s]/g, " ").split(/\s+/).filter(Boolean);
    for (const tok of tokens) {
      if (offSet.has(tok)) off++;
      else if (targetSet.has(tok)) on++;
    }
  }
  const total = off + on;
  if (total === 0) return 0;
  return off / total;
}

function buildCanonicalPromptEs(stepCount: number): string {
  const durationMin = Math.round((stepCount / 3) * 20);
  const durationMax = Math.round((stepCount / 3) * 25);
  return `Eres un ARQUITECTO DE CASOS DE NEGOCIOS CANÓNICOS para Academium, una plataforma de simulación de negocios impulsada por IA para educación universitaria en América Latina.

${STRUCTURE_LOCK_NOTICE}

TU MISIÓN: Crear casos de negocios siguiendo una ESTRUCTURA CANÓNICA ESTRICTA para el POC de febrero (${POC_VERSION}).

=== RESTRICCIONES OBLIGATORIAS (NO MODIFICABLES) ===
- Disciplina: Negocios
- Nivel: Pregrado universitario
- Duración del caso: ${durationMin}-${durationMax} minutos total
- Puntos de decisión: EXACTAMENTE ${stepCount}
- Idioma: TODO en Español (Latinoamericano)
- Estado de evaluación: NO calificado (solo POC)
- Objetivo primario: Flujo, completación y experiencia de toma de decisiones auténtica

=== ESTRUCTURA CANÓNICA DEL CASO ===

SECCIÓN 1 - CONTEXTO DEL CASO (120-180 palabras):
- Tono: Profesional, neutral, real
- Funcional, NO literario
- Cada oración debe apoyar la toma de decisiones
- DEBE incluir:
  * Tipo de organización (empresa, startup, división, etc.)
  * Rol del estudiante (nivel de autoridad explícito)
  * Situación actual o presión
  * Restricción de tiempo o urgencia
  * Razón clara de por qué las decisiones importan AHORA
- NO debe incluir:
  * Historias emocionales
  * Arcos de personajes
  * Resúmenes históricos
  * Explicaciones de teoría académica
  * Pistas "correctas" ocultas

SECCIÓN 2 - DESAFÍO CENTRAL DE NEGOCIOS:
- Un solo desafío principal
- Claramente restringido (presupuesto, tiempo, recursos, incertidumbre)
- Sin jerga técnica excesiva
- Sin dirección "correcta" implícita
- DEBE incluir:
  * Qué está en riesgo
  * Qué NO se puede cambiar
  * Qué es incierto
  * Cómo podría verse el éxito (sin definirlo)

SECCIÓN 3 - DECISIÓN 1 (Decisión de Orientación):
- Formato: Opción múltiple (3-4 opciones)
- Cada opción representa una POSTURA ESTRATÉGICA, no una solución
- REGLA CRÍTICA: NO hay opción correcta ni incorrecta
- Cada opción DEBE ser:
  * Defendible
  * Con lógica racional
  * Llevar a diferentes consecuencias downstream

DECISIONES 2 a ${stepCount - 1} (Decisiones Analíticas):
- Formato: Justificación escrita corta (5-7 líneas)
- Abierta, sin presión de conteo de palabras
- El prompt debe:
  * Preguntar CÓMO y POR QUÉ
  * NUNCA preguntar cuál es la respuesta correcta
  * Fomentar consideración de trade-offs
- Cada decisión debe construir sobre las anteriores progresivamente

DECISIÓN ${stepCount} (Decisión Integrativa Final):
- Formato: Justificación escrita corta
- DEBE forzar síntesis de:
  * Información previa
  * Trade-offs
  * Consecuencias de decisiones anteriores
- La decisión debe sentirse CONSEQUENCIAL
- NO hay resultados de "equilibrio perfecto"
- Ambigüedad realista es alentada

REFLEXIÓN (Ligera):
- UN solo prompt opcional
- Ejemplos:
  * "¿Qué factor influyó más en tus decisiones?"
  * "¿Qué explorarías diferente la próxima vez?"
- NO reflexiones largas, NO ensayos

=== INDICADORES DEL SISTEMA (4 INDICADORES POC) ===
Los indicadores deben reflejar:
1. Moral del equipo (teamMorale) - Estado emocional y compromiso del equipo
2. Salud presupuestaria (budgetHealth) - Salud financiera y disponibilidad de recursos
3. Riesgo operacional (operationalRisk) - Nivel de incertidumbre/peligro operativo
4. Flexibilidad estratégica (strategicFlexibility) - Capacidad de adaptación y opciones estratégicas

⚠️ REGLA CRÍTICA DE COSTO DE OPORTUNIDAD:
Cada decisión DEBE cambiar AL MENOS UN indicador NEGATIVAMENTE.
- No existen decisiones "perfectas" sin consecuencias
- Toda elección implica renunciar a algo

=== TONO DE CONSECUENCIAS Y RETROALIMENTACIÓN ===
- Alentador
- Orientado a mentoría
- NUNCA evaluativo
- NUNCA correctivo
- PROHIBIDO: "Correcto", "Incorrecto", "Mejor", "Óptimo", "Deberías haber..."

=== S7.1 FOCUS CUE (OBLIGATORIO en cada decisión) ===
Cada punto de decisión DEBE incluir un "focusCue" que:
- Destaque 2-3 dimensiones clave (stakeholders, restricciones, trade-offs, riesgos)
- Permanezca NEUTRAL (no guía hacia una decisión específica)
- Sea corto (1-2 líneas o 2-3 bullets)
- Sienta como mentoría ("aquí está cómo enmarcar el problema"), no instrucción

Formatos aceptables para focusCue:
- Una oración: "Antes de decidir, considera el impacto en el equipo, los plazos y el riesgo."
- Bullets: "Enfócate en: equipo / tiempo / riesgo."
- Enmarcado breve: "La tensión principal aquí es equilibrar prioridades bajo presión."

IMPORTANTE: El focusCue NUNCA implica una respuesta correcta.

=== S5.1 THINKING SCAFFOLD (OBLIGATORIO en cada decisión) ===
Cada punto de decisión DEBE incluir un "thinkingScaffold" que:
- Es un array de 2-3 bullets CORTOS (máximo 6 palabras cada uno)
- Son dimensiones de razonamiento: stakeholders / trade-offs / restricciones / riesgo
- NUNCA sugieren una respuesta, NUNCA dan "best practices", NUNCA llegan a conclusiones
- Tono de mentor: ayudan a entender CÓMO pensar la pregunta, no QUÉ elegir

Ejemplos de thinkingScaffold:
- ["Impacto en el equipo", "Riesgo vs velocidad", "Consecuencias a corto vs largo plazo"]
- ["Personas afectadas", "Recursos disponibles", "Restricciones de tiempo"]
- ["Stakeholders clave", "Trade-offs principales", "Límites del contexto"]

IMPORTANTE: El thinkingScaffold NUNCA contiene verbos imperativos ni sugerencias de acción.

=== FORMATO DE SALIDA JSON ===
{
  "title": "Título compelling y específico en español",
  "description": "2-3 oraciones hook que emocionarían a estudiantes",
  "domain": "Dominio principal (ej: Gestión de Crisis, Marketing, Operaciones, Ética)",
  "caseContext": "El contexto completo del caso (120-180 palabras) - estilo Harvard Business Case",
  "coreChallenge": "El desafío central de negocios claramente articulado",
  "decisionPoints": [
    { "number": 1, "format": "multiple_choice", "prompt": "...", "options": ["A", "B", "C"], "requiresJustification": false, "includesReflection": false, "focusCue": "...", "thinkingScaffold": ["...", "...", "..."] },
    { "number": 2, "format": "written", "prompt": "...", "requiresJustification": true, "includesReflection": false, "focusCue": "...", "thinkingScaffold": ["...", "...", "..."] },
    // ... genera EXACTAMENTE ${stepCount} puntos de decisión en total
    { "number": ${stepCount}, "format": "written", "prompt": "decisión integrativa final...", "requiresJustification": true, "includesReflection": false, "focusCue": "...", "thinkingScaffold": ["...", "...", "..."] }
  ],
  "reflectionPrompt": "Pregunta de reflexión al final de la simulación (Paso ${stepCount + 1}, separado de las decisiones)",
  "indicators": [
    { "id": "teamMorale", "label": "Moral del Equipo", "value": 65, "description": "..." },
    { "id": "budgetHealth", "label": "Salud Presupuestaria", "value": 70, "description": "..." },
    { "id": "operationalRisk", "label": "Riesgo Operacional", "value": 50, "description": "..." },
    { "id": "strategicFlexibility", "label": "Flexibilidad Estratégica", "value": 60, "description": "..." }
  ],
  "role": "Rol específico del jugador",
  "objective": "Objetivo claro de la misión",
  "companyName": "Nombre de empresa realista",
  "industry": "Industria específica",
  "timelineContext": "Contexto de presión temporal",
  "keyConstraints": ["Restricción 1", "Restricción 2", "Restricción 3"],
  "learningObjectives": ["Objetivo de aprendizaje 1", "Objetivo 2", "Objetivo 3"],
  "frameworks": [
    {
      "id": "fw_001",
      "name": "Nombre del marco analítico (ej: Análisis de Stakeholders)",
      "domainKeywords": ["palabra1", "palabra2", "palabra3", "palabra4", "palabra5"]
    },
    {
      "id": "fw_002",
      "name": "Segundo marco relevante (ej: Análisis Costo-Beneficio)",
      "domainKeywords": ["término1", "término2", "término3", "término4"]
    }
  ],
  "confidence": 85
}

=== INSTRUCCIONES PARA FRAMEWORKS ===
- Genera entre 1 y 4 marcos analíticos que sean genuinamente relevantes para el dominio y las decisiones del caso
- Cada marco debe incluir 4-8 palabras clave específicas que un estudiante usaría al aplicarlo
- Los nombres de los marcos deben ser concretos y reconocibles (ej: "Análisis FODA", "Análisis de Stakeholders", "Análisis Costo-Beneficio", "Marco de Gestión de Crisis")
- Las palabras clave deben reflejar el vocabulario real del marco aplicado al contexto del caso
- Los IDs deben ser únicos: fw_001, fw_002, etc.

IMPORTANTE: 
- TODO el contenido DEBE estar en ESPAÑOL LATINOAMERICANO
- El contexto del caso debe sentirse como un caso de Harvard Business School - profesional e inmersivo
- NO incluir respuestas correctas implícitas
- Cada opción de decisión 1 debe ser igualmente defendible`;
}

/**
 * Phase 1b: dedicated English variant of the canonical-case prompt.
 * Replaces the previous Spanish-prompt + langDirective approach. Every
 * instruction, label, and example is in English so the model never sees
 * conflicting language signals.
 */
function buildCanonicalPromptEn(stepCount: number): string {
  const durationMin = Math.round((stepCount / 3) * 20);
  const durationMax = Math.round((stepCount / 3) * 25);
  return `You are a CANONICAL BUSINESS CASE ARCHITECT for Academium, an AI-powered business simulation platform for university education.

${STRUCTURE_LOCK_NOTICE}

YOUR MISSION: Build business cases that follow a STRICT CANONICAL STRUCTURE for the POC release (${POC_VERSION}).

=== MANDATORY CONSTRAINTS (NON-NEGOTIABLE) ===
- Discipline: Business
- Level: University undergraduate
- Case duration: ${durationMin}-${durationMax} minutes total
- Decision points: EXACTLY ${stepCount}
- Language: ENGLISH only (no Spanish anywhere — titles, descriptions, prompts, options, contexts, constraints, framework names, indicator labels, keywords)
- Assessment status: Not graded (POC only)
- Primary goal: Flow, completion, and an authentic decision-making experience

=== CANONICAL CASE STRUCTURE ===

SECTION 1 — CASE CONTEXT (120-180 words):
- Tone: Professional, neutral, real
- Functional, not literary
- Every sentence must support decision-making
- MUST include:
  * Type of organization (company, startup, division, etc.)
  * Student's role (explicit level of authority)
  * Current situation or pressure
  * Time constraint or urgency
  * Clear reason why decisions matter NOW
- MUST NOT include:
  * Emotional storytelling
  * Character arcs
  * Historical recaps
  * Academic theory explanations
  * Hints toward a preferred answer

SECTION 2 — CORE BUSINESS CHALLENGE:
- A single primary challenge
- Clearly bounded (budget, time, resources, uncertainty)
- No excessive technical jargon
- No preferred direction implied
- MUST include:
  * What is at stake
  * What CANNOT be changed
  * What is uncertain
  * What success could look like (without defining it)

SECTION 3 — DECISION 1 (Orientation Decision):
- Format: Multiple choice (3-4 options)
- Each option represents a STRATEGIC STANCE, not a solution
- CRITICAL RULE: All options are equally legitimate; no preferred option exists
- Each option MUST be:
  * Defensible
  * Backed by clear rationale
  * Lead to different downstream consequences

DECISIONS 2 to ${stepCount - 1} (Analytical Decisions):
- Format: Short written justification (5-7 lines)
- Open-ended, no word-count pressure
- The prompt must:
  * Ask HOW and WHY
  * NEVER imply a preferred answer
  * Encourage trade-off consideration
- Each decision must build progressively on the previous ones

DECISION ${stepCount} (Final Integrative Decision):
- Format: Short written justification
- MUST force synthesis of:
  * Prior information
  * Trade-offs
  * Consequences of earlier decisions
- The decision must feel CONSEQUENTIAL
- No frictionless outcomes
- Realistic ambiguity is encouraged

REFLECTION (Light):
- ONE optional prompt
- Examples:
  * "Which factor influenced your decisions most?"
  * "What would you explore differently next time?"
- NO long reflections, NO essays

=== SYSTEM INDICATORS (4 POC INDICATORS) ===
Indicators must reflect:
1. Team morale (teamMorale) — Team's emotional state and engagement
2. Budget health (budgetHealth) — Financial health and resource availability
3. Operational risk (operationalRisk) — Operational uncertainty/danger level
4. Strategic flexibility (strategicFlexibility) — Adaptability and strategic options

CRITICAL OPPORTUNITY-COST RULE:
Every decision MUST move AT LEAST ONE indicator NEGATIVELY.
- No "perfect" decisions without consequences
- Every choice involves giving something up

=== CONSEQUENCE & FEEDBACK TONE ===
- Encouraging
- Mentoring-oriented
- NEVER evaluative
- NEVER prescriptive
- AVOID evaluative or directive lexicon (judgments of accuracy, comparative superiority, prescriptive obligations, or hindsight prescriptions)

=== S7.1 FOCUS CUE (REQUIRED on every decision) ===
Every decision point MUST include a "focusCue" that:
- Highlights 2-3 key dimensions (stakeholders, constraints, trade-offs, risks)
- Stays NEUTRAL (does not steer toward a specific decision)
- Is short (1-2 lines or 2-3 bullets)
- Feels like mentoring ("here is how to frame the problem"), not instruction

Acceptable formats for focusCue:
- One sentence: "Before deciding, weigh the impact on the team, the timeline, and risk."
- Bullets: "Focus on: team / time / risk."
- Brief framing: "The main tension here is balancing priorities under pressure."

IMPORTANT: focusCue NEVER implies a preferred answer.

=== S5.1 THINKING SCAFFOLD (REQUIRED on every decision) ===
Every decision point MUST include a "thinkingScaffold" that:
- Is an array of 2-3 SHORT bullets (max 6 words each)
- Are reasoning dimensions: stakeholders / trade-offs / constraints / risk
- NEVER suggest an answer, NEVER prescribe established practices, NEVER reach conclusions
- Mentor tone: helps the student understand HOW to think about the question, not WHAT to choose

Examples of thinkingScaffold:
- ["Team impact", "Risk vs speed", "Short- vs long-term consequences"]
- ["People affected", "Available resources", "Time constraints"]
- ["Key stakeholders", "Main trade-offs", "Context boundaries"]

IMPORTANT: thinkingScaffold NEVER contains imperative verbs or action suggestions.

=== JSON OUTPUT FORMAT ===
{
  "title": "Compelling, specific title in English",
  "description": "2-3 hook sentences that would excite students",
  "domain": "Primary domain (e.g.: Crisis Management, Marketing, Operations, Ethics)",
  "caseContext": "Full case context (120-180 words) — Harvard Business Case style",
  "coreChallenge": "Core business challenge clearly articulated",
  "decisionPoints": [
    { "number": 1, "format": "multiple_choice", "prompt": "...", "options": ["A", "B", "C"], "requiresJustification": false, "includesReflection": false, "focusCue": "...", "thinkingScaffold": ["...", "...", "..."] },
    { "number": 2, "format": "written", "prompt": "...", "requiresJustification": true, "includesReflection": false, "focusCue": "...", "thinkingScaffold": ["...", "...", "..."] },
    // ... generate EXACTLY ${stepCount} decision points in total
    { "number": ${stepCount}, "format": "written", "prompt": "final integrative decision...", "requiresJustification": true, "includesReflection": false, "focusCue": "...", "thinkingScaffold": ["...", "...", "..."] }
  ],
  "reflectionPrompt": "Reflection question at the end of the simulation (Step ${stepCount + 1}, separate from decisions)",
  "indicators": [
    { "id": "teamMorale", "label": "Team Morale", "value": 65, "description": "..." },
    { "id": "budgetHealth", "label": "Budget Health", "value": 70, "description": "..." },
    { "id": "operationalRisk", "label": "Operational Risk", "value": 50, "description": "..." },
    { "id": "strategicFlexibility", "label": "Strategic Flexibility", "value": 60, "description": "..." }
  ],
  "role": "Specific player role",
  "objective": "Clear mission objective",
  "companyName": "Realistic company name",
  "industry": "Specific industry",
  "timelineContext": "Time-pressure context",
  "keyConstraints": ["Constraint 1", "Constraint 2", "Constraint 3"],
  "learningObjectives": ["Learning objective 1", "Objective 2", "Objective 3"],
  "frameworks": [
    {
      "id": "fw_001",
      "name": "Analytical framework name (e.g.: Stakeholder Analysis)",
      "domainKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
    },
    {
      "id": "fw_002",
      "name": "Second relevant framework (e.g.: Cost-Benefit Analysis)",
      "domainKeywords": ["term1", "term2", "term3", "term4"]
    }
  ],
  "confidence": 85
}

=== INSTRUCTIONS FOR FRAMEWORKS ===
- Generate between 1 and 4 analytical frameworks that are genuinely relevant to the case domain and decisions
- Each framework must include 4-8 specific keywords a student would use when applying it
- Framework names must be concrete and recognizable (e.g.: "SWOT Analysis", "Stakeholder Analysis", "Cost-Benefit Analysis", "Crisis Management Framework")
- Keywords must reflect the real vocabulary of the framework applied to the case context
- IDs must be unique: fw_001, fw_002, etc.

IMPORTANT:
- ALL content MUST be in ENGLISH (no Spanish words anywhere)
- The case context must feel like a Harvard Business School case — professional and immersive
- Do NOT include implicit preferred answers
- Each option in decision 1 must be equally defensible`;
}

export interface CanonicalCaseData {
  title: string;
  description: string;
  domain: string;
  caseContext: string;
  coreChallenge: string;
  decisionPoints: DecisionPoint[];
  reflectionPrompt: string;
  indicators: Indicator[];
  role: string;
  objective: string;
  companyName: string;
  industry: string;
  timelineContext: string;
  keyConstraints: string[];
  learningObjectives: string[];
  frameworks: CaseFramework[];
  confidence: number;
}

/**
 * Regenerate JUST the keyword list for a set of frameworks whose previously
 * generated keywords appeared to be in the wrong language. Returns the same
 * frameworks with refreshed `domainKeywords`. Frameworks that fail to
 * regenerate are returned unchanged.
 */
async function regenerateFrameworkKeywords(
  frameworks: CaseFramework[],
  language: "es" | "en"
): Promise<CaseFramework[]> {
  if (frameworks.length === 0) return frameworks;
  const isEn = language === "en";

  const instructions = isEn
    ? `For each analytical framework below, produce 4-6 SHORT domain keywords that a business student would use when applying it. ALL keywords MUST be in ENGLISH (no Spanish). Each keyword must be 4 characters or longer, specific to the framework (avoid generic words like "problem", "issue", "analysis"). Return ONLY this JSON shape: {"frameworks":[{"id":"...","domainKeywords":["...","..."]}]}.`
    : `Para cada marco analítico abajo, produce 4-6 palabras clave CORTAS y específicas que un estudiante de negocios usaría al aplicarlo. TODAS las palabras clave DEBEN estar en ESPAÑOL (sin inglés). Cada palabra debe tener 4 o más caracteres, ser específica del marco (evita términos genéricos como "problema", "tema", "análisis"). Devuelve SOLO este JSON: {"frameworks":[{"id":"...","domainKeywords":["...","..."]}]}.`;

  const list = frameworks.map((f) => `- id=${f.id}: ${f.name}`).join("\n");

  const response = await generateChatCompletion(
    [
      { role: "system", content: instructions },
      { role: "user", content: `${isEn ? "Frameworks" : "Marcos"}:\n${list}` },
    ],
    { responseFormat: "json", maxTokens: 512, model: "gpt-4o-mini", agentName: "frameworkKeywordRegen" }
  );

  let parsed: any;
  try {
    parsed = JSON.parse(response);
  } catch {
    return frameworks;
  }

  const byId = new Map<string, string[]>();
  if (Array.isArray(parsed?.frameworks)) {
    for (const fw of parsed.frameworks) {
      if (!fw || typeof fw.id !== "string") continue;
      if (!Array.isArray(fw.domainKeywords)) continue;
      const kws = fw.domainKeywords
        .filter((k: any) => typeof k === "string" && k.trim().length > 0)
        .map((k: string) => k.trim().toLowerCase())
        .slice(0, 12);
      if (kws.length >= 2) byId.set(fw.id.trim(), kws);
    }
  }

  return frameworks.map((fw) =>
    byId.has(fw.id) ? { ...fw, domainKeywords: byId.get(fw.id)! } : fw,
  );
}

export async function generateCanonicalCase(
  topic: string,
  additionalContext?: string,
  stepCount?: number,
  language?: "es" | "en"
): Promise<CanonicalCaseData> {
  const effectiveSteps = Math.min(MAX_DECISIONS, Math.max(MIN_DECISIONS, stepCount ?? DEFAULT_DECISIONS));
  const durationMin = Math.round((effectiveSteps / 3) * 20);
  const durationMax = Math.round((effectiveSteps / 3) * 25);
  const isEn = language === "en";

  const contextAddition = additionalContext
    ? (isEn
        ? `\n\nAdditional professor context:\n${additionalContext}`
        : `\n\nContexto adicional del profesor:\n${additionalContext}`)
    : "";

  // Phase 1b: pure-language prompts (no langDirective append). Each variant
  // is fully in its target language to eliminate cross-language leakage.
  const systemPrompt = isEn
    ? buildCanonicalPromptEn(effectiveSteps)
    : buildCanonicalPromptEs(effectiveSteps);

  const userPrompt = isEn
    ? `Create a canonical business case based on this topic/industry:\n\nTOPIC: ${topic}${contextAddition}\n\nGenerate a COMPLETE business case following the canonical structure, ALL in English.\nCase duration: ${durationMin}-${durationMax} minutes.\nRemember: exactly ${effectiveSteps} decision points, no preferred answer, mentoring tone.`
    : `Crea un caso de negocios canónico basado en este tema/industria:\n\nTEMA: ${topic}${contextAddition}\n\nGenera un caso de negocios COMPLETO siguiendo la estructura canónica, TODO en español latinoamericano.\nEl caso debe durar ${durationMin}-${durationMax} minutos para completar.\nRecuerda: ${effectiveSteps} puntos de decisión exactamente, sin respuesta preferida, tono de mentoría.`;

  const callLLM = async () => generateChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { responseFormat: "json", maxTokens: 4096 + (effectiveSteps > 3 ? (effectiveSteps - 3) * 512 : 0), agentName: "canonicalCaseGenerator" }
  );

  let response = await callLLM();
  let parsed = JSON.parse(response);

  // Phase 1b: post-gen language assertion. Sample user-facing strings and
  // measure off-language token ratio. If above 10%, regenerate once and keep
  // whichever attempt has the lower ratio.
  const initialRatio = offLanguageRatio(parsed, isEn ? "en" : "es");
  if (initialRatio > 0.10) {
    console.warn(`[CanonicalCaseGenerator] Off-language content detected (target=${isEn ? "en" : "es"}, ratio=${initialRatio.toFixed(2)}). Regenerating...`);
    try {
      response = await callLLM();
      const retryParsed = JSON.parse(response);
      const retryRatio = offLanguageRatio(retryParsed, isEn ? "en" : "es");
      if (retryRatio < initialRatio) {
        parsed = retryParsed;
        if (retryRatio > 0.10) {
          console.error(`[CanonicalCaseGenerator] Persistent off-language content after retry (ratio=${retryRatio.toFixed(2)}). Using retry (lower ratio).`);
        }
      } else {
        console.error(`[CanonicalCaseGenerator] Retry ratio (${retryRatio.toFixed(2)}) not better than initial (${initialRatio.toFixed(2)}). Keeping initial.`);
      }
    } catch (err) {
      console.error("[CanonicalCaseGenerator] Language-assertion regeneration failed:", err);
    }
  }
  
  const defaultIndicators: Indicator[] = getCanonicalKPIs(language);

  const defaultFocusCues = isEn
    ? [
        "Consider: team impact / time pressure / immediate risks.",
        "The main tension here is balancing resources with objectives.",
        "Think about how your previous decisions affect this final choice.",
      ]
    : [
        "Considera: impacto en el equipo / presión de tiempo / riesgos inmediatos.",
        "La tensión principal aquí es equilibrar recursos con objetivos.",
        "Piensa en cómo tus decisiones anteriores afectan esta elección final.",
      ];
  
  // Phase 1b: locale-aware fallback strings to prevent Spanish leaking into EN cases.
  const decisionPromptFallback = (n: number) => isEn ? `Decision ${n}` : `Decisión ${n}`;
  const writtenPromptFallback = (n: number) => isEn
    ? `Decision ${n} — Please provide your analysis`
    : `Decisión ${n} - Por favor proporcione su análisis`;
  const optionFallback = isEn
    ? ["Option A", "Option B", "Option C"]
    : ["Opción A", "Opción B", "Opción C"];
  const scaffoldFallback = isEn
    ? ["Key stakeholders", "Main trade-offs", "Future consequences"]
    : ["Stakeholders clave", "Trade-offs principales", "Consecuencias futuras"];

  const decisionPoints: DecisionPoint[] = (parsed.decisionPoints || []).map((dp: any, index: number) => ({
    number: dp.number || index + 1,
    format: dp.format || (index === 0 ? "multiple_choice" : "written"),
    prompt: dp.prompt || decisionPromptFallback(index + 1),
    options: dp.options || undefined,
    requiresJustification: dp.requiresJustification ?? (index > 0),
    includesReflection: dp.includesReflection ?? false,
    focusCue: dp.focusCue || defaultFocusCues[index % defaultFocusCues.length],
    thinkingScaffold: Array.isArray(dp.thinkingScaffold) ? dp.thinkingScaffold : undefined,
  }));

  while (decisionPoints.length < effectiveSteps) {
    const num = decisionPoints.length + 1;
    decisionPoints.push({
      number: num,
      format: num === 1 ? "multiple_choice" : "written",
      prompt: writtenPromptFallback(num),
      options: num === 1 ? optionFallback : undefined,
      requiresJustification: num > 1,
      includesReflection: false,
      focusCue: defaultFocusCues[(num - 1) % defaultFocusCues.length],
      thinkingScaffold: scaffoldFallback,
    });
  }

  // S8.1: Map indicators with directionality
  const directionDefaults: Record<string, "up_better" | "down_better"> = {
    teamMorale: "up_better",
    morale: "up_better",
    budgetHealth: "up_better",
    budgetImpact: "up_better",
    revenue: "up_better",
    operationalRisk: "down_better",
    risk: "down_better",
    strategicFlexibility: "up_better",
    reputation: "up_better",
    trust: "up_better",
    efficiency: "up_better",
  };
  
  const indicators: Indicator[] = (parsed.indicators || []).length >= 4 
    ? parsed.indicators.map((ind: any) => ({
        id: ind.id || "indicator",
        label: ind.label || (isEn ? "Indicator" : "Indicador"),
        value: typeof ind.value === "number" ? ind.value : 50,
        description: ind.description,
        direction: ind.direction || directionDefaults[ind.id] || "up_better",
      }))
    : defaultIndicators;

  // Phase 2: every generated framework gets a canonicalId. Resolver maps
  // aliases (e.g. "5 Forces" + "Five Forces") to the same canonical entry;
  // unresolved names get a stable custom_<hash> id derived from the name.
  // We dedup by canonicalId, preferring the entry with more semantic fields
  // (e.g. registry-resolved over LLM-only) and merging keyword arrays.
  const { resolveFrameworkName } = await import("./frameworkRegistry");
  const { customCanonicalId } = await import("./frameworkBootMigration");
  const effectiveLangForResolver: "es" | "en" = isEn ? "en" : "es";

  const semanticScore = (fw: CaseFramework): number => {
    let s = 0;
    if (fw.coreConcepts && fw.coreConcepts.length > 0) s += 2;
    if (fw.conceptualDescription && fw.conceptualDescription.trim().length > 0) s += 2;
    if (fw.recognitionSignals && fw.recognitionSignals.length > 0) s += 2;
    if (fw.primaryDimension) s += 1;
    if (fw.aliases && fw.aliases.length > 0) s += 1;
    return s;
  };

  const byCanonical = new Map<string, CaseFramework>();
  if (Array.isArray(parsed.frameworks)) {
    for (const fw of parsed.frameworks) {
      if (!fw || typeof fw.name !== "string" || !fw.name.trim()) continue;
      if (!Array.isArray(fw.domainKeywords) || fw.domainKeywords.length < 2) continue;
      const keywords = (fw.domainKeywords as unknown[])
        .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
        .map((k) => k.trim().toLowerCase())
        .slice(0, 12);
      if (keywords.length < 2) continue;

      const trimmedName = fw.name.trim();
      const resolved = resolveFrameworkName(trimmedName, effectiveLangForResolver);

      const fwId = typeof fw.id === "string" && fw.id.trim()
        ? fw.id.trim()
        : `fw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const candidate: CaseFramework = resolved
        ? {
            id: fwId,
            name: resolved.canonicalName,
            domainKeywords: Array.from(
              new Set([...resolved.suggestedDomainKeywords.map((k) => k.toLowerCase()), ...keywords]),
            ).slice(0, 12),
            canonicalId: resolved.canonicalId,
            aliases: resolved.aliases,
            coreConcepts: resolved.coreConcepts,
            conceptualDescription: resolved.conceptualDescription,
            recognitionSignals: resolved.recognitionSignals,
            primaryDimension: resolved.primaryDimension,
            provenance: "explicit",
            accepted_by_professor: true,
            signalPattern: resolved.suggestedSignalPattern,
          }
        : {
            id: fwId,
            name: trimmedName,
            domainKeywords: keywords,
            canonicalId: customCanonicalId(trimmedName),
            provenance: "explicit",
            accepted_by_professor: true,
          };

      const existing = byCanonical.get(candidate.canonicalId!);
      if (!existing) {
        byCanonical.set(candidate.canonicalId!, candidate);
        continue;
      }
      // Prefer the more-populated entry; merge keyword arrays.
      const winner = semanticScore(candidate) >= semanticScore(existing) ? candidate : existing;
      const loser = winner === candidate ? existing : candidate;
      const mergedKeywords = Array.from(new Set([...winner.domainKeywords, ...loser.domainKeywords])).slice(0, 12);
      byCanonical.set(candidate.canonicalId!, { ...winner, domainKeywords: mergedKeywords });
    }
  }
  const parsedFrameworks: CaseFramework[] = Array.from(byCanonical.values());

  // Post-process: drop sub-4-char + generic stopword keywords, deduplicate across
  // frameworks, and flag any frameworks whose keyword arrays appear to be in the
  // wrong language (>30% wrong-language tokens). Then regenerate just the
  // keyword lists for flagged frameworks via a focused short LLM call.
  const effectiveLang: "es" | "en" = isEn ? "en" : "es";
  let { frameworks: cleanedFrameworks, needsRegeneration } = sanitizeFrameworks(
    parsedFrameworks,
    effectiveLang,
  );

  if (needsRegeneration.length > 0) {
    const idSet = new Set(needsRegeneration);
    const targets = cleanedFrameworks.filter((f) => idSet.has(f.id));
    try {
      const regenerated = await regenerateFrameworkKeywords(targets, effectiveLang);
      const merged = mergeRegeneratedKeywords(cleanedFrameworks, regenerated);
      // Re-sanitize to enforce minLength / dedup / generic stopword rules on regenerated output.
      cleanedFrameworks = sanitizeFrameworks(merged, effectiveLang).frameworks;
    } catch (err) {
      console.error("[canonicalCaseGenerator] Framework keyword regeneration failed:", err);
      // Keep the original sanitized lists; downstream detection still works with what's left.
    }
  }

  // Drop frameworks that ended up with fewer than 2 usable keywords.
  const finalFrameworks = cleanedFrameworks.filter((f) => f.domainKeywords.length >= 2);

  const isEnFallback = effectiveLang === "en";
  return {
    title: parsed.title || (isEnFallback ? "Business Case" : "Caso de Negocios"),
    description: parsed.description || (isEnFallback ? "A business simulation case" : "Un caso de simulación de negocios"),
    domain: parsed.domain || (isEnFallback ? "Business Management" : "Gestión de Negocios"),
    caseContext: parsed.caseContext || (isEnFallback ? "Case context pending..." : "Contexto del caso pendiente..."),
    coreChallenge: parsed.coreChallenge || (isEnFallback ? "Core challenge to be defined..." : "Desafío central por definir..."),
    decisionPoints: decisionPoints.slice(0, effectiveSteps),
    reflectionPrompt: parsed.reflectionPrompt || (isEnFallback ? "Which factor most influenced your decisions?" : "¿Qué factor influyó más en tus decisiones?"),
    indicators,
    role: parsed.role || (isEnFallback ? "Manager" : "Gerente"),
    objective: parsed.objective || (isEnFallback ? "Navigate the situation successfully" : "Navegar la situación exitosamente"),
    companyName: parsed.companyName || (isEnFallback ? "Company" : "Empresa"),
    industry: parsed.industry || (isEnFallback ? "Business" : "Negocios"),
    timelineContext: parsed.timelineContext || (isEnFallback ? "Urgent situation" : "Situación urgente"),
    keyConstraints: parsed.keyConstraints || (isEnFallback ? ["Limited budget", "Constrained time"] : ["Presupuesto limitado", "Tiempo restringido"]),
    learningObjectives: parsed.learningObjectives || (isEnFallback ? ["Critical thinking", "Decision making"] : ["Pensamiento crítico", "Toma de decisiones"]),
    frameworks: finalFrameworks.slice(0, 4),
    confidence: parsed.confidence || 75,
  };
}

export function convertCanonicalToScenarioData(
  canonical: CanonicalCaseData,
  language?: "es" | "en"
): GeneratedScenarioData {
  const defaultKpis: KPIs = {
    revenue: 1000000,
    morale: 75,
    reputation: 80,
    efficiency: 70,
    trust: 75,
  };

  const defaultRubric: Rubric = {
    criteria: [
      { name: "Pensamiento Crítico", description: "Analiza información y considera múltiples perspectivas", weight: 0.25 },
      { name: "Enmarcado del Problema", description: "Define claramente el problema y sus dimensiones", weight: 0.25 },
      { name: "Evaluación de Trade-offs", description: "Considera costos y beneficios de diferentes opciones", weight: 0.25 },
      { name: "Razonamiento Aplicado", description: "Aplica conceptos a la situación específica", weight: 0.25 },
    ],
  };

  const challengeLabel = language === "en" ? "Core Challenge" : "Desafío Central";
  const introText = `${canonical.caseContext}

**${challengeLabel}:**
${canonical.coreChallenge}`;

  const initialState: InitialState = {
    kpis: defaultKpis,
    indicators: canonical.indicators,
    decisionPoints: canonical.decisionPoints,
    totalDecisions: canonical.decisionPoints.length,
    introText,
    role: canonical.role,
    objective: canonical.objective,
    companyName: canonical.companyName,
    industry: canonical.industry,
    timelineContext: canonical.timelineContext,
    keyConstraints: canonical.keyConstraints,
    learningObjectives: canonical.learningObjectives,
    difficultyLevel: "intermediate",
    // Canonical Case Structure (Harvard Business School style)
    caseContext: canonical.caseContext,
    coreChallenge: canonical.coreChallenge,
    reflectionPrompt: canonical.reflectionPrompt,
    frameworks: canonical.frameworks && canonical.frameworks.length > 0 ? canonical.frameworks : undefined,
  };

  return {
    title: canonical.title,
    description: canonical.description,
    domain: canonical.domain,
    initialState,
    rubric: defaultRubric,
    isComplete: true,
    confidence: canonical.confidence,
  };
}
