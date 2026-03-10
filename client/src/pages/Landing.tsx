import { motion } from "framer-motion";
import { 
  Play, 
  Brain, 
  BarChart3, 
  Users, 
  Target, 
  Zap,
  ArrowRight,
  GraduationCap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Academium</span>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/select-role">
              Iniciar Sesión
              <ArrowRight className="w-4 h-4 ml-2" />
            </a>
          </Button>
        </div>
      </header>

      <main>
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Zap className="w-4 h-4" />
                Simulaciones de Negocios con IA
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                Aprende a Liderar con
                <span className="text-primary"> Decisiones Reales</span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
                Experimenta escenarios empresariales inmersivos impulsados por IA. Toma
                decisiones críticas, enfrenta consecuencias reales y desarrolla
                habilidades de liderazgo en un ambiente seguro.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" asChild data-testid="button-get-started">
                  <a href="/select-role">
                    <Play className="w-5 h-5 mr-2" />
                    Inicia Tu Primera Simulación
                  </a>
                </Button>
                <Button size="lg" variant="outline" data-testid="button-learn-more">
                  <GraduationCap className="w-5 h-5 mr-2" />
                  Para Educadores
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-20 px-6 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl font-bold mb-4">
                Cómo Funciona Academium
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Nuestro sistema de IA multi-agente crea experiencias de aprendizaje
                dinámicas y personalizadas que se adaptan a tus decisiones.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: <Target className="w-6 h-6" />,
                  title: "Elige Tu Escenario",
                  description:
                    "Selecciona de una biblioteca de desafíos empresariales: gestión de crisis, liderazgo de equipos, dilemas éticos y más.",
                },
                {
                  icon: <Brain className="w-6 h-6" />,
                  title: "Toma Decisiones",
                  description:
                    "Interactúa con personajes realistas, analiza datos y toma decisiones críticas que dan forma a la narrativa.",
                },
                {
                  icon: <BarChart3 className="w-6 h-6" />,
                  title: "Mide Tu Progreso",
                  description:
                    "Recibe retroalimentación instantánea, evaluaciones de competencias y realiza seguimiento de tu desarrollo.",
                },
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                >
                  <Card className="p-6 h-full hover-elevate">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                      {feature.icon}
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl font-bold mb-4">
                Indicadores Clave de Desempeño
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Cada decisión impacta cinco métricas fundamentales que determinan tu éxito.
              </p>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Moral del Equipo", color: "bg-chart-1" },
                { label: "Impacto Presupuestario", color: "bg-chart-2" },
                { label: "Riesgo Operacional", color: "bg-chart-3" },
                { label: "Alineación Estratégica", color: "bg-chart-4" },
                { label: "Presión de Tiempo", color: "bg-chart-5" },
              ].map((kpi, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="p-4 text-center">
                    <div
                      className={`w-3 h-3 rounded-full ${kpi.color} mx-auto mb-2`}
                    />
                    <span className="text-sm font-medium">{kpi.label}</span>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-6 bg-primary text-primary-foreground">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Users className="w-12 h-12 mx-auto mb-6 opacity-80" />
              <h2 className="text-3xl font-bold mb-4">
                ¿Listo para Transformar Tu Aprendizaje?
              </h2>
              <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
                Únete a miles de estudiantes y profesionales que desarrollan
                habilidades de liderazgo del mundo real a través de simulaciones
                inmersivas con IA.
              </p>
              <Button
                size="lg"
                variant="secondary"
                asChild
                data-testid="button-start-now"
              >
                <a href="/select-role">
                  Comenzar Gratis
                  <ArrowRight className="w-5 h-5 ml-2" />
                </a>
              </Button>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <span className="font-semibold">Academium</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Plataforma de aprendizaje experiencial impulsada por IA
          </p>
        </div>
      </footer>
    </div>
  );
}
