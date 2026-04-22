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
  CaseFramework,
  PedagogicalIntent,
  AcademicDimension,
  TradeoffSignature
} from "@shared/schema";
import { getCanonicalKPIs } from "@shared/schema";
import { generateChatCompletion } from "../openai";
import { POC_VERSION, STRUCTURE_LOCK_NOTICE, DEFAULT_DECISIONS, MIN_DECISIONS, MAX_DECISIONS } from "./constants";
import { sanitizeFrameworks, mergeRegeneratedKeywords } from "./frameworkKeywordSanitizer";
import { assignDecisionDimensions, dimensionConstraintFor, type DecisionDimension } from "./academicDimensions";

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

/**
 * Phase 5 (§9.4 + §10.3): build the intent-driven prompt block injected
 * into the user prompt. Includes teaching goal, framework anchoring,
 * competency weighting, decision design (per-dimension constraints), and
 * reasoning constraint blocks. Returns a pure-language string.
 */
function buildIntentBlock(
  intent: PedagogicalIntent,
  dimensions: DecisionDimension[],
  language: "es" | "en",
): string {
  const lines: string[] = [];
  if (language === "en") {
    lines.push("=== PEDAGOGICAL INTENT (PRIMARY DRIVER) ===");
    lines.push(`TEACHING GOAL: ${intent.teachingGoal}`);
    if (intent.targetFrameworks?.length) {
      lines.push("");
      lines.push("FRAMEWORK ANCHORING — the case MUST be designed so students can apply these frameworks. Surface their core concepts in the case context, decisions, and option text:");
      for (const fw of intent.targetFrameworks) {
        lines.push(`  • ${fw.name} (canonicalId=${fw.canonicalId})`);
      }
      lines.push("Generate `frameworks` array containing entries for ALL of the above plus any additional analytical frameworks naturally surfaced by the case.");
    }
    if (intent.targetCompetencies?.length) {
      lines.push("");
      lines.push(`COMPETENCY WEIGHTING — emphasize: ${intent.targetCompetencies.join(", ")}. Decision prompts and option signatures should give these competencies the most opportunity to surface.`);
    }
    lines.push("");
    lines.push("DECISION DESIGN — every decision is pre-assigned an academic dimension; the prompt MUST exercise that dimension:");
    for (const dd of dimensions) {
      lines.push(`  Decision ${dd.decisionNumber}: primaryDimension="${dd.primaryDimension}"${dd.secondaryDimension ? ` (secondary="${dd.secondaryDimension}")` : ""}`);
      lines.push(`    ↳ ${dimensionConstraintFor(dd.primaryDimension, "en")}`);
    }
    lines.push("");
    lines.push("Each decision in the JSON output MUST include: `primaryDimension`, `dimensionRationale` (1-2 sentences explaining why this decision exercises that dimension), and `targetFrameworkIds` (array of framework `id`s the decision should surface). Keep `tradeoffSignature` populated whenever primaryDimension is `tradeoff`.");
    if (intent.reasoningConstraint) {
      lines.push("");
      lines.push(`REASONING CONSTRAINT — students will be evaluated under this rule: ${intent.reasoningConstraint}. Decision prompts must respect this constraint.`);
    }
    lines.push("");
    lines.push("OUTPUT-FORMAT ADDITION — every decision in the `decisionPoints` array MUST contain these new fields: `primaryDimension`, `dimensionRationale`, `targetFrameworkIds`. Tradeoff decisions must also include `tradeoffSignature` with non-empty `dimension`, `cost`, `benefit`.");
    lines.push("");
    lines.push("NO-CORRECT-ANSWER LEXICON — do not use words like 'best', 'correct', 'optimal', 'wrong', 'should have', 'right answer', 'recommended approach' in any prompt, option, or focus cue.");
    if (intent.courseContext) {
      lines.push("");
      lines.push(`COURSE CONTEXT: ${intent.courseContext}`);
    }
    if (intent.professorNotes) {
      lines.push("");
      lines.push(`PROFESSOR NOTES — additional guidance from the professor (treat as a soft preference): ${intent.professorNotes}`);
    }
    return lines.join("\n");
  }
  // Spanish
  lines.push("=== INTENCIÓN PEDAGÓGICA (CONDUCTOR PRIMARIO) ===");
  lines.push(`OBJETIVO PEDAGÓGICO: ${intent.teachingGoal}`);
  if (intent.targetFrameworks?.length) {
    lines.push("");
    lines.push("ANCLAJE EN FRAMEWORKS — el caso DEBE diseñarse para que los estudiantes puedan aplicar estos marcos. Haz que sus conceptos centrales aparezcan en el contexto, las decisiones y las opciones:");
    for (const fw of intent.targetFrameworks) {
      lines.push(`  • ${fw.name} (canonicalId=${fw.canonicalId})`);
    }
    lines.push("Genera el arreglo `frameworks` con entradas para TODOS los anteriores más cualquier marco adicional que surja naturalmente del caso.");
  }
  if (intent.targetCompetencies?.length) {
    lines.push("");
    lines.push(`PESO DE COMPETENCIAS — enfatiza: ${intent.targetCompetencies.join(", ")}. Los prompts y opciones deben dar a estas competencias la mayor oportunidad de manifestarse.`);
  }
  lines.push("");
  lines.push("DISEÑO DE DECISIONES — cada decisión tiene una dimensión académica preasignada; el prompt DEBE ejercitar esa dimensión:");
  for (const dd of dimensions) {
    lines.push(`  Decisión ${dd.decisionNumber}: primaryDimension="${dd.primaryDimension}"${dd.secondaryDimension ? ` (secundaria="${dd.secondaryDimension}")` : ""}`);
    lines.push(`    ↳ ${dimensionConstraintFor(dd.primaryDimension, "es")}`);
  }
  lines.push("");
  lines.push("Cada decisión en el JSON DEBE incluir: `primaryDimension`, `dimensionRationale` (1-2 oraciones explicando por qué esta decisión ejercita esa dimensión), y `targetFrameworkIds` (arreglo de `id`s de frameworks que la decisión debe surfacear). Mantén `tradeoffSignature` poblado siempre que primaryDimension sea `tradeoff`.");
  if (intent.reasoningConstraint) {
    lines.push("");
    lines.push(`RESTRICCIÓN DE RAZONAMIENTO — los estudiantes serán evaluados bajo esta regla: ${intent.reasoningConstraint}. Los prompts deben respetar esta restricción.`);
  }
  lines.push("");
  lines.push("ADICIÓN AL FORMATO DE SALIDA — cada decisión en `decisionPoints` DEBE contener estos nuevos campos: `primaryDimension`, `dimensionRationale`, `targetFrameworkIds`. Las decisiones tradeoff además deben incluir `tradeoffSignature` con `dimension`, `cost`, `benefit` no vacíos.");
  lines.push("");
  lines.push("LÉXICO SIN-RESPUESTA-CORRECTA — no uses palabras como 'mejor', 'correcto', 'óptimo', 'incorrecto', 'debería haber', 'respuesta correcta', 'enfoque recomendado' en ningún prompt, opción o focus cue.");
  if (intent.courseContext) {
    lines.push("");
    lines.push(`CONTEXTO DEL CURSO: ${intent.courseContext}`);
  }
  if (intent.professorNotes) {
    lines.push("");
    lines.push(`NOTAS DEL PROFESOR — orientación adicional del profesor (preferencia suave): ${intent.professorNotes}`);
  }
  return lines.join("\n");
}

