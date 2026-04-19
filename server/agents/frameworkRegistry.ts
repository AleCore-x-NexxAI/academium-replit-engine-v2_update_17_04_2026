// Phase 2 (v3.0 §4.5 / Apéndice D.4) — canonical framework registry.
// 13 seed entries (Porter Generic Strategies and Five Forces seed separately).
import type { CaseFramework, FrameworkPrimaryDimension } from "@shared/schema";

export interface FrameworkRegistryEntry {
  canonicalId: string;
  canonicalName_en: string;
  canonicalName_es: string;
  primaryDimension: FrameworkPrimaryDimension;
  conceptualDescription_en: string;
  conceptualDescription_es: string;
  coreConcepts_en: string[];
  coreConcepts_es: string[];
  recognitionSignals_en: string[];
  recognitionSignals_es: string[];
  suggestedDomainKeywords_en: string[];
  suggestedDomainKeywords_es: string[];
  aliases: string[];
  suggestedSignalPattern?: NonNullable<CaseFramework["signalPattern"]>;
}

export const FRAMEWORK_REGISTRY: FrameworkRegistryEntry[] = [
  {
    canonicalId: "porter_generic_strategies",
    canonicalName_en: "Porter's Generic Strategies",
    canonicalName_es: "Estrategias Genéricas de Porter",
    primaryDimension: "strategic",
    conceptualDescription_en:
      "A strategy framework arguing firms must choose between cost leadership, differentiation, or focus on a narrow segment to achieve competitive advantage. Trying to be all things to all customers leaves a firm 'stuck in the middle.'",
    conceptualDescription_es:
      "Un marco estratégico que sostiene que las empresas deben elegir entre liderazgo en costos, diferenciación o enfoque en un segmento estrecho para lograr ventaja competitiva. Intentar ser todo para todos deja a la empresa 'atrapada en el medio.'",
    coreConcepts_en: ["cost leadership", "differentiation", "focus", "competitive advantage", "stuck in the middle"],
    coreConcepts_es: ["liderazgo en costos", "diferenciación", "enfoque", "ventaja competitiva", "atrapado en el medio"],
    recognitionSignals_en: [
      "narrowing scope to a specific segment",
      "choosing between low-cost positioning and premium positioning",
      "rejecting a broad approach to focus on a niche",
      "explicit trade-off between price and uniqueness",
    ],
    recognitionSignals_es: [
      "estrechar el alcance a un segmento específico",
      "elegir entre posicionamiento de bajo costo y posicionamiento premium",
      "rechazar un enfoque amplio para concentrarse en un nicho",
      "trade-off explícito entre precio y diferenciación",
    ],
    suggestedDomainKeywords_en: ["differentiation", "cost leadership", "focus strategy", "niche", "positioning", "competitive advantage"],
    suggestedDomainKeywords_es: ["diferenciación", "liderazgo en costos", "estrategia de enfoque", "nicho", "posicionamiento", "ventaja competitiva"],
    aliases: ["porter", "porters generic strategies", "generic strategies", "porter strategies", "estrategias genericas", "estrategias de porter"],
    suggestedSignalPattern: { requiredSignals: ["intent", "tradeoffAwareness"], minQuality: "PRESENT" },
  },
  {
    canonicalId: "porter_five_forces",
    canonicalName_en: "Porter's Five Forces",
    canonicalName_es: "Cinco Fuerzas de Porter",
    primaryDimension: "analytical",
    conceptualDescription_en:
      "A framework for analyzing industry attractiveness via five competitive forces: rivalry among existing competitors, threat of new entrants, threat of substitutes, bargaining power of suppliers, and bargaining power of buyers.",
    conceptualDescription_es:
      "Un marco para analizar el atractivo de una industria a través de cinco fuerzas competitivas: rivalidad entre competidores existentes, amenaza de nuevos entrantes, amenaza de sustitutos, poder de negociación de proveedores y poder de negociación de compradores.",
    coreConcepts_en: ["rivalry", "new entrants", "substitutes", "supplier power", "buyer power"],
    coreConcepts_es: ["rivalidad", "nuevos entrantes", "sustitutos", "poder de proveedores", "poder de compradores"],
    recognitionSignals_en: [
      "evaluating supplier or buyer leverage",
      "assessing barriers to entry",
      "weighing the threat of substitute products",
      "analyzing competitive intensity in the industry",
    ],
    recognitionSignals_es: [
      "evaluar el poder de proveedores o compradores",
      "evaluar barreras de entrada",
      "considerar la amenaza de productos sustitutos",
      "analizar la intensidad competitiva de la industria",
    ],
    suggestedDomainKeywords_en: ["five forces", "rivalry", "barriers to entry", "substitutes", "supplier power", "buyer power"],
    suggestedDomainKeywords_es: ["cinco fuerzas", "rivalidad", "barreras de entrada", "sustitutos", "poder proveedores", "poder compradores"],
    aliases: ["five forces", "5 forces", "cinco fuerzas", "5 fuerzas", "porter five forces", "porter 5 forces"],
    suggestedSignalPattern: { requiredSignals: ["justification", "tradeoffAwareness"], minQuality: "PRESENT" },
  },
  {
    canonicalId: "swot",
    canonicalName_en: "SWOT Analysis",
    canonicalName_es: "Análisis FODA",
    primaryDimension: "analytical",
    conceptualDescription_en:
      "A diagnostic tool that evaluates a situation across four dimensions: internal Strengths and Weaknesses; external Opportunities and Threats. Used to align strategy with internal capabilities and external context.",
    conceptualDescription_es:
      "Una herramienta diagnóstica que evalúa una situación en cuatro dimensiones: Fortalezas y Debilidades internas; Oportunidades y Amenazas externas. Se usa para alinear la estrategia con las capacidades internas y el contexto externo.",
    coreConcepts_en: ["strengths", "weaknesses", "opportunities", "threats", "internal vs external"],
    coreConcepts_es: ["fortalezas", "debilidades", "oportunidades", "amenazas", "interno vs externo"],
    recognitionSignals_en: [
      "listing internal capabilities alongside external risks",
      "weighing what the firm does well against market threats",
      "mapping opportunities to existing strengths",
    ],
    recognitionSignals_es: [
      "enumerar capacidades internas junto a riesgos externos",
      "contraponer lo que la empresa hace bien con amenazas del mercado",
      "mapear oportunidades a fortalezas existentes",
    ],
    suggestedDomainKeywords_en: ["strengths", "weaknesses", "opportunities", "threats", "internal", "external"],
    suggestedDomainKeywords_es: ["fortalezas", "debilidades", "oportunidades", "amenazas", "interno", "externo"],
    aliases: ["swot", "swot analysis", "foda", "analisis foda", "análisis foda", "dafo"],
    suggestedSignalPattern: { requiredSignals: ["justification"], minQuality: "PRESENT" },
  },
  {
    canonicalId: "pestel",
    canonicalName_en: "PESTEL Analysis",
    canonicalName_es: "Análisis PESTEL",
    primaryDimension: "analytical",
    conceptualDescription_en:
      "A scan of the external macro-environment along six dimensions: Political, Economic, Social, Technological, Environmental, and Legal forces shaping a market.",
    conceptualDescription_es:
      "Un escaneo del macro-entorno externo en seis dimensiones: fuerzas Políticas, Económicas, Sociales, Tecnológicas, Ambientales y Legales que dan forma a un mercado.",
    coreConcepts_en: ["political", "economic", "social", "technological", "environmental", "legal"],
    coreConcepts_es: ["político", "económico", "social", "tecnológico", "ambiental", "legal"],
    recognitionSignals_en: [
      "scanning regulatory or political shifts",
      "weighing macroeconomic conditions",
      "assessing technological or societal trends",
    ],
    recognitionSignals_es: [
      "escanear cambios regulatorios o políticos",
      "evaluar condiciones macroeconómicas",
      "evaluar tendencias tecnológicas o sociales",
    ],
    suggestedDomainKeywords_en: ["pestel", "political", "regulatory", "macroeconomic", "technological trends"],
    suggestedDomainKeywords_es: ["pestel", "político", "regulatorio", "macroeconómico", "tendencias tecnológicas"],
    aliases: ["pestel", "pest", "pestle", "analisis pestel", "análisis pestel"],
  },
  {
    canonicalId: "bcg_matrix",
    canonicalName_en: "BCG Matrix",
    canonicalName_es: "Matriz BCG",
    primaryDimension: "strategic",
    conceptualDescription_en:
      "A portfolio framework classifying business units by market growth and relative market share into Stars, Cash Cows, Question Marks, and Dogs to guide investment and divestment decisions.",
    conceptualDescription_es:
      "Un marco de portafolio que clasifica las unidades de negocio por crecimiento de mercado y participación relativa en Estrellas, Vacas Lecheras, Interrogantes y Perros para guiar decisiones de inversión y desinversión.",
    coreConcepts_en: ["stars", "cash cows", "question marks", "dogs", "portfolio allocation"],
    coreConcepts_es: ["estrellas", "vacas lecheras", "interrogantes", "perros", "asignación de portafolio"],
    recognitionSignals_en: [
      "classifying products by growth and share",
      "deciding which units to fund versus harvest",
      "treating the business as a portfolio of bets",
    ],
    recognitionSignals_es: [
      "clasificar productos por crecimiento y participación",
      "decidir qué unidades financiar versus cosechar",
      "tratar al negocio como un portafolio de apuestas",
    ],
    suggestedDomainKeywords_en: ["bcg", "cash cow", "star", "question mark", "portfolio", "market share"],
    suggestedDomainKeywords_es: ["bcg", "vaca lechera", "estrella", "interrogante", "portafolio", "participación de mercado"],
    aliases: ["bcg", "bcg matrix", "boston matrix", "matriz bcg", "matriz boston"],
  },
  {
    canonicalId: "value_chain",
    canonicalName_en: "Value Chain Analysis",
    canonicalName_es: "Análisis de Cadena de Valor",
    primaryDimension: "analytical",
    conceptualDescription_en:
      "Decomposes a firm into primary and support activities to identify where value is created and where margin can be improved through cost reduction or differentiation at each link.",
    conceptualDescription_es:
      "Descompone a la empresa en actividades primarias y de apoyo para identificar dónde se crea valor y dónde se puede mejorar el margen mediante reducción de costos o diferenciación en cada eslabón.",
    coreConcepts_en: ["primary activities", "support activities", "margin", "linkages", "value creation"],
    coreConcepts_es: ["actividades primarias", "actividades de apoyo", "margen", "enlaces", "creación de valor"],
    recognitionSignals_en: [
      "examining where margin is gained or lost across operations",
      "identifying value-creating activities by stage",
      "linking operational decisions to competitive advantage",
    ],
    recognitionSignals_es: [
      "examinar dónde se gana o pierde margen en las operaciones",
      "identificar actividades creadoras de valor por etapa",
      "vincular decisiones operativas con ventaja competitiva",
    ],
    suggestedDomainKeywords_en: ["value chain", "primary activities", "support activities", "margin", "operations"],
    suggestedDomainKeywords_es: ["cadena de valor", "actividades primarias", "actividades de apoyo", "margen", "operaciones"],
    aliases: ["value chain", "porter value chain", "cadena de valor"],
  },
  {
    canonicalId: "rbv",
    canonicalName_en: "Resource-Based View",
    canonicalName_es: "Visión Basada en Recursos",
    primaryDimension: "strategic",
    conceptualDescription_en:
      "Argues sustainable competitive advantage comes from resources and capabilities that are Valuable, Rare, Inimitable, and Non-substitutable (VRIN/VRIO). Strategy starts with what the firm uniquely owns or knows.",
    conceptualDescription_es:
      "Sostiene que la ventaja competitiva sostenible proviene de recursos y capacidades que son Valiosos, Raros, Inimitables y No sustituibles (VRIN/VRIO). La estrategia comienza con lo que la empresa posee o sabe de forma única.",
    coreConcepts_en: ["valuable", "rare", "inimitable", "non-substitutable", "core capabilities"],
    coreConcepts_es: ["valioso", "raro", "inimitable", "no sustituible", "capacidades centrales"],
    recognitionSignals_en: [
      "anchoring strategy in unique internal capabilities",
      "evaluating resources for rarity and imitability",
      "leveraging intangible assets like brand or know-how",
    ],
    recognitionSignals_es: [
      "anclar la estrategia en capacidades internas únicas",
      "evaluar recursos por su rareza e imitabilidad",
      "apalancar activos intangibles como marca o know-how",
    ],
    suggestedDomainKeywords_en: ["resource-based", "vrio", "vrin", "capabilities", "core competence"],
    suggestedDomainKeywords_es: ["basado en recursos", "vrio", "vrin", "capacidades", "competencia central"],
    aliases: ["rbv", "resource based view", "resource-based view", "vrio", "vrin", "vision basada en recursos", "visión basada en recursos"],
  },
  {
    canonicalId: "stakeholder_analysis",
    canonicalName_en: "Stakeholder Analysis",
    canonicalName_es: "Análisis de Stakeholders",
    primaryDimension: "stakeholder",
    conceptualDescription_en:
      "Identifies the parties affected by or able to affect a decision, then maps their interests and influence to inform engagement and trade-off decisions.",
    conceptualDescription_es:
      "Identifica a las partes afectadas por o capaces de afectar una decisión, y mapea sus intereses e influencia para informar decisiones de involucramiento y trade-offs.",
    coreConcepts_en: ["interests", "influence", "engagement", "power-interest grid", "salience"],
    coreConcepts_es: ["intereses", "influencia", "involucramiento", "matriz poder-interés", "saliencia"],
    recognitionSignals_en: [
      "naming distinct parties and their concerns",
      "weighing influence and interest of affected groups",
      "tailoring action to specific stakeholder needs",
    ],
    recognitionSignals_es: [
      "nombrar partes distintas y sus preocupaciones",
      "ponderar la influencia e interés de los grupos afectados",
      "adaptar la acción a necesidades específicas de stakeholders",
    ],
    suggestedDomainKeywords_en: ["stakeholders", "interests", "influence", "power", "engagement"],
    suggestedDomainKeywords_es: ["stakeholders", "intereses", "influencia", "poder", "involucramiento"],
    aliases: ["stakeholder analysis", "stakeholder mapping", "analisis de stakeholders", "mapeo de stakeholders"],
    suggestedSignalPattern: { requiredSignals: ["stakeholderAwareness"], minQuality: "PRESENT" },
  },
  {
    canonicalId: "cost_benefit",
    canonicalName_en: "Cost-Benefit Analysis",
    canonicalName_es: "Análisis Costo-Beneficio",
    primaryDimension: "tradeoff",
    conceptualDescription_en:
      "Systematically compares the expected costs and benefits of an option, often quantitatively, to support decisions where trade-offs across dimensions need to be reconciled.",
    conceptualDescription_es:
      "Compara sistemáticamente los costos y beneficios esperados de una opción, a menudo cuantitativamente, para apoyar decisiones donde se deben conciliar trade-offs entre dimensiones.",
    coreConcepts_en: ["expected costs", "expected benefits", "net value", "opportunity cost", "quantification"],
    coreConcepts_es: ["costos esperados", "beneficios esperados", "valor neto", "costo de oportunidad", "cuantificación"],
    recognitionSignals_en: [
      "weighing expected gains against expected losses",
      "explicitly tallying pros versus cons",
      "naming opportunity cost of an alternative",
    ],
    recognitionSignals_es: [
      "ponderar ganancias esperadas contra pérdidas esperadas",
      "enumerar explícitamente pros versus contras",
      "nombrar el costo de oportunidad de una alternativa",
    ],
    suggestedDomainKeywords_en: ["cost-benefit", "tradeoff", "opportunity cost", "net value", "pros and cons"],
    suggestedDomainKeywords_es: ["costo-beneficio", "trade-off", "costo de oportunidad", "valor neto", "pros y contras"],
    aliases: ["cost-benefit", "cost benefit analysis", "cba", "analisis costo-beneficio", "análisis costo-beneficio"],
    suggestedSignalPattern: { requiredSignals: ["tradeoffAwareness", "justification"], minQuality: "PRESENT" },
  },
  {
    canonicalId: "batna",
    canonicalName_en: "BATNA",
    canonicalName_es: "MAAN (BATNA)",
    primaryDimension: "tradeoff",
    conceptualDescription_en:
      "The Best Alternative To a Negotiated Agreement — the course of action a party will take if the current negotiation fails. Strengthens decisions by anchoring to a credible fallback rather than the negotiation itself.",
    conceptualDescription_es:
      "La Mejor Alternativa a un Acuerdo Negociado — el curso de acción que una parte tomará si la negociación actual fracasa. Fortalece decisiones al anclarlas a una alternativa creíble en lugar de a la negociación misma.",
    coreConcepts_en: ["alternative", "reservation value", "walk-away", "leverage", "fallback"],
    coreConcepts_es: ["alternativa", "valor de reserva", "punto de retiro", "apalancamiento", "alternativa de respaldo"],
    recognitionSignals_en: [
      "naming a fallback if the negotiation fails",
      "evaluating leverage from outside options",
      "setting a walk-away threshold",
    ],
    recognitionSignals_es: [
      "nombrar una alternativa si la negociación fracasa",
      "evaluar apalancamiento desde opciones externas",
      "establecer un umbral de retiro",
    ],
    suggestedDomainKeywords_en: ["batna", "alternative", "walk away", "leverage", "fallback"],
    suggestedDomainKeywords_es: ["maan", "batna", "alternativa", "retirarse", "respaldo"],
    aliases: ["batna", "maan"],
  },
  {
    canonicalId: "blue_ocean",
    canonicalName_en: "Blue Ocean Strategy",
    canonicalName_es: "Estrategia del Océano Azul",
    primaryDimension: "strategic",
    conceptualDescription_en:
      "Argues firms should create uncontested market space ('blue oceans') by simultaneously pursuing differentiation and low cost via the Eliminate-Reduce-Raise-Create grid, rather than competing in saturated 'red oceans.'",
    conceptualDescription_es:
      "Sostiene que las empresas deben crear espacios de mercado sin competencia ('océanos azules') buscando simultáneamente diferenciación y bajo costo mediante la matriz Eliminar-Reducir-Aumentar-Crear, en lugar de competir en 'océanos rojos' saturados.",
    coreConcepts_en: ["uncontested market", "value innovation", "eliminate-reduce-raise-create", "red ocean", "blue ocean"],
    coreConcepts_es: ["mercado sin competencia", "innovación en valor", "eliminar-reducir-aumentar-crear", "océano rojo", "océano azul"],
    recognitionSignals_en: [
      "creating new demand instead of fighting over existing",
      "redefining the offering to bypass competitors",
      "pursuing differentiation and lower cost simultaneously",
    ],
    recognitionSignals_es: [
      "crear nueva demanda en lugar de pelear por la existente",
      "redefinir la oferta para evadir competidores",
      "buscar simultáneamente diferenciación y menor costo",
    ],
    suggestedDomainKeywords_en: ["blue ocean", "value innovation", "uncontested market", "new demand"],
    suggestedDomainKeywords_es: ["océano azul", "innovación en valor", "mercado sin competencia", "nueva demanda"],
    aliases: ["blue ocean", "blue ocean strategy", "oceano azul", "océano azul", "estrategia oceano azul"],
  },
  {
    canonicalId: "ansoff",
    canonicalName_en: "Ansoff Matrix",
    canonicalName_es: "Matriz Ansoff",
    primaryDimension: "strategic",
    conceptualDescription_en:
      "Maps growth options across two axes — existing vs new products and existing vs new markets — yielding four strategies: market penetration, product development, market development, and diversification.",
    conceptualDescription_es:
      "Mapea opciones de crecimiento en dos ejes — productos existentes vs nuevos y mercados existentes vs nuevos — generando cuatro estrategias: penetración de mercado, desarrollo de producto, desarrollo de mercado y diversificación.",
    coreConcepts_en: ["market penetration", "product development", "market development", "diversification"],
    coreConcepts_es: ["penetración de mercado", "desarrollo de producto", "desarrollo de mercado", "diversificación"],
    recognitionSignals_en: [
      "choosing between deepening current markets and expanding to new ones",
      "weighing new products versus existing offerings as the growth lever",
      "framing growth as a 2x2 of products and markets",
    ],
    recognitionSignals_es: [
      "elegir entre profundizar en mercados actuales y expandir a nuevos",
      "ponderar nuevos productos versus ofertas existentes como palanca de crecimiento",
      "encuadrar el crecimiento como una matriz 2x2 de productos y mercados",
    ],
    suggestedDomainKeywords_en: ["ansoff", "market penetration", "product development", "market development", "diversification"],
    suggestedDomainKeywords_es: ["ansoff", "penetración mercado", "desarrollo producto", "desarrollo mercado", "diversificación"],
    aliases: ["ansoff", "ansoff matrix", "matriz ansoff"],
  },
  {
    canonicalId: "balanced_scorecard",
    canonicalName_en: "Balanced Scorecard",
    canonicalName_es: "Cuadro de Mando Integral",
    primaryDimension: "analytical",
    conceptualDescription_en:
      "A performance management framework that translates strategy into measurable objectives across four perspectives: financial, customer, internal processes, and learning and growth.",
    conceptualDescription_es:
      "Un marco de gestión de desempeño que traduce la estrategia en objetivos medibles en cuatro perspectivas: financiera, del cliente, de procesos internos y de aprendizaje y crecimiento.",
    coreConcepts_en: ["financial perspective", "customer perspective", "internal processes", "learning and growth", "kpis"],
    coreConcepts_es: ["perspectiva financiera", "perspectiva del cliente", "procesos internos", "aprendizaje y crecimiento", "kpis"],
    recognitionSignals_en: [
      "tracking performance across multiple non-financial dimensions",
      "linking strategic objectives to operational metrics",
      "balancing short-term financials with long-term learning",
    ],
    recognitionSignals_es: [
      "monitorear desempeño en múltiples dimensiones no financieras",
      "vincular objetivos estratégicos a métricas operativas",
      "equilibrar finanzas de corto plazo con aprendizaje de largo plazo",
    ],
    suggestedDomainKeywords_en: ["balanced scorecard", "kpi", "perspectives", "strategy map", "performance"],
    suggestedDomainKeywords_es: ["cuadro de mando", "kpi", "perspectivas", "mapa estratégico", "desempeño"],
    aliases: ["balanced scorecard", "bsc", "cuadro de mando integral", "cmi"],
  },
];

