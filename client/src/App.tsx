import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import ExploreExample from "@/pages/ExploreExample";
import Simulation from "@/pages/Simulation";
import SimulationStart from "@/pages/SimulationStart";
import SessionResults from "@/pages/SessionResults";
import Studio from "@/pages/Studio";
import Analytics from "@/pages/Analytics";
import ProfessorDashboard from "@/pages/ProfessorDashboard";
import ScenarioEdit from "@/pages/ScenarioEdit";
import ScenarioAnalytics from "@/pages/ScenarioAnalytics";
import BugReports from "@/pages/BugReports";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";
import { BugReportButton } from "@/components/BugReportButton";
import { OnboardingModal } from "@/components/OnboardingModal";
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
        <Route path="/simulation/start/:scenarioId" component={SimulationStart} />
        <Route path="/simulation/:sessionId/results" component={SessionResults} />
        <Route path="/simulation/:sessionId" component={Simulation} />
        <Route path="/studio" component={Studio} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/professor" component={ProfessorDashboard} />
        <Route path="/scenarios/:scenarioId/edit" component={ScenarioEdit} />
        <Route path="/scenarios/:scenarioId/analytics" component={ScenarioAnalytics} />
        <Route path="/bug-reports" component={BugReports} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
      {user?.isSuperAdmin && <BugReportButton />}
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
        <Route path="/bug-reports" component={BugReports} />
        <Route component={Landing} />
      </Switch>
    );
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
