// file: src/ipo/llm/anthropic.ts
// description: Anthropic Messages API provider — translates the
//              ChatCompletion-style envelope into Anthropic's /v1/messages
//              shape (system prompt extracted, role: 'user'|'assistant' only).
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

interface RawAnthropicResponse {
  id: string;
  model: string;
  content: Array<{ type: string; text?: string }>;
  stop_reason: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class AnthropicProvider implements LlmProvider {
  readonly code: AiProviderCode = 'ANTHROPIC';
  readonly display_name: string;
  readonly default_chat_model: string;
  readonly default_embedding_model: string | null = null;
  private readonly base_url: string;
  private readonly api_key: string;
  private readonly api_version: string = '2023-06-01';

  constructor(cfg: ProviderConfig) {
    if (cfg.code !== 'ANTHROPIC') {
      throw new Error("AnthropicProvider can only be constructed with code='ANTHROPIC'");
    }
    this.display_name = cfg.display_name ?? 'Anthropic';
    this.api_key = cfg.api_key;
    this.base_url = (cfg.base_url ?? 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    this.default_chat_model = cfg.default_chat_model ?? 'claude-3-5-sonnet-20241022';
  }

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    // Extract system prompt(s) and convert to Anthropic format.
    const system_msgs = req.messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const non_system = req.messages.filter(m => m.role !== 'system' && m.role !== 'tool');

    const body = {
      model: req.model || this.default_chat_model,
      max_tokens: req.max_tokens ?? 1024,
      temperature: req.temperature ?? 0.2,
      ...(system_msgs ? { system: system_msgs } : {}),
      messages: non_system.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      ...(req.stop ? { stop_sequences: req.stop } : {}),
    };

    const resp = await fetch(`${this.base_url}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.api_key,
        'anthropic-version': this.api_version,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new ProviderError(this.code, resp.status, `chat HTTP ${resp.status}: ${text.slice(0, 500)}`);
    }
    const json = (await resp.json()) as RawAnthropicResponse;
    const text = (json.content ?? [])
      .filter(c => c.type === 'text' && typeof c.text === 'string')
      .map(c => c.text!)
      .join('');

    return {
      provider: this.code,
      model: json.model,
      content: text,
      finish_reason: json.stop_reason === 'end_turn' ? 'stop'
                   : json.stop_reason === 'max_tokens' ? 'length'
                   : json.stop_reason === 'tool_use' ? 'tool_calls'
                   : 'unknown',
      usage: {
        prompt_tokens: json.usage?.input_tokens ?? 0,
        completion_tokens: json.usage?.output_tokens ?? 0,
        total_tokens: (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0),
      },
      raw: json,
    };
  }

  embed(_req: EmbeddingRequest): Promise<EmbeddingResponse> {
    return Promise.reject(new ProviderError(
      this.code, null, 'Anthropic does not provide an embeddings endpoint. Use OpenAI/TokenHot for embeddings.'
    ));
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