/**
 * Phase 5 (§9.4 gate 7): no-correct-answer telegraphing scan. Returns true
 * when the parsed case contains directive lexicon in its prompts/options.
 */
function detectTelegraphing(parsed: any, language: "es" | "en"): { hit: boolean; samples: string[] } {
  const ES = ["mejor opción", "respuesta correcta", "enfoque óptimo", "deberías haber", "lo correcto es", "lo óptimo es", "la mejor decisión"];
  const EN = ["best option", "correct answer", "optimal approach", "you should have", "the right choice", "the optimal", "the best decision"];
  const needles = language === "en" ? EN : ES;
  const samples: string[] = [];
  const scan = (s: any) => {
    if (typeof s !== "string") return;
    const low = s.toLowerCase();
    for (const n of needles) {
      if (low.includes(n)) samples.push(`"${s.slice(0, 80)}"`);
    }
  };
  if (Array.isArray(parsed?.decisionPoints)) {
    for (const dp of parsed.decisionPoints) {
      scan(dp?.prompt);
      scan(dp?.focusCue);
      if (Array.isArray(dp?.options)) dp.options.forEach(scan);
    }
  }
  return { hit: samples.length > 0, samples: samples.slice(0, 3) };
}

/**
 * Phase 5 (§9.4 gate 6): tradeoff realism check. For every decision whose
 * primary dimension is `tradeoff`, the prompt must name both a cost and a
 * benefit AND `tradeoffSignature` must be fully populated.
 */
function checkTradeoffRealism(
  decisionPoints: DecisionPoint[],
  dimensions: DecisionDimension[],
): { ok: boolean; failingNumbers: number[] } {
  const failing: number[] = [];
  const dimByNum = new Map(dimensions.map((d) => [d.decisionNumber, d.primaryDimension]));
  for (const dp of decisionPoints) {
    if (dimByNum.get(dp.number) !== "tradeoff") continue;
    const sig = dp.tradeoffSignature;
    const sigOk = !!sig && !!sig.cost?.trim() && !!sig.benefit?.trim() && !!sig.dimension?.trim();
    if (!sigOk) {
      failing.push(dp.number);
    }
  }
  return { ok: failing.length === 0, failingNumbers: failing };
}

/**
 * Phase 5 (§9.4 gate 4): dimension coverage. Requires at least
 * ⌈stepCount × 0.66⌉ DISTINCT primary dimensions across the case.
 */
function checkDimensionCoverage(
  dimensions: DecisionDimension[],
  stepCount: number,
): { ok: boolean; distinctCount: number; required: number } {
  const distinct = new Set(dimensions.map((d) => d.primaryDimension));
  const required = Math.ceil(stepCount * 0.66);
  return { ok: distinct.size >= required, distinctCount: distinct.size, required };
}

