// Phase 2 (v3.0 §4.5 / Apéndice D.4) — canonical framework registry.
// 41 entries across 6 disciplines (expanded from 13 strategy-focused entries in Task #75).
// Note: Balanced Scorecard spans two disciplines (strategy + business) as a single entry, not two.
import type { CaseFramework, FrameworkPrimaryDimension } from "@shared/schema";

export interface FrameworkRegistryEntry {
  canonicalId: string;
  canonicalName_en: string;
  canonicalName_es: string;
  primaryDimension: FrameworkPrimaryDimension;
  disciplines: string[];
  conceptualDescription_en: string;
  conceptualDescription_es: string;
  disciplineDescriptions?: {
    [discipline: string]: {
      en: string;
      es: string;
    };
  };
  coreConcepts_en: string[];
  coreConcepts_es: string[];
  recognitionSignals_en: string[];
  recognitionSignals_es: string[];
  suggestedDomainKeywords_en: string[];
  suggestedDomainKeywords_es: string[];
  aliases: string[];
  suggestedSignalPattern?: NonNullable<CaseFramework["signalPattern"]>;
}

export const FRAMEWORK_DISCIPLINES = [
  "business",
  "marketing",
  "finance",
  "operations",
  "human_resources",
  "strategy",
] as const;

export type FrameworkDiscipline = (typeof FRAMEWORK_DISCIPLINES)[number];

export const DISCIPLINE_LABELS: Record<FrameworkDiscipline, { en: string; es: string }> = {
  business: { en: "Business", es: "Negocios" },
  marketing: { en: "Marketing", es: "Marketing" },
  finance: { en: "Finance", es: "Finanzas" },
  operations: { en: "Operations", es: "Operaciones" },
  human_resources: { en: "Human Resources", es: "Recursos Humanos" },
  strategy: { en: "Strategy", es: "Estrategia" },
};

