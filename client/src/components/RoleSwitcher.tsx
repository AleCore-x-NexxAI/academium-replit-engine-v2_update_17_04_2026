import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, GraduationCap, BookMarked, Shield, Loader2 } from "lucide-react";
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
import type { User } from "@shared/schema";

type UserRole = "student" | "professor" | "admin";

interface RoleSwitcherProps {
  currentRole: string;
}

export function RoleSwitcher({ currentRole }: RoleSwitcherProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const switchRoleMutation = useMutation({
    mutationFn: async (newRole: UserRole) => {
      const response = await apiRequest("POST", "/api/users/role", { role: newRole });
      return response.json();
    },
    onSuccess: (data: User) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/simulations/sessions"] });
      const roleLabel = data.role === "professor" ? "Professor" : data.role === "admin" ? "Admin" : "Student";
      toast({
        title: "Role Switched",
        description: `You are now viewing as ${roleLabel}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to switch role. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRoleSwitch = (role: UserRole) => {
    if (role !== currentRole) {
      switchRoleMutation.mutate(role);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          data-testid="button-role-switcher"
          disabled={switchRoleMutation.isPending}
        >
          {switchRoleMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowLeftRight className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Switch View</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Demo: Switch between roles
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleRoleSwitch("student")}
          className="cursor-pointer"
          data-testid="menu-item-student"
        >
          <GraduationCap className="w-4 h-4 mr-2" />
          <span className="flex-1">Student View</span>
          {currentRole === "student" && (
            <Badge variant="secondary" className="ml-2 text-xs">
              Active
            </Badge>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleRoleSwitch("professor")}
          className="cursor-pointer"
          data-testid="menu-item-professor"
        >
          <BookMarked className="w-4 h-4 mr-2" />
          <span className="flex-1">Professor View</span>
          {currentRole === "professor" && (
            <Badge variant="secondary" className="ml-2 text-xs">
              Active
            </Badge>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleRoleSwitch("admin")}
          className="cursor-pointer"
          data-testid="menu-item-admin"
        >
          <Shield className="w-4 h-4 mr-2" />
          <span className="flex-1">Admin View</span>
          {currentRole === "admin" && (
            <Badge variant="secondary" className="ml-2 text-xs">
              Active
            </Badge>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
