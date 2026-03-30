import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Upload,
  FileText,
  Check,
  Loader2,
  Trash2,
  Edit,
  Eye,
  X,
  File,
  Sparkles,
  PenTool,
} from "lucide-react";
import CanonicalCaseCreator, { type CanonicalCaseCreatorRef } from "@/components/CanonicalCaseCreator";
import ManualCaseCreator from "@/components/ManualCaseCreator";
import { AssistantIcon } from "@/components/AssistantIcon";
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
import { useTranslation } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import type { Scenario } from "@shared/schema";

const scenarioFormSchema = z.object({
  // Basic Info
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  domain: z.string().min(1, "Please select a domain"),
  difficultyLevel: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
  
  // Player Context
  role: z.string().min(3, "Role must be at least 3 characters"),
  objective: z.string().min(10, "Objective must be at least 10 characters"),
  introText: z.string().min(20, "Introduction must be at least 20 characters"),
  
  // Company Context
  companyName: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  
  // Situation Details
  situationBackground: z.string().optional(),
  timelineContext: z.string().optional(),
  
  // Environment
  industryContext: z.string().optional(),
  competitiveEnvironment: z.string().optional(),
  regulatoryEnvironment: z.string().optional(),
  culturalContext: z.string().optional(),
  resourceConstraints: z.string().optional(),
  
  // Stakeholders (as JSON string for form handling)
  stakeholdersJson: z.string().optional(),
  
  // Constraints & Learning
  keyConstraintsText: z.string().optional(),
  learningObjectivesText: z.string().optional(),
  ethicalDimensionsText: z.string().optional(),
  
  // Language
  language: z.enum(["es", "en"]).default("es"),
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
  "Leadership",
  "Sustainability",
  "Innovation",
  "Mergers & Acquisitions",
  "Supply Chain",
];

const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance",
  "Manufacturing",
  "Retail",
  "Education",
  "Non-profit",
  "Energy",
  "Media & Entertainment",
  "Real Estate",
  "Transportation",
  "Hospitality",
  "Agriculture",
  "Government",
];

const COMPANY_SIZES = [
  { value: "startup", label: "Startup (1-50 employees)" },
  { value: "small", label: "Small Business (51-200)" },
  { value: "medium", label: "Medium Enterprise (201-1000)" },
  { value: "large", label: "Large Corporation (1001-10000)" },
  { value: "enterprise", label: "Enterprise (10000+)" },
];

const DIFFICULTY_LEVELS = [
  { value: "beginner", label: "Beginner - Clear choices, forgiving outcomes" },
  { value: "intermediate", label: "Intermediate - Trade-offs and complexity" },
  { value: "advanced", label: "Advanced - Ambiguous situations, high stakes" },
];

interface UploadedFile {
  name: string;
  url: string;
  size: number;
}

