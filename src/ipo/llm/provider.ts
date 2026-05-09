// file: src/ipo/llm/provider.ts
// description: LLM provider abstraction layer for IPOPilot. Defines a single
//              interface that the IPO orchestrator calls; concrete providers
//              (tokenhot.ai, OpenAI, Anthropic, DeepSeek) implement it.
// reference: src/ipo/llm/registry.ts, ipo_ai_providers (db table)

export type AiProviderCode = 'TOKENHOT' | 'OPENAI' | 'ANTHROPIC' | 'DEEPSEEK';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface ChatCompletionRequest {
  model: string;                       // e.g. 'gpt-4o', 'claude-3-5-sonnet-...', 'deepseek-chat'
  messages: ChatMessage[];
  temperature?: number;                // default 0.2 — IPO work needs determinism
  top_p?: number;
  max_tokens?: number;
  stop?: string[];
  // Tool / function calling left out of the abstraction surface for Phase 2 v1.
  // Each agent calls the LLM with a system+user envelope; tool calls happen
  // server-side via the orchestration service.
  metadata?: Record<string, string>;
}

export interface ChatCompletionResponse {
  provider: AiProviderCode;
  model: string;
  content: string;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'unknown';
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  raw?: unknown;
}

export interface EmbeddingRequest {
  model: string;                       // e.g. 'text-embedding-3-large'
  input: string | string[];
}

export interface EmbeddingResponse {
  provider: AiProviderCode;
  model: string;
  embeddings: number[][];              // one row per input
  usage: { prompt_tokens: number; total_tokens: number };
}

export interface ProviderHealth {
  ok: boolean;
  latency_ms: number;
  error?: string;
}

/**
 * The contract every concrete provider must implement.
 */
export interface LlmProvider {
  readonly code: AiProviderCode;
  readonly display_name: string;
  readonly default_chat_model: string;
  readonly default_embedding_model: string | null;

  chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse>;

  /** Optional — providers without embeddings throw a clear error. */
  embed(req: EmbeddingRequest): Promise<EmbeddingResponse>;

  health_check(): Promise<ProviderHealth>;
}

/**
 * Configuration loaded from ipo_ai_providers (env or DB later).
 */
export interface ProviderConfig {
  code: AiProviderCode;
  api_key: string;
  base_url?: string;
  default_chat_model?: string;
  default_embedding_model?: string;
  display_name?: string;
}

export class ProviderError extends Error {
  constructor(
    public provider: AiProviderCode,
    public status: number | null,
    message: string,
    public cause_raw?: unknown,
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'ProviderError';
  }
}

export class NotConfiguredError extends Error {
  constructor(provider: AiProviderCode | 'NONE') {
    super(`AI provider '${provider}' is not configured. Add credentials in Settings → AI Providers.`);
    this.name = 'NotConfiguredError';
  }
}
