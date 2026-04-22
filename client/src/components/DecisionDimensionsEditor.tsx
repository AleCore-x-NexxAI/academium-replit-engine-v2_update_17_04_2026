import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Trash2, HelpCircle } from "lucide-react";
import type { AcademicDimension } from "@shared/schema";

export interface DecisionDimensionEntry {
  decisionNumber: number;
  primaryDimension: AcademicDimension;
  secondaryDimension?: AcademicDimension;
}

interface Props {
  value: DecisionDimensionEntry[];
  onChange: (next: DecisionDimensionEntry[]) => void;
  language: "es" | "en";
  stepCount?: number;
  disabled?: boolean;
  testIdPrefix: string;
}

const DIMENSIONS: AcademicDimension[] = [
  "analytical",
  "strategic",
  "stakeholder",
  "ethical",
  "tradeoff",
];

const SENTINEL_NONE = "__none__";

const DIMENSION_TOOLTIP_KEYS: Record<AcademicDimension, { en: string; es: string }> = {
  analytical: {
    en: "Data gathering, quantitative reasoning, and evidence-based diagnosis of the situation.",
    es: "Recopilación de datos, razonamiento cuantitativo y diagnóstico basado en evidencia de la situación.",
  },
  strategic: {
    en: "Long-term positioning, competitive advantage, and resource allocation choices.",
    es: "Posicionamiento a largo plazo, ventaja competitiva y decisiones de asignación de recursos.",
  },
  stakeholder: {
    en: "Identifying affected parties, understanding their interests, and managing competing expectations.",
    es: "Identificar partes afectadas, comprender sus intereses y gestionar expectativas en competencia.",
  },
  ethical: {
    en: "Moral implications, fairness, transparency, and responsible decision-making considerations.",
    es: "Implicaciones morales, equidad, transparencia y consideraciones de toma de decisiones responsable.",
  },
  tradeoff: {
    en: "Evaluating competing alternatives, opportunity costs, and the tensions between conflicting goals.",
    es: "Evaluar alternativas en competencia, costos de oportunidad y las tensiones entre objetivos en conflicto.",
  },
};

function dimensionLabel(d: AcademicDimension, language: "es" | "en"): string {
  const labels: Record<AcademicDimension, { en: string; es: string }> = {
    analytical: { en: "Analytical (C1)", es: "Analítica (C1)" },
    strategic: { en: "Strategic (C2)", es: "Estratégica (C2)" },
    stakeholder: { en: "Stakeholder (C3)", es: "Stakeholder (C3)" },
    ethical: { en: "Ethical (C4)", es: "Ética (C4)" },
    tradeoff: { en: "Trade-off (C5)", es: "Trade-off (C5)" },
  };
  return labels[d][language];
}

export function DecisionDimensionsEditor({
  value,
  onChange,
  language,
  stepCount,
  disabled,
  testIdPrefix,
}: Props) {
  const usedDecisionNumbers = new Set(value.map((e) => e.decisionNumber));
  const maxDecision = stepCount ?? 10;
  const nextAvailable = (() => {
    for (let i = 1; i <= maxDecision; i++) {
      if (!usedDecisionNumbers.has(i)) return i;
    }
    return maxDecision;
  })();

  const addEntry = () => {
    onChange([
      ...value,
      { decisionNumber: nextAvailable, primaryDimension: "analytical" },
    ]);
  };

  const updateEntry = (idx: number, patch: Partial<DecisionDimensionEntry>) => {
    onChange(value.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const removeEntry = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">
          {language === "en" ? "Decision dimensions (optional)" : "Dimensiones por decisión (opcional)"}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addEntry}
          disabled={disabled || value.length >= maxDecision}
          data-testid={`button-${testIdPrefix}-add-dimension`}
        >
          <Plus className="w-3 h-3 mr-1" />
          {language === "en" ? "Add" : "Agregar"}
        </Button>
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {language === "en"
            ? "Map specific decisions to academic dimensions to steer reasoning calibration."
            : "Asocia decisiones específicas a dimensiones académicas para guiar la calibración del razonamiento."}
        </p>
      ) : (
        <div className="space-y-3">
          {value.map((entry, idx) => (
            <fieldset
              key={idx}
              className="space-y-2 border rounded-md p-3"
              data-testid={`row-${testIdPrefix}-dimension-${idx}`}
            >
              <p className="text-xs text-muted-foreground">
                {language === "en"
                  ? "Primary is the main reasoning this decision exercises. Secondary is a related dimension it also touches."
                  : "Primaria es el razonamiento principal que ejercita esta decisión. Secundaria es una dimensión relacionada que también toca."}
              </p>
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-2">
                  <Select
                    value={String(entry.decisionNumber)}
                    onValueChange={(v) => updateEntry(idx, { decisionNumber: Number(v) })}
                    disabled={disabled}
                  >
                    <SelectTrigger data-testid={`select-${testIdPrefix}-decision-${idx}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: maxDecision }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {language === "en" ? `Decision ${n}` : `Decisión ${n}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-5 space-y-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs font-medium">
                      {language === "en" ? "Primary dimension *" : "Dimensión primaria *"}
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" data-testid={`tooltip-dim-primary-${idx}`} />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        <p className="font-semibold">{dimensionLabel(entry.primaryDimension, language)}</p>
                        <p>{DIMENSION_TOOLTIP_KEYS[entry.primaryDimension][language]}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select
                    value={entry.primaryDimension}
                    onValueChange={(v) => updateEntry(idx, { primaryDimension: v as AcademicDimension })}
                    disabled={disabled}
                  >
                    <SelectTrigger data-testid={`select-${testIdPrefix}-primary-${idx}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIMENSIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {dimensionLabel(d, language)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 space-y-1">
                  <Label className="text-xs font-medium">
                    {language === "en" ? "Secondary dimension (optional)" : "Dimensión secundaria (opcional)"}
                  </Label>
                  <Select
                    value={entry.secondaryDimension ?? SENTINEL_NONE}
                    onValueChange={(v) =>
                      updateEntry(idx, {
                        secondaryDimension: v === SENTINEL_NONE ? undefined : (v as AcademicDimension),
                      })
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger data-testid={`select-${testIdPrefix}-secondary-${idx}`}>
                      <SelectValue
                        placeholder={language === "en" ? "Secondary (optional)" : "Secundaria (opcional)"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SENTINEL_NONE}>
                        {language === "en" ? "None" : "Ninguna"}
                      </SelectItem>
                      {DIMENSIONS.filter((d) => d !== entry.primaryDimension).map((d) => (
                        <SelectItem key={d} value={d}>
                          {dimensionLabel(d, language)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEntry(idx)}
                    disabled={disabled}
                    data-testid={`button-${testIdPrefix}-remove-dimension-${idx}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}