export const FRAMEWORK_REGISTRY: FrameworkRegistryEntry[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // STRATEGY (13 original entries, now with disciplines arrays)
  // ═══════════════════════════════════════════════════════════════════════
  {
    canonicalId: "porter_generic_strategies",
    canonicalName_en: "Porter's Generic Strategies",
    canonicalName_es: "Estrategias Genéricas de Porter",
    primaryDimension: "strategic",
    disciplines: ["strategy", "marketing"],
    conceptualDescription_en:
      "A strategy framework arguing firms must choose between cost leadership, differentiation, or focus on a narrow segment to achieve competitive advantage. Trying to be all things to all customers leaves a firm 'stuck in the middle.'",
    conceptualDescription_es:
      "Un marco estratégico que sostiene que las empresas deben elegir entre liderazgo en costos, diferenciación o enfoque en un segmento estrecho para lograr ventaja competitiva. Intentar ser todo para todos deja a la empresa 'atrapada en el medio.'",
    disciplineDescriptions: {
      strategy: {
        en: "In strategic analysis, Porter's Generic Strategies forces a firm-level positioning choice — cost leadership, differentiation, or focus — to secure sustainable competitive advantage. The framework exposes the risk of being 'stuck in the middle' without a clear strategic identity.",
        es: "En análisis estratégico, las Estrategias Genéricas de Porter obligan a elegir un posicionamiento a nivel de empresa — liderazgo en costos, diferenciación o enfoque — para asegurar ventaja competitiva sostenible. El marco expone el riesgo de quedar 'atrapado en el medio' sin identidad estratégica clara.",
      },
      marketing: {
        en: "In marketing, Porter's Generic Strategies informs brand positioning and segment targeting. Cost leadership drives value-oriented messaging; differentiation supports premium branding; focus narrows campaigns to a specific niche audience with tailored value propositions.",
        es: "En marketing, las Estrategias Genéricas de Porter informan el posicionamiento de marca y la selección de segmentos. El liderazgo en costos impulsa mensajes orientados al valor; la diferenciación apoya el branding premium; el enfoque dirige campañas a un nicho específico con propuestas de valor a medida.",
      },
    },
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
    disciplines: ["strategy"],
    conceptualDescription_en:
      "A framework for analyzing industry attractiveness via five competitive forces: rivalry among existing competitors, threat of new entrants, threat of substitutes, bargaining power of suppliers, and bargaining power of buyers.",
    conceptualDescription_es:
      "Un marco para analizar el atractivo de una industria a través de cinco fuerzas competitivas: rivalidad entre competidores existentes, amenaza de nuevos entrantes, amenaza de sustitutos, poder de negociación de proveedores y poder de negociación de compradores.",
    disciplineDescriptions: {
      strategy: {
        en: "In strategy, Five Forces maps the structural drivers of industry profitability — rivalry, entry threats, substitutes, and bargaining power — to determine whether an industry is attractive enough to enter, stay in, or exit.",
        es: "En estrategia, las Cinco Fuerzas mapean los impulsores estructurales de la rentabilidad de una industria — rivalidad, amenazas de entrada, sustitutos y poder de negociación — para determinar si una industria es lo suficientemente atractiva para entrar, permanecer o salir.",
      },
    },
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
    aliases: ["five forces", "5 forces", "cinco fuerzas", "5 fuerzas", "porter five forces", "porter 5 forces", "porters five forces", "cinco fuerzas de porter"],
    suggestedSignalPattern: { requiredSignals: ["justification", "tradeoffAwareness"], minQuality: "PRESENT" },
  },
  {
    canonicalId: "swot",
    canonicalName_en: "SWOT Analysis",
    canonicalName_es: "Análisis FODA",
    primaryDimension: "analytical",
    disciplines: ["strategy", "marketing", "business"],
    conceptualDescription_en:
      "A diagnostic tool that evaluates a situation across four dimensions: internal Strengths and Weaknesses; external Opportunities and Threats. Used to align strategy with internal capabilities and external context.",
    conceptualDescription_es:
      "Una herramienta diagnóstica que evalúa una situación en cuatro dimensiones: Fortalezas y Debilidades internas; Oportunidades y Amenazas externas. Se usa para alinear la estrategia con las capacidades internas y el contexto externo.",
    disciplineDescriptions: {
      strategy: {
        en: "In strategic analysis, SWOT frames internal Strengths and Weaknesses against external Opportunities and Threats to identify positioning gaps and competitive leverage points. Used to connect capability assessment with strategic choice.",
        es: "En análisis estratégico, FODA enmarca Fortalezas y Debilidades internas contra Oportunidades y Amenazas externas para identificar brechas de posicionamiento y puntos de apalancamiento competitivo. Se usa para conectar la evaluación de capacidades con la elección estratégica.",
      },
      marketing: {
        en: "In marketing, SWOT is applied to a brand, segment, or campaign — mapping what the brand owns (Strengths), where it is exposed (Weaknesses), market openings (Opportunities), and competitive or consumer shifts (Threats).",
        es: "En marketing, FODA se aplica a una marca, segmento o campaña — mapeando lo que la marca posee (Fortalezas), dónde está expuesta (Debilidades), aperturas de mercado (Oportunidades) y cambios competitivos o del consumidor (Amenazas).",
      },
      business: {
        en: "In general business, SWOT provides a structured diagnostic for any unit or initiative, helping managers align internal resources with external conditions before committing to action plans or resource allocation.",
        es: "En negocios generales, FODA ofrece un diagnóstico estructurado para cualquier unidad o iniciativa, ayudando a los gerentes a alinear recursos internos con condiciones externas antes de comprometerse con planes de acción o asignación de recursos.",
      },
    },
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
    disciplines: ["strategy"],
    conceptualDescription_en:
      "A scan of the external macro-environment along six dimensions: Political, Economic, Social, Technological, Environmental, and Legal forces shaping a market.",
    conceptualDescription_es:
      "Un escaneo del macro-entorno externo en seis dimensiones: fuerzas Políticas, Económicas, Sociales, Tecnológicas, Ambientales y Legales que dan forma a un mercado.",
    disciplineDescriptions: {
      strategy: {
        en: "In strategy, PESTEL scans the macro-environment to surface political, economic, social, technological, environmental, and legal forces that constrain or enable strategic options before the firm commits to a direction.",
        es: "En estrategia, PESTEL escanea el macro-entorno para revelar fuerzas políticas, económicas, sociales, tecnológicas, ambientales y legales que restringen o habilitan opciones estratégicas antes de que la empresa se comprometa con una dirección.",
      },
    },
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
    disciplines: ["strategy", "marketing"],
    conceptualDescription_en:
      "A portfolio framework classifying business units by market growth and relative market share into Stars, Cash Cows, Question Marks, and Dogs to guide investment and divestment decisions.",
    conceptualDescription_es:
      "Un marco de portafolio que clasifica las unidades de negocio por crecimiento de mercado y participación relativa en Estrellas, Vacas Lecheras, Interrogantes y Perros para guiar decisiones de inversión y desinversión.",
    disciplineDescriptions: {
      strategy: {
        en: "In strategy, the BCG Matrix guides corporate portfolio decisions by classifying business units into Stars, Cash Cows, Question Marks, and Dogs based on market growth and share, directing investment and divestment priorities.",
        es: "En estrategia, la Matriz BCG guía decisiones de portafolio corporativo clasificando unidades de negocio en Estrellas, Vacas Lecheras, Interrogantes y Perros según crecimiento y participación de mercado, dirigiendo prioridades de inversión y desinversión.",
      },
      marketing: {
        en: "In marketing, the BCG Matrix helps prioritize product lines or brands within a portfolio, determining which deserve increased marketing spend (Stars), which fund other initiatives (Cash Cows), and which need repositioning or sunsetting.",
        es: "En marketing, la Matriz BCG ayuda a priorizar líneas de producto o marcas dentro de un portafolio, determinando cuáles merecen mayor gasto en marketing (Estrellas), cuáles financian otras iniciativas (Vacas Lecheras) y cuáles necesitan reposicionamiento o retiro.",
      },
    },
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
    disciplines: ["strategy", "operations"],
    conceptualDescription_en:
      "Decomposes a firm into primary and support activities to identify where value is created and where margin can be improved through cost reduction or differentiation at each link.",
    conceptualDescription_es:
      "Descompone a la empresa en actividades primarias y de apoyo para identificar dónde se crea valor y dónde se puede mejorar el margen mediante reducción de costos o diferenciación en cada eslabón.",
    disciplineDescriptions: {
      strategy: {
        en: "In strategy, Value Chain Analysis reveals which activities create competitive advantage and where margin leaks occur, guiding decisions about which capabilities to invest in, outsource, or restructure.",
        es: "En estrategia, el Análisis de Cadena de Valor revela qué actividades crean ventaja competitiva y dónde ocurren fugas de margen, guiando decisiones sobre qué capacidades invertir, externalizar o reestructurar.",
      },
      operations: {
        en: "In operations, Value Chain Analysis breaks down the production and delivery sequence to pinpoint inefficiencies, bottlenecks, and cost-reduction opportunities at each stage from inbound logistics to after-sales service.",
        es: "En operaciones, el Análisis de Cadena de Valor desglosa la secuencia de producción y entrega para identificar ineficiencias, cuellos de botella y oportunidades de reducción de costos en cada etapa desde logística de entrada hasta servicio postventa.",
      },
    },
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
    disciplines: ["strategy"],
    conceptualDescription_en:
      "Argues sustainable competitive advantage comes from resources and capabilities that are Valuable, Rare, Inimitable, and Non-substitutable (VRIN/VRIO). Strategy starts with what the firm uniquely owns or knows.",
    conceptualDescription_es:
      "Sostiene que la ventaja competitiva sostenible proviene de recursos y capacidades que son Valiosos, Raros, Inimitables y No sustituibles (VRIN/VRIO). La estrategia comienza con lo que la empresa posee o sabe de forma única.",
    disciplineDescriptions: {
      strategy: {
        en: "In strategy, the Resource-Based View anchors competitive advantage in internal resources and capabilities that pass the VRIO test — Valuable, Rare, Inimitable, Organized — shifting focus from market positioning to what the firm uniquely owns.",
        es: "En estrategia, la Visión Basada en Recursos ancla la ventaja competitiva en recursos y capacidades internas que pasan la prueba VRIO — Valiosos, Raros, Inimitables, Organizados — desplazando el foco del posicionamiento de mercado a lo que la empresa posee de forma única.",
      },
    },
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
    disciplines: ["strategy", "human_resources"],
    conceptualDescription_en:
      "Identifies the parties affected by or able to affect a decision, then maps their interests and influence to inform engagement and trade-off decisions.",
    conceptualDescription_es:
      "Identifica a las partes afectadas por o capaces de afectar una decisión, y mapea sus intereses e influencia para informar decisiones de involucramiento y trade-offs.",
    disciplineDescriptions: {
      strategy: {
        en: "In strategy, Stakeholder Analysis maps which parties hold power and interest over a strategic decision, enabling the firm to sequence engagement, anticipate resistance, and design coalitions that support execution.",
        es: "En estrategia, el Análisis de Stakeholders mapea qué partes tienen poder e interés sobre una decisión estratégica, permitiendo a la empresa secuenciar el involucramiento, anticipar resistencia y diseñar coaliciones que apoyen la ejecución.",
      },
      human_resources: {
        en: "In human resources, Stakeholder Analysis identifies employees, unions, managers, and external parties affected by workforce policies, mapping their concerns and influence to design change initiatives that minimize resistance.",
        es: "En recursos humanos, el Análisis de Stakeholders identifica empleados, sindicatos, gerentes y partes externas afectadas por políticas laborales, mapeando sus preocupaciones e influencia para diseñar iniciativas de cambio que minimicen la resistencia.",
      },
    },
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
    disciplines: ["strategy", "finance"],
    conceptualDescription_en:
      "Systematically compares the expected costs and benefits of an option, often quantitatively, to support decisions where trade-offs across dimensions need to be reconciled.",
    conceptualDescription_es:
      "Compara sistemáticamente los costos y beneficios esperados de una opción, a menudo cuantitativamente, para apoyar decisiones donde se deben conciliar trade-offs entre dimensiones.",
    disciplineDescriptions: {
      strategy: {
        en: "In strategy, Cost-Benefit Analysis structures the trade-off evaluation between competing strategic options by quantifying expected gains and losses, making opportunity costs visible before resource commitment.",
        es: "En estrategia, el Análisis Costo-Beneficio estructura la evaluación de trade-offs entre opciones estratégicas competidoras cuantificando ganancias y pérdidas esperadas, haciendo visibles los costos de oportunidad antes del compromiso de recursos.",
      },
      finance: {
        en: "In finance, Cost-Benefit Analysis translates project or investment alternatives into comparable monetary terms, aggregating direct and indirect costs against projected benefits to produce a net-value recommendation.",
        es: "En finanzas, el Análisis Costo-Beneficio traduce alternativas de proyecto o inversión en términos monetarios comparables, agregando costos directos e indirectos contra beneficios proyectados para producir una recomendación de valor neto.",
      },
    },
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
    disciplines: ["strategy", "human_resources"],
    conceptualDescription_en:
      "The Best Alternative To a Negotiated Agreement — the course of action a party will take if the current negotiation fails. Strengthens decisions by anchoring to a credible fallback rather than the negotiation itself.",
    conceptualDescription_es:
      "La Mejor Alternativa a un Acuerdo Negociado — el curso de acción que una parte tomará si la negociación actual fracasa. Fortalece decisiones al anclarlas a una alternativa creíble en lugar de a la negociación misma.",
    disciplineDescriptions: {
      strategy: {
        en: "In strategy, BATNA defines the walk-away threshold in negotiations with partners, acquirers, or suppliers, ensuring the firm never accepts terms worse than its best independent alternative.",
        es: "En estrategia, BATNA define el umbral de retiro en negociaciones con socios, adquirentes o proveedores, asegurando que la empresa nunca acepte términos peores que su mejor alternativa independiente.",
      },
      human_resources: {
        en: "In human resources, BATNA applies to labor negotiations, compensation discussions, and talent retention — helping HR leaders evaluate whether a proposed agreement exceeds the alternative of losing the employee or facing union action.",
        es: "En recursos humanos, BATNA se aplica a negociaciones laborales, discusiones de compensación y retención de talento — ayudando a líderes de RRHH a evaluar si un acuerdo propuesto supera la alternativa de perder al empleado o enfrentar acción sindical.",
      },
    },
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
    disciplines: ["strategy", "marketing"],
    conceptualDescription_en:
      "Argues firms should create uncontested market space ('blue oceans') by simultaneously pursuing differentiation and low cost via the Eliminate-Reduce-Raise-Create grid, rather than competing in saturated 'red oceans.'",
    conceptualDescription_es:
      "Sostiene que las empresas deben crear espacios de mercado sin competencia ('océanos azules') buscando simultáneamente diferenciación y bajo costo mediante la matriz Eliminar-Reducir-Aumentar-Crear, en lugar de competir en 'océanos rojos' saturados.",
    disciplineDescriptions: {
      strategy: {
        en: "In strategy, Blue Ocean pushes firms to escape head-to-head rivalry by redefining the value curve — simultaneously eliminating costly features and creating new value that opens uncontested market space.",
        es: "En estrategia, Océano Azul impulsa a las empresas a escapar de la rivalidad directa redefiniendo la curva de valor — eliminando simultáneamente características costosas y creando nuevo valor que abre espacio de mercado sin competencia.",
      },
      marketing: {
        en: "In marketing, Blue Ocean Strategy reframes category boundaries by targeting non-customers with a value proposition that breaks the price-quality tradeoff, enabling campaigns that define a new market rather than fight for existing share.",
        es: "En marketing, la Estrategia del Océano Azul redefine los límites de categoría dirigiéndose a no-clientes con una propuesta de valor que rompe el tradeoff precio-calidad, habilitando campañas que definen un nuevo mercado en lugar de pelear por participación existente.",
      },
    },
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
    disciplines: ["strategy", "marketing"],
    conceptualDescription_en:
      "Maps growth options across two axes — existing vs new products and existing vs new markets — yielding four strategies: market penetration, product development, market development, and diversification.",
    conceptualDescription_es:
      "Mapea opciones de crecimiento en dos ejes — productos existentes vs nuevos y mercados existentes vs nuevos — generando cuatro estrategias: penetración de mercado, desarrollo de producto, desarrollo de mercado y diversificación.",
    disciplineDescriptions: {
      strategy: {
        en: "In strategy, the Ansoff Matrix structures growth decisions by mapping risk along two axes — product novelty and market novelty — forcing explicit comparison between penetration, development, and diversification paths.",
        es: "En estrategia, la Matriz Ansoff estructura decisiones de crecimiento mapeando riesgo en dos ejes — novedad del producto y novedad del mercado — forzando una comparación explícita entre penetración, desarrollo y diversificación.",
      },
      marketing: {
        en: "In marketing, the Ansoff Matrix guides go-to-market strategy by clarifying whether growth comes from deeper engagement with existing customers, launching new products, entering new segments, or diversifying entirely.",
        es: "En marketing, la Matriz Ansoff guía la estrategia de go-to-market clarificando si el crecimiento proviene de mayor compromiso con clientes existentes, lanzar nuevos productos, entrar en nuevos segmentos o diversificarse por completo.",
      },
    },
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
    disciplines: ["strategy", "business"],
    conceptualDescription_en:
      "A performance management framework that translates strategy into measurable objectives across four perspectives: financial, customer, internal processes, and learning and growth.",
    conceptualDescription_es:
      "Un marco de gestión de desempeño que traduce la estrategia en objetivos medibles en cuatro perspectivas: financiera, del cliente, de procesos internos y de aprendizaje y crecimiento.",
    disciplineDescriptions: {
      strategy: {
        en: "In strategy, the Balanced Scorecard translates high-level strategy into actionable objectives across financial, customer, process, and learning perspectives, ensuring strategic intent reaches operational execution.",
        es: "En estrategia, el Cuadro de Mando Integral traduce la estrategia de alto nivel en objetivos accionables a través de perspectivas financiera, de cliente, de procesos y de aprendizaje, asegurando que la intención estratégica llegue a la ejecución operativa.",
      },
      business: {
        en: "In general business, the Balanced Scorecard provides a multi-dimensional performance dashboard that prevents over-reliance on financial metrics by tracking customer satisfaction, internal efficiency, and organizational learning alongside profitability.",
        es: "En negocios generales, el Cuadro de Mando Integral provee un tablero de desempeño multidimensional que previene la dependencia excesiva de métricas financieras rastreando satisfacción del cliente, eficiencia interna y aprendizaje organizacional junto a la rentabilidad.",
      },
    },
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

  // ═══════════════════════════════════════════════════════════════════════
  // BUSINESS (5 new + balanced_scorecard already above)
  // ═══════════════════════════════════════════════════════════════════════
  {
    canonicalId: "business_model_canvas",
    canonicalName_en: "Business Model Canvas",
    canonicalName_es: "Lienzo de Modelo de Negocio",
    primaryDimension: "strategic",
    disciplines: ["business"],
    conceptualDescription_en:
      "A visual template that maps a business model across nine building blocks — value proposition, customer segments, channels, customer relationships, revenue streams, key resources, key activities, key partners, and cost structure — to show how a company creates and delivers value.",
    conceptualDescription_es:
      "Una plantilla visual que mapea un modelo de negocio en nueve bloques — propuesta de valor, segmentos de clientes, canales, relaciones con clientes, fuentes de ingreso, recursos clave, actividades clave, socios clave y estructura de costos — para mostrar cómo la empresa crea y entrega valor.",
    disciplineDescriptions: {
      business: {
        en: "In business, the Business Model Canvas provides a single-page view of how a company creates, delivers, and captures value — connecting customer segments, value propositions, channels, revenue streams, and cost structure into one coherent picture.",
        es: "En negocios, el Lienzo de Modelo de Negocio ofrece una vista de una página de cómo una empresa crea, entrega y captura valor — conectando segmentos de clientes, propuestas de valor, canales, fuentes de ingreso y estructura de costos en una imagen coherente.",
      },
    },
    coreConcepts_en: ["value proposition", "customer segments", "revenue streams", "cost structure", "key partners"],
    coreConcepts_es: ["propuesta de valor", "segmentos de clientes", "fuentes de ingreso", "estructura de costos", "socios clave"],
    recognitionSignals_en: [
      "describing how the business creates, delivers, and captures value",
      "mapping multiple components of a business model simultaneously",
      "connecting customer needs to revenue and cost decisions",
    ],
    recognitionSignals_es: [
      "describir cómo el negocio crea, entrega y captura valor",
      "mapear múltiples componentes del modelo de negocio simultáneamente",
      "conectar necesidades del cliente con decisiones de ingreso y costo",
    ],
    suggestedDomainKeywords_en: ["business model", "value proposition", "canvas", "revenue", "customer segments"],
    suggestedDomainKeywords_es: ["modelo de negocio", "propuesta de valor", "canvas", "ingresos", "segmentos de clientes"],
    aliases: ["BMC", "business canvas", "lienzo canvas", "business model canvas", "lienzo de modelo de negocio"],
  },
  {
    canonicalId: "okrs",
    canonicalName_en: "OKRs",
    canonicalName_es: "OKRs",
    primaryDimension: "strategic",
    disciplines: ["business"],
    conceptualDescription_en:
      "A goal-setting framework pairing qualitative Objectives with measurable Key Results to align teams around outcomes rather than activities. Progress is tracked transparently and frequently.",
    conceptualDescription_es:
      "Un marco de definición de metas que empareja Objetivos cualitativos con Resultados Clave medibles para alinear equipos en torno a resultados en vez de actividades. El progreso se rastrea de forma transparente y frecuente.",
    disciplineDescriptions: {
      business: {
        en: "In business, OKRs align cross-functional teams around shared outcomes by pairing ambitious qualitative objectives with measurable key results, creating transparency on progress and enabling rapid course correction.",
        es: "En negocios, los OKRs alinean equipos multifuncionales en torno a resultados compartidos emparejando objetivos cualitativos ambiciosos con resultados clave medibles, creando transparencia sobre el progreso y habilitando correcciones rápidas de curso.",
      },
    },
    coreConcepts_en: ["objectives", "key results", "alignment", "transparency", "outcome focus"],
    coreConcepts_es: ["objetivos", "resultados clave", "alineación", "transparencia", "enfoque en resultados"],
    recognitionSignals_en: [
      "setting ambitious qualitative goals paired with quantifiable metrics",
      "aligning team efforts toward shared measurable outcomes",
      "tracking progress transparently on a regular cadence",
    ],
    recognitionSignals_es: [
      "fijar metas cualitativas ambiciosas acompañadas de métricas cuantificables",
      "alinear esfuerzos del equipo hacia resultados medibles compartidos",
      "rastrear progreso de forma transparente con cadencia regular",
    ],
    suggestedDomainKeywords_en: ["okr", "objectives", "key results", "alignment", "goals"],
    suggestedDomainKeywords_es: ["okr", "objetivos", "resultados clave", "alineación", "metas"],
    aliases: ["objectives and key results", "objetivos y resultados clave", "okr"],
  },
  {
    canonicalId: "smart_goals",
    canonicalName_en: "SMART Goals",
    canonicalName_es: "Objetivos SMART",
    primaryDimension: "analytical",
    disciplines: ["business"],
    conceptualDescription_en:
      "A goal-quality checklist ensuring each objective is Specific, Measurable, Achievable, Relevant, and Time-bound so progress can be tracked and accountability established.",
    conceptualDescription_es:
      "Una lista de verificación de calidad de metas que asegura que cada objetivo sea Específico, Medible, Alcanzable, Relevante y con Tiempo definido para rastrear progreso y establecer responsabilidad.",
    disciplineDescriptions: {
      business: {
        en: "In business, SMART Goals converts vague aspirations into concrete targets with clear metrics, deadlines, and accountability — ensuring every objective is actionable and progress is measurable.",
        es: "En negocios, los Objetivos SMART convierten aspiraciones vagas en metas concretas con métricas claras, plazos y responsabilidad — asegurando que cada objetivo sea accionable y el progreso sea medible.",
      },
    },
    coreConcepts_en: ["specific", "measurable", "achievable", "relevant", "time-bound"],
    coreConcepts_es: ["específico", "medible", "alcanzable", "relevante", "con plazo definido"],
    recognitionSignals_en: [
      "defining goals with clear metrics and deadlines",
      "testing whether an objective can be measured and has a timeline",
      "rejecting vague goals in favor of concrete targets",
    ],
    recognitionSignals_es: [
      "definir metas con métricas claras y plazos",
      "evaluar si un objetivo es medible y tiene cronograma",
      "rechazar metas vagas en favor de objetivos concretos",
    ],
    suggestedDomainKeywords_en: ["smart", "specific", "measurable", "achievable", "time-bound"],
    suggestedDomainKeywords_es: ["smart", "específico", "medible", "alcanzable", "con plazo"],
    aliases: ["smart", "smart goals", "objetivos smart", "metas smart"],
  },
  {
    canonicalId: "mckinsey_7s",
    canonicalName_en: "McKinsey 7S",
    canonicalName_es: "Modelo 7S de McKinsey",
    primaryDimension: "strategic",
    disciplines: ["business", "strategy"],
    conceptualDescription_en:
      "An organizational alignment model examining seven interdependent elements — Strategy, Structure, Systems (hard), and Shared Values, Skills, Style, Staff (soft) — to diagnose why change initiatives succeed or fail.",
    conceptualDescription_es:
      "Un modelo de alineación organizacional que examina siete elementos interdependientes — Estrategia, Estructura, Sistemas (duros) y Valores Compartidos, Habilidades, Estilo, Personal (blandos) — para diagnosticar por qué las iniciativas de cambio tienen éxito o fracasan.",
    disciplineDescriptions: {
      business: {
        en: "In business, McKinsey 7S diagnoses organizational health by checking alignment among strategy, structure, systems, shared values, skills, style, and staff — revealing why change initiatives stall despite good plans.",
        es: "En negocios, el Modelo 7S de McKinsey diagnostica la salud organizacional verificando la alineación entre estrategia, estructura, sistemas, valores compartidos, habilidades, estilo y personal — revelando por qué las iniciativas de cambio se estancan a pesar de buenos planes.",
      },
      strategy: {
        en: "In strategy, McKinsey 7S ensures that a chosen strategic direction is supported by the organization's internal alignment — testing whether structure, systems, culture, and capabilities reinforce or undermine the strategy.",
        es: "En estrategia, el Modelo 7S de McKinsey asegura que una dirección estratégica elegida esté respaldada por la alineación interna de la organización — evaluando si la estructura, sistemas, cultura y capacidades refuerzan o socavan la estrategia.",
      },
    },
    coreConcepts_en: ["strategy", "structure", "systems", "shared values", "skills", "style", "staff"],
    coreConcepts_es: ["estrategia", "estructura", "sistemas", "valores compartidos", "habilidades", "estilo", "personal"],
    recognitionSignals_en: [
      "diagnosing misalignment among organizational elements",
      "balancing hard elements like structure with soft elements like culture",
      "checking whether change in one area is supported by the others",
    ],
    recognitionSignals_es: [
      "diagnosticar desalineación entre elementos organizacionales",
      "equilibrar elementos duros como estructura con blandos como cultura",
      "verificar si el cambio en un área está respaldado por las demás",
    ],
    suggestedDomainKeywords_en: ["7s", "mckinsey", "alignment", "organizational", "hard soft elements"],
    suggestedDomainKeywords_es: ["7s", "mckinsey", "alineación", "organizacional", "elementos duros blandos"],
    aliases: ["7s framework", "mckinsey seven s", "mckinsey 7s", "modelo 7s"],
  },
  {
    canonicalId: "pdca_cycle",
    canonicalName_en: "PDCA Cycle",
    canonicalName_es: "Ciclo PDCA",
    primaryDimension: "analytical",
    disciplines: ["business", "operations"],
    conceptualDescription_en:
      "A four-step iterative management method — Plan, Do, Check, Act — for continuous improvement. Each cycle tests a hypothesis, measures results, and standardizes or adjusts before repeating.",
    conceptualDescription_es:
      "Un método de gestión iterativo de cuatro pasos — Planificar, Hacer, Verificar, Actuar — para la mejora continua. Cada ciclo prueba una hipótesis, mide resultados y estandariza o ajusta antes de repetir.",
    disciplineDescriptions: {
      business: {
        en: "In business, the PDCA Cycle provides a structured test-and-learn loop for any management initiative — plan a change, execute it, measure results, and standardize or adjust before the next iteration.",
        es: "En negocios, el Ciclo PDCA provee un ciclo estructurado de prueba y aprendizaje para cualquier iniciativa gerencial — planificar un cambio, ejecutarlo, medir resultados y estandarizar o ajustar antes de la siguiente iteración.",
      },
      operations: {
        en: "In operations, the PDCA Cycle drives continuous process improvement on the shop floor by iterating through plan-do-check-act loops, ensuring each improvement is measured before being standardized.",
        es: "En operaciones, el Ciclo PDCA impulsa la mejora continua de procesos en planta iterando a través de ciclos planificar-hacer-verificar-actuar, asegurando que cada mejora sea medida antes de ser estandarizada.",
      },
    },
    coreConcepts_en: ["plan", "do", "check", "act", "continuous improvement"],
    coreConcepts_es: ["planificar", "hacer", "verificar", "actuar", "mejora continua"],
    recognitionSignals_en: [
      "proposing a test-and-learn cycle rather than a one-shot decision",
      "measuring results before scaling a change",
      "iterating based on feedback from a pilot",
    ],
    recognitionSignals_es: [
      "proponer un ciclo de prueba y aprendizaje en vez de una decisión única",
      "medir resultados antes de escalar un cambio",
      "iterar con base en retroalimentación de un piloto",
    ],
    suggestedDomainKeywords_en: ["pdca", "plan do check act", "deming", "continuous improvement", "iteration"],
    suggestedDomainKeywords_es: ["pdca", "planificar hacer verificar actuar", "deming", "mejora continua", "iteración"],
    aliases: ["deming cycle", "plan-do-check-act", "ciclo de deming", "pdca"],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // MARKETING (6 new entries)
  // ═══════════════════════════════════════════════════════════════════════
  {
    canonicalId: "marketing_mix_4ps",
    canonicalName_en: "4Ps Marketing Mix",
    canonicalName_es: "4 P del Marketing Mix",
    primaryDimension: "strategic",
    disciplines: ["marketing"],
    conceptualDescription_en:
      "A foundational marketing framework that structures decisions around four levers — Product, Price, Place, and Promotion — to design a coherent market offering.",
    conceptualDescription_es:
      "Un marco fundamental de marketing que estructura decisiones alrededor de cuatro palancas — Producto, Precio, Plaza y Promoción — para diseñar una oferta de mercado coherente.",
    disciplineDescriptions: {
      marketing: {
        en: "In marketing, the 4Ps structures go-to-market decisions across Product, Price, Place, and Promotion, ensuring each lever reinforces the others to deliver a coherent value proposition to the target segment.",
        es: "En marketing, las 4P estructuran decisiones de salida al mercado a través de Producto, Precio, Plaza y Promoción, asegurando que cada palanca refuerce a las demás para entregar una propuesta de valor coherente al segmento objetivo.",
      },
    },
    coreConcepts_en: ["product", "price", "place", "promotion", "marketing mix"],
    coreConcepts_es: ["producto", "precio", "plaza", "promoción", "mezcla de marketing"],
    recognitionSignals_en: [
      "structuring a market offering across product, pricing, distribution, and communication",
      "adjusting one marketing lever in light of changes in another",
      "designing a coherent go-to-market plan across the four Ps",
    ],
    recognitionSignals_es: [
      "estructurar una oferta de mercado a través de producto, precio, distribución y comunicación",
      "ajustar una palanca de marketing ante cambios en otra",
      "diseñar un plan de salida al mercado coherente a través de las 4P",
    ],
    suggestedDomainKeywords_en: ["4ps", "product", "price", "place", "promotion", "marketing mix"],
    suggestedDomainKeywords_es: ["4p", "producto", "precio", "plaza", "promoción", "mezcla de marketing"],
    aliases: ["4ps", "4 p", "product price place promotion", "producto precio plaza promoción", "marketing mix", "mezcla de marketing"],
  },
  {
    canonicalId: "stp_marketing",
    canonicalName_en: "Segmentation, Targeting, Positioning",
    canonicalName_es: "Segmentación, Targeting, Posicionamiento",
    primaryDimension: "strategic",
    disciplines: ["marketing", "strategy"],
    conceptualDescription_en:
      "A three-step process: divide the market into meaningful segments, select which to target, and craft a positioning that differentiates the offering in the chosen segment's mind.",
    conceptualDescription_es:
      "Un proceso de tres pasos: dividir el mercado en segmentos significativos, seleccionar cuáles atacar y construir un posicionamiento que diferencie la oferta en la mente del segmento elegido.",
    disciplineDescriptions: {
      marketing: {
        en: "In marketing, STP is the core strategic sequence — segment the market by meaningful criteria, choose which segments to target, and position the brand distinctively in the target segment's perception against competitors.",
        es: "En marketing, STP es la secuencia estratégica central — segmentar el mercado por criterios significativos, elegir qué segmentos atacar y posicionar la marca de manera distintiva en la percepción del segmento objetivo frente a competidores.",
      },
      strategy: {
        en: "In strategy, STP informs where-to-play decisions by identifying which customer segments offer the best fit with firm capabilities, guiding resource allocation toward the most defensible market positions.",
        es: "En estrategia, STP informa decisiones de dónde competir identificando qué segmentos de clientes ofrecen el mejor ajuste con las capacidades de la empresa, guiando la asignación de recursos hacia las posiciones de mercado más defendibles.",
      },
    },
    coreConcepts_en: ["segmentation", "targeting", "positioning", "differentiation", "market selection"],
    coreConcepts_es: ["segmentación", "targeting", "posicionamiento", "diferenciación", "selección de mercado"],
    recognitionSignals_en: [
      "dividing customers into distinct groups based on shared characteristics",
      "choosing which segment to serve and why",
      "defining how the product should be perceived relative to competitors",
    ],
    recognitionSignals_es: [
      "dividir clientes en grupos distintos según características compartidas",
      "elegir qué segmento atender y por qué",
      "definir cómo debe percibirse el producto en relación con competidores",
    ],
    suggestedDomainKeywords_en: ["segmentation", "targeting", "positioning", "stp", "market segment"],
    suggestedDomainKeywords_es: ["segmentación", "targeting", "posicionamiento", "stp", "segmento de mercado"],
    aliases: ["stp", "stp marketing", "segmentacion targeting posicionamiento"],
  },
  {
    canonicalId: "aida_model",
    canonicalName_en: "AIDA Model",
    canonicalName_es: "Modelo AIDA",
    primaryDimension: "stakeholder",
    disciplines: ["marketing"],
    conceptualDescription_en:
      "A communication-effect model describing four stages a prospect moves through — Attention, Interest, Desire, Action — guiding how messages should be crafted at each stage of the buying process.",
    conceptualDescription_es:
      "Un modelo de efecto de comunicación que describe cuatro etapas que atraviesa un prospecto — Atención, Interés, Deseo, Acción — guiando cómo deben elaborarse los mensajes en cada etapa del proceso de compra.",
    disciplineDescriptions: {
      marketing: {
        en: "In marketing, AIDA maps the customer's cognitive journey from first Attention through Interest and Desire to Action, guiding message design and campaign sequencing at each stage of the conversion funnel.",
        es: "En marketing, AIDA mapea el recorrido cognitivo del cliente desde la primera Atención pasando por Interés y Deseo hasta la Acción, guiando el diseño de mensajes y la secuencia de campañas en cada etapa del embudo de conversión.",
      },
    },
    coreConcepts_en: ["attention", "interest", "desire", "action", "conversion funnel"],
    coreConcepts_es: ["atención", "interés", "deseo", "acción", "embudo de conversión"],
    recognitionSignals_en: [
      "designing messages that first capture attention then build desire",
      "mapping customer engagement across awareness-to-purchase stages",
      "crafting calls to action aligned with where the audience is in their journey",
    ],
    recognitionSignals_es: [
      "diseñar mensajes que primero capturen atención y luego construyan deseo",
      "mapear el engagement del cliente a través de etapas de conocimiento a compra",
      "elaborar llamados a la acción alineados con la etapa del recorrido de la audiencia",
    ],
    suggestedDomainKeywords_en: ["aida", "attention", "interest", "desire", "action", "funnel"],
    suggestedDomainKeywords_es: ["aida", "atención", "interés", "deseo", "acción", "embudo"],
    aliases: ["attention interest desire action", "atención interés deseo acción", "aida"],
  },
  {
    canonicalId: "customer_journey_map",
    canonicalName_en: "Customer Journey Map",
    canonicalName_es: "Mapa del Viaje del Cliente",
    primaryDimension: "stakeholder",
    disciplines: ["marketing"],
    conceptualDescription_en:
      "A visual timeline of every touchpoint a customer experiences — from awareness through purchase to loyalty — used to identify pain points, moments of truth, and improvement opportunities.",
    conceptualDescription_es:
      "Una línea de tiempo visual de cada punto de contacto que un cliente experimenta — desde la concientización pasando por la compra hasta la lealtad — usada para identificar puntos de dolor, momentos de verdad y oportunidades de mejora.",
    disciplineDescriptions: {
      marketing: {
        en: "In marketing, the Customer Journey Map traces every touchpoint from first awareness through post-purchase loyalty, revealing friction points and moments of delight that inform campaign design and experience optimization.",
        es: "En marketing, el Mapa del Viaje del Cliente traza cada punto de contacto desde el primer conocimiento hasta la lealtad post-compra, revelando puntos de fricción y momentos de deleite que informan el diseño de campañas y la optimización de la experiencia.",
      },
    },
    coreConcepts_en: ["touchpoints", "pain points", "moments of truth", "customer experience", "loyalty"],
    coreConcepts_es: ["puntos de contacto", "puntos de dolor", "momentos de verdad", "experiencia del cliente", "lealtad"],
    recognitionSignals_en: [
      "tracing the customer's end-to-end experience across touchpoints",
      "identifying friction or delight moments in the buying process",
      "redesigning interactions based on the customer's perspective",
    ],
    recognitionSignals_es: [
      "trazar la experiencia del cliente de extremo a extremo a través de puntos de contacto",
      "identificar momentos de fricción o deleite en el proceso de compra",
      "rediseñar interacciones basándose en la perspectiva del cliente",
    ],
    suggestedDomainKeywords_en: ["journey map", "touchpoints", "customer experience", "pain points", "moments of truth"],
    suggestedDomainKeywords_es: ["mapa de viaje", "puntos de contacto", "experiencia del cliente", "puntos de dolor", "momentos de verdad"],
    aliases: ["journey map", "mapa de viaje", "customer journey", "mapa del viaje del cliente"],
  },
  {
    canonicalId: "brand_equity_keller",
    canonicalName_en: "Brand Equity Pyramid",
    canonicalName_es: "Pirámide de Brand Equity",
    primaryDimension: "strategic",
    disciplines: ["marketing"],
    conceptualDescription_en:
      "Keller's CBBE pyramid builds brand equity in four ascending stages — identity (who are you?), meaning (what are you?), response (what about you?), and resonance (what about you and me?) — guiding investment in brand-building activities.",
    conceptualDescription_es:
      "La pirámide CBBE de Keller construye el brand equity en cuatro etapas ascendentes — identidad (¿quién eres?), significado (¿qué eres?), respuesta (¿qué pienso de ti?) y resonancia (¿qué hay entre tú y yo?) — guiando la inversión en actividades de construcción de marca.",
    disciplineDescriptions: {
      marketing: {
        en: "In marketing, the Brand Equity Pyramid (Keller CBBE) sequences brand-building investments from identity through meaning and response to resonance, diagnosing where the brand stands and what investment is needed next.",
        es: "En marketing, la Pirámide de Brand Equity (Keller CBBE) secuencia inversiones de construcción de marca desde identidad pasando por significado y respuesta hasta resonancia, diagnosticando dónde está la marca y qué inversión se necesita a continuación.",
      },
    },
    coreConcepts_en: ["brand identity", "brand meaning", "brand response", "brand resonance", "equity"],
    coreConcepts_es: ["identidad de marca", "significado de marca", "respuesta de marca", "resonancia de marca", "equity"],
    recognitionSignals_en: [
      "building brand awareness as a foundation for deeper engagement",
      "linking brand perceptions to emotional resonance and loyalty",
      "evaluating brand strength across awareness, meaning, and attachment",
    ],
    recognitionSignals_es: [
      "construir conocimiento de marca como base para un engagement más profundo",
      "vincular percepciones de marca con resonancia emocional y lealtad",
      "evaluar la fuerza de marca a través de conocimiento, significado y apego",
    ],
    suggestedDomainKeywords_en: ["brand equity", "keller", "cbbe", "resonance", "brand identity"],
    suggestedDomainKeywords_es: ["brand equity", "keller", "cbbe", "resonancia", "identidad de marca"],
    aliases: ["keller pyramid", "cbbe", "pirámide de keller", "brand equity pyramid"],
  },
  {
    canonicalId: "jobs_to_be_done",
    canonicalName_en: "Jobs to Be Done",
    canonicalName_es: "Jobs to Be Done",
    primaryDimension: "stakeholder",
    disciplines: ["marketing", "strategy"],
    conceptualDescription_en:
      "Reframes innovation around the 'job' customers hire a product to do — focusing on the underlying need rather than demographics or features — to uncover unmet demand and guide product design.",
    conceptualDescription_es:
      "Reenmarca la innovación alrededor del 'trabajo' para el cual los clientes contratan un producto — enfocándose en la necesidad subyacente en vez de demografía o características — para descubrir demanda insatisfecha y guiar el diseño del producto.",
    disciplineDescriptions: {
      marketing: {
        en: "In marketing, Jobs to Be Done shifts focus from demographics to the functional and emotional 'job' a customer hires a product for, revealing unmet needs that drive product positioning and messaging.",
        es: "En marketing, Jobs to Be Done desplaza el foco de la demografía al 'trabajo' funcional y emocional para el cual un cliente contrata un producto, revelando necesidades insatisfechas que impulsan el posicionamiento y los mensajes del producto.",
      },
      strategy: {
        en: "In strategy, Jobs to Be Done reframes competitive analysis around the outcomes customers seek rather than product categories, uncovering non-obvious competitors and whitespace opportunities for innovation.",
        es: "En estrategia, Jobs to Be Done reenmarca el análisis competitivo alrededor de los resultados que buscan los clientes en lugar de categorías de producto, descubriendo competidores no obvios y oportunidades de innovación en espacios vacíos.",
      },
    },
    coreConcepts_en: ["job", "hiring a product", "unmet needs", "outcome-driven", "functional vs emotional jobs"],
    coreConcepts_es: ["trabajo", "contratar un producto", "necesidades insatisfechas", "orientado a resultados", "trabajos funcionales vs emocionales"],
    recognitionSignals_en: [
      "asking what job the customer is trying to get done",
      "focusing on outcomes rather than product features",
      "discovering unmet needs by observing workarounds",
    ],
    recognitionSignals_es: [
      "preguntar qué trabajo intenta realizar el cliente",
      "enfocarse en resultados en vez de características del producto",
      "descubrir necesidades insatisfechas observando soluciones improvisadas",
    ],
    suggestedDomainKeywords_en: ["jtbd", "jobs to be done", "hiring", "outcome", "unmet needs"],
    suggestedDomainKeywords_es: ["jtbd", "jobs to be done", "contratar", "resultado", "necesidades insatisfechas"],
    aliases: ["jtbd", "jobs to be done"],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // FINANCE (5 new entries)
  // ═══════════════════════════════════════════════════════════════════════
  {
    canonicalId: "dcf_valuation",
    canonicalName_en: "Discounted Cash Flow Valuation",
    canonicalName_es: "Valoración por Flujo de Caja Descontado",
    primaryDimension: "analytical",
    disciplines: ["finance"],
    conceptualDescription_en:
      "Values an asset by projecting its future cash flows and discounting them to present value using an appropriate rate, providing a fundamental measure of intrinsic worth independent of market sentiment.",
    conceptualDescription_es:
      "Valora un activo proyectando sus flujos de caja futuros y descontándolos a valor presente usando una tasa apropiada, proporcionando una medida fundamental de valor intrínseco independiente del sentimiento de mercado.",
    disciplineDescriptions: {
      finance: {
        en: "In finance, DCF is the foundational valuation method — projecting future free cash flows and discounting them at the weighted cost of capital to estimate intrinsic value independent of market sentiment.",
        es: "En finanzas, DCF es el método de valoración fundamental — proyectando flujos de caja libre futuros y descontándolos al costo ponderado de capital para estimar el valor intrínseco independiente del sentimiento de mercado.",
      },
    },
    coreConcepts_en: ["free cash flow", "discount rate", "present value", "terminal value", "intrinsic value"],
    coreConcepts_es: ["flujo de caja libre", "tasa de descuento", "valor presente", "valor terminal", "valor intrínseco"],
    recognitionSignals_en: [
      "projecting future cash flows and bringing them to present value",
      "selecting an appropriate discount rate to reflect risk",
      "comparing intrinsic value against market price",
    ],
    recognitionSignals_es: [
      "proyectar flujos de caja futuros y traerlos a valor presente",
      "seleccionar una tasa de descuento apropiada para reflejar el riesgo",
      "comparar el valor intrínseco contra el precio de mercado",
    ],
    suggestedDomainKeywords_en: ["dcf", "discounted cashflow", "free cash flow", "discount rate", "valuation"],
    suggestedDomainKeywords_es: ["dcf", "flujo descontado", "flujo de caja libre", "tasa de descuento", "valoración"],
    aliases: ["dcf", "discounted cashflow", "flujo descontado", "dcf valuation"],
  },
  {
    canonicalId: "capm",
    canonicalName_en: "Capital Asset Pricing Model",
    canonicalName_es: "Modelo de Valoración de Activos Financieros",
    primaryDimension: "analytical",
    disciplines: ["finance"],
    conceptualDescription_en:
      "Relates expected return of an asset to its systematic risk (beta) relative to the market, establishing that higher risk should command higher expected returns via the security market line.",
    conceptualDescription_es:
      "Relaciona el retorno esperado de un activo con su riesgo sistemático (beta) relativo al mercado, estableciendo que mayor riesgo debe generar mayor retorno esperado a través de la línea de mercado de valores.",
    disciplineDescriptions: {
      finance: {
        en: "In finance, CAPM quantifies the cost of equity by relating expected return to systematic risk (beta), establishing the minimum return investors demand for bearing market-level risk on a specific asset.",
        es: "En finanzas, CAPM cuantifica el costo de capital propio relacionando el retorno esperado con el riesgo sistemático (beta), estableciendo el retorno mínimo que los inversionistas exigen por asumir riesgo de mercado en un activo específico.",
      },
    },
    coreConcepts_en: ["beta", "risk-free rate", "market premium", "expected return", "systematic risk"],
    coreConcepts_es: ["beta", "tasa libre de riesgo", "prima de mercado", "retorno esperado", "riesgo sistemático"],
    recognitionSignals_en: [
      "estimating cost of equity using beta and market premium",
      "distinguishing systematic from unsystematic risk",
      "benchmarking expected returns against the security market line",
    ],
    recognitionSignals_es: [
      "estimar costo de capital usando beta y prima de mercado",
      "distinguir riesgo sistemático de riesgo no sistemático",
      "comparar retornos esperados contra la línea de mercado de valores",
    ],
    suggestedDomainKeywords_en: ["capm", "beta", "risk premium", "cost of equity", "systematic risk"],
    suggestedDomainKeywords_es: ["capm", "mvaf", "beta", "prima de riesgo", "costo del capital"],
    aliases: ["capm", "mvaf", "capital asset pricing model"],
  },
  {
    canonicalId: "dupont_analysis",
    canonicalName_en: "DuPont Analysis",
    canonicalName_es: "Análisis DuPont",
    primaryDimension: "analytical",
    disciplines: ["finance"],
    conceptualDescription_en:
      "Decomposes return on equity (ROE) into three drivers — profit margin, asset turnover, and financial leverage — to pinpoint whether profitability, efficiency, or leverage explains performance.",
    conceptualDescription_es:
      "Descompone el retorno sobre el patrimonio (ROE) en tres impulsores — margen de ganancia, rotación de activos y apalancamiento financiero — para identificar si la rentabilidad, eficiencia o apalancamiento explica el desempeño.",
    disciplineDescriptions: {
      finance: {
        en: "In finance, DuPont Analysis decomposes ROE into profit margin, asset turnover, and leverage to diagnose whether a company's returns are driven by operational efficiency, asset utilization, or financial structure.",
        es: "En finanzas, el Análisis DuPont descompone el ROE en margen de ganancia, rotación de activos y apalancamiento para diagnosticar si los retornos de una empresa son impulsados por eficiencia operativa, utilización de activos o estructura financiera.",
      },
    },
    coreConcepts_en: ["return on equity", "profit margin", "asset turnover", "financial leverage", "decomposition"],
    coreConcepts_es: ["retorno sobre patrimonio", "margen de ganancia", "rotación de activos", "apalancamiento financiero", "descomposición"],
    recognitionSignals_en: [
      "breaking down ROE into margin, turnover, and leverage components",
      "diagnosing whether operational efficiency or leverage drives returns",
      "comparing financial ratios across competitor decompositions",
    ],
    recognitionSignals_es: [
      "descomponer ROE en componentes de margen, rotación y apalancamiento",
      "diagnosticar si la eficiencia operativa o el apalancamiento impulsa los retornos",
      "comparar ratios financieros a través de descomposiciones de competidores",
    ],
    suggestedDomainKeywords_en: ["dupont", "roe", "profit margin", "asset turnover", "leverage"],
    suggestedDomainKeywords_es: ["dupont", "roe", "margen de ganancia", "rotación de activos", "apalancamiento"],
    aliases: ["dupont", "dupont model", "dupont analysis", "análisis dupont"],
  },
  {
    canonicalId: "npv_irr",
    canonicalName_en: "NPV and IRR",
    canonicalName_es: "VAN y TIR",
    primaryDimension: "tradeoff",
    disciplines: ["finance"],
    conceptualDescription_en:
      "Two complementary capital budgeting metrics: Net Present Value sums discounted cash flows to show absolute value creation, while Internal Rate of Return finds the discount rate at which NPV equals zero to show percentage return.",
    conceptualDescription_es:
      "Dos métricas complementarias de presupuesto de capital: el Valor Actual Neto suma flujos descontados para mostrar creación de valor absoluto, mientras la Tasa Interna de Retorno encuentra la tasa a la que el VAN es cero para mostrar el retorno porcentual.",
    disciplineDescriptions: {
      finance: {
        en: "In finance, NPV and IRR are the standard capital budgeting tools — NPV shows absolute value created by an investment while IRR reveals its percentage return, enabling comparison against hurdle rates and alternative projects.",
        es: "En finanzas, VAN y TIR son las herramientas estándar de presupuesto de capital — el VAN muestra el valor absoluto creado por una inversión mientras la TIR revela su retorno porcentual, permitiendo comparación contra tasas de corte y proyectos alternativos.",
      },
    },
    coreConcepts_en: ["net present value", "internal rate of return", "discount rate", "capital budgeting", "investment decision"],
    coreConcepts_es: ["valor actual neto", "tasa interna de retorno", "tasa de descuento", "presupuesto de capital", "decisión de inversión"],
    recognitionSignals_en: [
      "comparing investment alternatives using NPV or IRR thresholds",
      "deciding whether a project creates or destroys value based on discounted cash flows",
      "choosing between mutually exclusive projects by ranking NPV",
    ],
    recognitionSignals_es: [
      "comparar alternativas de inversión usando umbrales de VAN o TIR",
      "decidir si un proyecto crea o destruye valor con base en flujos descontados",
      "elegir entre proyectos mutuamente excluyentes ordenando por VAN",
    ],
    suggestedDomainKeywords_en: ["npv", "irr", "net present value", "internal rate of return", "capital budgeting"],
    suggestedDomainKeywords_es: ["van", "tir", "valor presente neto", "tasa interna de retorno", "presupuesto de capital"],
    aliases: ["net present value", "internal rate of return", "van", "tir", "valor presente neto", "tasa interna de retorno", "npv", "irr"],
  },
  {
    canonicalId: "working_capital_mgmt",
    canonicalName_en: "Working Capital Management",
    canonicalName_es: "Gestión del Capital de Trabajo",
    primaryDimension: "analytical",
    disciplines: ["finance", "operations"],
    conceptualDescription_en:
      "Manages the balance between current assets (cash, receivables, inventory) and current liabilities (payables) to ensure the firm can meet short-term obligations while minimizing idle capital.",
    conceptualDescription_es:
      "Gestiona el equilibrio entre activos corrientes (efectivo, cuentas por cobrar, inventario) y pasivos corrientes (cuentas por pagar) para asegurar que la empresa cumpla sus obligaciones de corto plazo minimizando capital ocioso.",
    disciplineDescriptions: {
      finance: {
        en: "In finance, Working Capital Management optimizes the cash conversion cycle by managing receivables, payables, and cash reserves to ensure the firm meets obligations while minimizing the cost of idle capital.",
        es: "En finanzas, la Gestión del Capital de Trabajo optimiza el ciclo de conversión de efectivo gestionando cuentas por cobrar, cuentas por pagar y reservas de efectivo para asegurar que la empresa cumpla sus obligaciones minimizando el costo de capital ocioso.",
      },
      operations: {
        en: "In operations, Working Capital Management links inventory policies and supplier payment terms to production scheduling, ensuring materials flow without excess stockpiling or cash flow disruptions.",
        es: "En operaciones, la Gestión del Capital de Trabajo vincula políticas de inventario y términos de pago a proveedores con la programación de producción, asegurando el flujo de materiales sin exceso de almacenamiento ni disrupciones de flujo de caja.",
      },
    },
    coreConcepts_en: ["cash conversion cycle", "receivables", "payables", "inventory management", "liquidity"],
    coreConcepts_es: ["ciclo de conversión de efectivo", "cuentas por cobrar", "cuentas por pagar", "gestión de inventario", "liquidez"],
    recognitionSignals_en: [
      "optimizing the cash conversion cycle by managing receivables and payables",
      "balancing liquidity needs against the cost of holding idle cash",
      "deciding inventory levels that minimize both stockout risk and carrying cost",
    ],
    recognitionSignals_es: [
      "optimizar el ciclo de conversión de efectivo gestionando cuentas por cobrar y pagar",
      "equilibrar necesidades de liquidez contra el costo de mantener efectivo ocioso",
      "decidir niveles de inventario que minimicen riesgo de desabasto y costo de mantenimiento",
    ],
    suggestedDomainKeywords_en: ["working capital", "cash conversion", "receivables", "payables", "liquidity"],
    suggestedDomainKeywords_es: ["capital de trabajo", "ciclo de conversión", "cuentas por cobrar", "cuentas por pagar", "liquidez"],
    aliases: ["wcm", "capital circulante", "working capital", "gestion del capital de trabajo"],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // OPERATIONS (6 new entries)
  // ═══════════════════════════════════════════════════════════════════════
  {
    canonicalId: "lean_manufacturing",
    canonicalName_en: "Lean Manufacturing",
    canonicalName_es: "Manufactura Lean",
    primaryDimension: "strategic",
    disciplines: ["operations"],
    conceptualDescription_en:
      "A production philosophy focused on eliminating waste (muda) across seven categories — overproduction, waiting, transport, overprocessing, inventory, motion, and defects — to maximize value delivered with minimum resources.",
    conceptualDescription_es:
      "Una filosofía de producción enfocada en eliminar desperdicios (muda) en siete categorías — sobreproducción, espera, transporte, sobreprocesamiento, inventario, movimiento y defectos — para maximizar el valor entregado con mínimos recursos.",
    disciplineDescriptions: {
      operations: {
        en: "In operations, Lean Manufacturing systematically eliminates seven wastes — overproduction, waiting, transport, overprocessing, inventory, motion, and defects — to create continuous flow and maximize value delivered per resource consumed.",
        es: "En operaciones, la Manufactura Lean elimina sistemáticamente siete desperdicios — sobreproducción, espera, transporte, sobreprocesamiento, inventario, movimiento y defectos — para crear flujo continuo y maximizar el valor entregado por recurso consumido.",
      },
    },
    coreConcepts_en: ["waste elimination", "muda", "value stream", "pull system", "continuous flow"],
    coreConcepts_es: ["eliminación de desperdicios", "muda", "cadena de valor", "sistema pull", "flujo continuo"],
    recognitionSignals_en: [
      "identifying and eliminating non-value-adding activities",
      "implementing pull-based production instead of push-based",
      "mapping the value stream to find bottlenecks and waste",
    ],
    recognitionSignals_es: [
      "identificar y eliminar actividades que no agregan valor",
      "implementar producción basada en jalón en vez de empuje",
      "mapear la cadena de valor para encontrar cuellos de botella y desperdicios",
    ],
    suggestedDomainKeywords_en: ["lean", "waste", "muda", "value stream", "continuous flow"],
    suggestedDomainKeywords_es: ["lean", "desperdicio", "muda", "cadena de valor", "flujo continuo"],
    aliases: ["lean", "producción lean", "lean production", "lean manufacturing", "manufactura lean"],
  },
  {
    canonicalId: "six_sigma",
    canonicalName_en: "Six Sigma",
    canonicalName_es: "Six Sigma",
    primaryDimension: "analytical",
    disciplines: ["operations"],
    conceptualDescription_en:
      "A data-driven quality methodology that uses the DMAIC cycle (Define, Measure, Analyze, Improve, Control) to reduce process variation and defects to near-zero levels (3.4 defects per million opportunities).",
    conceptualDescription_es:
      "Una metodología de calidad basada en datos que usa el ciclo DMAIC (Definir, Medir, Analizar, Mejorar, Controlar) para reducir la variación y defectos del proceso a niveles casi nulos (3.4 defectos por millón de oportunidades).",
    disciplineDescriptions: {
      operations: {
        en: "In operations, Six Sigma applies the DMAIC cycle with statistical tools to measure process variation, identify root causes of defects, and implement controls that sustain near-zero defect rates across production.",
        es: "En operaciones, Six Sigma aplica el ciclo DMAIC con herramientas estadísticas para medir la variación del proceso, identificar causas raíz de defectos e implementar controles que sostengan tasas de defectos cercanas a cero en la producción.",
      },
    },
    coreConcepts_en: ["DMAIC", "variation", "defect rate", "process capability", "statistical control"],
    coreConcepts_es: ["DMAIC", "variación", "tasa de defectos", "capacidad de proceso", "control estadístico"],
    recognitionSignals_en: [
      "using statistical analysis to identify root causes of defects",
      "following a structured DMAIC improvement cycle",
      "setting quality targets based on process capability metrics",
    ],
    recognitionSignals_es: [
      "usar análisis estadístico para identificar causas raíz de defectos",
      "seguir un ciclo de mejora DMAIC estructurado",
      "fijar objetivos de calidad basados en métricas de capacidad de proceso",
    ],
    suggestedDomainKeywords_en: ["six sigma", "dmaic", "defects", "variation", "process improvement"],
    suggestedDomainKeywords_es: ["six sigma", "dmaic", "defectos", "variación", "mejora de procesos"],
    aliases: ["6 sigma", "seis sigma", "dmaic", "six sigma"],
  },
  {
    canonicalId: "theory_of_constraints",
    canonicalName_en: "Theory of Constraints",
    canonicalName_es: "Teoría de Restricciones",
    primaryDimension: "strategic",
    disciplines: ["operations"],
    conceptualDescription_en:
      "Identifies the single bottleneck (constraint) that limits system throughput, then focuses all improvement efforts on exploiting, subordinating to, and elevating that constraint before moving to the next one.",
    conceptualDescription_es:
      "Identifica el cuello de botella único (restricción) que limita el rendimiento del sistema, luego enfoca todos los esfuerzos de mejora en explotar, subordinar y elevar esa restricción antes de pasar a la siguiente.",
    disciplineDescriptions: {
      operations: {
        en: "In operations, the Theory of Constraints focuses all improvement on the single bottleneck limiting system throughput — exploit it, subordinate other resources to it, then elevate it before addressing the next constraint.",
        es: "En operaciones, la Teoría de Restricciones enfoca toda la mejora en el cuello de botella único que limita el rendimiento del sistema — explotarlo, subordinar otros recursos a él, luego elevarlo antes de abordar la siguiente restricción.",
      },
    },
    coreConcepts_en: ["constraint", "bottleneck", "throughput", "exploit", "subordinate"],
    coreConcepts_es: ["restricción", "cuello de botella", "rendimiento", "explotar", "subordinar"],
    recognitionSignals_en: [
      "finding the single constraint that limits the whole system's output",
      "prioritizing improvement at the bottleneck over everywhere else",
      "subordinating non-constraint resources to support the bottleneck",
    ],
    recognitionSignals_es: [
      "encontrar la restricción única que limita la producción de todo el sistema",
      "priorizar la mejora en el cuello de botella sobre cualquier otro punto",
      "subordinar recursos no-restricción para apoyar al cuello de botella",
    ],
    suggestedDomainKeywords_en: ["toc", "constraint", "bottleneck", "throughput", "goldratt"],
    suggestedDomainKeywords_es: ["tdr", "toc", "restricción", "cuello de botella", "rendimiento"],
    aliases: ["toc", "tdr", "theory of constraints", "teoría de restricciones"],
  },
  {
    canonicalId: "just_in_time",
    canonicalName_en: "Just-in-Time",
    canonicalName_es: "Justo a Tiempo",
    primaryDimension: "tradeoff",
    disciplines: ["operations"],
    conceptualDescription_en:
      "A production strategy that aligns raw-material orders with production schedules so inventory arrives exactly when needed, reducing carrying costs but increasing exposure to supply-chain disruption risk.",
    conceptualDescription_es:
      "Una estrategia de producción que alinea pedidos de materia prima con calendarios de producción para que el inventario llegue exactamente cuando se necesita, reduciendo costos de almacenamiento pero aumentando la exposición a riesgos de disrupción en la cadena de suministro.",
    disciplineDescriptions: {
      operations: {
        en: "In operations, Just-in-Time synchronizes material arrivals with production schedules to minimize inventory carrying costs, trading buffer stock for tighter supplier coordination and heightened supply-chain risk awareness.",
        es: "En operaciones, Justo a Tiempo sincroniza la llegada de materiales con los calendarios de producción para minimizar costos de almacenamiento, cambiando stock de seguridad por coordinación más estrecha con proveedores y mayor conciencia de riesgo en la cadena de suministro.",
      },
    },
    coreConcepts_en: ["minimal inventory", "pull production", "supply chain risk", "carrying cost", "lead time"],
    coreConcepts_es: ["inventario mínimo", "producción por jalón", "riesgo de cadena de suministro", "costo de almacenamiento", "tiempo de entrega"],
    recognitionSignals_en: [
      "minimizing inventory holding to reduce waste and cost",
      "weighing efficiency gains against supply disruption risk",
      "synchronizing delivery schedules with production needs",
    ],
    recognitionSignals_es: [
      "minimizar inventario para reducir desperdicios y costos",
      "ponderar ganancias de eficiencia contra riesgo de disrupción de suministro",
      "sincronizar calendarios de entrega con necesidades de producción",
    ],
    suggestedDomainKeywords_en: ["jit", "just in time", "inventory", "pull", "supply chain"],
    suggestedDomainKeywords_es: ["jit", "justo a tiempo", "inventario", "jalón", "cadena de suministro"],
    aliases: ["jit", "just in time", "justo a tiempo"],
  },
  {
    canonicalId: "scor_model",
    canonicalName_en: "SCOR Model",
    canonicalName_es: "Modelo SCOR",
    primaryDimension: "analytical",
    disciplines: ["operations"],
    conceptualDescription_en:
      "The Supply Chain Operations Reference model structures supply chain management into five process areas — Plan, Source, Make, Deliver, Return — providing standardized metrics and best practices for benchmarking.",
    conceptualDescription_es:
      "El modelo de Referencia de Operaciones de la Cadena de Suministro estructura la gestión de la cadena en cinco áreas de proceso — Planificar, Abastecer, Producir, Entregar, Devolver — proporcionando métricas estandarizadas y mejores prácticas para benchmarking.",
    disciplineDescriptions: {
      operations: {
        en: "In operations, the SCOR Model provides a standardized framework for diagnosing supply chain performance across Plan, Source, Make, Deliver, and Return processes, enabling benchmarking and cross-functional improvement.",
        es: "En operaciones, el Modelo SCOR provee un marco estandarizado para diagnosticar el desempeño de la cadena de suministro en los procesos de Planificar, Abastecer, Producir, Entregar y Devolver, habilitando benchmarking y mejora transversal.",
      },
    },
    coreConcepts_en: ["plan", "source", "make", "deliver", "return", "supply chain metrics"],
    coreConcepts_es: ["planificar", "abastecer", "producir", "entregar", "devolver", "métricas de cadena"],
    recognitionSignals_en: [
      "analyzing supply chain performance across plan-source-make-deliver-return",
      "benchmarking supply chain metrics against industry standards",
      "structuring supply chain improvement using standardized process areas",
    ],
    recognitionSignals_es: [
      "analizar desempeño de cadena de suministro en planificar-abastecer-producir-entregar-devolver",
      "comparar métricas de cadena contra estándares de la industria",
      "estructurar la mejora de cadena de suministro usando áreas de proceso estandarizadas",
    ],
    suggestedDomainKeywords_en: ["scor", "supply chain", "plan source make deliver", "benchmarking"],
    suggestedDomainKeywords_es: ["scor", "cadena de suministro", "planificar abastecer producir entregar", "benchmarking"],
    aliases: ["supply chain operations reference", "scor", "modelo scor"],
  },
  {
    canonicalId: "kaizen",
    canonicalName_en: "Kaizen",
    canonicalName_es: "Kaizen",
    primaryDimension: "strategic",
    disciplines: ["operations"],
    conceptualDescription_en:
      "A philosophy of continuous, incremental improvement involving every employee from the shop floor to the C-suite, emphasizing small daily changes over dramatic one-time reforms.",
    conceptualDescription_es:
      "Una filosofía de mejora continua e incremental que involucra a cada empleado desde la planta hasta la alta dirección, enfatizando pequeños cambios diarios sobre reformas dramáticas de una sola vez.",
    disciplineDescriptions: {
      operations: {
        en: "In operations, Kaizen engages every employee — from shop floor to management — in identifying small, incremental process improvements daily, building a culture where standardization and continuous refinement compound over time.",
        es: "En operaciones, Kaizen involucra a cada empleado — desde la planta hasta la gerencia — en identificar mejoras incrementales de proceso pequeñas a diario, construyendo una cultura donde la estandarización y el refinamiento continuo se acumulan con el tiempo.",
      },
    },
    coreConcepts_en: ["continuous improvement", "incremental change", "employee involvement", "gemba", "standardize"],
    coreConcepts_es: ["mejora continua", "cambio incremental", "involucramiento del empleado", "gemba", "estandarizar"],
    recognitionSignals_en: [
      "proposing small iterative improvements rather than big-bang changes",
      "involving frontline workers in identifying improvement opportunities",
      "standardizing a new practice before improving it further",
    ],
    recognitionSignals_es: [
      "proponer mejoras iterativas pequeñas en vez de cambios drásticos",
      "involucrar a trabajadores de primera línea en identificar oportunidades de mejora",
      "estandarizar una práctica nueva antes de seguirla mejorando",
    ],
    suggestedDomainKeywords_en: ["kaizen", "continuous improvement", "incremental", "gemba", "standardize"],
    suggestedDomainKeywords_es: ["kaizen", "mejora continua", "incremental", "gemba", "estandarizar"],
    aliases: ["continuous improvement", "mejora continua", "kaizen"],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // HUMAN RESOURCES (6 new entries)
  // ═══════════════════════════════════════════════════════════════════════
  {
    canonicalId: "maslow_hierarchy",
    canonicalName_en: "Maslow's Hierarchy of Needs",
    canonicalName_es: "Pirámide de Maslow",
    primaryDimension: "stakeholder",
    disciplines: ["human_resources"],
    conceptualDescription_en:
      "A motivational theory arranging human needs in a five-level pyramid — physiological, safety, belonging, esteem, self-actualization — arguing lower needs must be substantially met before higher ones become motivating.",
    conceptualDescription_es:
      "Una teoría motivacional que organiza las necesidades humanas en una pirámide de cinco niveles — fisiológicas, seguridad, pertenencia, estima, autorrealización — argumentando que las necesidades inferiores deben satisfacerse antes de que las superiores se conviertan en motivadoras.",
    disciplineDescriptions: {
      human_resources: {
        en: "In human resources, Maslow's Hierarchy guides workforce motivation by diagnosing which need level employees occupy — from basic compensation and safety through belonging and recognition to growth opportunities — before designing appropriate incentives.",
        es: "En recursos humanos, la Jerarquía de Maslow guía la motivación laboral diagnosticando en qué nivel de necesidad se encuentran los empleados — desde compensación básica y seguridad hasta pertenencia, reconocimiento y oportunidades de crecimiento — antes de diseñar incentivos apropiados.",
      },
    },
    coreConcepts_en: ["physiological", "safety", "belonging", "esteem", "self-actualization"],
    coreConcepts_es: ["fisiológicas", "seguridad", "pertenencia", "estima", "autorrealización"],
    recognitionSignals_en: [
      "prioritizing basic employee needs before higher-level motivation",
      "explaining behavior through unmet needs at a specific pyramid level",
      "designing incentives that match the current need level of the workforce",
    ],
    recognitionSignals_es: [
      "priorizar necesidades básicas del empleado antes de motivación de nivel superior",
      "explicar comportamiento a través de necesidades insatisfechas en un nivel específico de la pirámide",
      "diseñar incentivos que correspondan al nivel actual de necesidad de la fuerza laboral",
    ],
    suggestedDomainKeywords_en: ["maslow", "hierarchy", "needs", "motivation", "self-actualization"],
    suggestedDomainKeywords_es: ["maslow", "jerarquía", "necesidades", "motivación", "autorrealización"],
    aliases: ["maslow pyramid", "jerarquía de necesidades", "maslow", "pirámide de maslow"],
  },
  {
    canonicalId: "herzberg_two_factor",
    canonicalName_en: "Herzberg Two-Factor Theory",
    canonicalName_es: "Teoría de los Dos Factores de Herzberg",
    primaryDimension: "stakeholder",
    disciplines: ["human_resources"],
    conceptualDescription_en:
      "Distinguishes between hygiene factors (salary, conditions, security) whose absence causes dissatisfaction, and motivators (achievement, recognition, growth) whose presence drives satisfaction — showing that eliminating dissatisfaction alone does not create motivation.",
    conceptualDescription_es:
      "Distingue entre factores higiénicos (salario, condiciones, seguridad) cuya ausencia causa insatisfacción, y motivadores (logro, reconocimiento, crecimiento) cuya presencia impulsa la satisfacción — mostrando que eliminar insatisfacción por sí solo no crea motivación.",
    disciplineDescriptions: {
      human_resources: {
        en: "In human resources, Herzberg's Two-Factor Theory separates hygiene factors (salary, conditions) that prevent dissatisfaction from motivators (achievement, recognition, growth) that drive engagement, guiding job design and reward strategy.",
        es: "En recursos humanos, la Teoría de los Dos Factores de Herzberg separa factores higiénicos (salario, condiciones) que previenen insatisfacción de motivadores (logro, reconocimiento, crecimiento) que impulsan el compromiso, guiando el diseño del puesto y la estrategia de recompensas.",
      },
    },
    coreConcepts_en: ["hygiene factors", "motivators", "satisfaction", "dissatisfaction", "job enrichment"],
    coreConcepts_es: ["factores higiénicos", "motivadores", "satisfacción", "insatisfacción", "enriquecimiento del puesto"],
    recognitionSignals_en: [
      "separating factors that prevent dissatisfaction from those that create satisfaction",
      "arguing that better salary alone will not motivate without meaningful work",
      "proposing job enrichment as a path to intrinsic motivation",
    ],
    recognitionSignals_es: [
      "separar factores que previenen insatisfacción de los que crean satisfacción",
      "argumentar que un mejor salario solo no motivará sin trabajo significativo",
      "proponer enriquecimiento del puesto como camino a motivación intrínseca",
    ],
    suggestedDomainKeywords_en: ["herzberg", "hygiene", "motivators", "satisfaction", "job enrichment"],
    suggestedDomainKeywords_es: ["herzberg", "higiene", "motivadores", "satisfacción", "enriquecimiento"],
    aliases: ["motivation hygiene theory", "teoría de motivación-higiene", "herzberg", "dos factores"],
  },
  {
    canonicalId: "kotter_change",
    canonicalName_en: "Kotter's 8-Step Change",
    canonicalName_es: "Modelo de Cambio de 8 Pasos de Kotter",
    primaryDimension: "strategic",
    disciplines: ["human_resources", "strategy"],
    conceptualDescription_en:
      "An eight-stage process for leading organizational change: create urgency, form a coalition, develop a vision, communicate, empower action, generate short-term wins, consolidate gains, and anchor new practices in culture.",
    conceptualDescription_es:
      "Un proceso de ocho etapas para liderar el cambio organizacional: crear urgencia, formar una coalición, desarrollar una visión, comunicar, empoderar la acción, generar victorias de corto plazo, consolidar avances y anclar nuevas prácticas en la cultura.",
    disciplineDescriptions: {
      human_resources: {
        en: "In human resources, Kotter's 8-Step model sequences large-scale organizational change — from building urgency and forming coalitions through quick wins to anchoring new behaviors in culture — reducing resistance and sustaining transformation.",
        es: "En recursos humanos, el modelo de 8 Pasos de Kotter secuencia el cambio organizacional a gran escala — desde construir urgencia y formar coaliciones hasta victorias rápidas y anclar nuevos comportamientos en la cultura — reduciendo resistencia y sosteniendo la transformación.",
      },
      strategy: {
        en: "In strategy, Kotter's framework ensures that strategic pivots translate into lasting organizational change by sequencing leadership actions that build momentum, overcome inertia, and embed new capabilities into the firm's culture.",
        es: "En estrategia, el marco de Kotter asegura que los pivotes estratégicos se traduzcan en cambio organizacional duradero secuenciando acciones de liderazgo que generan impulso, superan inercia e integran nuevas capacidades en la cultura de la empresa.",
      },
    },
    coreConcepts_en: ["urgency", "guiding coalition", "vision", "short-term wins", "anchoring change"],
    coreConcepts_es: ["urgencia", "coalición directiva", "visión", "victorias de corto plazo", "anclar el cambio"],
    recognitionSignals_en: [
      "building urgency before launching a change initiative",
      "securing early wins to build momentum for larger transformation",
      "embedding new behaviors in organizational culture to prevent regression",
    ],
    recognitionSignals_es: [
      "construir urgencia antes de lanzar una iniciativa de cambio",
      "asegurar victorias tempranas para generar impulso para una transformación mayor",
      "embeber nuevos comportamientos en la cultura organizacional para prevenir regresión",
    ],
    suggestedDomainKeywords_en: ["kotter", "change management", "urgency", "coalition", "anchoring"],
    suggestedDomainKeywords_es: ["kotter", "gestión del cambio", "urgencia", "coalición", "anclar"],
    aliases: ["kotter 8 step", "modelo kotter", "kotter change", "kotter"],
  },
  {
    canonicalId: "tuckman_stages",
    canonicalName_en: "Tuckman's Stages of Group Development",
    canonicalName_es: "Etapas de Desarrollo de Grupos de Tuckman",
    primaryDimension: "stakeholder",
    disciplines: ["human_resources"],
    conceptualDescription_en:
      "Describes five stages teams pass through — Forming, Storming, Norming, Performing, and Adjourning — helping leaders anticipate conflict, set expectations, and adapt their management style as the team matures.",
    conceptualDescription_es:
      "Describe cinco etapas por las que pasan los equipos — Formación, Conflicto, Normalización, Desempeño y Cierre — ayudando a los líderes a anticipar conflictos, establecer expectativas y adaptar su estilo de gestión conforme el equipo madura.",
    disciplineDescriptions: {
      human_resources: {
        en: "In human resources, Tuckman's Stages helps managers anticipate team dynamics — from the politeness of Forming through Storming conflict to productive Norming and Performing — and adapt leadership style at each phase.",
        es: "En recursos humanos, las Etapas de Tuckman ayudan a los gerentes a anticipar la dinámica de equipo — desde la cortesía de la Formación pasando por el conflicto hasta la Normalización y el Desempeño productivo — y adaptar el estilo de liderazgo en cada fase.",
      },
    },
    coreConcepts_en: ["forming", "storming", "norming", "performing", "adjourning"],
    coreConcepts_es: ["formación", "conflicto", "normalización", "desempeño", "cierre"],
    recognitionSignals_en: [
      "recognizing team conflict as a natural stage rather than a failure",
      "adjusting leadership approach based on the team's maturity level",
      "diagnosing whether a team has moved past storming into productive norming",
    ],
    recognitionSignals_es: [
      "reconocer el conflicto del equipo como una etapa natural en vez de un fracaso",
      "ajustar el enfoque de liderazgo según el nivel de madurez del equipo",
      "diagnosticar si un equipo ha superado el conflicto hacia una normalización productiva",
    ],
    suggestedDomainKeywords_en: ["tuckman", "forming", "storming", "norming", "performing", "team development"],
    suggestedDomainKeywords_es: ["tuckman", "formación", "conflicto", "normalización", "desempeño", "desarrollo de equipo"],
    aliases: ["forming storming norming performing", "formación conflicto normalización desempeño", "tuckman", "tuckman stages"],
  },
  {
    canonicalId: "hofstede_cultural",
    canonicalName_en: "Hofstede Cultural Dimensions",
    canonicalName_es: "Dimensiones Culturales de Hofstede",
    primaryDimension: "stakeholder",
    disciplines: ["human_resources", "strategy"],
    conceptualDescription_en:
      "Quantifies national culture along six dimensions — power distance, individualism, masculinity, uncertainty avoidance, long-term orientation, and indulgence — to explain cross-cultural differences in management and negotiation.",
    conceptualDescription_es:
      "Cuantifica la cultura nacional en seis dimensiones — distancia al poder, individualismo, masculinidad, aversión a la incertidumbre, orientación a largo plazo e indulgencia — para explicar diferencias interculturales en gestión y negociación.",
    disciplineDescriptions: {
      human_resources: {
        en: "In human resources, Hofstede's Cultural Dimensions helps managers adapt leadership, communication, and incentive design to the cultural norms of diverse workforces — accounting for power distance, individualism, and uncertainty avoidance.",
        es: "En recursos humanos, las Dimensiones Culturales de Hofstede ayudan a los gerentes a adaptar liderazgo, comunicación y diseño de incentivos a las normas culturales de fuerzas laborales diversas — considerando distancia al poder, individualismo y aversión a la incertidumbre.",
      },
      strategy: {
        en: "In strategy, Hofstede's Cultural Dimensions informs international expansion decisions by quantifying cultural distance between markets, anticipating management friction, and guiding localization of business practices.",
        es: "En estrategia, las Dimensiones Culturales de Hofstede informan decisiones de expansión internacional cuantificando la distancia cultural entre mercados, anticipando fricción gerencial y guiando la localización de prácticas de negocio.",
      },
    },
    coreConcepts_en: ["power distance", "individualism", "uncertainty avoidance", "long-term orientation", "cultural comparison"],
    coreConcepts_es: ["distancia al poder", "individualismo", "aversión a la incertidumbre", "orientación a largo plazo", "comparación cultural"],
    recognitionSignals_en: [
      "adapting management style to the cultural norms of a specific country",
      "explaining organizational behavior through cultural dimension scores",
      "anticipating cross-cultural friction in international teams or negotiations",
    ],
    recognitionSignals_es: [
      "adaptar el estilo de gestión a las normas culturales de un país específico",
      "explicar comportamiento organizacional a través de dimensiones culturales",
      "anticipar fricción intercultural en equipos o negociaciones internacionales",
    ],
    suggestedDomainKeywords_en: ["hofstede", "cultural dimensions", "power distance", "individualism", "cross-cultural"],
    suggestedDomainKeywords_es: ["hofstede", "dimensiones culturales", "distancia al poder", "individualismo", "intercultural"],
    aliases: ["hofstede model", "cultural dimensions", "hofstede", "dimensiones culturales de hofstede"],
  },
  {
    canonicalId: "situational_leadership",
    canonicalName_en: "Situational Leadership",
    canonicalName_es: "Liderazgo Situacional",
    primaryDimension: "stakeholder",
    disciplines: ["human_resources"],
    conceptualDescription_en:
      "Proposes that effective leadership style varies by follower readiness: directing for low-readiness followers, coaching for growing ones, supporting for capable but uncertain ones, and delegating for self-reliant performers.",
    conceptualDescription_es:
      "Propone que el estilo de liderazgo efectivo varía según la madurez del seguidor: dirigir para seguidores de baja madurez, entrenar para los que están creciendo, apoyar para los capaces pero inseguros, y delegar para los autónomos y competentes.",
    disciplineDescriptions: {
      human_resources: {
        en: "In human resources, Situational Leadership matches management style — directing, coaching, supporting, or delegating — to each employee's readiness level, ensuring new hires get structure while experienced performers receive autonomy.",
        es: "En recursos humanos, el Liderazgo Situacional adapta el estilo de gestión — dirigir, entrenar, apoyar o delegar — al nivel de madurez de cada empleado, asegurando que los nuevos reciban estructura mientras los experimentados reciban autonomía.",
      },
    },
    coreConcepts_en: ["directing", "coaching", "supporting", "delegating", "follower readiness"],
    coreConcepts_es: ["dirigir", "entrenar", "apoyar", "delegar", "madurez del seguidor"],
    recognitionSignals_en: [
      "matching leadership style to the competence and commitment of team members",
      "shifting from directive to delegating as subordinates develop",
      "diagnosing whether a team member needs guidance or autonomy",
    ],
    recognitionSignals_es: [
      "adaptar el estilo de liderazgo a la competencia y compromiso de los miembros del equipo",
      "cambiar de estilo directivo a delegativo conforme los subordinados se desarrollan",
      "diagnosticar si un miembro del equipo necesita guía o autonomía",
    ],
    suggestedDomainKeywords_en: ["situational leadership", "hersey blanchard", "readiness", "directing", "delegating"],
    suggestedDomainKeywords_es: ["liderazgo situacional", "hersey blanchard", "madurez", "dirigir", "delegar"],
    aliases: ["hersey blanchard", "modelo de hersey y blanchard", "situational leadership", "liderazgo situacional"],
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
  disciplines: string[];
}

export function resolveFrameworkName(
  name: string,
  language: "es" | "en" = "es",
): ResolvedFramework | null {
  if (!name || typeof name !== "string") return null;
  const norm = NORMALIZE(name);
  if (!norm) return null;

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
    disciplines: entry.disciplines,
  };
}

export const SIGNAL_FOR_DIMENSION: Record<FrameworkPrimaryDimension, "intent" | "justification" | "tradeoffAwareness" | "stakeholderAwareness" | "ethicalAwareness"> = {
  analytical: "justification",
  strategic: "intent",
  tradeoff: "tradeoffAwareness",
  stakeholder: "stakeholderAwareness",
  ethical: "ethicalAwareness",
};
