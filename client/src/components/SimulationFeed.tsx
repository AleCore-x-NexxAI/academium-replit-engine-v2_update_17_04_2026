import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Bot, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { HistoryEntry } from "@shared/schema";

interface SimulationFeedProps {
  history: HistoryEntry[];
  isTyping: boolean;
  thinkingSteps?: { message: string; completed: boolean }[];
}

const npcAvatars: Record<string, { initial: string; color: string }> = {
  Marcus: { initial: "M", color: "bg-chart-1" },
  Sarah: { initial: "S", color: "bg-chart-2" },
  Victor: { initial: "V", color: "bg-chart-5" },
  Alex: { initial: "A", color: "bg-chart-3" },
};

function MessageBubble({ entry, index }: { entry: HistoryEntry; index: number }) {
  const isUser = entry.role === "user";
  const isNpc = entry.role === "npc";
  const isSystem = entry.role === "system";

  const npcInfo = entry.speaker ? npcAvatars[entry.speaker] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
      data-testid={`message-bubble-${index}`}
    >
      {!isUser && (
        <Avatar className="w-8 h-8 shrink-0">
          <AvatarFallback
            className={`text-xs font-medium ${
              isNpc && npcInfo ? npcInfo.color : "bg-muted"
            } ${isNpc ? "text-white" : ""}`}
          >
            {isNpc && npcInfo ? (
              npcInfo.initial
            ) : (
              <Bot className="w-4 h-4" />
            )}
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={`max-w-[80%] ${
          isUser
            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3"
            : isNpc
            ? "bg-card border rounded-2xl rounded-bl-md px-4 py-3"
            : "border-l-4 border-muted-foreground/30 pl-4 py-2"
        }`}
      >
        {isNpc && entry.speaker && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-muted-foreground">
              {entry.speaker}
            </span>
          </div>
        )}

        <p
          className={`leading-relaxed ${
            isUser ? "text-sm" : isNpc ? "text-sm italic" : "text-sm"
          }`}
        >
          {entry.content}
        </p>

        <span
          className={`text-xs mt-2 block ${
            isUser ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          {new Date(entry.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {isUser && (
        <Avatar className="w-8 h-8 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            <User className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </motion.div>
  );
}

function ThinkingIndicator({
  steps,
}: {
  steps: { message: string; completed: boolean }[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex gap-3"
      data-testid="thinking-indicator"
    >
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarFallback className="bg-muted">
          <Bot className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>

      <div className="bg-card border rounded-2xl rounded-bl-md px-4 py-3">
        <div className="space-y-2">
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.3 }}
              className="flex items-center gap-2"
            >
              {step.completed ? (
                <div className="w-2 h-2 rounded-full bg-chart-2" />
              ) : (
                <motion.div
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                />
              )}
              <span
                className={`text-sm ${
                  step.completed ? "text-muted-foreground" : "text-foreground"
                }`}
              >
                {step.message}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex gap-3"
    >
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarFallback className="bg-muted">
          <Bot className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>

      <div className="bg-card border rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-muted-foreground"
              animate={{ y: [0, -4, 0] }}
              transition={{
                repeat: Infinity,
                duration: 0.6,
                delay: i * 0.1,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function SimulationFeed({
  history,
  isTyping,
  thinkingSteps,
}: SimulationFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isTyping, thinkingSteps]);

  if (history.length === 0 && !isTyping) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center p-8">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            The simulation will begin shortly...
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full" ref={scrollRef}>
      <div className="p-6 space-y-6">
        {history.map((entry, index) => (
          <MessageBubble key={index} entry={entry} index={index} />
        ))}

        <AnimatePresence>
          {isTyping && thinkingSteps && thinkingSteps.length > 0 ? (
            <ThinkingIndicator steps={thinkingSteps} />
          ) : isTyping ? (
            <TypingDots />
          ) : null}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
