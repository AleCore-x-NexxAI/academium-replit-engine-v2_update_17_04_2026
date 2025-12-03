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
            <span className="text-xl font-bold">SIMULEARN</span>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">
              Sign In
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
                AI-Powered Business Simulations
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                Learn to Lead Through
                <span className="text-primary"> Real Decisions</span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
                Experience immersive business scenarios powered by AI. Make critical
                decisions, face real consequences, and develop leadership skills in
                a safe environment.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" asChild data-testid="button-get-started">
                  <a href="/api/login">
                    <Play className="w-5 h-5 mr-2" />
                    Start Your First Simulation
                  </a>
                </Button>
                <Button size="lg" variant="outline" data-testid="button-learn-more">
                  <GraduationCap className="w-5 h-5 mr-2" />
                  For Educators
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
                How SIMULEARN Works
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Our multi-agent AI system creates dynamic, personalized learning
                experiences that adapt to your decisions.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: <Target className="w-6 h-6" />,
                  title: "Choose Your Scenario",
                  description:
                    "Select from a library of business challenges: crisis management, team leadership, ethical dilemmas, and more.",
                },
                {
                  icon: <Brain className="w-6 h-6" />,
                  title: "Make Decisions",
                  description:
                    "Engage with realistic NPCs, analyze data, and make critical choices that shape the narrative.",
                },
                {
                  icon: <BarChart3 className="w-6 h-6" />,
                  title: "Track Your Growth",
                  description:
                    "Receive instant feedback, competency assessments, and track your development over time.",
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
                Key Performance Indicators
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Every decision impacts five core metrics that determine your success.
              </p>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Revenue", color: "bg-chart-1" },
                { label: "Team Morale", color: "bg-chart-2" },
                { label: "Reputation", color: "bg-chart-3" },
                { label: "Efficiency", color: "bg-chart-4" },
                { label: "Trust", color: "bg-chart-5" },
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
                Ready to Transform Your Learning?
              </h2>
              <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
                Join thousands of students and professionals developing real-world
                leadership skills through immersive AI simulations.
              </p>
              <Button
                size="lg"
                variant="secondary"
                asChild
                data-testid="button-start-now"
              >
                <a href="/api/login">
                  Get Started for Free
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
            <span className="font-semibold">SIMULEARN</span>
          </div>
          <p className="text-sm text-muted-foreground">
            AI-powered experiential learning platform
          </p>
        </div>
      </footer>
    </div>
  );
}