/**
 * Phase 5 (§9.4 gate 5): framework coverage check via the framework
 * detector. Runs the sync detector on each decision prompt and verifies
 * that at least one decision yields a non-`not_evidenced` detection for
 * one of the case's tracked frameworks. Lightweight — keyword tier only.
 */
async function checkFrameworkCoverage(
  decisionPoints: DecisionPoint[],
  frameworks: CaseFramework[],
  primaryTargetCanonicalId: string | undefined,
  language: "es" | "en",
): Promise<{ ok: boolean; missingPrimary: string | null }> {
  if (frameworks.length === 0) return { ok: true, missingPrimary: null };
  // If the intent declared a primary target framework but it is NOT present
  // in the generated frameworks at all, the gate fails immediately. We do
  // NOT silently fall back to frameworks[0] — that would mask the real
  // problem (the case never anchored on the requested framework).
  let primaryFw: CaseFramework | undefined;
  if (primaryTargetCanonicalId) {
    primaryFw = frameworks.find((f) => f.canonicalId === primaryTargetCanonicalId);
    if (!primaryFw) {
      return { ok: false, missingPrimary: primaryTargetCanonicalId };
    }
  } else {
    primaryFw = frameworks[0];
  }
  try {
    const { detectFrameworks } = await import("./frameworkDetector");
    const emptySignals: any = {
      intent: { quality: "WEAK", detected: false, evidence: "" },
      justification: { quality: "WEAK", detected: false, evidence: "" },
      tradeoffAwareness: { quality: "WEAK", detected: false, evidence: "" },
      stakeholderAwareness: { quality: "WEAK", detected: false, evidence: "" },
      ethicalAwareness: { quality: "WEAK", detected: false, evidence: "" },
    };
    // Phase 5 (§9.4) requires at least ONE decision to independently
    // surface the primary target framework — concatenated-text detection
    // can mask the case where no single decision evidences it. Run the
    // semantic detector per decision and short-circuit on the first hit.
    for (const dp of decisionPoints) {
      const text = `${dp.prompt}\n${(dp.options ?? []).join("\n")}\n${dp.focusCue ?? ""}`;
      const detections = await detectFrameworks(text, emptySignals, frameworks, language);
      const hit = detections.some(
        (d) => d.framework_id === primaryFw!.id && d.level !== "not_evidenced",
      );
      if (hit) return { ok: true, missingPrimary: null };
    }
    return { ok: false, missingPrimary: primaryFw.name };
  } catch (err) {
    // Detector failure must NOT silently bypass the gate. Surface as an
    // explicit failure so the caller flags it for the professor review.
    console.warn("[canonicalCaseGenerator] checkFrameworkCoverage detector error — failing gate:", err);
    return { ok: false, missingPrimary: primaryFw.name };
  }
}

/**
 * Phase 5 (§9.4 + §10.3): per-dimension prompt-text validators. Each
 * validator inspects the decision's prompt + options for the textual
 * markers required by its dimension. Returns the failing decision numbers.
 */
function checkPerDimensionPromptText(decisionPoints: DecisionPoint[]): {
  stakeholderFailures: number[];
  analyticalFailures: number[];
  strategicFailures: number[];
  ethicalFailures: number[];
  tradeoffPromptFailures: number[];
} {
  const stakeholderFailures: number[] = [];
  const analyticalFailures: number[] = [];
  const strategicFailures: number[] = [];
  const ethicalFailures: number[] = [];
  const tradeoffPromptFailures: number[] = [];

  // Lightweight cue lexicons (Es+En). Validators use case-insensitive checks.
  const stakeholderCues = /\b(stakeholders?|equipo|empleados?|clientes?|inversor(?:es)?|accionistas?|proveedor(?:es)?|comunidad|junta|board|customers?|investors?|shareholders?|suppliers?|community|team|employees?|users?)\b/gi;
  const numericCue = /\d|%|porcentaje|percent|aument|decrease|increase|disminu|caus|provoc|debido a|because|leads? to|results? in/gi;
  const ethicalCues = /\bético|ética|ethical|ethic|legítim|legitimate|principio|principle|integridad|integrity|justicia|justice|fairness|valor(?:es)? humanos?|human values?/gi;
  const tradeoffCueCost = /\b(costo|coste|sacrific|riesgo|pierde|cost|sacrifice|risk|lose|forfeit|trade.?off)\b/gi;
  const tradeoffCueBenefit = /\b(beneficio|gana|ventaja|oportunidad|mejor|benefit|gain|upside|opportunity|advantage|payoff)\b/gi;

  for (const dp of decisionPoints) {
    const text = `${dp.prompt}\n${(dp.options ?? []).join("\n")}`;
    const lower = text.toLowerCase();
    switch (dp.primaryDimension) {
      case "stakeholder": {
        const matches = new Set(text.match(stakeholderCues) ?? []);
        if (matches.size < 2) stakeholderFailures.push(dp.number);
        break;
      }
      case "analytical": {
        if (!numericCue.test(text)) analyticalFailures.push(dp.number);
        numericCue.lastIndex = 0;
        break;
      }
      case "strategic": {
        const optionCount = Array.isArray(dp.options) ? dp.options.length : 0;
        // strategic decisions need ≥2 defensible paths surfaced — use options
        // as the most reliable proxy; fall back to detecting two "or"/"o" splits.
        const orSplits = (lower.match(/\b(or|o)\b/g) ?? []).length;
        if (optionCount < 2 && orSplits < 1) strategicFailures.push(dp.number);
        break;
      }
      case "ethical": {
        if (!ethicalCues.test(text)) ethicalFailures.push(dp.number);
        ethicalCues.lastIndex = 0;
        break;
      }
      case "tradeoff": {
        const hasCost = tradeoffCueCost.test(text);
        const hasBenefit = tradeoffCueBenefit.test(text);
        tradeoffCueCost.lastIndex = 0;
        tradeoffCueBenefit.lastIndex = 0;
        if (!hasCost || !hasBenefit) tradeoffPromptFailures.push(dp.number);
        break;
      }
    }
  }

  return { stakeholderFailures, analyticalFailures, strategicFailures, ethicalFailures, tradeoffPromptFailures };
}

