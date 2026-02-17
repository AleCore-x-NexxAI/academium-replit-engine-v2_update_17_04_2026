/**
 * LLM Module - Multi-provider abstraction with load balancing
 */

export {
  generateChatCompletion,
  isRateLimitError,
  getProviderStats,
  hasAvailableSlots,
  enqueueRequest,
  getJobStatus,
  getCapacityStatus,
  warmUpProviders,
  openai,
  gemini,
  type ChatMessage,
  type CompletionOptions,
  type ProviderType,
  type SupportedModel,
  type OpenAIModel,
  type GeminiModel,
  type ProviderStats,
  OPENAI_MODELS,
  GEMINI_MODELS,
} from "./provider";
