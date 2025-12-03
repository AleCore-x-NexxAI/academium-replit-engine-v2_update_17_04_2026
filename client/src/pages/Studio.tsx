import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import {
  Brain,
  ArrowLeft,
  Plus,
  Upload,
  FileText,
  Check,
  Loader2,
  Trash2,
  Edit,
  Eye,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Scenario } from "@shared/schema";

const scenarioFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  domain: z.string().min(1, "Please select a domain"),
  role: z.string().min(3, "Role must be at least 3 characters"),
  objective: z.string().min(10, "Objective must be at least 10 characters"),
  introText: z.string().min(20, "Introduction must be at least 20 characters"),
});

type ScenarioFormData = z.infer<typeof scenarioFormSchema>;

const DOMAINS = [
  "Marketing",
  "Ethics",
  "HR",
  "Strategy",
  "Crisis",
  "Finance",
  "Operations",
];

function CreateScenarioDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<ScenarioFormData>({
    resolver: zodResolver(scenarioFormSchema),
    defaultValues: {
      title: "",
      description: "",
      domain: "",
      role: "",
      objective: "",
      introText: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ScenarioFormData) => {
      return await apiRequest("POST", "/api/scenarios", {
        title: data.title,
        description: data.description,
        domain: data.domain,
        initialState: {
          role: data.role,
          objective: data.objective,
          introText: data.introText,
          kpis: {
            revenue: 100000,
            morale: 75,
            reputation: 75,
            efficiency: 75,
            trust: 75,
          },
        },
        isPublished: true,
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Scenario created successfully" });
      setOpen(false);
      form.reset();
      onSuccess();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Session Expired",
          description: "Please sign in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create scenario",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-scenario">
          <Plus className="w-4 h-4 mr-2" />
          Create Scenario
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Scenario</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scenario Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., The Data Breach Crisis"
                      {...field}
                      data-testid="input-scenario-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domain</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-domain">
                        <SelectValue placeholder="Select a domain" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DOMAINS.map((domain) => (
                        <SelectItem key={domain} value={domain}>
                          {domain}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief overview of the scenario..."
                      className="min-h-20"
                      {...field}
                      data-testid="input-scenario-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Player Role</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Chief Marketing Officer"
                      {...field}
                      data-testid="input-role"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="objective"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Objective</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Restore brand reputation while maintaining profitability"
                      {...field}
                      data-testid="input-objective"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="introText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opening Narrative</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="The story that sets the scene..."
                      className="min-h-32"
                      {...field}
                      data-testid="input-intro-text"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit-scenario"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Create Scenario
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ScenarioListItem({
  scenario,
  onDelete,
}: {
  scenario: Scenario;
  onDelete: () => void;
}) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/scenarios/${scenario.id}`);
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Scenario removed" });
      onDelete();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete scenario",
        variant: "destructive",
      });
    },
  });

  return (
    <Card
      className="p-4"
      data-testid={`studio-scenario-${scenario.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold truncate">{scenario.title}</h3>
            <Badge variant="secondary">{scenario.domain}</Badge>
            {scenario.isPublished && (
              <Badge variant="outline" className="text-chart-2 border-chart-2">
                Published
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {scenario.description}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" data-testid="button-view-scenario">
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" data-testid="button-edit-scenario">
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid="button-delete-scenario"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 text-destructive" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function Studio() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const {
    data: scenarios,
    isLoading: scenariosLoading,
    error: scenariosError,
    refetch,
  } = useQuery<Scenario[]>({
    queryKey: ["/api/scenarios/authored"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to access the studio.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [authLoading, isAuthenticated, toast]);

  useEffect(() => {
    if (!authLoading && user && user.role !== "professor" && user.role !== "admin") {
      toast({
        title: "Access Denied",
        description: "Only professors can access the authoring studio.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [authLoading, user, navigate, toast]);

  useEffect(() => {
    if (scenariosError && isUnauthorizedError(scenariosError as Error)) {
      toast({
        title: "Session Expired",
        description: "Please sign in again.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [scenariosError, toast]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold">Authoring Studio</span>
            </div>
          </div>

          <CreateScenarioDialog onSuccess={() => refetch()} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold mb-2">Your Scenarios</h1>
          <p className="text-muted-foreground">
            Create and manage business simulation scenarios for your students.
          </p>
        </motion.div>

        {scenariosLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : scenarios && scenarios.length > 0 ? (
          <div className="space-y-4">
            {scenarios.map((scenario) => (
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <ScenarioListItem scenario={scenario} onDelete={() => refetch()} />
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">No Scenarios Yet</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Create your first scenario to start building simulations.
            </p>
            <CreateScenarioDialog onSuccess={() => refetch()} />
          </Card>
        )}
      </main>
    </div>
  );
}