const NORMALIZE = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export interface ResolvedFramework {
  canonicalId: string;
  canonicalName: string;
  aliases: string[];
  coreConcepts: string[];
  conceptualDescription: string;
  recognitionSignals: string[];
  primaryDimension: FrameworkPrimaryDimension;
  suggestedDomainKeywords: string[];
  suggestedSignalPattern?: NonNullable<CaseFramework["signalPattern"]>;
}

export function resolveFrameworkName(
  name: string,
  language: "es" | "en" = "es",
): ResolvedFramework | null {
  if (!name || typeof name !== "string") return null;
  const norm = NORMALIZE(name);
  if (!norm) return null;

  // Porter alone is ambiguous between Generic Strategies and Five Forces.
  // Per packet §4.5, return null and let the client disambiguate.
  if (norm === "porter" || norm === "porters" || norm === "porter s") {
    return null;
  }

  for (const entry of FRAMEWORK_REGISTRY) {
    const candidates = new Set<string>([
      NORMALIZE(entry.canonicalName_en),
      NORMALIZE(entry.canonicalName_es),
      ...entry.aliases.map(NORMALIZE),
    ]);
    if (candidates.has(norm)) {
      return toResolved(entry, language);
    }
  }

  // Loose contains-style fallback for short alias hits like "swot" inside "swot analysis"
  for (const entry of FRAMEWORK_REGISTRY) {
    const candidates = [
      NORMALIZE(entry.canonicalName_en),
      NORMALIZE(entry.canonicalName_es),
      ...entry.aliases.map(NORMALIZE),
    ];
    if (candidates.some((c) => c.length >= 3 && (norm === c || norm.startsWith(c + " ") || norm.endsWith(" " + c)))) {
      return toResolved(entry, language);
    }
  }

  return null;
}

