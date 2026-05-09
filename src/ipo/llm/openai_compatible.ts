// file: src/ipo/llm/openai_compatible.ts
// description: Generic OpenAI-Chat-Completions-compatible provider used by
//              tokenhot.ai, OpenAI, and DeepSeek (all expose the same v1
//              chat/completions surface, just different base URLs).
// reference: src/ipo/llm/provider.ts

import {
  type LlmProvider,
  type AiProviderCode,
  type ChatCompletionRequest,
  type ChatCompletionResponse,
  type EmbeddingRequest,
  type EmbeddingResponse,
  type ProviderHealth,
  type ProviderConfig,
  ProviderError,
} from './provider';

interface RawChoice {
  index: number;
  message: { role: string; content: string };
  finish_reason: string;
}

interface RawChatResponse {
  id?: string;
  model: string;
  choices: RawChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

interface RawEmbedResponse {
  model: string;
  data: Array<{ index: number; embedding: number[] }>;
  usage?: { prompt_tokens?: number; total_tokens?: number };
}

const PROVIDER_DEFAULTS: Record<AiProviderCode, { base_url: string; chat_model: string; embed_model: string | null; display: string }> = {
  TOKENHOT:   { base_url: 'https://api.tokenhot.ai/v1',     chat_model: 'gpt-4o-mini',                 embed_model: 'text-embedding-3-small', display: 'TokenHot' },
  OPENAI:     { base_url: 'https://api.openai.com/v1',      chat_model: 'gpt-4o-mini',                 embed_model: 'text-embedding-3-small', display: 'OpenAI' },
  DEEPSEEK:   { base_url: 'https://api.deepseek.com/v1',    chat_model: 'deepseek-chat',               embed_model: null,                     display: 'DeepSeek' },
  ANTHROPIC:  { base_url: 'https://api.anthropic.com/v1',   chat_model: 'claude-3-5-sonnet-20241022',  embed_model: null,                     display: 'Anthropic' },
};

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly code: AiProviderCode;
  readonly display_name: string;
  readonly default_chat_model: string;
  readonly default_embedding_model: string | null;
  private readonly base_url: string;
  private readonly api_key: string;

  constructor(cfg: ProviderConfig) {
    if (cfg.code === 'ANTHROPIC') {
      // Anthropic does NOT speak OpenAI Chat Completions natively; ship a clear
      // error so the caller knows to plug in the dedicated AnthropicProvider.
      throw new Error("Use AnthropicProvider for code='ANTHROPIC' — its API surface is different.");
    }
    const defaults = PROVIDER_DEFAULTS[cfg.code];
    this.code = cfg.code;
    this.display_name = cfg.display_name ?? defaults.display;
    this.api_key = cfg.api_key;
    this.base_url = (cfg.base_url ?? defaults.base_url).replace(/\/+$/, '');
    this.default_chat_model = cfg.default_chat_model ?? defaults.chat_model;
    this.default_embedding_model = cfg.default_embedding_model ?? defaults.embed_model;
  }

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const url = `${this.base_url}/chat/completions`;
    const body = {
      model: req.model || this.default_chat_model,
      messages: req.messages,
      temperature: req.temperature ?? 0.2,
      ...(req.top_p !== undefined ? { top_p: req.top_p } : {}),
      ...(req.max_tokens !== undefined ? { max_tokens: req.max_tokens } : {}),
      ...(req.stop ? { stop: req.stop } : {}),
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new ProviderError(this.code, resp.status, `chat HTTP ${resp.status}: ${text.slice(0, 500)}`);
    }
    const json = (await resp.json()) as RawChatResponse;
    const choice = json.choices?.[0];
    if (!choice) throw new ProviderError(this.code, null, 'chat: no choices in response', json);

    return {
      provider: this.code,
      model: json.model,
      content: choice.message.content ?? '',
      finish_reason: normalize_finish(choice.finish_reason),
      usage: {
        prompt_tokens: json.usage?.prompt_tokens ?? 0,
        completion_tokens: json.usage?.completion_tokens ?? 0,
        total_tokens: json.usage?.total_tokens ?? 0,
      },
      raw: json,
    };
  }

  async embed(req: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (!this.default_embedding_model && !req.model) {
      throw new ProviderError(this.code, null, 'embed: provider does not support embeddings');
    }
    const url = `${this.base_url}/embeddings`;
    const body = {
      model: req.model || this.default_embedding_model,
      input: req.input,
    };
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new ProviderError(this.code, resp.status, `embed HTTP ${resp.status}: ${text.slice(0, 500)}`);
    }
    const json = (await resp.json()) as RawEmbedResponse;
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    return {
      provider: this.code,
      model: json.model,
      embeddings: sorted.map(d => d.embedding),
      usage: {
        prompt_tokens: json.usage?.prompt_tokens ?? 0,
        total_tokens: json.usage?.total_tokens ?? 0,
      },
    };
  }

  async health_check(): Promise<ProviderHealth> {
    const start = performance.now();
    try {
      await this.chat({
        model: this.default_chat_model,
        messages: [
          { role: 'system', content: 'You are a healthcheck.' },
          { role: 'user', content: 'pong' },
        ],
        max_tokens: 4,
        temperature: 0,
      });
      return { ok: true, latency_ms: Math.round(performance.now() - start) };
    } catch (e) {
      return {
        ok: false,
        latency_ms: Math.round(performance.now() - start),
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}

function normalize_finish(s: string | undefined): ChatCompletionResponse['finish_reason'] {
  switch (s) {
    case 'stop': return 'stop';
    case 'length': return 'length';
    case 'tool_calls': return 'tool_calls';
    case 'content_filter': return 'content_filter';
    default: return 'unknown';
  }
}
