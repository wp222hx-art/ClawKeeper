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
  type ListModelsResponse,
  type ModelInfo,
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

  /**
   * GET {base_url}/models — TokenHot, OpenAI, and DeepSeek all expose this
   * endpoint with the same schema: { object: 'list', data: [{ id, owned_by,
   * created, ... }] }. We then heuristically classify each entry into a
   * capability bucket so the UI can offer "chat models only" / "embedding
   * models only" filters.
   */
  async list_models(): Promise<ListModelsResponse> {
    const url = `${this.base_url}/models`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.api_key}`,
        'Content-Type': 'application/json',
      },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new ProviderError(this.code, resp.status, `list_models HTTP ${resp.status}: ${text.slice(0, 500)}`);
    }
    const json = (await resp.json()) as {
      object?: string;
      data?: Array<{
        id: string;
        owned_by?: string;
        created?: number;
        // some providers add their own non-standard fields
        context_length?: number;
        context_window?: number;
        max_context_length?: number;
        type?: string;
        capability?: string;
      }>;
    };
    const raw_models = json.data ?? [];
    const models: ModelInfo[] = raw_models.map((m) => ({
      id: m.id,
      display_name: m.id,
      family: extract_family(m.id),
      capability: classify_capability(m.id, m.type ?? m.capability),
      context_window: m.context_length ?? m.context_window ?? m.max_context_length ?? null,
      owned_by: m.owned_by ?? null,
      created_at: m.created ? new Date(m.created * 1000).toISOString() : null,
      raw: m,
    }));
    return {
      provider: this.code,
      count: models.length,
      models,
      fetched_at: new Date().toISOString(),
    };
  }
}

/** Heuristic — group models by family name for UI filtering. */
function extract_family(id: string): string {
  const lower = id.toLowerCase();
  if (lower.includes('gpt-4o')) return 'gpt-4o';
  if (lower.includes('gpt-4.1')) return 'gpt-4.1';
  if (lower.includes('gpt-4')) return 'gpt-4';
  if (lower.includes('gpt-3.5')) return 'gpt-3.5';
  if (lower.includes('o1')) return 'o1';
  if (lower.includes('o3')) return 'o3';
  if (lower.includes('claude-3-5')) return 'claude-3-5';
  if (lower.includes('claude-3')) return 'claude-3';
  if (lower.includes('claude')) return 'claude';
  if (lower.includes('deepseek-r1') || lower.includes('deepseek-reasoner')) return 'deepseek-r1';
  if (lower.includes('deepseek-v3') || lower.includes('deepseek-chat')) return 'deepseek-v3';
  if (lower.includes('deepseek')) return 'deepseek';
  if (lower.includes('gemini')) return 'gemini';
  if (lower.includes('qwen')) return 'qwen';
  if (lower.includes('llama')) return 'llama';
  if (lower.includes('embedding')) return 'embedding';
  if (lower.includes('whisper')) return 'whisper';
  if (lower.includes('tts')) return 'tts';
  if (lower.includes('dall-e') || lower.includes('image')) return 'image';
  return 'other';
}

/** Heuristic — classify a model into a capability bucket from id/type hints. */
function classify_capability(id: string, type_hint?: string): ModelInfo['capability'] {
  const t = (type_hint ?? '').toLowerCase();
  const i = id.toLowerCase();
  if (t.includes('embed') || i.includes('embedding') || i.startsWith('text-embedding')) return 'embedding';
  if (t.includes('image') || i.includes('dall-e') || i.includes('image') || i.includes('flux') || i.includes('sd-')) return 'image';
  if (t.includes('audio') || i.includes('whisper') || i.includes('tts') || i.includes('voice')) return 'audio';
  if (t.includes('rerank') || i.includes('rerank')) return 'rerank';
  // Reasonable default: anything else accepting tokens is treated as chat.
  if (
    i.startsWith('gpt-') || i.includes('chat') || i.includes('claude') ||
    i.includes('deepseek') || i.includes('gemini') || i.includes('qwen') ||
    i.includes('llama') || i.startsWith('o1') || i.startsWith('o3') ||
    i.includes('mistral') || i.includes('mixtral') || i.includes('grok') ||
    i.includes('kimi') || i.includes('glm') || i.includes('yi-')
  ) return 'chat';
  return 'unknown';
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