export function getRegistryEntryById(canonicalId: string): FrameworkRegistryEntry | undefined {
  return FRAMEWORK_REGISTRY.find((e) => e.canonicalId === canonicalId);
}

function toResolved(entry: FrameworkRegistryEntry, language: "es" | "en"): ResolvedFramework {
  const isEn = language === "en";
  return {
    canonicalId: entry.canonicalId,
    canonicalName: isEn ? entry.canonicalName_en : entry.canonicalName_es,
    aliases: entry.aliases,
    coreConcepts: isEn ? entry.coreConcepts_en : entry.coreConcepts_es,
    conceptualDescription: isEn ? entry.conceptualDescription_en : entry.conceptualDescription_es,
    recognitionSignals: isEn ? entry.recognitionSignals_en : entry.recognitionSignals_es,
    primaryDimension: entry.primaryDimension,
    suggestedDomainKeywords: isEn ? entry.suggestedDomainKeywords_en : entry.suggestedDomainKeywords_es,
    suggestedSignalPattern: entry.suggestedSignalPattern,
  };
}

/**
 * Map our 5 reasoning signal names to a CaseFramework.primaryDimension key.
 */
export const SIGNAL_FOR_DIMENSION: Record<FrameworkPrimaryDimension, "intent" | "justification" | "tradeoffAwareness" | "stakeholderAwareness" | "ethicalAwareness"> = {
  analytical: "justification",
  strategic: "intent",
  tradeoff: "tradeoffAwareness",
  stakeholder: "stakeholderAwareness",
  ethical: "ethicalAwareness",
};