/**
 * Backfill semantic completeness on every framework returned by the LLM.
 * Per Phase 5 spec, every framework MUST have non-empty `coreConcepts`,
 * `conceptualDescription`, and `recognitionSignals`. When the LLM omits
 * them, we synthesize minimal but coherent stubs so downstream detectors
 * never receive an empty record.
 */
function backfillFrameworkSemanticFields(
  frameworks: CaseFramework[],
  language: "es" | "en",
): CaseFramework[] {
  const isEn = language === "en";
  return frameworks.map((fw) => {
    const coreConcepts = Array.isArray(fw.coreConcepts) && fw.coreConcepts.length > 0
      ? fw.coreConcepts
      : (fw.domainKeywords?.slice(0, 3) ?? [
          isEn ? "key concept" : "concepto clave",
          isEn ? "core idea" : "idea central",
        ]);
    const conceptualDescription = typeof fw.conceptualDescription === "string" && fw.conceptualDescription.trim()
      ? fw.conceptualDescription
      : (isEn
          ? `${fw.name}: an analytical framework students can apply to reason about this case.`
          : `${fw.name}: un marco analítico que los estudiantes pueden aplicar para razonar sobre este caso.`);
    const recognitionSignals = Array.isArray(fw.recognitionSignals) && fw.recognitionSignals.length > 0
      ? fw.recognitionSignals
      : (fw.domainKeywords?.slice(0, 5) ?? coreConcepts);
    return { ...fw, coreConcepts, conceptualDescription, recognitionSignals };
  });
}

