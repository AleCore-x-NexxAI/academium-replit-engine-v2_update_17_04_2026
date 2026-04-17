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
  Indicator
} from "@shared/schema";
import { getCanonicalKPIs } from "@shared/schema";
import { generateChatCompletion } from "../openai";
import { POC_VERSION, STRUCTURE_LOCK_NOTICE, DEFAULT_DECISIONS, MIN_DECISIONS, MAX_DECISIONS } from "./constants";

function buildCanonicalPrompt(stepCount: number): string {
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
  "confidence": 85
}

IMPORTANTE: 
- TODO el contenido DEBE estar en ESPAÑOL LATINOAMERICANO
- El contexto del caso debe sentirse como un caso de Harvard Business School - profesional e inmersivo
- NO incluir respuestas correctas implícitas
- Cada opción de decisión 1 debe ser igualmente defendible`;
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
  confidence: number;
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
    ? `\n\nContexto adicional del profesor:\n${additionalContext}` 
    : "";

  const langDirective = isEn
    ? `\n\nCRITICAL LANGUAGE OVERRIDE: Generate ALL content in ENGLISH. All titles, descriptions, prompts, options, contexts, constraints, and objectives MUST be in English. Zero Spanish.\nCRITICAL: Indicator labels MUST be in English. Example English labels: "Team Morale", "Budget", "Brand Reputation".`
    : `\n\nCRÍTICO: Los nombres de indicadores DEBEN estar en español. Ejemplo: "Moral del Equipo", "Presupuesto", "Reputación".`;

  const response = await generateChatCompletion(
    [
      { role: "system", content: buildCanonicalPrompt(effectiveSteps) + langDirective },
      { 
        role: "user", 
        content: isEn
          ? `Create a canonical business case based on this topic/industry:\n\nTOPIC: ${topic}${contextAddition}\n\nGenerate a COMPLETE business case following the canonical structure, ALL in English.\nThe case should last ${durationMin}-${durationMax} minutes to complete.\nRemember: exactly ${effectiveSteps} decision points, no correct answers, mentoring tone.`
          : `Crea un caso de negocios canónico basado en este tema/industria:\n\nTEMA: ${topic}${contextAddition}\n\nGenera un caso de negocios COMPLETO siguiendo la estructura canónica, TODO en español latinoamericano.\nEl caso debe durar ${durationMin}-${durationMax} minutos para completar.\nRecuerda: ${effectiveSteps} puntos de decisión exactamente, sin respuestas correctas, tono de mentoría.`
      },
    ],
    { responseFormat: "json", maxTokens: 4096 + (effectiveSteps > 3 ? (effectiveSteps - 3) * 512 : 0), agentName: "canonicalCaseGenerator" }
  );

  const parsed = JSON.parse(response);
  
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
  
  const decisionPoints: DecisionPoint[] = (parsed.decisionPoints || []).map((dp: any, index: number) => ({
    number: dp.number || index + 1,
    format: dp.format || (index === 0 ? "multiple_choice" : "written"),
    prompt: dp.prompt || `Decisión ${index + 1}`,
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
      prompt: `Decisión ${num} - Por favor proporcione su análisis`,
      options: num === 1 ? ["Opción A", "Opción B", "Opción C"] : undefined,
      requiresJustification: num > 1,
      includesReflection: false,
      focusCue: defaultFocusCues[(num - 1) % defaultFocusCues.length],
      thinkingScaffold: ["Stakeholders clave", "Trade-offs principales", "Consecuencias futuras"],
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
        label: ind.label || "Indicador",
        value: typeof ind.value === "number" ? ind.value : 50,
        description: ind.description,
        direction: ind.direction || directionDefaults[ind.id] || "up_better",
      }))
    : defaultIndicators;

  return {
    title: parsed.title || "Caso de Negocios",
    description: parsed.description || "Un caso de simulación de negocios",
    domain: parsed.domain || "Gestión de Negocios",
    caseContext: parsed.caseContext || "Contexto del caso pendiente...",
    coreChallenge: parsed.coreChallenge || "Desafío central por definir...",
    decisionPoints: decisionPoints.slice(0, effectiveSteps),
    reflectionPrompt: parsed.reflectionPrompt || "¿Qué factor influyó más en tus decisiones?",
    indicators,
    role: parsed.role || "Gerente",
    objective: parsed.objective || "Navegar la situación exitosamente",
    companyName: parsed.companyName || "Empresa",
    industry: parsed.industry || "Negocios",
    timelineContext: parsed.timelineContext || "Situación urgente",
    keyConstraints: parsed.keyConstraints || ["Presupuesto limitado", "Tiempo restringido"],
    learningObjectives: parsed.learningObjectives || ["Pensamiento crítico", "Toma de decisiones"],
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
