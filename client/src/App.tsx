import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Landing from "@/pages/Landing";
import RoleSelection from "@/pages/RoleSelection";
import Home from "@/pages/Home";
import ExploreExample from "@/pages/ExploreExample";
import DemoSimulation from "@/pages/DemoSimulation";
import Simulation from "@/pages/Simulation";
import SimulationStart from "@/pages/SimulationStart";
import SessionResults from "@/pages/SessionResults";
import Studio from "@/pages/Studio";
import Analytics from "@/pages/Analytics";
import ProfessorDashboard from "@/pages/ProfessorDashboard";
import ScenarioEdit from "@/pages/ScenarioEdit";
import ScenarioAnalytics from "@/pages/ScenarioAnalytics";
import SimulationManagement from "@/pages/SimulationManagement";
import Settings from "@/pages/Settings";
import AiCostDashboard from "@/pages/AiCostDashboard";
import NotFound from "@/pages/not-found";
import { OnboardingModal } from "@/components/OnboardingModal";
import { RoleProtectedRoute } from "@/components/RoleProtectedRoute";
import type { User } from "@shared/schema";

function AuthenticatedApp() {
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  return (
    <>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/explore" component={ExploreExample} />
        <Route path="/demo-simulation">
          <RoleProtectedRoute allowedRoles={["professor", "admin"]}>
            <DemoSimulation />
          </RoleProtectedRoute>
        </Route>
        <Route path="/simulation/start/:scenarioId" component={SimulationStart} />
        <Route path="/simulation/:sessionId/results" component={SessionResults} />
        <Route path="/simulation/:sessionId" component={Simulation} />
        <Route path="/studio">
          <RoleProtectedRoute allowedRoles={["professor", "admin"]}>
            <Studio />
          </RoleProtectedRoute>
        </Route>
        <Route path="/analytics">
          <RoleProtectedRoute allowedRoles={["professor", "admin"]}>
            <Analytics />
          </RoleProtectedRoute>
        </Route>
        <Route path="/professor">
          <RoleProtectedRoute allowedRoles={["professor", "admin"]}>
            <ProfessorDashboard />
          </RoleProtectedRoute>
        </Route>
        <Route path="/scenarios/:scenarioId/manage">
          <RoleProtectedRoute allowedRoles={["professor", "admin"]}>
            <SimulationManagement />
          </RoleProtectedRoute>
        </Route>
        <Route path="/scenarios/:scenarioId/edit">
          {(params) => (
            <RoleProtectedRoute allowedRoles={["professor", "admin"]}>
              <ScenarioEdit />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/scenarios/:scenarioId/analytics">
          {(params) => (
            <RoleProtectedRoute allowedRoles={["professor", "admin"]}>
              <ScenarioAnalytics />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/settings">
          <RoleProtectedRoute allowedRoles={["admin"]}>
            <Settings />
          </RoleProtectedRoute>
        </Route>
        <Route path="/admin/ai-costs">
          <RoleProtectedRoute allowedRoles={["admin"]}>
            <AiCostDashboard />
          </RoleProtectedRoute>
        </Route>
        <Route component={NotFound} />
      </Switch>
      {user && <OnboardingModal user={user} />}
    </>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/select-role" component={RoleSelection} />
        <Route component={Landing} />
      </Switch>
    );
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider delayDuration={200} skipDelayDuration={0}>
          <Toaster />
          <Router />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
