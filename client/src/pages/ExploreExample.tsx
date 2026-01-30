import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  BookOpen,
  ArrowLeft,
  Target,
  Building2,
  User,
  MessageSquare,
  Play,
  ChevronRight,
  Eye,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const EXAMPLE_CASE = {
  title: "Crisis de Lanzamiento de Producto",
  domain: "Gestión de Crisis",
  duration: "20-25 minutos",
  role: "Gerente de Producto",
  company: "TechSolutions",
  industry: "Tecnología/Software B2B",
  context: `Eres el Gerente de Producto de TechSolutions, una empresa de software B2B. A tres días del lanzamiento de tu producto estrella 'CloudSync Pro', el equipo de QA descubre un problema crítico de seguridad que podría exponer datos de clientes. El CEO espera tu recomendación antes del fin del día.

TechSolutions ha invertido 18 meses y $2M en desarrollar CloudSync Pro. El equipo de ventas ya cerró pre-ventas por $500K. La competencia planea lanzar un producto similar en 6 semanas.`,
  coreChallenge: "Gestionar la crisis del lanzamiento equilibrando intereses de stakeholders, riesgos operacionales y reputación de la empresa.",
  constraints: [
    "Lanzamiento programado en 3 días",
    "Pre-ventas comprometidas por $500K",
    "Competencia lanza en 6 semanas",
    "Vulnerabilidad de seguridad confirmada",
  ],
  decisionPoints: [
    {
      id: 1,
      type: "multiple_choice",
      title: "Decisión 1: Acción Inmediata",
      description: "Elige tu primera respuesta ante la crisis",
      preview: "4 opciones: Informar al CEO, trabajo 24/7, lanzar con parche, o consultar legal",
    },
    {
      id: 2,
      type: "written",
      title: "Decisión 2: Gestión de Stakeholders",
      description: "Explica cómo manejas la tensión entre ventas y QA",
      preview: "Respuesta escrita: Cómo equilibras las demandas de diferentes grupos",
    },
    {
      id: 3,
      type: "reflection",
      title: "Decisión 3: Reflexión Final",
      description: "Sintetiza tu aprendizaje",
      preview: "Reflexión integradora: ¿Qué aprendiste? ¿Qué harías diferente?",
    },
  ],
  indicators: [
    { id: "teamMorale", label: "Moral del Equipo", description: "Estado emocional y compromiso del equipo" },
    { id: "budgetImpact", label: "Impacto Presupuestario", description: "Salud financiera y disponibilidad de recursos" },
    { id: "operationalRisk", label: "Riesgo Operacional", description: "Nivel de incertidumbre y peligro operacional" },
    { id: "strategicAlignment", label: "Alineación Estratégica", description: "Coherencia con objetivos organizacionales" },
  ],
};

export default function ExploreExample() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-[1000]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back-home">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              <span className="font-semibold" data-testid="text-preview-title">Vista Previa de Ejemplo</span>
            </div>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1" data-testid="badge-readonly">
            <Clock className="w-3 h-3" />
            Solo lectura
          </Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8">
            <p className="text-muted-foreground mb-2">
              Esta es una vista previa de cómo los estudiantes experimentan una simulación.
            </p>
            <p className="text-sm text-muted-foreground">
              Explora la estructura sin compromiso. Nada aquí es permanente ni afecta nada.
            </p>
          </div>

          <Card className="mb-8">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl mb-2" data-testid="text-example-title">
                    {EXAMPLE_CASE.title}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{EXAMPLE_CASE.domain}</Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {EXAMPLE_CASE.duration}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <User className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Tu Rol</p>
                    <p className="text-sm text-muted-foreground">{EXAMPLE_CASE.role}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Building2 className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Organización</p>
                    <p className="text-sm text-muted-foreground">{EXAMPLE_CASE.company} • {EXAMPLE_CASE.industry}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Contexto del Caso
                </h3>
                <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {EXAMPLE_CASE.context}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Desafío Central
                </h3>
                <p className="text-sm">{EXAMPLE_CASE.coreChallenge}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Estructura de Decisiones
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Los estudiantes toman exactamente 3 decisiones, cada una construyendo sobre la anterior.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {EXAMPLE_CASE.decisionPoints.map((decision, index) => (
                <div
                  key={decision.id}
                  className="flex items-start gap-4 p-4 rounded-lg border"
                  data-testid={`card-decision-preview-${decision.id}`}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-semibold text-sm">
                    {decision.id}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium" data-testid={`text-decision-title-${decision.id}`}>{decision.title}</h4>
                      <Badge variant="outline" className="text-xs" data-testid={`badge-decision-type-${decision.id}`}>
                        {decision.type === "multiple_choice" ? "Opción múltiple" : 
                         decision.type === "written" ? "Respuesta escrita" : "Reflexión"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2" data-testid={`text-decision-description-${decision.id}`}>{decision.description}</p>
                    <p className="text-xs text-muted-foreground/70 italic" data-testid={`text-decision-preview-${decision.id}`}>{decision.preview}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">Indicadores del Sistema</CardTitle>
              <p className="text-sm text-muted-foreground">
                Cada decisión afecta estos indicadores. No hay respuestas correctas — solo trade-offs.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {EXAMPLE_CASE.indicators.map((indicator) => (
                  <div key={indicator.id} className="text-center p-3 rounded-lg bg-muted/50" data-testid={`card-indicator-${indicator.id}`}>
                    <p className="text-sm font-medium" data-testid={`text-indicator-label-${indicator.id}`}>{indicator.label}</p>
                    <p className="text-xs text-muted-foreground" data-testid={`text-indicator-description-${indicator.id}`}>{indicator.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
                <div>
                  <h3 className="font-semibold mb-1">¿Listo para explorar más?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Puedes crear tu propia simulación o simplemente volver cuando estés listo.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link href="/studio">
                    <Button data-testid="button-create-simulation">
                      <Play className="w-4 h-4 mr-2" />
                      Crear Simulación
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button variant="outline" data-testid="button-back-to-home">
                      Volver al Inicio
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
