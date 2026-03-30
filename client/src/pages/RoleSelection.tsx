import { useState } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  GraduationCap,
  BookOpen,
  Shield,
  ArrowRight,
  KeyRound,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslation } from "@/contexts/LanguageContext";

type Role = "student" | "professor" | "admin";

export default function RoleSelection() {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const primaryRoleOptions = [
    {
      id: "student" as Role,
      title: t("roleSelection.student"),
      description: t("roleSelection.studentDesc"),
      icon: <GraduationCap className="w-8 h-8" />,
      color: "bg-chart-1/10 text-chart-1",
      requiresCode: false,
    },
    {
      id: "professor" as Role,
      title: t("roleSelection.professor"),
      description: t("roleSelection.professorDesc"),
      icon: <BookOpen className="w-8 h-8" />,
      color: "bg-chart-2/10 text-chart-2",
      requiresCode: false,
    },
  ];

  const adminRoleOption = {
    id: "admin" as Role,
    title: t("roleSelection.superAdmin"),
    description: t("roleSelection.superAdminDesc"),
    icon: <Shield className="w-5 h-5" />,
    color: "bg-muted text-muted-foreground",
    requiresCode: true,
  };

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    if (role === "admin") {
      setShowCodeDialog(true);
    } else {
      window.location.href = `/api/fresh-login?role=${role}`;
    }
  };

  const handleCodeSubmit = async () => {
    if (!adminCode.trim()) {
      toast({
        title: t("roleSelection.codeRequired"),
        description: t("roleSelection.enterAdminCode"),
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch("/api/auth/verify-admin-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: adminCode }),
      });

      const data = await response.json();

      if (data.valid) {
        window.location.href = `/api/fresh-login?role=admin&verified=true`;
      } else {
        toast({
          title: t("roleSelection.invalidCode"),
          description: t("roleSelection.invalidCodeDesc"),
          variant: "destructive",
        });
        setAdminCode("");
      }
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("roleSelection.verifyError"),
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">Academium</span>
            </a>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Button variant="ghost" asChild>
              <a href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("common.back")}
              </a>
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{t("roleSelection.chooseRole")}</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {t("roleSelection.chooseRoleDesc")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {primaryRoleOptions.map((option, index) => (
            <motion.div
              key={option.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex"
            >
              <Card
                className={`p-8 w-full cursor-pointer transition-all hover-elevate flex flex-col h-full ${
                  selectedRole === option.id ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => handleRoleSelect(option.id)}
                data-testid={`card-role-${option.id}`}
              >
                <div
                  className={`w-16 h-16 rounded-xl ${option.color} flex items-center justify-center mb-4 mx-auto`}
                >
                  {option.icon}
                </div>
                <h2 className="text-xl font-semibold mb-3 text-center">{option.title}</h2>
                <p className="text-sm text-muted-foreground mb-6 text-center flex-grow">
                  {option.description}
                </p>
                <Button
                  className="w-full mt-auto"
                  data-testid={`button-select-${option.id}`}
                >
                  {t("roleSelection.continueAs")} {option.title}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="max-w-2xl mx-auto mt-6"
        >
          <Card
            className={`px-6 py-4 w-full cursor-pointer transition-all hover-elevate border-dashed ${
              selectedRole === adminRoleOption.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => handleRoleSelect(adminRoleOption.id)}
            data-testid={`card-role-${adminRoleOption.id}`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-lg ${adminRoleOption.color} flex items-center justify-center shrink-0`}
              >
                {adminRoleOption.icon}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">{adminRoleOption.title}</h3>
                  <KeyRound className="w-3 h-3 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {adminRoleOption.description}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                data-testid={`button-select-${adminRoleOption.id}`}
              >
                {t("roleSelection.restrictedAccess")}
                <KeyRound className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </Card>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-xs text-muted-foreground mt-8"
        >
          {t("roleSelection.roleSaved")}
        </motion.p>
      </main>
      <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-chart-4" />
              {t("roleSelection.adminAccess")}
            </DialogTitle>
            <DialogDescription>
              {t("roleSelection.adminAccessDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="admin-code">{t("roleSelection.accessCode")}</Label>
            <Input
              id="admin-code"
              type="password"
              placeholder={t("roleSelection.enterCode")}
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCodeSubmit()}
              data-testid="input-admin-code"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCodeDialog(false);
                setAdminCode("");
                setSelectedRole(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleCodeSubmit}
              disabled={isVerifying}
              data-testid="button-verify-code"
            >
              {isVerifying ? t("roleSelection.verifying") : t("roleSelection.verifyAndContinue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
