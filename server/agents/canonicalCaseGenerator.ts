import type { 
  GeneratedScenarioData,
  InitialState,
  KPIs,
  Rubric,
  DecisionPoint,
  Indicator
} from "@shared/schema";
import { generateChatCompletion } from "../openai";

const CANONICAL_CASE_GENERATOR_PROMPT = `Eres un ARQUITECTO DE CASOS DE NEGOCIOS CANÓNICOS para SIMULEARN, una plataforma de simulación de negocios impulsada por IA para educación universitaria en América Latina.

TU MISIÓN: Crear casos de negocios siguiendo una ESTRUCTURA CANÓNICA ESTRICTA para el POC de febrero.

=== RESTRICCIONES OBLIGATORIAS (NO MODIFICABLES) ===
- Disciplina: Negocios
- Nivel: Pregrado universitario
- Duración del caso: 20-25 minutos total
- Puntos de decisión: EXACTAMENTE 3
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
- Ejemplo de enmarcado conceptual:
  * Opción A: Priorizar estabilidad a corto plazo
  * Opción B: Invertir en capacidad a largo plazo
  * Opción C: Equilibrar riesgo conservadoramente

SECCIÓN 4 - DECISIÓN 2 (Decisión Analítica):
- Formato: Justificación escrita corta (5-7 líneas)
- Abierta, sin presión de conteo de palabras
- El prompt debe:
  * Preguntar CÓMO y POR QUÉ
  * NUNCA preguntar cuál es la respuesta correcta
  * Fomentar consideración de trade-offs

SECCIÓN 5 - DECISIÓN 3 (Decisión Integrativa):
- Formato: Justificación escrita corta
- DEBE forzar síntesis de:
  * Información previa
  * Trade-offs
  * Consecuencias de decisiones anteriores
- La decisión debe sentirse CONSEQUENCIAL
- NO hay resultados de "equilibrio perfecto"
- Ambigüedad realista es alentada

SECCIÓN 6 - REFLEXIÓN (Ligera):
- UN solo prompt opcional
- Ejemplos:
  * "¿Qué factor influyó más en tus decisiones?"
  * "¿Qué explorarías diferente la próxima vez?"
- NO reflexiones largas, NO ensayos

=== INDICADORES DEL SISTEMA (4 INDICADORES POC) ===
Los indicadores deben reflejar:
1. Moral del equipo (teamMorale) - Estado emocional y compromiso del equipo
2. Impacto presupuestario (budgetImpact) - Salud financiera y disponibilidad de recursos
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

=== FORMATO DE SALIDA JSON ===
{
  "title": "Título compelling y específico en español",
  "description": "2-3 oraciones hook que emocionarían a estudiantes",
  "domain": "Dominio principal (ej: Gestión de Crisis, Marketing, Operaciones, Ética)",
  "caseContext": "El contexto completo del caso (120-180 palabras) - estilo Harvard Business Case",
  "coreChallenge": "El desafío central de negocios claramente articulado",
  "decisionPoints": [
    {
      "number": 1,
      "format": "multiple_choice",
      "prompt": "Pregunta de la decisión 1 - orientación estratégica",
      "options": ["Opción A: descripción", "Opción B: descripción", "Opción C: descripción"],
      "requiresJustification": false,
      "includesReflection": false
    },
    {
      "number": 2,
      "format": "written",
      "prompt": "Pregunta de la decisión 2 - análisis justificado (cómo y por qué)",
      "requiresJustification": true,
      "includesReflection": false
    },
    {
      "number": 3,
      "format": "written",
      "prompt": "Pregunta de la decisión 3 - integración de información y trade-offs",
      "requiresJustification": true,
      "includesReflection": false
    }
  ],
  "reflectionPrompt": "Pregunta de reflexión ligera",
  "indicators": [
    { "id": "teamMorale", "label": "Moral del Equipo", "value": 65, "description": "..." },
    { "id": "budgetImpact", "label": "Impacto Presupuestario", "value": 70, "description": "..." },
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
  additionalContext?: string
): Promise<CanonicalCaseData> {
  const contextAddition = additionalContext 
    ? `\n\nContexto adicional del profesor:\n${additionalContext}` 
    : "";

  const response = await generateChatCompletion(
    [
      { role: "system", content: CANONICAL_CASE_GENERATOR_PROMPT },
      { 
        role: "user", 
        content: `Crea un caso de negocios canónico basado en este tema/industria:

TEMA: ${topic}${contextAddition}

Genera un caso de negocios COMPLETO siguiendo la estructura canónica, TODO en español latinoamericano.
El caso debe durar 20-25 minutos para completar.
Recuerda: 3 puntos de decisión exactamente, sin respuestas correctas, tono de mentoría.` 
      },
    ],
    { responseFormat: "json", maxTokens: 4096 }
  );

  const parsed = JSON.parse(response);
  
  const defaultIndicators: Indicator[] = [
    { id: "teamMorale", label: "Moral del Equipo", value: 65, description: "Nivel de motivación y compromiso del equipo" },
    { id: "budgetImpact", label: "Impacto Presupuestario", value: 70, description: "Estado del presupuesto disponible" },
    { id: "operationalRisk", label: "Riesgo Operacional", value: 50, description: "Nivel de riesgo en operaciones" },
    { id: "strategicFlexibility", label: "Flexibilidad Estratégica", value: 60, description: "Capacidad de adaptación estratégica" },
  ];

  const decisionPoints: DecisionPoint[] = (parsed.decisionPoints || []).map((dp: any, index: number) => ({
    number: dp.number || index + 1,
    format: dp.format || (index === 0 ? "multiple_choice" : "written"),
    prompt: dp.prompt || `Decisión ${index + 1}`,
    options: dp.options || undefined,
    requiresJustification: dp.requiresJustification ?? (index > 0),
    includesReflection: dp.includesReflection ?? false,
  }));

  while (decisionPoints.length < 3) {
    const num = decisionPoints.length + 1;
    decisionPoints.push({
      number: num,
      format: num === 1 ? "multiple_choice" : "written",
      prompt: `Decisión ${num} - Por favor proporcione su análisis`,
      options: num === 1 ? ["Opción A", "Opción B", "Opción C"] : undefined,
      requiresJustification: num > 1,
      includesReflection: false,
    });
  }

  const indicators: Indicator[] = (parsed.indicators || []).length >= 4 
    ? parsed.indicators.map((ind: any) => ({
        id: ind.id || "indicator",
        label: ind.label || "Indicador",
        value: typeof ind.value === "number" ? ind.value : 50,
        description: ind.description,
      }))
    : defaultIndicators;

  return {
    title: parsed.title || "Caso de Negocios",
    description: parsed.description || "Un caso de simulación de negocios",
    domain: parsed.domain || "Gestión de Negocios",
    caseContext: parsed.caseContext || "Contexto del caso pendiente...",
    coreChallenge: parsed.coreChallenge || "Desafío central por definir...",
    decisionPoints: decisionPoints.slice(0, 3),
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
  canonical: CanonicalCaseData
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

  const introText = `${canonical.caseContext}

**Desafío Central:**
${canonical.coreChallenge}`;

  const initialState: InitialState = {
    kpis: defaultKpis,
    indicators: canonical.indicators,
    decisionPoints: canonical.decisionPoints,
    totalDecisions: 3,
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
