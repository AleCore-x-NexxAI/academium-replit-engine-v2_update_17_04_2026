import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  Sparkles,
  FileText,
  Check,
  ArrowRight,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ScenarioDraft, DraftConversationMessage, GeneratedScenarioData } from "@shared/schema";
import { useTranslation } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";

interface AIAuthoringChatProps {
  onScenarioPublished: () => void;
  onClose: () => void;
}

function MessageBubble({ message }: { message: DraftConversationMessage }) {
  const isAssistant = message.role === "assistant";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isAssistant
            ? "bg-muted text-foreground"
            : "bg-primary text-primary-foreground"
        }`}
      >
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content.split("\n").map((line, i) => {
            if (line.startsWith("**") && line.endsWith("**")) {
              return (
                <p key={i} className="font-semibold mt-2 first:mt-0">
                  {line.replace(/\*\*/g, "")}
                </p>
              );
            }
            if (line.startsWith("- ")) {
              return (
                <p key={i} className="ml-2">
                  {line}
                </p>
              );
            }
            return <p key={i}>{line || "\u00A0"}</p>;
          })}
        </div>
        <p className="text-xs opacity-60 mt-2">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </motion.div>
  );
}

function ScenarioPreviewCard({
  scenario,
  onPublish,
  isPublishing,
}: {
  scenario: GeneratedScenarioData;
  onPublish: () => void;
  isPublishing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  return (
    <Card className="p-4 border-primary/20 bg-primary/5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-primary" />
            <h4 className="font-semibold">{scenario.title}</h4>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {scenario.description}
          </p>
        </div>
        <Badge variant="secondary">{scenario.domain}</Badge>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <Badge variant="outline">
          {scenario.initialState.difficultyLevel || "intermediate"}
        </Badge>
        <Badge variant="outline">
          {scenario.initialState.stakeholders?.length || 0} {t("aiAuthoring.stakeholders")}
        </Badge>
        <Badge variant="outline">
          {scenario.rubric.criteria.length} {t("aiAuthoring.criteria")}
        </Badge>
        <Badge variant="outline" className="text-chart-2 border-chart-2">
          {scenario.confidence}% {t("aiAuthoring.confidence")}
        </Badge>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t pt-3 mt-3 space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  {t("aiAuthoring.openingNarrative")}
                </p>
                <p className="text-sm leading-relaxed">
                  {scenario.initialState.introText.substring(0, 400)}...
                </p>
              </div>

              {scenario.initialState.stakeholders &&
                scenario.initialState.stakeholders.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("aiAuthoring.keyStakeholders")}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {scenario.initialState.stakeholders.map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {s.name} ({s.role})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

              {scenario.initialState.learningObjectives &&
                scenario.initialState.learningObjectives.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("aiAuthoring.learningObjectives")}
                    </p>
                    <ul className="text-sm list-disc list-inside">
                      {scenario.initialState.learningObjectives.map((obj, i) => (
                        <li key={i}>{obj}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          data-testid="button-toggle-preview"
        >
          {expanded ? t("aiAuthoring.showLess") : t("aiAuthoring.showMore")}
        </Button>
        <Button
          size="sm"
          onClick={onPublish}
          disabled={isPublishing}
          className="ml-auto"
          data-testid="button-publish-scenario"
        >
          {isPublishing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          {t("aiAuthoring.publishScenario")}
        </Button>
      </div>
    </Card>
  );
}

export default function AIAuthoringChat({
  onScenarioPublished,
  onClose,
}: AIAuthoringChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<DraftConversationMessage[]>([]);
  const [generatedScenario, setGeneratedScenario] = useState<GeneratedScenarioData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [localMessages]);

  const { data: draft, isLoading: draftLoading } = useQuery<ScenarioDraft>({
    queryKey: ["/api/drafts", currentDraftId],
    enabled: !!currentDraftId,
  });

  useEffect(() => {
    if (draft) {
      setLocalMessages(draft.conversationHistory as DraftConversationMessage[] || []);
      if (draft.generatedScenario) {
        setGeneratedScenario(draft.generatedScenario as GeneratedScenarioData);
      }
    }
  }, [draft]);

  const createDraftMutation = useMutation({
    mutationFn: async (sourceInput?: string) => {
      const response = await apiRequest("POST", "/api/drafts", {
        sourceInput: sourceInput || undefined,
      });
      return response.json() as Promise<ScenarioDraft>;
    },
    onSuccess: (newDraft) => {
      setCurrentDraftId(newDraft.id);
      setLocalMessages(newDraft.conversationHistory as DraftConversationMessage[] || []);
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("aiAuthoring.errorStartAssistant"),
        variant: "destructive",
      });
    },
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!currentDraftId) throw new Error("No draft");
      const response = await apiRequest("POST", `/api/drafts/${currentDraftId}/chat`, {
        message,
      });
      return response.json() as Promise<{
        draft: ScenarioDraft;
        assistantMessage: string;
        generatedScenario?: GeneratedScenarioData;
      }>;
    },
    onSuccess: (result) => {
      setLocalMessages(result.draft.conversationHistory as DraftConversationMessage[] || []);
      if (result.generatedScenario) {
        setGeneratedScenario(result.generatedScenario);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", currentDraftId] });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("aiAuthoring.errorSendMessage"),
        variant: "destructive",
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!currentDraftId) throw new Error("No draft");
      const response = await apiRequest("POST", `/api/drafts/${currentDraftId}/publish`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("aiAuthoring.publishedTitle"),
        description: t("aiAuthoring.publishedDesc"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios/authored"] });
      onScenarioPublished();
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("aiAuthoring.errorPublish"),
        variant: "destructive",
      });
    },
  });

  const handleStartNew = () => {
    createDraftMutation.mutate(undefined);
  };

  const handleSendMessage = () => {
    if (!inputValue.trim() || chatMutation.isPending) return;

    const userMessage: DraftConversationMessage = {
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    chatMutation.mutate(inputValue.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const hasStarted = !!currentDraftId || createDraftMutation.isPending;

  if (!hasStarted) {
    return (
      <Card className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{t("aiAuthoring.title")}</h3>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="button-close-ai-chat"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {t("aiAuthoring.createWithAI")}
            </h3>
            <p className="text-muted-foreground mb-6">
              {t("aiAuthoring.createWithAIDesc")}
            </p>
            <Button
              onClick={handleStartNew}
              disabled={createDraftMutation.isPending}
              data-testid="button-start-ai-authoring"
            >
              {createDraftMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              {t("aiAuthoring.startCreating")}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">{t("aiAuthoring.title")}</h3>
          {draft?.status && (
            <Badge variant="outline" className="text-xs">
              {draft.status}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setCurrentDraftId(null);
              setLocalMessages([]);
              setGeneratedScenario(null);
            }}
            title={t("aiAuthoring.startNew")}
            data-testid="button-reset-chat"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-ai-chat"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {draftLoading || createDraftMutation.isPending ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-3/4" />
              <Skeleton className="h-16 w-1/2 ml-auto" />
            </div>
          ) : (
            <>
              {localMessages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}

              {chatMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        {t("aiAuthoring.thinking")}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {generatedScenario && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <ScenarioPreviewCard
                    scenario={generatedScenario}
                    onPublish={() => publishMutation.mutate()}
                    isPublishing={publishMutation.isPending}
                  />
                </motion.div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("aiAuthoring.placeholder")}
            className="resize-none min-h-[60px] max-h-[120px]"
            disabled={chatMutation.isPending || !currentDraftId}
            data-testid="input-ai-chat-message"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || chatMutation.isPending || !currentDraftId}
            data-testid="button-send-message"
          >
            {chatMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {t("aiAuthoring.enterToSend")}
        </p>
      </div>
    </Card>
  );
}
