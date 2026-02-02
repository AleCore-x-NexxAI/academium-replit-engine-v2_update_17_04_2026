import { useState, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  BookOpen, 
  Target,
  Building2,
  User,
  MessageSquare,
  Send,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

const DEMO_SCENARIO = {
  title: "Crisis de Lanzamiento de Producto",
  domain: "Gestión de Crisis",
  role: "Gerente de Producto",
  company: "TechSolutions",
  industry: "Tecnología/Software B2B",
  context: `Eres el Gerente de Producto de TechSolutions, una empresa de software B2B. A tres días del lanzamiento de tu producto estrella 'CloudSync Pro', el equipo de QA descubre un problema crítico de seguridad que podría exponer datos de clientes. El CEO espera tu recomendación antes del fin del día.

TechSolutions ha invertido 18 meses y $2M en desarrollar CloudSync Pro. El equipo de ventas ya cerró pre-ventas por $500K. La competencia planea lanzar un producto similar en 6 semanas.`,
  coreChallenge: "Gestionar la crisis del lanzamiento equilibrando intereses de stakeholders, riesgos operacionales y reputación de la empresa.",
  objective: "Tomar decisiones estratégicas para manejar la crisis y proteger los intereses de la empresa",
};

const DEMO_DECISIONS = [
  {
    id: 1,
    title: "Decisión 1: Acción Inmediata",
    prompt: "El equipo de QA te ha informado sobre la vulnerabilidad crítica. ¿Cuál es tu primera acción?",
    format: "multiple_choice" as const,
    options: [
      { id: "A", text: "Informar inmediatamente al CEO y solicitar una reunión de emergencia" },
      { id: "B", text: "Pedir al equipo de desarrollo que trabaje 24/7 para solucionar el problema" },
      { id: "C", text: "Proceder con el lanzamiento y planificar un parche posterior" },
      { id: "D", text: "Consultar con el equipo legal sobre posibles implicaciones" },
    ],
  },
  {
    id: 2,
    title: "Decisión 2: Gestión de Stakeholders",
    prompt: "El equipo de ventas está presionando para mantener la fecha de lanzamiento. ¿Cómo equilibras las demandas de ventas con las preocupaciones de seguridad?",
    format: "written" as const,
    placeholder: "Describe tu estrategia para manejar las expectativas del equipo de ventas mientras priorizas la seguridad...",
  },
  {
    id: 3,
    title: "Decisión 3: Reflexión Final",
    prompt: "Reflexiona sobre esta experiencia: ¿Qué aprendiste sobre la gestión de crisis? ¿Qué harías diferente la próxima vez?",
    format: "written" as const,
    placeholder: "Comparte tu reflexión sobre el proceso de toma de decisiones y los aprendizajes clave...",
  },
];

const STANDARD_INDICATORS = [
  { id: "revenue", label: "Ingresos / Presupuesto", value: 65, previousValue: 65 },
  { id: "morale", label: "Moral del Equipo", value: 70, previousValue: 70 },
  { id: "reputation", label: "Reputación de Marca", value: 75, previousValue: 75 },
  { id: "efficiency", label: "Eficiencia Operacional", value: 60, previousValue: 60 },
  { id: "trust", label: "Confianza de Stakeholders", value: 72, previousValue: 72 },
];

const DEMO_RESPONSES: Record<number, { narrative: string; feedback: string; indicatorChanges: Record<string, number>; rationale: Record<string, string[]> }> = {
  1: {
    narrative: `Tu decisión de actuar rápidamente ha sido notada por el equipo.

El CEO aprecia tu proactividad en comunicar el problema. En la reunión de emergencia, se discuten las opciones disponibles. El equipo legal confirma que lanzar con la vulnerabilidad podría resultar en demandas significativas.

Después de una discusión intensa, se decide aplazar el lanzamiento 2 semanas. El equipo de ventas no está contento, pero comprende la gravedad de la situación.`,
    feedback: "Tu decisión de informar al CEO inmediatamente demuestra buenas prácticas de gestión de crisis. La transparencia temprana permite tomar decisiones informadas.",
    indicatorChanges: { morale: -5, trust: 10, reputation: 5 },
    rationale: {
      morale: [
        "El aplazamiento genera frustración en el equipo de desarrollo",
        "Meses de trabajo intenso se sienten desvalorizados temporalmente",
      ],
      trust: [
        "La transparencia con liderazgo incrementa la confianza organizacional",
        "Stakeholders aprecian la comunicación proactiva del riesgo",
        "La decisión demuestra priorización de seguridad sobre velocidad",
      ],
      reputation: [
        "Evitar un lanzamiento con vulnerabilidades protege la imagen de marca",
        "El mercado valora empresas que priorizan la seguridad del cliente",
      ],
    },
  },
  2: {
    narrative: `Tu estrategia de comunicación con el equipo de ventas ha sido implementada.

Al presentar datos concretos sobre los riesgos legales y reputacionales, logras que el equipo de ventas comprenda la situación. Propones un plan de compensación para los clientes con pre-ventas: acceso anticipado a funciones premium sin costo adicional.

El equipo de ventas acepta comunicar el retraso a los clientes, posicionándolo como un compromiso con la calidad.`,
    feedback: "Tu enfoque equilibrado entre la presión comercial y la seguridad muestra madurez en la toma de decisiones. La propuesta de compensación es creativa.",
    indicatorChanges: { revenue: -10, efficiency: 5, trust: 8 },
    rationale: {
      revenue: [
        "La compensación con funciones premium reduce margen de ganancia",
        "El retraso de 2 semanas implica costos operativos adicionales",
      ],
      efficiency: [
        "El plan de comunicación estructurado agiliza la gestión de expectativas",
        "Procesos claros de escalamiento mejoran la respuesta organizacional",
      ],
      trust: [
        "La propuesta de compensación genera buena voluntad con clientes",
        "La transparencia sobre el retraso refuerza la relación comercial",
      ],
    },
  },
  3: {
    narrative: `Has completado la simulación de gestión de crisis.

El lanzamiento finalmente se realizó con éxito 2 semanas después. La vulnerabilidad fue corregida, y los clientes apreciaron la transparencia de TechSolutions. La compensación ofrecida generó buena voluntad en el mercado.

Este caso demuestra la importancia de priorizar la seguridad y mantener una comunicación clara con todos los stakeholders.`,
    feedback: "Tu reflexión muestra una comprensión profunda de los trade-offs en la gestión de crisis. Recuerda: las decisiones difíciles a menudo no tienen respuestas perfectas, solo mejores alternativas.",
    indicatorChanges: { revenue: 5, reputation: 10, morale: 8 },
    rationale: {
      revenue: [
        "El lanzamiento exitoso genera ventas y recupera inversión",
        "Clientes satisfechos con la compensación realizan compras adicionales",
      ],
      reputation: [
        "La narrativa de 'calidad sobre velocidad' posiciona bien a la marca",
        "Medios de la industria destacan el manejo responsable de la crisis",
        "Clientes recomiendan el producto por la experiencia positiva",
      ],
      morale: [
        "El equipo celebra el lanzamiento exitoso",
        "La validación externa refuerza el compromiso del equipo",
        "El manejo de la crisis fortalece la cultura organizacional",
      ],
    },
  },
};

interface HistoryEntry {
  role: "system" | "user" | "npc";
  content: string;
  timestamp: Date;
}

export default function DemoSimulation() {
  const [, navigate] = useLocation();
  const [currentDecision, setCurrentDecision] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      role: "system",
      content: DEMO_SCENARIO.context,
      timestamp: new Date(),
    },
  ]);
  const [indicators, setIndicators] = useState(STANDARD_INDICATORS);
  const [selectedOption, setSelectedOption] = useState("");
  const [writtenResponse, setWrittenResponse] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const [inputWarning, setInputWarning] = useState<string | null>(null);
  const [currentRationale, setCurrentRationale] = useState<Record<string, string[]> | null>(null);
  const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null);

  const validateInput = (input: string): { valid: boolean; message?: string } => {
    const trimmedInput = input.trim().toLowerCase();
    
    if (!trimmedInput || trimmedInput.length < 5) {
      return { valid: false, message: "Por favor, proporciona una respuesta más detallada relacionada con el caso." };
    }

    const offensivePatterns = [
      /\b(idiota|pendejo|estupido|tonto|imbecil|mierda|carajo|puta|joder|cabron|maldito)\b/i,
      /\b(idiot|stupid|dumb|ass|fuck|shit|damn|bastard)\b/i,
    ];
    
    for (const pattern of offensivePatterns) {
      if (pattern.test(trimmedInput)) {
        return { 
          valid: false, 
          message: "El lenguaje inapropiado no está permitido. Por favor, proporciona una respuesta profesional relacionada con el caso de estudio." 
        };
      }
    }

    const caseKeywords = ["equipo", "lanzamiento", "producto", "decision", "cliente", "empresa", "vulnerabilidad", 
                          "seguridad", "riesgo", "comunicar", "ceo", "ventas", "marketing", "estrategia", "proyecto",
                          "plan", "opcion", "alternativa", "solucion", "problema", "impacto", "resultado", "tiempo",
                          "recurso", "presupuesto", "stakeholder", "reputacion", "confianza", "moral", "eficiencia"];
    
    const hasRelevantContent = caseKeywords.some(keyword => trimmedInput.includes(keyword)) || trimmedInput.length > 30;
    
    if (!hasRelevantContent) {
      return { 
        valid: false, 
        message: "Tu respuesta no parece estar relacionada con el contexto del caso. Por favor, proporciona una respuesta relevante a la situación presentada." 
      };
    }

    return { valid: true };
  };

  const handleSubmitDecision = useCallback(async () => {
    if (currentDecision >= DEMO_DECISIONS.length) return;
    
    const decision = DEMO_DECISIONS[currentDecision];
    const userResponse = decision.format === "multiple_choice" 
      ? decision.options?.find(o => o.id === selectedOption)?.text || ""
      : writtenResponse;
    
    if (!userResponse.trim()) return;

    if (decision.format !== "multiple_choice") {
      const validation = validateInput(userResponse);
      if (!validation.valid) {
        setInputWarning(validation.message || "Por favor, proporciona una respuesta válida.");
        return;
      }
    }

    setInputWarning(null);
    setIsProcessing(true);
    setCurrentFeedback(null);

    setHistory(prev => [...prev, {
      role: "user" as const,
      content: userResponse,
      timestamp: new Date(),
    }]);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const response = DEMO_RESPONSES[currentDecision + 1];
    
    setHistory(prev => [...prev, {
      role: "npc" as const,
      content: response.narrative,
      timestamp: new Date(),
    }]);

    setIndicators(prev => prev.map(ind => ({
      ...ind,
      previousValue: ind.value,
      value: ind.value + (response.indicatorChanges[ind.id] || 0),
    })));

    setCurrentFeedback(response.feedback);
    setCurrentRationale(response.rationale);
    setExpandedIndicator(null);
    setIsProcessing(false);
    setSelectedOption("");
    setWrittenResponse("");

    if (currentDecision + 1 >= DEMO_DECISIONS.length) {
      setIsComplete(true);
    } else {
      setCurrentDecision(prev => prev + 1);
    }
  }, [currentDecision, selectedOption, writtenResponse]);

  const currentDecisionData = DEMO_DECISIONS[currentDecision];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-[1000]">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/explore">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <span className="font-semibold text-sm" data-testid="text-demo-title">
                {DEMO_SCENARIO.title}
              </span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Eye className="w-3 h-3" />
                Modo Demo (Solo Visualización)
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Sin guardar datos
            </Badge>
            <Badge variant="secondary">
              Decisión {Math.min(currentDecision + 1, DEMO_DECISIONS.length)} de {DEMO_DECISIONS.length}
            </Badge>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        <aside className="w-72 border-r bg-muted/30 p-4 hidden lg:block">
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Rol
              </h3>
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-primary" />
                {DEMO_SCENARIO.role}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Organización
              </h3>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-primary" />
                {DEMO_SCENARIO.company}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Objetivo
              </h3>
              <p className="text-sm text-muted-foreground">{DEMO_SCENARIO.objective}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Progreso
              </h3>
              <Progress 
                value={(currentDecision / DEMO_DECISIONS.length) * 100} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isComplete ? "Completado" : `${currentDecision} de ${DEMO_DECISIONS.length} decisiones`}
              </p>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col lg:flex-row">
          <div className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-2xl mx-auto space-y-4">
                <AnimatePresence mode="popLayout">
                  {history.map((entry, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`p-4 rounded-lg ${
                        entry.role === "user" 
                          ? "bg-primary/10 ml-8" 
                          : entry.role === "system"
                          ? "bg-muted border"
                          : "bg-card border mr-8"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {entry.role === "system" && (
                          <BookOpen className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        )}
                        {entry.role === "npc" && (
                          <MessageSquare className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-1">
                            {entry.role === "user" ? "Tu decisión" : entry.role === "system" ? "Contexto" : "Resultado"}
                          </p>
                          <p className="text-sm whitespace-pre-line">{entry.content}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {isProcessing && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 rounded-lg bg-muted border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="animate-pulse flex gap-1">
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-sm text-muted-foreground">Procesando tu decisión...</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>

            {!isComplete && currentDecisionData && (
              <div className="border-t p-6 bg-background">
                <div className="max-w-2xl mx-auto space-y-6">
                  {/* Task callout module - visually dominant */}
                  <div className="p-5 rounded-xl bg-primary/5 border-2 border-primary/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-5 h-5 text-primary" />
                      <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                        Tu decisión ahora
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold mb-3" data-testid="text-decision-title">
                      {currentDecisionData.title}
                    </h3>
                    <p className="text-base text-foreground leading-relaxed" data-testid="text-decision-prompt">
                      {currentDecisionData.prompt}
                    </p>
                  </div>

                  {/* Input area - clearly connected to task */}
                  <div className="space-y-4">
                    {currentDecisionData.format === "multiple_choice" && currentDecisionData.options && (
                      <RadioGroup value={selectedOption} onValueChange={setSelectedOption} className="space-y-3">
                        {currentDecisionData.options.map((option) => (
                          <div
                            key={option.id}
                            className="flex items-start gap-4 p-4 rounded-lg border-2 hover-elevate cursor-pointer transition-all data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
                            onClick={() => setSelectedOption(option.id)}
                            data-state={selectedOption === option.id ? "checked" : "unchecked"}
                          >
                            <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                            <Label htmlFor={option.id} className="text-base cursor-pointer flex-1 leading-relaxed">
                              <span className="font-semibold text-primary">{option.id}.</span> {option.text}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {currentDecisionData.format === "written" && (
                      <Textarea
                        value={writtenResponse}
                        onChange={(e) => {
                          setWrittenResponse(e.target.value);
                          if (inputWarning) setInputWarning(null);
                        }}
                        placeholder={currentDecisionData.placeholder || "Escribe tu respuesta..."}
                        rows={5}
                        className="resize-none text-base"
                        data-testid="input-written-response"
                      />
                    )}

                    {inputWarning && (
                      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive" data-testid="text-input-warning">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                          <span className="text-base">{inputWarning}</span>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleSubmitDecision}
                      disabled={isProcessing || (currentDecisionData.format === "multiple_choice" ? !selectedOption : !writtenResponse.trim())}
                      className="w-full h-12 text-base"
                      data-testid="button-submit-decision"
                    >
                      {isProcessing ? (
                        "Procesando..."
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-2" />
                          Enviar Decisión
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {isComplete && (
              <div className="border-t p-4 bg-background">
                <div className="max-w-2xl mx-auto text-center">
                  <div className="p-6 rounded-lg bg-green-500/10 border border-green-500/30">
                    <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Demo Completado</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Has experimentado el flujo completo de simulación que verán tus estudiantes.
                    </p>
                    <div className="flex gap-3 justify-center">
                      <Button variant="outline" onClick={() => navigate("/explore")}>
                        Volver al Ejemplo
                      </Button>
                      <Button onClick={() => navigate("/")}>
                        Ir al Inicio
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="w-96 border-l bg-muted/20 p-6 hidden xl:block">
            <div className="space-y-8">
              <div>
                <h3 className="text-base font-semibold uppercase tracking-wide text-muted-foreground mb-6">
                  Indicadores
                </h3>
                <div className="space-y-5">
                  {indicators.map((indicator) => {
                    const change = indicator.value - indicator.previousValue;
                    const hasRationale = currentRationale && currentRationale[indicator.id];
                    const isExpanded = expandedIndicator === indicator.id;
                    
                    return (
                      <div key={indicator.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-base font-medium">{indicator.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold">{indicator.value}%</span>
                            {change !== 0 && (
                              <Badge 
                                variant="secondary" 
                                className={`text-sm px-2 py-0.5 ${
                                  change > 0 
                                    ? "bg-green-500/15 text-green-700 border-green-500/30" 
                                    : "bg-red-500/15 text-red-700 border-red-500/30"
                                }`}
                              >
                                {change > 0 ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                                {change > 0 ? "+" : ""}{change}
                              </Badge>
                            )}
                            {change === 0 && (
                              <Badge variant="secondary" className="text-sm px-2 py-0.5">
                                <Minus className="w-3.5 h-3.5 mr-1" />
                                0
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Progress 
                          value={indicator.value} 
                          className={`h-3 ${change > 0 ? "[&>div]:bg-green-500" : change < 0 ? "[&>div]:bg-red-500" : ""}`}
                        />
                        
                        {/* Explainability button */}
                        {hasRationale && change !== 0 && (
                          <div className="pt-1">
                            <button
                              onClick={() => setExpandedIndicator(isExpanded ? null : indicator.id)}
                              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                              data-testid={`button-why-${indicator.id}`}
                            >
                              <HelpCircle className="w-4 h-4" />
                              <span>¿Por qué cambió?</span>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            
                            <AnimatePresence>
                              {isExpanded && currentRationale[indicator.id] && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden"
                                >
                                  <ul className="mt-3 space-y-2 pl-1">
                                    {currentRationale[indicator.id].map((reason, idx) => (
                                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0 mt-2" />
                                        <span>{reason}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {currentFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <h3 className="text-base font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                    Observaciones
                  </h3>
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-5">
                      <p className="text-base leading-relaxed">{currentFeedback}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
