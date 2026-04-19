import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import type { CaseFramework, FrameworkPrimaryDimension } from "@shared/schema";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ResolverResponse {
  canonicalId: string | null;
  ambiguous?: boolean;
  candidates?: Array<{ canonicalId: string; name: string }>;
  name?: string;
  coreConcepts?: string[];
  conceptualDescription?: string;
  recognitionSignals?: string[];
  primaryDimension?: FrameworkPrimaryDimension;
  suggestedDomainKeywords?: string[];
  suggestedSignalPattern?: NonNullable<CaseFramework["signalPattern"]>;
  aliases?: string[];
}

// Browser-friendly stable hash for unresolved framework names. Mirrors the
// server-side customCanonicalId() result format ("custom_" + 10-hex). Uses a
// FNV-1a 32-bit hash hex-padded — collisions are acceptable here because the
// same name will always produce the same id within a single scenario.
function clientCustomCanonicalId(name: string): string {
  const norm = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return `custom_${h.toString(16).padStart(8, "0")}00`;
}

interface FrameworkEditorProps {
  value: CaseFramework[];
  onChange: (next: CaseFramework[]) => void;
  caseContext?: string;
  language: "es" | "en";
  disabled?: boolean;
  maxFrameworks?: number;
}

const SIGNALS = [
  "intent",
  "justification",
  "tradeoffAwareness",
  "stakeholderAwareness",
  "ethicalAwareness",
] as const;