export async function generateCanonicalCase(
  topic: string,
  pedagogicalIntent: PedagogicalIntent,
  additionalContext?: string,
  stepCount?: number,
  language?: "es" | "en"
): Promise<CanonicalCaseData> {
  const effectiveSteps = Math.min(MAX_DECISIONS, Math.max(MIN_DECISIONS, stepCount ?? DEFAULT_DECISIONS));
  const durationMin = Math.round((effectiveSteps / 3) * 20);
  const durationMax = Math.round((effectiveSteps / 3) * 25);
  const isEn = language === "en";

  // Phase 5 (§10.2): pre-assign per-decision academic dimensions before the
  // LLM call so the prompt can communicate them as hard constraints.
  const dimensions = assignDecisionDimensions(pedagogicalIntent, effectiveSteps);
  const intentBlock = buildIntentBlock(pedagogicalIntent, dimensions, isEn ? "en" : "es");

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

  const baseUserPrompt = isEn
    ? `${intentBlock}\n\nCreate a canonical business case based on this topic/industry:\n\nTOPIC: ${topic}${contextAddition}\n\nGenerate a COMPLETE business case following the canonical structure, ALL in English.\nCase duration: ${durationMin}-${durationMax} minutes.\nRemember: exactly ${effectiveSteps} decision points, no preferred answer, mentoring tone. The pedagogical-intent block above OVERRIDES any conflicting default instructions in the system prompt.`
    : `${intentBlock}\n\nCrea un caso de negocios canónico basado en este tema/industria:\n\nTEMA: ${topic}${contextAddition}\n\nGenera un caso de negocios COMPLETO siguiendo la estructura canónica, TODO en español latinoamericano.\nEl caso debe durar ${durationMin}-${durationMax} minutos para completar.\nRecuerda: ${effectiveSteps} puntos de decisión exactamente, sin respuesta preferida, tono de mentoría. El bloque de intención pedagógica anterior SOBREESCRIBE cualquier instrucción por defecto en conflicto del system prompt.`;

  const callLLM = async (extraHint?: string) => generateChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: extraHint ? `${baseUserPrompt}\n\n${extraHint}` : baseUserPrompt },
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

  // Phase 5: stamp the pre-assigned dimension onto every decision so the
  // server-side metadata is authoritative even if the LLM omits/overrides it.
  // dimensionRationale and targetFrameworkIds get safe fallbacks so the
  // persisted decision always has the new metadata fields populated.
  const dimByNumber = new Map(dimensions.map((d) => [d.decisionNumber, d]));
  const intentTargetIds = (pedagogicalIntent.targetFrameworks ?? [])
    .map((f) => f.canonicalId)
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  const fallbackRationale = (dim: AcademicDimension) =>
    isEn
      ? `Auto-assigned: this decision exercises the "${dim}" dimension per the case's pedagogical intent.`
      : `Asignación automática: esta decisión ejercita la dimensión "${dim}" según la intención pedagógica del caso.`;
  const decisionPoints: DecisionPoint[] = (parsed.decisionPoints || []).map((dp: any, index: number) => {
    const number = dp.number || index + 1;
    const dim = dimByNumber.get(number);
    const primary = dim?.primaryDimension ?? "strategic";
    const ts = dp.tradeoffSignature && typeof dp.tradeoffSignature === "object"
      ? {
          dimension: String(dp.tradeoffSignature.dimension ?? "").trim(),
          cost: String(dp.tradeoffSignature.cost ?? "").trim(),
          benefit: String(dp.tradeoffSignature.benefit ?? "").trim(),
        } as TradeoffSignature
      : undefined;
    const llmFwIds = Array.isArray(dp.targetFrameworkIds)
      ? dp.targetFrameworkIds.filter((s: any) => typeof s === "string" && s.trim()).map((s: string) => s.trim())
      : [];
    return {
      number,
      format: dp.format || (index === 0 ? "multiple_choice" : "written"),
      prompt: dp.prompt || decisionPromptFallback(number),
      options: dp.options || undefined,
      requiresJustification: dp.requiresJustification ?? (index > 0),
      includesReflection: dp.includesReflection ?? false,
      focusCue: dp.focusCue || defaultFocusCues[index % defaultFocusCues.length],
      thinkingScaffold: Array.isArray(dp.thinkingScaffold) ? dp.thinkingScaffold : undefined,
      tradeoffSignature: ts && (ts.cost || ts.benefit || ts.dimension) ? ts : undefined,
      primaryDimension: primary,
      secondaryDimension: dim?.secondaryDimension,
      dimensionRationale: typeof dp.dimensionRationale === "string" && dp.dimensionRationale.trim()
        ? dp.dimensionRationale.trim()
        : fallbackRationale(primary),
      targetFrameworkIds: llmFwIds.length > 0 ? llmFwIds : intentTargetIds,
      reviewCompleted: false,
      qualityFlags: [],
    };
  });

  while (decisionPoints.length < effectiveSteps) {
    const num = decisionPoints.length + 1;
    const dim = dimByNumber.get(num);
    const primary = dim?.primaryDimension ?? "strategic";
    decisionPoints.push({
      number: num,
      format: num === 1 ? "multiple_choice" : "written",
      prompt: writtenPromptFallback(num),
      options: num === 1 ? optionFallback : undefined,
      requiresJustification: num > 1,
      includesReflection: false,
      focusCue: defaultFocusCues[(num - 1) % defaultFocusCues.length],
      thinkingScaffold: scaffoldFallback,
      primaryDimension: primary,
      secondaryDimension: dim?.secondaryDimension,
      dimensionRationale: fallbackRationale(primary),
      targetFrameworkIds: intentTargetIds,
      reviewCompleted: false,
      qualityFlags: ["fallback_decision_point"],
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

  // Drop frameworks that ended up with fewer than 2 usable keywords, then
  // backfill the semantic-completeness fields so every persisted framework
  // has coreConcepts/conceptualDescription/recognitionSignals populated.
  const finalFrameworks = backfillFrameworkSemanticFields(
    cleanedFrameworks.filter((f) => f.domainKeywords.length >= 2),
    effectiveLang,
  );

  // Phase 5: normalize each decision's targetFrameworkIds against the FINAL
  // framework list. The fallback path seeded these from intent.canonicalId
  // values (and the LLM may also emit canonicalIds), but downstream review
  // and detection use the framework's real `id`. Map canonicalId → id when
  // possible, drop ids that don't resolve to any final framework. This is
  // re-applied after every gate-triggered regen below so regenerated
  // decisions cannot reintroduce stale/canonical ids.
  const normalizeAllDecisionFrameworkIds = () =>
    normalizeTargetFrameworkIds(decisionPoints, finalFrameworks);
  normalizeAllDecisionFrameworkIds();

  // Phase 5 (§9.4): post-generation quality gates. Each gate either passes
  // silently or attaches a qualityFlag to the affected decision(s). The
  // language gate already ran upstream; framework dedup/field completeness
  // already ran during framework parsing. Remaining gates (4–7) below.

  // Phase 5 (§9.4): each failing structural gate gets ONE focused regen
  // attempt at the per-decision level. We retain qualityFlags as the
  // surface to the professor when a regen attempt does not resolve the
  // failure, so the review checkpoint can still highlight residual issues.
  const primaryTargetCanonical = pedagogicalIntent.targetFrameworks?.[0]?.canonicalId;
  const runRegenForDecision = async (dpNum: number, hint: string, flagOnFail: string) => {
    try {
      const fresh = await regenerateSingleDecision({
        caseContext: parsed.caseContext ?? "",
        coreChallenge: parsed.coreChallenge ?? "",
        pedagogicalIntent,
        existingDecisions: decisionPoints,
        decisionNumber: dpNum,
        language: effectiveLang,
        hint,
      });
      const idx = decisionPoints.findIndex((d) => d.number === dpNum);
      if (idx >= 0) decisionPoints[idx] = fresh;
    } catch (err) {
      console.warn(`[canonicalCaseGenerator] regen for decision ${dpNum} failed:`, err);
      const idx = decisionPoints.findIndex((d) => d.number === dpNum);
      if (idx >= 0) decisionPoints[idx].qualityFlags = [...(decisionPoints[idx].qualityFlags ?? []), flagOnFail];
    }
    // Re-normalize after every regen so a regenerated decision cannot
    // reintroduce canonicalIds or unresolved framework ids.
    normalizeAllDecisionFrameworkIds();
  };

  // Gate 4: dimension coverage — EXEMPT from the §9.4 "one regen per gate"
  // rule by design. Dimensions are pre-assigned deterministically by
  // `assignDecisionDimensions` (§10.2 templates) BEFORE the LLM call, with
  // `no_consecutive_same` and competency promotion already enforced. The
  // only way Gate 4 can fail is if `effectiveSteps` itself yields fewer
  // distinct dimensions than required — that is a structural property of
  // the case length, not a regenerable LLM output. Regenerating any single
  // decision cannot alter the global dimension distribution. We therefore
  // surface this as a quality flag for the professor review checkpoint.
  const covG = checkDimensionCoverage(dimensions, effectiveSteps);
  if (!covG.ok) {
    console.warn(`[canonicalCaseGenerator] Gate4 dimension coverage failed: ${covG.distinctCount}/${covG.required}`);
    decisionPoints[0].qualityFlags = [...(decisionPoints[0].qualityFlags ?? []), `dimension_coverage_low_${covG.distinctCount}_of_${covG.required}`];
  }

  // Gate 5: framework coverage — must surface the PRIMARY target framework.
  // If it doesn't, regenerate the first decision with an explicit hint.
  const frG = await checkFrameworkCoverage(decisionPoints, finalFrameworks, primaryTargetCanonical, effectiveLang);
  if (!frG.ok) {
    console.warn(`[canonicalCaseGenerator] Gate5 primary framework "${frG.missingPrimary}" not surfaced — regenerating decision 1`);
    const hint = isEn
      ? `IMPORTANT: explicitly surface concepts from the primary framework "${frG.missingPrimary}" in the prompt and options.`
      : `IMPORTANTE: surfacea explícitamente conceptos del framework principal "${frG.missingPrimary}" en el prompt y opciones.`;
    await runRegenForDecision(1, hint, "framework_coverage_primary_missing");
    const reCheck = await checkFrameworkCoverage(decisionPoints, finalFrameworks, primaryTargetCanonical, effectiveLang);
    if (!reCheck.ok) {
      decisionPoints[0].qualityFlags = [...(decisionPoints[0].qualityFlags ?? []), "framework_coverage_primary_missing"];
    }
  }

  // Gate 6: tradeoff realism — combines signature completeness AND prompt
  // text containing both cost & benefit cues. Regenerate each failing
  // tradeoff decision with a single hint covering both requirements.
  const trSigG = checkTradeoffRealism(decisionPoints, dimensions);
  const perDimInitial = checkPerDimensionPromptText(decisionPoints);
  const tradeoffFailures = Array.from(new Set([
    ...trSigG.failingNumbers,
    ...perDimInitial.tradeoffPromptFailures,
  ]));
  if (tradeoffFailures.length > 0) {
    console.warn(`[canonicalCaseGenerator] Gate6 tradeoff failures: ${tradeoffFailures.join(", ")}`);
    const hint = isEn
      ? `IMPORTANT: name BOTH a concrete cost AND a concrete benefit in the prompt text; populate tradeoffSignature with non-empty dimension/cost/benefit.`
      : `IMPORTANTE: nombra TANTO un costo concreto COMO un beneficio concreto en el texto del prompt; completa tradeoffSignature con dimension/cost/benefit no vacíos.`;
    for (const num of tradeoffFailures) {
      await runRegenForDecision(num, hint, "tradeoff_incomplete");
    }
    const reTrSig = checkTradeoffRealism(decisionPoints, dimensions);
    const rePerDim = checkPerDimensionPromptText(decisionPoints);
    const residual = new Set([...reTrSig.failingNumbers, ...rePerDim.tradeoffPromptFailures]);
    for (const dp of decisionPoints) {
      if (residual.has(dp.number)) {
        dp.qualityFlags = [...(dp.qualityFlags ?? []), "tradeoff_incomplete"];
      }
    }
  }

  // Gate 6b (§10.3): per-dimension prompt-text validators for stakeholder /
  // analytical / strategic / ethical decisions. Each failing decision gets
  // ONE focused regen attempt with a dimension-specific hint; residuals
  // are flagged for the professor review checkpoint.
  const perDim = checkPerDimensionPromptText(decisionPoints);
  const perDimRegens: Array<[number[], string, string]> = [
    [
      perDim.stakeholderFailures,
      isEn
        ? "IMPORTANT: name at least TWO distinct stakeholders with non-aligned interests."
        : "IMPORTANTE: nombra al menos DOS stakeholders distintos con intereses no alineados.",
      "stakeholder_prompt_weak",
    ],
    [
      perDim.analyticalFailures,
      isEn
        ? "IMPORTANT: include a numeric data point or an explicit causal claim in the prompt or options."
        : "IMPORTANTE: incluye un dato numérico o una afirmación causal explícita en el prompt u opciones.",
      "analytical_prompt_weak",
    ],
    [
      perDim.strategicFailures,
      isEn
        ? "IMPORTANT: present at least TWO defensible strategic paths with distinct long-term consequences."
        : "IMPORTANTE: presenta al menos DOS caminos estratégicos defendibles con consecuencias de largo plazo distintas.",
      "strategic_prompt_weak",
    ],
    [
      perDim.ethicalFailures,
      isEn
        ? "IMPORTANT: frame the decision as a tension between two LEGITIMATE goods (not good vs. evil)."
        : "IMPORTANTE: enmarca la decisión como tensión entre dos BIENES LEGÍTIMOS (no bien vs. mal).",
      "ethical_prompt_weak",
    ],
  ];
  for (const [failingNums, hint, flag] of perDimRegens) {
    if (failingNums.length === 0) continue;
    console.warn(`[canonicalCaseGenerator] Gate6b ${flag} for: ${failingNums.join(", ")}`);
    for (const num of failingNums) {
      await runRegenForDecision(num, hint, flag);
    }
  }
  // Residual per-dimension flagging
  const finalPerDim = checkPerDimensionPromptText(decisionPoints);
  const finalFailures: Record<string, number[]> = {
    stakeholder_prompt_weak: finalPerDim.stakeholderFailures,
    analytical_prompt_weak: finalPerDim.analyticalFailures,
    strategic_prompt_weak: finalPerDim.strategicFailures,
    ethical_prompt_weak: finalPerDim.ethicalFailures,
  };
  for (const dp of decisionPoints) {
    for (const [flag, nums] of Object.entries(finalFailures)) {
      if (nums.includes(dp.number)) {
        dp.qualityFlags = [...(dp.qualityFlags ?? []), flag];
      }
    }
  }

  // Gate 7: no-correct-answer telegraphing — single full-case regen would
  // be expensive; instead regenerate decision 1 with a strong hint and
  // re-scan. Persistent failures are flagged.
  const tel = detectTelegraphing({ decisionPoints }, effectiveLang);
  if (tel.hit) {
    console.warn(`[canonicalCaseGenerator] Gate7 telegraphing detected: ${tel.samples.join(" | ")}`);
    const hint = isEn
      ? `Avoid all directive language: 'best', 'correct', 'optimal', 'should have', 'right answer'. Frame every option as defensible.`
      : `Evita lenguaje directivo: 'mejor', 'correcto', 'óptimo', 'debería haber', 'respuesta correcta'. Plantea cada opción como defendible.`;
    await runRegenForDecision(1, hint, "telegraphing_detected");
    const reTel = detectTelegraphing({ decisionPoints }, effectiveLang);
    if (reTel.hit) {
      decisionPoints[0].qualityFlags = [...(decisionPoints[0].qualityFlags ?? []), "telegraphing_detected"];
    }
  }

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

/**
 * Phase 5: regenerate a single decision point in an existing case while
 * keeping all other decisions intact. Builds a focused prompt anchored on
 * the case context, the target dimension, and any per-dimension constraint.
 * Returns the new decision point ready to splice into the case.
 */
export async function regenerateSingleDecision(args: {
  caseContext: string;
  coreChallenge: string;
  pedagogicalIntent: PedagogicalIntent;
  existingDecisions: DecisionPoint[];
  decisionNumber: number;
  language: "es" | "en";
  hint?: string;
}): Promise<DecisionPoint> {
  const { caseContext, coreChallenge, pedagogicalIntent, existingDecisions, decisionNumber, language, hint } = args;
  const isEn = language === "en";
  const dimensions = assignDecisionDimensions(pedagogicalIntent, existingDecisions.length);
  const target = dimensions.find((d) => d.decisionNumber === decisionNumber) ?? dimensions[Math.max(0, decisionNumber - 1)];
  const dim = target?.primaryDimension ?? "strategic";
  const others = existingDecisions
    .filter((d) => d.number !== decisionNumber)
    .map((d) => `Decision ${d.number} (${d.primaryDimension ?? "?"}): ${d.prompt.slice(0, 200)}`)
    .join("\n");

  const sys = isEn
    ? `You regenerate a SINGLE decision in an existing canonical business case. Keep continuity with the case context and the other decisions. Output JSON for ONE decision only.`
    : `Regeneras UNA SOLA decisión dentro de un caso canónico de negocios existente. Mantén la continuidad con el contexto y las otras decisiones. Devuelve JSON para UNA SOLA decisión.`;

  const usr = isEn
    ? `CASE CONTEXT:\n${caseContext}\n\nCORE CHALLENGE:\n${coreChallenge}\n\nTEACHING GOAL: ${pedagogicalIntent.teachingGoal}\n\nOTHER DECISIONS (do not duplicate):\n${others}\n\nREGENERATE Decision ${decisionNumber} with primaryDimension="${dim}".\n${dimensionConstraintFor(dim, "en")}\n${hint ? `\nADDITIONAL GUIDANCE: ${hint}` : ""}\n\nReturn JSON: {"number": ${decisionNumber}, "format": "written" | "multiple_choice", "prompt": "...", "options": ["..."]?, "requiresJustification": true | false, "focusCue": "...", "thinkingScaffold": ["..."], "dimensionRationale": "...", "targetFrameworkIds": ["..."], "tradeoffSignature": {"dimension":"...","cost":"...","benefit":"..."}?}`
    : `CONTEXTO DEL CASO:\n${caseContext}\n\nDESAFÍO CENTRAL:\n${coreChallenge}\n\nOBJETIVO PEDAGÓGICO: ${pedagogicalIntent.teachingGoal}\n\nOTRAS DECISIONES (no duplicar):\n${others}\n\nREGENERA la Decisión ${decisionNumber} con primaryDimension="${dim}".\n${dimensionConstraintFor(dim, "es")}\n${hint ? `\nGUÍA ADICIONAL: ${hint}` : ""}\n\nDevuelve JSON: {"number": ${decisionNumber}, "format": "written" | "multiple_choice", "prompt": "...", "options": ["..."]?, "requiresJustification": true | false, "focusCue": "...", "thinkingScaffold": ["..."], "dimensionRationale": "...", "targetFrameworkIds": ["..."], "tradeoffSignature": {"dimension":"...","cost":"...","benefit":"..."}?}`;

  const response = await generateChatCompletion(
    [
      { role: "system", content: sys },
      { role: "user", content: usr },
    ],
    { responseFormat: "json", maxTokens: 1024, agentName: "regenerateSingleDecision" }
  );

  const parsed = JSON.parse(response);
  const ts = parsed.tradeoffSignature && typeof parsed.tradeoffSignature === "object"
    ? {
        dimension: String(parsed.tradeoffSignature.dimension ?? "").trim(),
        cost: String(parsed.tradeoffSignature.cost ?? "").trim(),
        benefit: String(parsed.tradeoffSignature.benefit ?? "").trim(),
      } as TradeoffSignature
    : undefined;
  const previous = existingDecisions.find((d) => d.number === decisionNumber);
  return {
    number: decisionNumber,
    format: parsed.format === "multiple_choice" ? "multiple_choice" : (previous?.format ?? "written"),
    prompt: typeof parsed.prompt === "string" && parsed.prompt.trim() ? parsed.prompt.trim() : (previous?.prompt ?? ""),
    options: Array.isArray(parsed.options) ? parsed.options.filter((o: any) => typeof o === "string") : previous?.options,
    requiresJustification: parsed.requiresJustification ?? (previous?.requiresJustification ?? true),
    includesReflection: previous?.includesReflection ?? false,
    focusCue: typeof parsed.focusCue === "string" ? parsed.focusCue : previous?.focusCue,
    thinkingScaffold: Array.isArray(parsed.thinkingScaffold) ? parsed.thinkingScaffold : previous?.thinkingScaffold,
    tradeoffSignature: ts && (ts.cost || ts.benefit || ts.dimension) ? ts : previous?.tradeoffSignature,
    primaryDimension: dim,
    secondaryDimension: target?.secondaryDimension ?? previous?.secondaryDimension,
    dimensionRationale: typeof parsed.dimensionRationale === "string" && parsed.dimensionRationale.trim()
      ? parsed.dimensionRationale.trim()
      : previous?.dimensionRationale,
    targetFrameworkIds: Array.isArray(parsed.targetFrameworkIds)
      ? parsed.targetFrameworkIds.filter((s: any) => typeof s === "string")
      : previous?.targetFrameworkIds,
    reviewCompleted: false, // regenerated → reset review state
    qualityFlags: [],
  };
}

/**
 * Phase 5: shared helper that maps each decision's targetFrameworkIds to
 * the FINAL framework list's real `id`s, mapping canonicalId→id when
 * possible and dropping any value that doesn't resolve. Exported so the
 * regenerate-decision route can re-apply normalization after a single
 * decision is regenerated.
 */
export function normalizeTargetFrameworkIds(
  decisions: DecisionPoint[],
  frameworks: CaseFramework[],
): void {
  const idsByCanonical = new Map<string, string>();
  const idsById = new Set<string>();
  for (const fw of frameworks) {
    idsById.add(fw.id);
    if (fw.canonicalId) idsByCanonical.set(fw.canonicalId, fw.id);
  }
  for (const dp of decisions) {
    const raw = Array.isArray(dp.targetFrameworkIds) ? dp.targetFrameworkIds : [];
    const normalized = raw
      .map((v) => (idsById.has(v) ? v : idsByCanonical.get(v)))
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    dp.targetFrameworkIds = Array.from(new Set(normalized));
  }
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
    language,
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
    language,
  };
}
