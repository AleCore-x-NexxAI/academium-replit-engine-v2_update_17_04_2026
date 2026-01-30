import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  BookOpen, 
  Edit,
  Loader2,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Scenario } from "@shared/schema";

export default function ProfessorDashboard() {
  const [, navigate] = useLocation();

  // Use the professor scenarios endpoint that includes stats
  const { data: scenarios, isLoading, error } = useQuery<Scenario[]>({
    queryKey: ["/api/professor/scenarios"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b sticky top-0 bg-background z-[1000]">
          <div className="max-w-2xl mx-auto px-6 h-16 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-semibold">Mis Simulaciones</span>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-6 py-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b sticky top-0 bg-background z-[1000]">
          <div className="max-w-2xl mx-auto px-6 h-16 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-semibold">Mis Simulaciones</span>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-6 py-8">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                <p>Error al cargar simulaciones. Por favor intenta de nuevo.</p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Simple Header */}
      <header className="border-b sticky top-0 bg-background z-[1000]">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/")}
            data-testid="button-back-home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-semibold" data-testid="text-page-title">Mis Simulaciones</span>
        </div>
      </header>

      {/* Simple List */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        {!scenarios || scenarios.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Aún no has creado ninguna simulación.
              </p>
              <Button onClick={() => navigate("/studio")} data-testid="button-create-first">
                Crear Tu Primera Simulación
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {scenarios.map((scenario) => (
              <Card 
                key={scenario.id} 
                className="hover-elevate"
                data-testid={`card-simulation-${scenario.id}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    {/* Title and Status */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <h3 className="font-medium truncate" data-testid={`text-title-${scenario.id}`}>
                        {scenario.title}
                      </h3>
                      <Badge 
                        variant={scenario.isPublished ? "default" : "secondary"}
                        data-testid={`badge-status-${scenario.id}`}
                      >
                        {scenario.isPublished ? "Listo" : "Borrador"}
                      </Badge>
                    </div>

                    {/* Edit Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/studio?edit=${scenario.id}`)}
                      data-testid={`button-edit-${scenario.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
