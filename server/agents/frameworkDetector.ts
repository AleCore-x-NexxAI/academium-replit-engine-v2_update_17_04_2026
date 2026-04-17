import type { CaseFramework, FrameworkDetection } from "@shared/schema";
import type { SignalExtractionResult } from "./types";

const MIN_QUALITY_MAP: Record<string, number> = { WEAK: 1, PRESENT: 2, STRONG: 3 };

export function detectFrameworks(
  studentInput: string,
  signals: SignalExtractionResult,
  frameworks: CaseFramework[],
  language: "es" | "en" = "es"
): FrameworkDetection[] {
  if (!frameworks || frameworks.length === 0) return [];

  const inputLower = studentInput.toLowerCase();

  return frameworks.map((fw) => {
    const keywordMatch = fw.domainKeywords.some((kw) =>
      new RegExp(`\\b${escapeRegex(kw)}\\b`, "i").test(studentInput)
    );
    const nameMatch = new RegExp(`\\b${escapeRegex(fw.name)}\\b`, "i").test(studentInput);

    if (nameMatch || keywordMatch) {
      const matchedTerm = nameMatch ? fw.name : fw.domainKeywords.find((kw) =>
        new RegExp(`\\b${escapeRegex(kw)}\\b`, "i").test(studentInput)
      ) || fw.name;
      return {
        framework_id: fw.id,
        framework_name: fw.name,
        level: "explicit" as const,
        evidence: language === "en"
          ? `The response directly references "${matchedTerm}", a key term from the ${fw.name} framework.`
          : `La respuesta referencia directamente "${matchedTerm}", un término clave del marco ${fw.name}.`,
      };
    }

    if (fw.signalPattern) {
      const minQ = MIN_QUALITY_MAP[fw.signalPattern.minQuality] ?? 2;
      const signalMap: Record<string, number> = {
        intent: signals.intent.quality,
        justification: signals.justification.quality,
        tradeoffAwareness: signals.tradeoffAwareness.quality,
        stakeholderAwareness: signals.stakeholderAwareness.quality,
        ethicalAwareness: signals.ethicalAwareness.quality,
      };
      const allSignalsMet = fw.signalPattern.requiredSignals.every((sig) => {
        return (signalMap[sig] ?? 0) >= minQ;
      });

      const additionalKws = fw.signalPattern.additionalKeywords || [];
      const hasAdditionalKeyword = additionalKws.some((kw) =>
        inputLower.includes(kw.toLowerCase())
      );

      if (allSignalsMet && (hasAdditionalKeyword || fw.domainKeywords.some((kw) => inputLower.includes(kw.toLowerCase())))) {
        const sigList = fw.signalPattern.requiredSignals.join(", ");
        return {
          framework_id: fw.id,
          framework_name: fw.name,
          level: "implicit" as const,
          evidence: language === "en"
            ? `Reasoning signals (${sigList}) align with ${fw.name} application patterns in the response.`
            : `Las señales de razonamiento (${sigList}) se alinean con patrones de aplicación del marco ${fw.name} en la respuesta.`,
        };
      }
    }

    return {
      framework_id: fw.id,
      framework_name: fw.name,
      level: "not_evidenced" as const,
      evidence: language === "en"
        ? `No direct or indirect evidence of ${fw.name} application detected in this response.`
        : `No se detectó evidencia directa o indirecta de aplicación del marco ${fw.name} en esta respuesta.`,
    };
  });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
