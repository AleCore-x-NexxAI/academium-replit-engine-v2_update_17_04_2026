import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, GraduationCap, BookMarked, Shield, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "@/contexts/LanguageContext";
import type { User } from "@shared/schema";

type UserRole = "student" | "professor" | "admin";

interface RoleSwitcherProps {
  user: User;
}

export function RoleSwitcher({ user }: RoleSwitcherProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  const isSuperAdmin = user.isSuperAdmin;
  const effectiveRole = (user.viewingAs || user.role) as UserRole;

  const getRoleLabel = (role: string) => {
    if (role === "professor") return t("roleSwitcher.professor");
    if (role === "admin") return t("roleSwitcher.admin");
    return t("roleSwitcher.student");
  };

  const switchViewMutation = useMutation({
    mutationFn: async (newView: UserRole) => {
      const response = await apiRequest("POST", "/api/users/view", { viewingAs: newView });
      return response.json();
    },
    onSuccess: (data: User) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/simulations/sessions"] });
      toast({
        title: t("roleSwitcher.viewSwitched"),
        description: t("roleSwitcher.nowViewingAs", { role: getRoleLabel(data.viewingAs || data.role) }),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("roleSwitcher.switchError"),
        variant: "destructive",
      });
    },
  });

  const switchRoleMutation = useMutation({
    mutationFn: async (newRole: UserRole) => {
      const response = await apiRequest("POST", "/api/users/role", { role: newRole });
      return response.json();
    },
    onSuccess: (data: User) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/simulations/sessions"] });
      toast({
        title: t("roleSwitcher.roleSwitched"),
        description: t("roleSwitcher.nowViewingAs", { role: getRoleLabel(data.role) }),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("roleSwitcher.switchError"),
        variant: "destructive",
      });
    },
  });

  const handleSwitch = (role: UserRole) => {
    if (role !== effectiveRole) {
      if (isSuperAdmin) {
        switchViewMutation.mutate(role);
      } else {
        switchRoleMutation.mutate(role);
      }
    }
  };

  const isPending = switchViewMutation.isPending || switchRoleMutation.isPending;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          data-testid="button-role-switcher"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isSuperAdmin ? (
            <Crown className="w-4 h-4 text-amber-500" />
          ) : (
            <ArrowLeftRight className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{t("roleSwitcher.switchView")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          {isSuperAdmin ? (
            <span className="flex items-center gap-1">
              <Crown className="w-3 h-3 text-amber-500" />
              {t("roleSwitcher.superadminLabel")}
            </span>
          ) : (
            t("roleSwitcher.adminLabel")
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleSwitch("student")}
          className="cursor-pointer"
          data-testid="menu-item-student"
        >
          <GraduationCap className="w-4 h-4 mr-2" />
          <span className="flex-1">{t("roleSwitcher.studentView")}</span>
          {effectiveRole === "student" && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {t("roleSwitcher.active")}
            </Badge>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSwitch("professor")}
          className="cursor-pointer"
          data-testid="menu-item-professor"
        >
          <BookMarked className="w-4 h-4 mr-2" />
          <span className="flex-1">{t("roleSwitcher.professorView")}</span>
          {effectiveRole === "professor" && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {t("roleSwitcher.active")}
            </Badge>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSwitch("admin")}
          className="cursor-pointer"
          data-testid="menu-item-admin"
        >
          <Shield className="w-4 h-4 mr-2" />
          <span className="flex-1">{t("roleSwitcher.adminView")}</span>
          {effectiveRole === "admin" && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {t("roleSwitcher.active")}
            </Badge>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