function PDFUploader({
  onUploadComplete,
  uploadedFile,
  onRemoveFile,
}: {
  onUploadComplete: (file: UploadedFile) => void;
  uploadedFile?: UploadedFile;
  onRemoveFile: () => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleUpload = async (file: globalThis.File) => {
    if (file.type !== "application/pdf") {
      toast({
        title: t("studio.invalidFileType"),
        description: t("studio.pleaseUploadPDF"),
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t("studio.fileTooLarge"),
        description: t("studio.maxFileSize10MB"),
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const response = await apiRequest("POST", "/api/upload/url");
      const { uploadUrl } = (await response.json()) as { uploadUrl: string };

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      const fileUrl = uploadUrl.split("?")[0];
      
      onUploadComplete({
        name: file.name,
        url: fileUrl,
        size: file.size,
      });

      toast({
        title: t("studio.uploadComplete"),
        description: `${file.name} ${t("studio.uploadedSuccessfully")}`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: t("studio.uploadFailed"),
        description: t("studio.uploadFailedDesc"),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (uploadedFile) {
    return (
      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm truncate max-w-[200px]">
                {uploadedFile.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(uploadedFile.size)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemoveFile}
            data-testid="button-remove-file"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
        ${dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"}
        ${isUploading ? "pointer-events-none opacity-50" : ""}
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      data-testid="dropzone-pdf"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleChange}
        className="hidden"
        data-testid="input-pdf-file"
      />
      {isUploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t("studio.uploading")}</p>
        </div>
      ) : (
        <>
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">
            {t("studio.dropPDFHere")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("studio.maxFileSizeLabel")}
          </p>
        </>
      )}
    </div>
  );
}

// Rubric file uploader (supports PDF, DOC, DOCX)
function RubricUploader({
  onUploadComplete,
}: {
  onUploadComplete: (file: UploadedFile) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const handleUpload = async (file: globalThis.File) => {
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: t("studio.invalidFileType"),
        description: t("studio.pleaseUploadDoc"),
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t("studio.fileTooLarge"),
        description: t("studio.maxFileSize10MB"),
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const response = await apiRequest("POST", "/api/upload/url");
      const { uploadUrl } = (await response.json()) as { uploadUrl: string };

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      const fileUrl = uploadUrl.split("?")[0];
      
      onUploadComplete({
        name: file.name,
        url: fileUrl,
        size: file.size,
      });

      toast({
        title: t("studio.uploadComplete"),
        description: `${file.name} ${t("studio.uploadedSuccessfully")}`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: t("studio.uploadFailed"),
        description: t("studio.uploadFailedDesc"),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  return (
    <div
      className={`
        border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
        ${dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"}
        ${isUploading ? "pointer-events-none opacity-50" : ""}
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      data-testid="dropzone-rubric"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleChange}
        className="hidden"
        data-testid="input-rubric-file"
      />
      {isUploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t("studio.uploading")}</p>
        </div>
      ) : (
        <>
          <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">
            {t("studio.dropRubricHere")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("studio.rubricFormats")}
          </p>
        </>
      )}
    </div>
  );
}

// Extended form schema for KPIs and rubric
const extendedScenarioFormSchema = scenarioFormSchema.extend({
  // Initial KPIs
  kpiRevenue: z.coerce.number().min(0).default(100000),
  kpiMorale: z.coerce.number().min(0).max(100).default(75),
  kpiReputation: z.coerce.number().min(0).max(100).default(75),
  kpiEfficiency: z.coerce.number().min(0).max(100).default(75),
  kpiTrust: z.coerce.number().min(0).max(100).default(75),
  // Rubric criteria as text
  rubricCriteriaText: z.string().optional(),
});

type ExtendedScenarioFormData = z.infer<typeof extendedScenarioFormSchema>;

interface CustomKPIInput {
  id: string;
  label: string;
  value: number;
  unit: "percentage" | "absolute" | "currency";
}

function ManualScenarioForm({ onSuccess }: { onSuccess: () => void }) {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | undefined>();
  const [rubricFile, setRubricFile] = useState<UploadedFile | undefined>();
  const [customKpis, setCustomKpis] = useState<CustomKPIInput[]>([]);
  const [courseConcepts, setCourseConcepts] = useState<string[]>([]);
  const [conceptInput, setConceptInput] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["basic", "player"]));
  const { toast } = useToast();
  const { t } = useTranslation();

  const addCustomKpi = () => {
    setCustomKpis(prev => [...prev, {
      id: `custom-${Date.now()}`,
      label: "",
      value: 50,
      unit: "percentage"
    }]);
  };

  const removeCustomKpi = (id: string) => {
    setCustomKpis(prev => prev.filter(k => k.id !== id));
  };

  const updateCustomKpi = (id: string, field: keyof CustomKPIInput, value: string | number) => {
    setCustomKpis(prev => prev.map(k => 
      k.id === id ? { ...k, [field]: value } : k
    ));
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const form = useForm<ExtendedScenarioFormData>({
    resolver: zodResolver(extendedScenarioFormSchema),
    defaultValues: {
      title: "",
      description: "",
      domain: "",
      difficultyLevel: "intermediate",
      role: "",
      objective: "",
      introText: "",
      companyName: "",
      industry: "",
      companySize: "",
      situationBackground: "",
      timelineContext: "",
      industryContext: "",
      competitiveEnvironment: "",
      regulatoryEnvironment: "",
      culturalContext: "",
      resourceConstraints: "",
      stakeholdersJson: "",
      keyConstraintsText: "",
      learningObjectivesText: "",
      ethicalDimensionsText: "",
      language: "es",
      kpiRevenue: 100000,
      kpiMorale: 75,
      kpiReputation: 75,
      kpiEfficiency: 75,
      kpiTrust: 75,
      rubricCriteriaText: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ExtendedScenarioFormData) => {
      let stakeholders: Array<{name: string; role: string; interests: string; influence: "low" | "medium" | "high"}> = [];
      if (data.stakeholdersJson) {
        try {
          stakeholders = JSON.parse(data.stakeholdersJson);
        } catch {
          stakeholders = data.stakeholdersJson.split("\n")
            .filter(line => line.trim())
            .map(line => {
              const parts = line.split("-").map(p => p.trim());
              return {
                name: parts[0] || "Stakeholder",
                role: parts[1] || "Role",
                interests: parts[2] || "Interests",
                influence: "medium" as const,
              };
            });
        }
      }
      
      const parseTextList = (text?: string) => 
        text?.split("\n").filter(line => line.trim()).map(line => line.trim()) || [];
      
      // Parse rubric criteria
      let rubric: { 
        criteria: { name: string; weight: number; description: string; }[];
        attachment?: { name: string; url: string; size: number; };
      } | null = null;
      if (data.rubricCriteriaText) {
        const criteria = data.rubricCriteriaText.split("\n")
          .filter(line => line.trim())
          .map(line => {
            const parts = line.split("|").map(p => p.trim());
            return {
              name: parts[0] || "Criterion",
              weight: parseInt(parts[1]) || 25,
              description: parts[2] || "Description",
            };
          });
        if (criteria.length > 0) {
          rubric = { criteria };
        }
      }
      
      // Add rubric attachment if uploaded
      if (rubric && rubricFile) {
        rubric.attachment = {
          name: rubricFile.name,
          url: rubricFile.url,
          size: rubricFile.size,
        };
      }

      // Format custom KPIs for the schema
      const formattedCustomKpis = customKpis
        .filter(k => k.label.trim())
        .map(k => ({
          id: k.id,
          label: k.label,
          value: k.value,
          unit: k.unit,
        }));
      
      return await apiRequest("POST", "/api/scenarios", {
        title: data.title,
        description: data.description,
        domain: data.domain,
        initialState: {
          role: data.role,
          objective: data.objective,
          introText: data.introText,
          kpis: {
            revenue: data.kpiRevenue,
            morale: data.kpiMorale,
            reputation: data.kpiReputation,
            efficiency: data.kpiEfficiency,
            trust: data.kpiTrust,
          },
          customKpis: formattedCustomKpis.length > 0 ? formattedCustomKpis : undefined,
          caseStudyUrl: uploadedFile?.url,
          companyName: data.companyName || undefined,
          industry: data.industry || undefined,
          companySize: data.companySize || undefined,
          situationBackground: data.situationBackground || undefined,
          timelineContext: data.timelineContext || undefined,
          industryContext: data.industryContext || undefined,
          competitiveEnvironment: data.competitiveEnvironment || undefined,
          regulatoryEnvironment: data.regulatoryEnvironment || undefined,
          culturalContext: data.culturalContext || undefined,
          resourceConstraints: data.resourceConstraints || undefined,
          difficultyLevel: data.difficultyLevel,
          stakeholders: stakeholders.length > 0 ? stakeholders : undefined,
          keyConstraints: parseTextList(data.keyConstraintsText).length > 0 ? parseTextList(data.keyConstraintsText) : undefined,
          learningObjectives: parseTextList(data.learningObjectivesText).length > 0 ? parseTextList(data.learningObjectivesText) : undefined,
        },
        rubric,
        courseConcepts: courseConcepts.length > 0 ? courseConcepts : undefined,
        isPublished: true,
        language: data.language || "es",
      });
    },
    onSuccess: () => {
      toast({ title: t("studio.success"), description: t("studio.scenarioCreated") });
      form.reset();
      setUploadedFile(undefined);
      setRubricFile(undefined);
      setCustomKpis([]);
      setCourseConcepts([]);
      setConceptInput("");
      onSuccess();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({ title: t("studio.sessionExpired"), description: t("studio.pleaseSignInAgain"), variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: t("studio.error"), description: t("studio.failedCreateScenario"), variant: "destructive" });
    },
  });

  const SectionHeader = ({ id, title, isRequired }: { id: string; title: string; isRequired?: boolean }) => (
    <button
      type="button"
      onClick={() => toggleSection(id)}
      className="flex items-center justify-between w-full text-left py-2 border-b"
    >
      <h3 className="text-lg font-semibold flex items-center gap-2">
        {title}
        {isRequired && <Badge variant="secondary" className="text-xs">{t("studio.required")}</Badge>}
      </h3>
      <motion.div
        animate={{ rotate: expandedSections.has(id) ? 180 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </motion.div>
    </button>
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
        className="space-y-6"
      >
        {/* SECTION 1: Basic Information */}
        <div className="space-y-4">
          <SectionHeader id="basic" title={t("studio.basicInformation")} isRequired />
          <AnimatePresence>
            {expandedSections.has("basic") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("studio.scenarioTitle")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("studio.scenarioTitlePlaceholder")} {...field} data-testid="input-scenario-title-manual" />
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
                        <FormLabel>{t("studio.domain")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-domain-manual">
                              <SelectValue placeholder={t("studio.selectDomain")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DOMAINS.map((domain) => (
                              <SelectItem key={domain} value={domain}>{domain}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="difficultyLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studio.difficultyLevel")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-difficulty-manual">
                            <SelectValue placeholder={t("studio.selectDifficulty")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DIFFICULTY_LEVELS.map((level) => (
                            <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Idioma de la Simulación</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-language-manual">
                            <SelectValue placeholder="Idioma" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="es">Español</SelectItem>
                          <SelectItem value="en">English</SelectItem>
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
                      <FormLabel>{t("studio.description")}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t("studio.descriptionPlaceholder")} className="min-h-20" {...field} data-testid="input-description-manual" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECTION 2: Company Context */}
        <div className="space-y-4">
          <SectionHeader id="company" title={t("studio.companyContext")} />
          <AnimatePresence>
            {expandedSections.has("company") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                <p className="text-sm text-muted-foreground">{t("studio.companyContextDesc")}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("studio.companyName")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("studio.companyNamePlaceholder")} {...field} data-testid="input-company-name-manual" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("studio.industry")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-industry-manual">
                              <SelectValue placeholder={t("studio.selectIndustry")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {INDUSTRIES.map((industry) => (
                              <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="companySize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("studio.companySize")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-company-size-manual">
                              <SelectValue placeholder={t("studio.selectSize")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COMPANY_SIZES.map((size) => (
                              <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="situationBackground"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studio.situationBackground")}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={t("studio.situationBackgroundPlaceholder")}
                          className="min-h-20" 
                          {...field} 
                          data-testid="input-situation-background-manual" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="industryContext"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("studio.industryDynamics")}</FormLabel>
                        <FormControl>
                          <Textarea placeholder={t("studio.industryDynamicsPlaceholder")} className="min-h-16" {...field} data-testid="input-industry-context-manual" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="competitiveEnvironment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("studio.competitiveEnvironment")}</FormLabel>
                        <FormControl>
                          <Textarea placeholder={t("studio.competitiveEnvironmentPlaceholder")} className="min-h-16" {...field} data-testid="input-competitive-manual" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECTION 3: Player Role & Situation */}
        <div className="space-y-4">
          <SectionHeader id="player" title={t("studio.playerRoleSituation")} isRequired />
          <AnimatePresence>
            {expandedSections.has("player") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("studio.playerRole")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("studio.playerRolePlaceholder")} {...field} data-testid="input-role-manual" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timelineContext"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("studio.timelineContext")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("studio.timelineContextPlaceholder")} {...field} data-testid="input-timeline-manual" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="objective"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studio.primaryObjective")}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t("studio.objectivePlaceholder")} className="min-h-16" {...field} data-testid="input-objective-manual" />
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
                      <FormLabel>{t("studio.openingNarrative")}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={t("studio.openingNarrativePlaceholder")}
                          className="min-h-32" 
                          {...field} 
                          data-testid="input-intro-manual" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECTION 4: Stakeholders */}
        <div className="space-y-4">
          <SectionHeader id="stakeholders" title={t("studio.keyStakeholders")} />
          <AnimatePresence>
            {expandedSections.has("stakeholders") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                <p className="text-sm text-muted-foreground">{t("studio.stakeholdersDesc")}</p>
                <FormField
                  control={form.control}
                  name="stakeholdersJson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studio.stakeholders")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Sarah Chen - CEO - Wants quick resolution to protect stock price&#10;Marcus Williams - Head of PR - Concerned about media narrative&#10;Elena Rodriguez - Legal Counsel - Focused on regulatory compliance&#10;James Park - Employee Rep - Advocates for staff concerns"
                          className="min-h-28 font-mono text-sm"
                          {...field}
                          data-testid="input-stakeholders-manual"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECTION 5: Environment & Constraints */}
        <div className="space-y-4">
          <SectionHeader id="environment" title={t("studio.environmentConstraints")} />
          <AnimatePresence>
            {expandedSections.has("environment") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="regulatoryEnvironment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("studio.regulatoryEnvironment")}</FormLabel>
                        <FormControl>
                          <Textarea placeholder={t("studio.regulatoryPlaceholder")} className="min-h-16" {...field} data-testid="input-regulatory-manual" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="culturalContext"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("studio.culturalContext")}</FormLabel>
                        <FormControl>
                          <Textarea placeholder={t("studio.culturalPlaceholder")} className="min-h-16" {...field} data-testid="input-cultural-manual" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="resourceConstraints"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studio.resourceConstraints")}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t("studio.resourcesPlaceholder")} className="min-h-16" {...field} data-testid="input-resources-manual" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="keyConstraintsText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studio.keyConstraints")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="$500,000 maximum budget&#10;Must maintain at least 80% workforce&#10;Cannot change product pricing"
                          className="min-h-20 font-mono text-sm"
                          {...field}
                          data-testid="input-constraints-manual"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECTION 6: Learning Objectives */}
        <div className="space-y-4">
          <SectionHeader id="learning" title={t("studio.learningObjectives")} />
          <AnimatePresence>
            {expandedSections.has("learning") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                <p className="text-sm text-muted-foreground">{t("studio.learningObjectivesDesc")}</p>
                <FormField
                  control={form.control}
                  name="learningObjectivesText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studio.learningObjectives")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Understand crisis communication strategies&#10;Balance stakeholder interests under pressure&#10;Apply decision-making frameworks under uncertainty&#10;Analyze trade-offs between short and long-term outcomes"
                          className="min-h-28 font-mono text-sm"
                          {...field}
                          data-testid="input-learning-objectives-manual"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECTION 6B: Course Concepts */}
        <div className="space-y-4">
          <SectionHeader id="concepts" title={t("studio.courseConcepts")} />
          <AnimatePresence>
            {expandedSections.has("concepts") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                <p className="text-sm text-muted-foreground">
                  {t("studio.courseConceptsDesc")}
                </p>
                <div className="flex gap-2">
                  <Input
                    value={conceptInput}
                    onChange={(e) => setConceptInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = conceptInput.trim();
                        if (val && !courseConcepts.includes(val) && courseConcepts.length < 8) {
                          setCourseConcepts(prev => [...prev, val]);
                          setConceptInput("");
                        }
                      }
                    }}
                    placeholder={t("studio.conceptPlaceholder")}
                    disabled={courseConcepts.length >= 8}
                    data-testid="input-course-concept"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={!conceptInput.trim() || courseConcepts.includes(conceptInput.trim()) || courseConcepts.length >= 8}
                    onClick={() => {
                      const val = conceptInput.trim();
                      if (val && !courseConcepts.includes(val) && courseConcepts.length < 8) {
                        setCourseConcepts(prev => [...prev, val]);
                        setConceptInput("");
                      }
                    }}
                    data-testid="button-add-concept"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {courseConcepts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {courseConcepts.map((concept, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="gap-1 pr-1"
                        data-testid={`badge-concept-${index}`}
                      >
                        {concept}
                        <button
                          type="button"
                          onClick={() => setCourseConcepts(prev => prev.filter((_, i) => i !== index))}
                          className="ml-1 rounded-full p-0.5"
                          data-testid={`button-remove-concept-${index}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                {courseConcepts.length > 0 && courseConcepts.length < 3 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {t("studio.minConceptsWarning")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {courseConcepts.length}/8 {t("studio.concepts")}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECTION 7: Initial KPIs */}
        <div className="space-y-4">
          <SectionHeader id="kpis" title={t("studio.initialKPIs")} />
          <AnimatePresence>
            {expandedSections.has("kpis") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                <p className="text-sm text-muted-foreground">{t("studio.kpisDesc")}</p>
                
                {/* Default KPIs */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">{t("studio.defaultKPIs")}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <FormField
                      control={form.control}
                      name="kpiRevenue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("studio.revenue")}</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} step={1000} {...field} data-testid="input-kpi-revenue-manual" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="kpiMorale"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("studio.morale")}</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} max={100} {...field} data-testid="input-kpi-morale-manual" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="kpiReputation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("studio.reputation")}</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} max={100} {...field} data-testid="input-kpi-reputation-manual" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="kpiEfficiency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("studio.efficiency")}</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} max={100} {...field} data-testid="input-kpi-efficiency-manual" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="kpiTrust"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("studio.trust")}</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} max={100} {...field} data-testid="input-kpi-trust-manual" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Custom KPIs */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">{t("studio.customKPIs")}</h4>
                      <p className="text-xs text-muted-foreground">{t("studio.customKPIsDesc")}</p>
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={addCustomKpi}
                      data-testid="button-add-custom-kpi"
                    >
                      <Plus className="w-4 h-4 mr-1" />{t("studio.addKPI")}</Button>
                  </div>
                  
                  {customKpis.map((kpi, index) => (
                    <div key={kpi.id} className="flex items-end gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <FormLabel className="text-xs">{t("studio.label")}</FormLabel>
                        <Input
                          placeholder="e.g., Customer Satisfaction"
                          value={kpi.label}
                          onChange={(e) => updateCustomKpi(kpi.id, "label", e.target.value)}
                          data-testid={`input-custom-kpi-label-${index}`}
                        />
                      </div>
                      <div className="w-24">
                        <FormLabel className="text-xs">{t("studio.value")}</FormLabel>
                        <Input
                          type="number"
                          min={0}
                          value={kpi.value}
                          onChange={(e) => updateCustomKpi(kpi.id, "value", parseInt(e.target.value) || 0)}
                          data-testid={`input-custom-kpi-value-${index}`}
                        />
                      </div>
                      <div className="w-32">
                        <FormLabel className="text-xs">{t("studio.unit")}</FormLabel>
                        <Select 
                          value={kpi.unit} 
                          onValueChange={(v) => updateCustomKpi(kpi.id, "unit", v as "percentage" | "absolute" | "currency")}
                        >
                          <SelectTrigger data-testid={`select-custom-kpi-unit-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">{t("studio.percentage")}</SelectItem>
                            <SelectItem value="absolute">{t("studio.number")}</SelectItem>
                            <SelectItem value="currency">{t("studio.currency")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCustomKpi(kpi.id)}
                        data-testid={`button-remove-custom-kpi-${index}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  
                  {customKpis.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                      {t("studio.noCustomKPIs")}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECTION 8: Rubric Criteria */}
        <div className="space-y-4">
          <SectionHeader id="rubric" title={t("studio.assessmentRubric")} />
          <AnimatePresence>
            {expandedSections.has("rubric") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                <p className="text-sm text-muted-foreground">{t("studio.rubricDesc")}</p>
                <FormField
                  control={form.control}
                  name="rubricCriteriaText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studio.rubricCriteria")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Strategic Thinking | 30 | Long-term planning and foresight&#10;Ethical Reasoning | 25 | Considering moral implications&#10;Stakeholder Management | 25 | Balancing diverse interests&#10;Decision Decisiveness | 20 | Making clear, timely choices"
                          className="min-h-28 font-mono text-sm"
                          {...field}
                          data-testid="input-rubric-manual"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Rubric Document Upload */}
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <FormLabel>{t("studio.rubricDocument")}</FormLabel>
                      <p className="text-xs text-muted-foreground">{t("studio.rubricDocumentDesc")}</p>
                    </div>
                  </div>
                  
                  {rubricFile ? (
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <FileText className="w-5 h-5 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{rubricFile.name}</p>
                        {rubricFile.size && (
                          <p className="text-xs text-muted-foreground">
                            {(rubricFile.size / 1024).toFixed(1)} KB
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRubricFile(undefined)}
                        data-testid="button-remove-rubric-file"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <RubricUploader 
                      onUploadComplete={(file) => setRubricFile(file)}
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECTION 9: Supporting Materials */}
        <div className="space-y-4">
          <SectionHeader id="materials" title={t("studio.supportingMaterials")} />
          <AnimatePresence>
            {expandedSections.has("materials") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                <div>
                  <FormLabel className="mb-2 block">{t("studio.caseStudyPDF")}</FormLabel>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("studio.caseStudyPDFDesc")}
                  </p>
                  <PDFUploader
                    onUploadComplete={setUploadedFile}
                    uploadedFile={uploadedFile}
                    onRemoveFile={() => setUploadedFile(undefined)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-manual">
            {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            {t("studio.createScenario")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function CreateScenarioDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | undefined>();
  const { toast } = useToast();
  const { t } = useTranslation();

  const form = useForm<ScenarioFormData>({
    resolver: zodResolver(scenarioFormSchema),
    defaultValues: {
      title: "",
      description: "",
      domain: "",
      difficultyLevel: "intermediate",
      role: "",
      objective: "",
      introText: "",
      companyName: "",
      industry: "",
      companySize: "",
      situationBackground: "",
      timelineContext: "",
      industryContext: "",
      competitiveEnvironment: "",
      regulatoryEnvironment: "",
      culturalContext: "",
      resourceConstraints: "",
      stakeholdersJson: "",
      keyConstraintsText: "",
      learningObjectivesText: "",
      ethicalDimensionsText: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ScenarioFormData) => {
      // Parse stakeholders from JSON if provided
      let stakeholders: Array<{name: string; role: string; interests: string; influence: "low" | "medium" | "high"}> = [];
      if (data.stakeholdersJson) {
        try {
          stakeholders = JSON.parse(data.stakeholdersJson);
        } catch (e) {
          // If invalid JSON, try to parse as simple text list
          stakeholders = data.stakeholdersJson.split("\n")
            .filter(line => line.trim())
            .map(line => {
              const parts = line.split("-").map(p => p.trim());
              return {
                name: parts[0] || "Stakeholder",
                role: parts[1] || "Role",
                interests: parts[2] || "Interests",
                influence: "medium" as const,
              };
            });
        }
      }
      
      // Parse text lists into arrays
      const parseTextList = (text?: string) => 
        text?.split("\n").filter(line => line.trim()).map(line => line.trim()) || [];
      
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
          caseStudyUrl: uploadedFile?.url,
          // Enhanced context fields
          companyName: data.companyName || undefined,
          industry: data.industry || undefined,
          companySize: data.companySize || undefined,
          situationBackground: data.situationBackground || undefined,
          timelineContext: data.timelineContext || undefined,
          industryContext: data.industryContext || undefined,
          competitiveEnvironment: data.competitiveEnvironment || undefined,
          regulatoryEnvironment: data.regulatoryEnvironment || undefined,
          culturalContext: data.culturalContext || undefined,
          resourceConstraints: data.resourceConstraints || undefined,
          difficultyLevel: data.difficultyLevel,
          stakeholders: stakeholders.length > 0 ? stakeholders : undefined,
          keyConstraints: parseTextList(data.keyConstraintsText).length > 0 ? parseTextList(data.keyConstraintsText) : undefined,
          learningObjectives: parseTextList(data.learningObjectivesText).length > 0 ? parseTextList(data.learningObjectivesText) : undefined,
          ethicalDimensions: parseTextList(data.ethicalDimensionsText).length > 0 ? parseTextList(data.ethicalDimensionsText) : undefined,
        },
        isPublished: true,
      });
    },
    onSuccess: () => {
      toast({ title: t("studio.success"), description: t("studio.scenarioCreated") });
      setOpen(false);
      form.reset();
      setUploadedFile(undefined);
      onSuccess();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: t("studio.sessionExpired"),
          description: t("studio.pleaseSignInAgain"),
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: t("studio.error"),
        description: t("studio.failedCreateScenario"),
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-scenario">
          <Plus className="w-4 h-4 mr-2" />
          {t("studio.createScenario")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("studio.createNewScenario")}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
            className="space-y-6"
          >
            {/* SECTION: Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">{t("studio.basicInformation")}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studio.scenarioTitle")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("studio.scenarioTitlePlaceholder")}
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
                      <FormLabel>{t("studio.domain")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-domain">
                            <SelectValue placeholder={t("studio.selectDomain")} />
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
              </div>

              <FormField
                control={form.control}
                name="difficultyLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("studio.difficultyLevel")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-difficulty">
                          <SelectValue placeholder="Select difficulty" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DIFFICULTY_LEVELS.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.label}
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
                    <FormLabel>{t("studio.description")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("studio.descriptionPlaceholder")}
                        className="min-h-20"
                        {...field}
                        data-testid="input-scenario-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* SECTION: Company Context */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">{t("studio.companyContext")}</h3>
              <p className="text-sm text-muted-foreground">{t("studio.companyContextDesc")}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studio.companyName")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("studio.companyNamePlaceholder")}
                          {...field}
                          data-testid="input-company-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studio.industry")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-industry">
                            <SelectValue placeholder={t("studio.selectIndustry")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INDUSTRIES.map((industry) => (
                            <SelectItem key={industry} value={industry}>
                              {industry}
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
                  name="companySize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studio.companySize")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-company-size">
                            <SelectValue placeholder={t("studio.selectSize")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COMPANY_SIZES.map((size) => (
                            <SelectItem key={size.value} value={size.value}>
                              {size.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="industryContext"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("studio.industryDynamics")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the industry landscape - market trends, challenges, opportunities, typical competitors..."
                        className="min-h-16"
                        {...field}
                        data-testid="input-industry-context"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="competitiveEnvironment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("studio.competitiveEnvironment")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Who are the main competitors? What's the competitive pressure like?"
                        className="min-h-16"
                        {...field}
                        data-testid="input-competitive-environment"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* SECTION: Player Role & Situation */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">{t("studio.playerRoleSituation")}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studio.playerRole")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("studio.playerRolePlaceholder")}
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
                  name="timelineContext"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studio.timelineContext")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("studio.timelineContextPlaceholder")}
                          {...field}
                          data-testid="input-timeline"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="objective"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("studio.primaryObjective")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What is the main goal the player must achieve? e.g., Restore brand reputation while maintaining profitability and employee morale"
                        className="min-h-16"
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
                name="situationBackground"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("studio.situationBackground")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What happened before the scenario begins? What events led to this crisis or challenge? Provide rich context for the AI..."
                        className="min-h-24"
                        {...field}
                        data-testid="input-situation-background"
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
                    <FormLabel>{t("studio.openingNarrative")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="The immersive story that sets the scene when the student starts. Write this as if narrating a story..."
                        className="min-h-32"
                        {...field}
                        data-testid="input-intro-text"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* SECTION: Stakeholders */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">{t("studio.keyStakeholders")}</h3>
              <p className="text-sm text-muted-foreground">{t("studio.stakeholdersDesc")}</p>
              
              <FormField
                control={form.control}
                name="stakeholdersJson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("studio.stakeholders")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Sarah Chen - CEO - Wants quick resolution to protect stock price&#10;Marcus Williams - Head of PR - Concerned about media narrative&#10;Elena Rodriguez - Legal Counsel - Focused on regulatory compliance&#10;James Park - Employee Rep - Advocates for staff concerns"
                        className="min-h-28 font-mono text-sm"
                        {...field}
                        data-testid="input-stakeholders"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* SECTION: Environment & Constraints */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">{t("studio.environmentConstraints")}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="regulatoryEnvironment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studio.regulatoryEnvironment")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What regulations, laws, or compliance requirements apply?"
                          className="min-h-16"
                          {...field}
                          data-testid="input-regulatory"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="culturalContext"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studio.culturalContext")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any cultural, geographical, or social factors to consider?"
                          className="min-h-16"
                          {...field}
                          data-testid="input-cultural"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="resourceConstraints"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("studio.resourceConstraints")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Budget limitations, staffing issues, time pressures, technical limitations..."
                        className="min-h-16"
                        {...field}
                        data-testid="input-resources"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="keyConstraintsText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("studio.keyConstraints")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="$500,000 maximum budget&#10;Must maintain at least 80% workforce&#10;Cannot change product pricing&#10;Must comply with GDPR regulations"
                        className="min-h-20 font-mono text-sm"
                        {...field}
                        data-testid="input-constraints"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* SECTION: Learning Objectives & Ethics */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">{t("studio.learningObjectivesEthics")}</h3>
              
              <FormField
                control={form.control}
                name="learningObjectivesText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("studio.learningObjectivesPerLine")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Understand crisis communication strategies&#10;Balance stakeholder interests under pressure&#10;Apply ethical decision-making frameworks&#10;Analyze trade-offs between short and long-term outcomes"
                        className="min-h-24 font-mono text-sm"
                        {...field}
                        data-testid="input-learning-objectives"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ethicalDimensionsText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("studio.ethicalDimensions")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Transparency vs. corporate protection&#10;Employee welfare vs. shareholder value&#10;Short-term profits vs. long-term sustainability&#10;Individual accountability vs. organizational culture"
                        className="min-h-20 font-mono text-sm"
                        {...field}
                        data-testid="input-ethical-dimensions"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* SECTION: Supporting Materials */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">{t("studio.supportingMaterials")}</h3>
              
              <div>
                <FormLabel className="mb-2 block">{t("studio.caseStudyPDF")}</FormLabel>
                <p className="text-sm text-muted-foreground mb-3">
                  {t("studio.caseStudyPDFDesc")}
                </p>
                <PDFUploader
                  onUploadComplete={setUploadedFile}
                  uploadedFile={uploadedFile}
                  onRemoveFile={() => setUploadedFile(undefined)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {t("studio.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit-scenario"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("studio.creating")}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {t("studio.createScenario")}
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
  const { t } = useTranslation();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/scenarios/${scenario.id}`);
    },
    onSuccess: () => {
      toast({ title: t("studio.deleted"), description: t("studio.scenarioRemoved") });
      onDelete();
    },
    onError: () => {
      toast({
        title: t("studio.error"),
        description: t("studio.failedDeleteScenario"),
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
                {t("studio.published")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {scenario.description}
          </p>
          {scenario.courseConcepts && scenario.courseConcepts.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {scenario.courseConcepts.slice(0, 4).map((concept, i) => (
                <Badge key={i} variant="outline" className="text-xs" data-testid={`badge-card-concept-${i}`}>
                  {concept}
                </Badge>
              ))}
              {scenario.courseConcepts.length > 4 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{scenario.courseConcepts.length - 4}
                </Badge>
              )}
            </div>
          )}
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

function EditScenarioView({ scenario, onBack, onManage }: { scenario: Scenario; onBack: () => void; onManage: () => void }) {
  const [editConcepts, setEditConcepts] = useState<string[]>(scenario.courseConcepts || []);
  const [editConceptInput, setEditConceptInput] = useState("");
  const { toast } = useToast();
  const { t } = useTranslation();

  const saveConceptsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PUT", `/api/scenarios/${scenario.id}`, {
        courseConcepts: editConcepts.length > 0 ? editConcepts : null,
      });
    },
    onSuccess: () => {
      toast({ title: t("studio.conceptsSaved"), description: t("studio.conceptsSavedDesc") });
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios/authored"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios", scenario.id] });
    },
    onError: () => {
      toast({ title: t("studio.error"), description: t("studio.failedSaveConcepts"), variant: "destructive" });
    },
  });

  const conceptsChanged = JSON.stringify(editConcepts) !== JSON.stringify(scenario.courseConcepts || []);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">{t("studio.editSimulation")}</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t("studio.titleLabel")}</label>
            <p className="text-lg font-semibold">{scenario.title}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t("studio.domainLabel")}</label>
            <p className="text-sm">{scenario.domain}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t("studio.descriptionLabel")}</label>
            <p className="text-sm">{scenario.description}</p>
          </div>
          {scenario.initialState?.caseContext && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t("studio.caseContext")}</label>
              <p className="text-sm whitespace-pre-wrap">{scenario.initialState.caseContext}</p>
            </div>
          )}
          {scenario.initialState?.decisionPoints && scenario.initialState.decisionPoints.length > 0 && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t("studio.decisionPoints")} ({scenario.initialState.decisionPoints.length})</label>
              <div className="space-y-2 mt-2">
                {scenario.initialState.decisionPoints.map((dp, idx) => (
                  <Card key={idx} className="p-3 bg-muted/50">
                    <p className="text-sm font-medium">{t("studio.decision")} {idx + 1}: {dp.prompt}</p>
                    <p className="text-xs text-muted-foreground">{t("studio.format")}: {dp.format === "multiple_choice" ? t("studio.multipleChoice") : t("studio.writtenResponse")}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">{t("studio.courseConcepts")}</label>
            <p className="text-xs text-muted-foreground mb-3">
              {t("studio.courseConceptsEditDesc")}
            </p>
            <div className="flex gap-2 mb-3">
              <Input
                value={editConceptInput}
                onChange={(e) => setEditConceptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = editConceptInput.trim();
                    if (val && !editConcepts.includes(val) && editConcepts.length < 8) {
                      setEditConcepts(prev => [...prev, val]);
                      setEditConceptInput("");
                    }
                  }
                }}
                placeholder="Escribe un concepto y presiona Enter..."
                disabled={editConcepts.length >= 8}
                data-testid="input-edit-course-concept"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!editConceptInput.trim() || editConcepts.includes(editConceptInput.trim()) || editConcepts.length >= 8}
                onClick={() => {
                  const val = editConceptInput.trim();
                  if (val && !editConcepts.includes(val) && editConcepts.length < 8) {
                    setEditConcepts(prev => [...prev, val]);
                    setEditConceptInput("");
                  }
                }}
                data-testid="button-add-edit-concept"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {editConcepts.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {editConcepts.map((concept, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="gap-1 pr-1"
                    data-testid={`badge-edit-concept-${i}`}
                  >
                    {concept}
                    <button
                      type="button"
                      onClick={() => setEditConcepts(prev => prev.filter((_, idx) => idx !== i))}
                      className="ml-1 rounded-full p-0.5"
                      data-testid={`button-remove-edit-concept-${i}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {editConcepts.length > 0 && editConcepts.length < 3 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t("studio.minConceptsEditWarning")}
              </p>
            )}
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">{editConcepts.length}/8 {t("studio.concepts")}</p>
              {conceptsChanged && (
                <Button
                  size="sm"
                  onClick={() => saveConceptsMutation.mutate()}
                  disabled={saveConceptsMutation.isPending}
                  data-testid="button-save-concepts"
                >
                  {saveConceptsMutation.isPending ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3 mr-1" />
                  )}
                  {t("studio.saveConcepts")}
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onBack}>
            {t("studio.backToList")}
          </Button>
          <Button onClick={onManage}>
            {t("studio.manageSimulation")}
          </Button>
        </div>
      </Card>
      <p className="text-sm text-muted-foreground text-center">
        {t("studio.fullEditComingSoon")}
      </p>
    </div>
  );
}

type AuthoringMode = "list" | "manual" | "canonical" | "edit";

export default function Studio() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const editScenarioId = new URLSearchParams(searchString).get("edit");
  const [authoringMode, setAuthoringMode] = useState<AuthoringMode>(editScenarioId ? "edit" : "list");
  const canonicalCreatorRef = useRef<CanonicalCaseCreatorRef>(null);
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const {
    data: scenarios,
    isLoading: scenariosLoading,
    error: scenariosError,
    refetch,
  } = useQuery<Scenario[]>({
    queryKey: ["/api/scenarios/authored"],
    enabled: isAuthenticated,
  });

  const {
    data: editingScenario,
    isLoading: editScenarioLoading,
  } = useQuery<Scenario>({
    queryKey: ["/api/scenarios", editScenarioId],
    enabled: !!editScenarioId && isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: t("studio.pleaseSignIn"),
        description: t("studio.needSignInStudio"),
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
        title: t("studio.accessDenied"),
        description: t("studio.onlyProfessors"),
        variant: "destructive",
      });
      navigate("/");
    }
  }, [authLoading, user, navigate, toast]);

  useEffect(() => {
    if (scenariosError && isUnauthorizedError(scenariosError as Error)) {
      toast({
        title: t("studio.sessionExpired"),
        description: t("studio.pleaseSignInAgain"),
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

  const handleAIPublished = () => {
    setAuthoringMode("list");
    refetch();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-[1000]">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                // Handle back navigation based on current mode
                if (authoringMode === "canonical") {
                  // Try to go back within the canonical creator first
                  const handled = canonicalCreatorRef.current?.handleBack();
                  if (!handled) {
                    // If not handled internally, go to path selection
                    setAuthoringMode("list");
                  }
                } else if (authoringMode !== "list") {
                  setAuthoringMode("list");
                } else {
                  navigate("/");
                }
              }}
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-semibold" data-testid="text-page-title">{t("studio.createSimulation")}</span>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {authoringMode === "canonical" ? (
            <motion.div
              key="canonical-creator"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-[calc(100vh-12rem)]"
            >
              <CanonicalCaseCreator
                ref={canonicalCreatorRef}
                onScenarioPublished={handleAIPublished}
                onClose={() => setAuthoringMode("list")}
              />
            </motion.div>
          ) : authoringMode === "manual" ? (
            <motion.div
              key="manual-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-[calc(100vh-12rem)]"
            >
              <ManualCaseCreator
                onSuccess={() => { setAuthoringMode("list"); refetch(); }}
                onClose={() => setAuthoringMode("list")}
              />
            </motion.div>
          ) : authoringMode === "edit" ? (
            <motion.div
              key="edit-scenario"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {editScenarioLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : editingScenario ? (
                <EditScenarioView
                  scenario={editingScenario}
                  onBack={() => { navigate("/studio"); setAuthoringMode("list"); }}
                  onManage={() => navigate(`/scenarios/${editScenarioId}/manage`)}
                />
              ) : (
                <Card className="p-6 text-center">
                  <p className="text-muted-foreground">{t("studio.simulationNotFound")}</p>
                  <Button className="mt-4" onClick={() => { navigate("/studio"); setAuthoringMode("list"); }}>
                    {t("studio.backToList")}
                  </Button>
                </Card>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="path-selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[60vh]"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                <Card
                  className="p-8 cursor-pointer hover-elevate flex flex-col items-center text-center"
                  onClick={() => setAuthoringMode("canonical")}
                  data-testid="card-create-with-ai"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{t("studio.createWithAI")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("studio.createWithAIDesc")}
                  </p>
                </Card>

                <Card
                  className="p-8 cursor-pointer hover-elevate flex flex-col items-center text-center"
                  onClick={() => setAuthoringMode("manual")}
                  data-testid="card-create-manually"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <PenTool className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{t("studio.createManually")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("studio.createManuallyDesc")}
                  </p>
                </Card>
              </div>
              
              {/* Reassurance line */}
              <p className="text-sm text-muted-foreground mt-6 text-center">
                {t("studio.nothingPublishedWithoutReview")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Assistant Icon - visible during creation modes */}
      {(authoringMode === "canonical" || authoringMode === "manual") && (
        <AssistantIcon />
      )}
    </div>
  );
}
