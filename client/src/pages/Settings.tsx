import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import {
  User as UserIcon,
  Settings as SettingsIcon,
  Save,
  Loader2,
  Plus,
  Trash2,
  Edit,
  Bot,
  Crown,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, LlmProvider } from "@shared/schema";
import { useTranslation } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";

const profileFormSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

const llmProviderFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  provider: z.string().min(1, "Provider is required").max(50),
  modelId: z.string().min(1, "Model ID is required").max(100),
  description: z.string().optional(),
  isEnabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().default(0),
});

type LlmProviderFormData = z.infer<typeof llmProviderFormSchema>;

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google AI" },
  { value: "azure", label: "Azure OpenAI" },
  { value: "custom", label: "Custom" },
];

function ProfileSection({ user }: { user: User }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: user.firstName || "",
      lastName: user.lastName || "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await apiRequest("PATCH", "/api/users/profile", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: t("settings.profileUpdated"),
        description: t("settings.profileSavedDesc"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("settings.updateProfileError"),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateMutation.mutate(data);
  };

  const getInitials = () => {
    const first = user.firstName?.charAt(0) || "";
    const last = user.lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const getRoleBadgeColor = () => {
    switch (user.role) {
      case "admin": return "default";
      case "professor": return "secondary";
      default: return "outline";
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <UserIcon className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">{t("settings.profile")}</h2>
      </div>

      <div className="flex items-start gap-6 mb-6">
        <Avatar className="w-20 h-20">
          <AvatarImage src={user.profileImageUrl || undefined} />
          <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-lg font-medium" data-testid="text-user-name">
              {user.firstName} {user.lastName}
            </p>
            {user.isSuperAdmin && (
              <Crown className="w-4 h-4 text-yellow-500" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-2" data-testid="text-user-email">
            {user.email}
          </p>
          <div className="flex items-center gap-2">
            <Badge variant={getRoleBadgeColor()} data-testid="badge-user-role">
              {user.role}
            </Badge>
            {user.isSuperAdmin && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                {t("settings.superadmin")}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("settings.firstName")}</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-first-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("settings.lastName")}</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-last-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button 
            type="submit" 
            disabled={updateMutation.isPending}
            data-testid="button-save-profile"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {t("settings.saveChanges")}
          </Button>
        </form>
      </Form>
    </Card>
  );
}

function LlmProviderForm({
  provider,
  onSuccess,
  onCancel,
}: {
  provider?: LlmProvider;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const isEditing = !!provider;

  const form = useForm<LlmProviderFormData>({
    resolver: zodResolver(llmProviderFormSchema),
    defaultValues: {
      name: provider?.name || "",
      provider: provider?.provider || "openai",
      modelId: provider?.modelId || "",
      description: provider?.description || "",
      isEnabled: provider?.isEnabled ?? true,
      isDefault: provider?.isDefault ?? false,
      sortOrder: provider?.sortOrder ?? 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: LlmProviderFormData) => {
      const response = await apiRequest("POST", "/api/llm-providers", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-providers"] });
      toast({ title: t("settings.providerCreated") });
      onSuccess();
    },
    onError: () => {
      toast({ title: t("settings.providerCreateError"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: LlmProviderFormData) => {
      const response = await apiRequest("PUT", `/api/llm-providers/${provider!.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-providers"] });
      toast({ title: t("settings.providerUpdated") });
      onSuccess();
    },
    onError: () => {
      toast({ title: t("settings.providerUpdateError"), variant: "destructive" });
    },
  });

  const onSubmit = (data: LlmProviderFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("settings.displayName")}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t("settings.providerNamePlaceholder")} data-testid="input-provider-name" />
              </FormControl>
              <FormDescription>{t("settings.providerNameDesc")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="provider"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("settings.provider")}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-provider-type">
                      <SelectValue placeholder={t("settings.selectProvider")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PROVIDER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
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
            name="modelId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("settings.modelId")}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t("settings.modelIdPlaceholder")} data-testid="input-model-id" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("settings.descriptionOptional")}</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder={t("settings.providerDescPlaceholder")}
                  rows={2}
                  data-testid="input-provider-description"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-6">
          <FormField
            control={form.control}
            name="isEnabled"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-provider-enabled"
                  />
                </FormControl>
                <FormLabel className="!mt-0">{t("settings.enabled")}</FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isDefault"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-provider-default"
                  />
                </FormControl>
                <FormLabel className="!mt-0">{t("settings.defaultForScenarios")}</FormLabel>
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-provider">
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={isPending} data-testid="button-save-provider">
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            {isEditing ? t("settings.updateProvider") : t("settings.createProvider")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function AiCostLink() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  return (
    <Card className="cursor-pointer hover-elevate" onClick={() => navigate("/admin/ai-costs")} data-testid="link-ai-costs">
      <CardContent className="flex items-center gap-3 p-4">
        <DollarSign className="w-5 h-5 text-primary" />
        <div>
          <p className="font-medium">{t("aiCostDashboard.title")}</p>
          <p className="text-sm text-muted-foreground">{t("aiCostDashboard.description")}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LlmProvidersSection() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LlmProvider | null>(null);

  const { data: providers, isLoading } = useQuery<LlmProvider[]>({
    queryKey: ["/api/llm-providers"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/llm-providers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-providers"] });
      toast({ title: t("settings.providerDeleted") });
    },
    onError: () => {
      toast({ title: t("settings.providerDeleteError"), variant: "destructive" });
    },
  });

  const getProviderLabel = (provider: string) => {
    return PROVIDER_OPTIONS.find((p) => p.value === provider)?.label || provider;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bot className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">{t("settings.llmProviders")}</h2>
          <Badge variant="outline" className="border-yellow-500 text-yellow-600">
            <Crown className="w-3 h-3 mr-1" />
            {t("settings.superadmin")}
          </Badge>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-provider">
              <Plus className="w-4 h-4 mr-1" />
              {t("settings.addProvider")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("settings.addLlmProvider")}</DialogTitle>
            </DialogHeader>
            <LlmProviderForm
              onSuccess={() => setIsAddDialogOpen(false)}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        {t("settings.llmProvidersDesc")}
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : providers && providers.length > 0 ? (
        <div className="space-y-3">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between p-4 border rounded-lg"
              data-testid={`card-provider-${provider.id}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{provider.name}</span>
                  {provider.isDefault && (
                    <Badge variant="secondary" className="text-xs">{t("settings.defaultBadge")}</Badge>
                  )}
                  {!provider.isEnabled && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">{t("settings.disabledBadge")}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{getProviderLabel(provider.provider)}</span>
                  <span>•</span>
                  <code className="text-xs bg-muted px-1 rounded">{provider.modelId}</code>
                </div>
                {provider.description && (
                  <p className="text-xs text-muted-foreground mt-1">{provider.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Dialog
                  open={editingProvider?.id === provider.id}
                  onOpenChange={(open) => !open && setEditingProvider(null)}
                >
                  <DialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingProvider(provider)}
                      data-testid={`button-edit-provider-${provider.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{t("settings.editLlmProvider")}</DialogTitle>
                    </DialogHeader>
                    {editingProvider && (
                      <LlmProviderForm
                        provider={editingProvider}
                        onSuccess={() => setEditingProvider(null)}
                        onCancel={() => setEditingProvider(null)}
                      />
                    )}
                  </DialogContent>
                </Dialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      data-testid={`button-delete-provider-${provider.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("settings.deleteLlmProvider")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("settings.deleteProviderConfirm", { name: provider.name })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(provider.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {t("common.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>{t("settings.noProviders")}</p>
          <p className="text-sm">{t("settings.noProvidersDesc")}</p>
        </div>
      )}
    </Card>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">{t("settings.pleaseLogin")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
          </div>
          <LanguageToggle />
        </div>

        <div className="space-y-6">
          <ProfileSection user={user} />
          
          {user.isSuperAdmin && (
            <AiCostLink />
          )}
          {user.isSuperAdmin && <LlmProvidersSection />}
        </div>
      </div>
    </div>
  );
}