export function FrameworkEditor({
  value,
  onChange,
  caseContext,
  language,
  disabled = false,
  maxFrameworks = 8,
}: FrameworkEditorProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [nameInput, setNameInput] = useState("");
  const [fetchingFor, setFetchingFor] = useState<Set<string>>(new Set());
  const [signalOpen, setSignalOpen] = useState<Record<number, boolean>>({});
  const [disambig, setDisambig] = useState<{ candidates: Array<{ canonicalId: string; name: string }> } | null>(null);
  const [resolving, setResolving] = useState(false);

  const update = (next: CaseFramework[]) => onChange(next);

  const fetchKeywords = async (fwId: string, fwName: string) => {
    setFetchingFor((prev) => new Set(prev).add(fwId));
    try {
      const res = await apiRequest("POST", "/api/scenarios/suggest-framework-keywords", {
        frameworkName: fwName,
        caseContext: caseContext || undefined,
        language,
      });
      const data = await res.json();
      const kw: string[] = Array.isArray(data?.keywords) ? data.keywords : [];
      const sp = data?.signalPattern;
      onChange(
        value.map((f) => {
          if (f.id !== fwId) return f;
          const merged = Array.from(
            new Set([...f.domainKeywords, ...kw.map((k) => k.toLowerCase())])
          );
          return { ...f, domainKeywords: merged, signalPattern: f.signalPattern || sp };
        })
      );
    } catch {
      // silent
    } finally {
      setFetchingFor((prev) => {
        const next = new Set(prev);
        next.delete(fwId);
        return next;
      });
    }
  };

  const buildFramework = (
    nameToAdd: string,
    canonicalId: string,
    resolved: ResolverResponse | null,
  ): CaseFramework => ({
    id: `fw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: resolved?.name || nameToAdd,
    domainKeywords: Array.isArray(resolved?.suggestedDomainKeywords)
      ? resolved.suggestedDomainKeywords.map((k) => k.toLowerCase())
      : [],
    canonicalId,
    aliases: resolved?.aliases,
    coreConcepts: resolved?.coreConcepts,
    conceptualDescription: resolved?.conceptualDescription,
    recognitionSignals: resolved?.recognitionSignals,
    primaryDimension: resolved?.primaryDimension,
    provenance: "explicit",
    accepted_by_professor: true,
    signalPattern: resolved?.suggestedSignalPattern,
  });

  const addByCanonical = async (
    nameToAdd: string,
    canonicalId: string,
    prefetched: ResolverResponse | null,
  ): Promise<CaseFramework | null> => {
    // Dedup by canonicalId — canonicalId is now always present (registry id
    // for resolved names, custom_<hash> for unresolved).
    if (value.some((f) => f.canonicalId === canonicalId)) {
      toast({
        title: t("manualCase.frameworkAlreadyAdded"),
        description: t("manualCase.frameworkAlreadyAddedDesc"),
      });
      return null;
    }

    let resolved: ResolverResponse | null = prefetched;
    if (!resolved && canonicalId.startsWith("custom_") === false) {
      try {
        const res = await apiRequest("POST", "/api/scenarios/resolve-framework-name", {
          name: nameToAdd,
          language,
        });
        resolved = (await res.json()) as ResolverResponse;
      } catch {
        // ignore — fall through with name only
      }
    }

    const fw = buildFramework(nameToAdd, canonicalId, resolved);
    update([...value, fw]);
    return fw;
  };

  const addFramework = async () => {
    const name = nameInput.trim();
    if (!name || value.length >= maxFrameworks) return;
    setResolving(true);
    try {
      const res = await apiRequest("POST", "/api/scenarios/resolve-framework-name", {
        name,
        language,
      });
      const data = (await res.json()) as ResolverResponse;
      if (data?.ambiguous && Array.isArray(data.candidates) && data.candidates.length > 0) {
        setDisambig({ candidates: data.candidates });
        return;
      }
      if (data?.canonicalId) {
        const finalName = data.name || name;
        await addByCanonical(finalName, data.canonicalId, data);
        setNameInput("");
      } else {
        // Unresolved — assign stable custom_<hash> canonicalId and AI-fill keywords.
        const customId = clientCustomCanonicalId(name);
        const added = await addByCanonical(name, customId, null);
        setNameInput("");
        if (added) void fetchKeywords(added.id, name);
      }
    } catch {
      // Network failure — still assign a custom canonical id so dedup works.
      const customId = clientCustomCanonicalId(name);
      if (!value.some((f) => f.canonicalId === customId)) {
        const fw = buildFramework(name, customId, null);
        update([...value, fw]);
        setNameInput("");
        void fetchKeywords(fw.id, name);
      }
    } finally {
      setResolving(false);
    }
  };

  const pickDisambig = async (canonicalId: string, displayName: string) => {
    setDisambig(null);
    await addByCanonical(displayName, canonicalId, null);
    setNameInput("");
  };

  const removeFramework = (i: number) => update(value.filter((_, idx) => idx !== i));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };

  const addKeyword = (i: number, kw: string) => {
    const v = kw.trim().toLowerCase();
    if (!v) return;
    const next = [...value];
    if (next[i].domainKeywords.includes(v)) return;
    next[i] = { ...next[i], domainKeywords: [...next[i].domainKeywords, v] };
    update(next);
  };

  const removeKeyword = (i: number, kwIdx: number) => {
    const next = [...value];
    next[i] = {
      ...next[i],
      domainKeywords: next[i].domainKeywords.filter((_, k) => k !== kwIdx),
    };
    update(next);
  };

  const updateSP = (
    i: number,
    patch: Partial<NonNullable<CaseFramework["signalPattern"]>>
  ) => {
    const next = [...value];
    const fw = next[i];
    next[i] = {
      ...fw,
      signalPattern: {
        requiredSignals: fw.signalPattern?.requiredSignals ?? [],
        minQuality: fw.signalPattern?.minQuality ?? "PRESENT",
        additionalKeywords: fw.signalPattern?.additionalKeywords,
        ...patch,
      },
    };
    update(next);
  };

  const toggleSignal = (
    i: number,
    signal: NonNullable<CaseFramework["signalPattern"]>["requiredSignals"][number]
  ) => {
    const fw = value[i];
    const cur = fw.signalPattern?.requiredSignals ?? [];
    const newSig = cur.includes(signal) ? cur.filter((s) => s !== signal) : [...cur, signal];
    updateSP(i, { requiredSignals: newSig });
  };

  const addAddKw = (i: number, kw: string) => {
    const v = kw.trim().toLowerCase();
    if (!v) return;
    const fw = value[i];
    const ex = fw.signalPattern?.additionalKeywords ?? [];
    if (ex.includes(v)) return;
    updateSP(i, { additionalKeywords: [...ex, v] });
  };

  const removeAddKw = (i: number, kwIdx: number) => {
    const fw = value[i];
    const ex = fw.signalPattern?.additionalKeywords ?? [];
    updateSP(i, { additionalKeywords: ex.filter((_, k) => k !== kwIdx) });
  };

  const signalLabelKey: Record<string, string> = {
    intent: "manualCase.signalIntent",
    justification: "manualCase.signalJustification",
    tradeoffAwareness: "manualCase.signalTradeoff",
    stakeholderAwareness: "manualCase.signalStakeholder",
    ethicalAwareness: "manualCase.signalEthical",
  };

  return (
    <div className="space-y-3" data-testid="framework-editor">
      <p className="text-xs text-muted-foreground">{t("manualCase.frameworksDesc")}</p>

      <div className="flex gap-2">
        <Input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder={t("manualCase.frameworkNamePlaceholder")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addFramework();
            }
          }}
          disabled={disabled || value.length >= maxFrameworks}
          data-testid="input-fwedit-name"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={
            disabled ||
            resolving ||
            !nameInput.trim() ||
            value.length >= maxFrameworks ||
            value.some((f) => f.name.toLowerCase() === nameInput.trim().toLowerCase())
          }
          onClick={() => void addFramework()}
          data-testid="button-fwedit-add"
        >
          {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>

      <Dialog open={!!disambig} onOpenChange={(open) => !open && setDisambig(null)}>
        <DialogContent data-testid="dialog-fwedit-disambig">
          <DialogHeader>
            <DialogTitle>{t("manualCase.frameworkDisambig")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {disambig?.candidates.map((c) => (
              <Button
                key={c.canonicalId}
                variant="outline"
                onClick={() => void pickDisambig(c.canonicalId, c.name)}
                data-testid={`button-fwedit-disambig-${c.canonicalId}`}
              >
                {c.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((fw, idx) => (
            <div
              key={fw.id}
              className="border rounded-md p-3 space-y-2"
              data-testid={`fwedit-card-${idx}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{fw.name}</span>
                <div className="flex items-center gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => move(idx, -1)}
                    disabled={disabled || idx === 0}
                    data-testid={`button-fwedit-up-${idx}`}
                  >
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => move(idx, 1)}
                    disabled={disabled || idx === value.length - 1}
                    data-testid={`button-fwedit-down-${idx}`}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeFramework(idx)}
                    disabled={disabled}
                    data-testid={`button-fwedit-remove-${idx}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">{t("manualCase.keywords")}</Label>
                  {fetchingFor.has(fw.id) && (
                    <span
                      className="flex items-center gap-1 text-xs text-muted-foreground"
                      data-testid={`fwedit-keywords-loading-${idx}`}
                    >
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t("manualCase.aiFetchingKeywords")}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-1 items-center">
                  {fw.domainKeywords.map((kw, kwIdx) => (
                    <Badge
                      key={kwIdx}
                      variant="secondary"
                      data-testid={`badge-fwedit-keyword-${idx}-${kwIdx}`}
                    >
                      {kw}
                      <button
                        type="button"
                        className="ml-1"
                        onClick={() => removeKeyword(idx, kwIdx)}
                        disabled={disabled}
                        data-testid={`button-fwedit-remove-keyword-${idx}-${kwIdx}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  <Input
                    className="w-32 h-7 text-xs"
                    placeholder={t("manualCase.addKeyword")}
                    disabled={disabled}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const target = e.target as HTMLInputElement;
                        addKeyword(idx, target.value);
                        target.value = "";
                      }
                    }}
                    data-testid={`input-fwedit-keyword-${idx}`}
                  />
                </div>
              </div>

              <Collapsible
                open={signalOpen[idx] ?? false}
                onOpenChange={(open) =>
                  setSignalOpen((prev) => ({ ...prev, [idx]: open }))
                }
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between h-7 text-xs px-2"
                    data-testid={`button-fwedit-signal-toggle-${idx}`}
                  >
                    <span className="text-muted-foreground">
                      {t("manualCase.signalPattern")}
                    </span>
                    {signalOpen[idx] ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-1 border-t mt-1">
                  <div className="flex flex-wrap gap-1 pt-1">
                    {SIGNALS.map((signal) => {
                      const active =
                        fw.signalPattern?.requiredSignals?.includes(signal) ?? false;
                      return (
                        <Badge
                          key={signal}
                          variant={active ? "default" : "outline"}
                          className="cursor-pointer toggle-elevate"
                          onClick={() => !disabled && toggleSignal(idx, signal)}
                          data-testid={`badge-fwedit-signal-${idx}-${signal}`}
                        >
                          {t(signalLabelKey[signal])}
                        </Badge>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">
                      {t("manualCase.minQuality")}
                    </Label>
                    <Select
                      value={fw.signalPattern?.minQuality ?? "PRESENT"}
                      onValueChange={(val) =>
                        updateSP(idx, { minQuality: val as "WEAK" | "PRESENT" | "STRONG" })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger
                        className="h-7 text-xs w-28"
                        data-testid={`select-fwedit-min-quality-${idx}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WEAK">{t("manualCase.qualityWeak")}</SelectItem>
                        <SelectItem value="PRESENT">{t("manualCase.qualityPresent")}</SelectItem>
                        <SelectItem value="STRONG">{t("manualCase.qualityStrong")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{t("manualCase.additionalKeywords")}</Label>
                    <div className="flex flex-wrap gap-1 mt-1 items-center">
                      {(fw.signalPattern?.additionalKeywords ?? []).map((kw, kwIdx) => (
                        <Badge
                          key={kwIdx}
                          variant="secondary"
                          data-testid={`badge-fwedit-add-keyword-${idx}-${kwIdx}`}
                        >
                          {kw}
                          <button
                            type="button"
                            className="ml-1"
                            onClick={() => removeAddKw(idx, kwIdx)}
                            disabled={disabled}
                            data-testid={`button-fwedit-remove-add-keyword-${idx}-${kwIdx}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                      <Input
                        className="w-32 h-7 text-xs"
                        placeholder={t("manualCase.addKeyword")}
                        disabled={disabled}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const target = e.target as HTMLInputElement;
                            addAddKw(idx, target.value);
                            target.value = "";
                          }
                        }}
                        data-testid={`input-fwedit-add-keyword-${idx}`}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {value.length}/{maxFrameworks}
      </p>
    </div>
  );
}
