import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
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
  X,
  File,
  Sparkles,
  PenTool,
} from "lucide-react";
import CanonicalCaseCreator from "@/components/CanonicalCaseCreator";
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

  const handleUpload = async (file: globalThis.File) => {
    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
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
        title: "Upload complete",
        description: `${file.name} uploaded successfully`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
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
          <p className="text-sm text-muted-foreground">Uploading...</p>
        </div>
      ) : (
        <>
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">
            Drop your PDF here or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            Maximum file size: 10MB
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

  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const handleUpload = async (file: globalThis.File) => {
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, DOC, or DOCX file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
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
        title: "Upload complete",
        description: `${file.name} uploaded successfully`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
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
          <p className="text-sm text-muted-foreground">Uploading...</p>
        </div>
      ) : (
        <>
          <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">
            Drop rubric file here or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            PDF, DOC, or DOCX (max 10MB)
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["basic", "player"]));
  const { toast } = useToast();

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
        isPublished: true,
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Scenario created successfully" });
      form.reset();
      setUploadedFile(undefined);
      setRubricFile(undefined);
      setCustomKpis([]);
      onSuccess();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({ title: "Session Expired", description: "Please sign in again.", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to create scenario", variant: "destructive" });
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
        {isRequired && <Badge variant="secondary" className="text-xs">Required</Badge>}
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
          <SectionHeader id="basic" title="Basic Information" isRequired />
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
                        <FormLabel>Scenario Title *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., The Data Breach Crisis" {...field} data-testid="input-scenario-title-manual" />
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
                        <FormLabel>Domain *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-domain-manual">
                              <SelectValue placeholder="Select a domain" />
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
                      <FormLabel>Difficulty Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-difficulty-manual">
                            <SelectValue placeholder="Select difficulty" />
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description *</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Brief overview of what students will experience..." className="min-h-20" {...field} data-testid="input-description-manual" />
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
          <SectionHeader id="company" title="Company Context" />
          <AnimatePresence>
            {expandedSections.has("company") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                <p className="text-sm text-muted-foreground">The more detail you provide, the more tailored the AI simulation will be.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., TechFlow Inc." {...field} data-testid="input-company-name-manual" />
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
                        <FormLabel>Industry</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-industry-manual">
                              <SelectValue placeholder="Select industry" />
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
                        <FormLabel>Company Size</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-company-size-manual">
                              <SelectValue placeholder="Select size" />
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
                      <FormLabel>Situation Background</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What happened before the scenario begins? What events led to this crisis or challenge?"
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
                        <FormLabel>Industry Dynamics</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Market trends, challenges, opportunities..." className="min-h-16" {...field} data-testid="input-industry-context-manual" />
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
                        <FormLabel>Competitive Environment</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Main competitors, competitive pressure..." className="min-h-16" {...field} data-testid="input-competitive-manual" />
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
          <SectionHeader id="player" title="Player Role & Situation" isRequired />
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
                        <FormLabel>Player Role *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Chief Marketing Officer" {...field} data-testid="input-role-manual" />
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
                        <FormLabel>Timeline Context</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Immediate crisis - 72 hours to respond" {...field} data-testid="input-timeline-manual" />
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
                      <FormLabel>Primary Objective *</FormLabel>
                      <FormControl>
                        <Textarea placeholder="What is the main goal the player must achieve?" className="min-h-16" {...field} data-testid="input-objective-manual" />
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
                      <FormLabel>Opening Narrative *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="The immersive story that sets the scene when the student starts. Write this as if narrating a story..."
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
          <SectionHeader id="stakeholders" title="Key Stakeholders" />
          <AnimatePresence>
            {expandedSections.has("stakeholders") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                <p className="text-sm text-muted-foreground">Define the key people the player will interact with. Format: Name - Role - Interests (one per line)</p>
                <FormField
                  control={form.control}
                  name="stakeholdersJson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stakeholders</FormLabel>
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
          <SectionHeader id="environment" title="Environment & Constraints" />
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
                        <FormLabel>Regulatory Environment</FormLabel>
                        <FormControl>
                          <Textarea placeholder="What regulations, laws, or compliance requirements apply?" className="min-h-16" {...field} data-testid="input-regulatory-manual" />
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
                        <FormLabel>Cultural Context</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Cultural, geographical, or social factors..." className="min-h-16" {...field} data-testid="input-cultural-manual" />
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
                      <FormLabel>Resource Constraints</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Budget limitations, staffing issues, time pressures, technical limitations..." className="min-h-16" {...field} data-testid="input-resources-manual" />
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
                      <FormLabel>Key Constraints (one per line)</FormLabel>
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
          <SectionHeader id="learning" title="Learning Objectives" />
          <AnimatePresence>
            {expandedSections.has("learning") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                <p className="text-sm text-muted-foreground">Define what students should learn from this simulation (one objective per line).</p>
                <FormField
                  control={form.control}
                  name="learningObjectivesText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Learning Objectives</FormLabel>
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

        {/* SECTION 7: Initial KPIs */}
        <div className="space-y-4">
          <SectionHeader id="kpis" title="Initial KPIs" />
          <AnimatePresence>
            {expandedSections.has("kpis") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                <p className="text-sm text-muted-foreground">Set the starting values for key performance indicators. Revenue is absolute; others are percentages (0-100).</p>
                
                {/* Default KPIs */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Default KPIs</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <FormField
                      control={form.control}
                      name="kpiRevenue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Revenue ($)</FormLabel>
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
                          <FormLabel>Morale (%)</FormLabel>
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
                          <FormLabel>Reputation (%)</FormLabel>
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
                          <FormLabel>Efficiency (%)</FormLabel>
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
                          <FormLabel>Trust (%)</FormLabel>
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
                      <h4 className="text-sm font-medium">Custom KPIs (Optional)</h4>
                      <p className="text-xs text-muted-foreground">Add additional metrics specific to this scenario</p>
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={addCustomKpi}
                      data-testid="button-add-custom-kpi"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add KPI
                    </Button>
                  </div>
                  
                  {customKpis.map((kpi, index) => (
                    <div key={kpi.id} className="flex items-end gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <FormLabel className="text-xs">Label</FormLabel>
                        <Input
                          placeholder="e.g., Customer Satisfaction"
                          value={kpi.label}
                          onChange={(e) => updateCustomKpi(kpi.id, "label", e.target.value)}
                          data-testid={`input-custom-kpi-label-${index}`}
                        />
                      </div>
                      <div className="w-24">
                        <FormLabel className="text-xs">Value</FormLabel>
                        <Input
                          type="number"
                          min={0}
                          value={kpi.value}
                          onChange={(e) => updateCustomKpi(kpi.id, "value", parseInt(e.target.value) || 0)}
                          data-testid={`input-custom-kpi-value-${index}`}
                        />
                      </div>
                      <div className="w-32">
                        <FormLabel className="text-xs">Unit</FormLabel>
                        <Select 
                          value={kpi.unit} 
                          onValueChange={(v) => updateCustomKpi(kpi.id, "unit", v as "percentage" | "absolute" | "currency")}
                        >
                          <SelectTrigger data-testid={`select-custom-kpi-unit-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                            <SelectItem value="absolute">Number</SelectItem>
                            <SelectItem value="currency">Currency ($)</SelectItem>
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
                      No custom KPIs added. Click "Add KPI" to create scenario-specific metrics.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECTION 8: Rubric Criteria */}
        <div className="space-y-4">
          <SectionHeader id="rubric" title="Assessment Rubric" />
          <AnimatePresence>
            {expandedSections.has("rubric") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                <p className="text-sm text-muted-foreground">Define how student decisions will be evaluated. Format: Criterion Name | Weight (%) | Description (one per line)</p>
                <FormField
                  control={form.control}
                  name="rubricCriteriaText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rubric Criteria</FormLabel>
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
                      <FormLabel>Rubric Document (Optional)</FormLabel>
                      <p className="text-xs text-muted-foreground">Upload a PDF with detailed grading criteria</p>
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
          <SectionHeader id="materials" title="Supporting Materials" />
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
                  <FormLabel className="mb-2 block">Case Study PDF (Optional)</FormLabel>
                  <p className="text-sm text-muted-foreground mb-3">
                    Upload a PDF case study to provide additional context for the AI agents
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
            Create Scenario
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
      toast({ title: "Success", description: "Scenario created successfully" });
      setOpen(false);
      form.reset();
      setUploadedFile(undefined);
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Scenario</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
            className="space-y-6"
          >
            {/* SECTION: Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scenario Title *</FormLabel>
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
                      <FormLabel>Domain *</FormLabel>
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
              </div>

              <FormField
                control={form.control}
                name="difficultyLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Difficulty Level</FormLabel>
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
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief overview of what students will experience..."
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
              <h3 className="text-lg font-semibold border-b pb-2">Company Context</h3>
              <p className="text-sm text-muted-foreground">The more detail you provide, the more tailored the AI simulation will be.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., TechFlow Inc."
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
                      <FormLabel>Industry</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-industry">
                            <SelectValue placeholder="Select industry" />
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
                      <FormLabel>Company Size</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-company-size">
                            <SelectValue placeholder="Select size" />
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
                    <FormLabel>Industry Dynamics</FormLabel>
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
                    <FormLabel>Competitive Environment</FormLabel>
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
              <h3 className="text-lg font-semibold border-b pb-2">Player Role & Situation</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Player Role *</FormLabel>
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
                  name="timelineContext"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timeline Context</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Immediate crisis - 72 hours to respond"
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
                    <FormLabel>Primary Objective *</FormLabel>
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
                    <FormLabel>Situation Background</FormLabel>
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
                    <FormLabel>Opening Narrative *</FormLabel>
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
              <h3 className="text-lg font-semibold border-b pb-2">Key Stakeholders</h3>
              <p className="text-sm text-muted-foreground">Define the key people the player will interact with. Format: Name - Role - Interests (one per line)</p>
              
              <FormField
                control={form.control}
                name="stakeholdersJson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stakeholders</FormLabel>
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
              <h3 className="text-lg font-semibold border-b pb-2">Environment & Constraints</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="regulatoryEnvironment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Regulatory Environment</FormLabel>
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
                      <FormLabel>Cultural Context</FormLabel>
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
                    <FormLabel>Resource Constraints</FormLabel>
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
                    <FormLabel>Key Constraints (one per line)</FormLabel>
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
              <h3 className="text-lg font-semibold border-b pb-2">Learning Objectives & Ethics</h3>
              
              <FormField
                control={form.control}
                name="learningObjectivesText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Learning Objectives (one per line)</FormLabel>
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
                    <FormLabel>Ethical Dimensions (one per line)</FormLabel>
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
              <h3 className="text-lg font-semibold border-b pb-2">Supporting Materials</h3>
              
              <div>
                <FormLabel className="mb-2 block">Case Study PDF (Optional)</FormLabel>
                <p className="text-sm text-muted-foreground mb-3">
                  Upload a PDF case study to provide additional context for the AI agents
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

type AuthoringMode = "list" | "manual" | "canonical";

export default function Studio() {
  const [, navigate] = useLocation();
  const [authoringMode, setAuthoringMode] = useState<AuthoringMode>("list");
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

  const handleAIPublished = () => {
    setAuthoringMode("list");
    refetch();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (authoringMode !== "list") {
                  setAuthoringMode("list");
                } else {
                  navigate("/");
                }
              }}
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold">Estudio de Autoría</span>
            </div>
          </div>

          {authoringMode === "list" && (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setAuthoringMode("canonical")}
                data-testid="button-canonical-case"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Crear Caso
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
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
                onScenarioPublished={handleAIPublished}
                onClose={() => setAuthoringMode("list")}
              />
            </motion.div>
          ) : (
            <motion.div
              key="scenario-list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2">Tus Escenarios</h1>
                <p className="text-muted-foreground">
                  Crea y gestiona escenarios de simulación de negocios para tus estudiantes.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <Card
                  className="p-6 cursor-pointer hover-elevate"
                  onClick={() => setAuthoringMode("canonical")}
                  data-testid="card-ai-authoring-mode"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Sparkles className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Crear con Asistencia IA</h3>
                      <p className="text-sm text-muted-foreground">
                        Genera un caso completo conversando con IA. Tú siempre tienes el control final.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card
                  className="p-6 cursor-pointer hover-elevate"
                  data-testid="card-manual-authoring-mode"
                >
                  <Dialog>
                    <DialogTrigger asChild>
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <PenTool className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-1">Crear Manualmente</h3>
                          <p className="text-sm text-muted-foreground">
                            Construye un escenario desde cero con control total del contenido.
                          </p>
                        </div>
                      </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Crear Nuevo Escenario</DialogTitle>
                      </DialogHeader>
                      <ManualScenarioForm onSuccess={() => { refetch(); }} />
                    </DialogContent>
                  </Dialog>
                </Card>
              </div>

              {scenariosLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                  ))}
                </div>
              ) : scenarios && scenarios.length > 0 ? (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Escenarios Publicados</h2>
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
                  <h3 className="text-lg font-medium mb-2">Sin Escenarios Todavía</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Usa la creación con IA o manual para construir tu primer escenario.
                  </p>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
