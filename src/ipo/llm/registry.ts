// file: src/ipo/llm/registry.ts
// description: LlmProviderRegistry — central place to register, look up, and
//              health-check IPOPilot's configured AI providers. In Phase 1,
//              providers are loaded from environment variables (IPO_*) so the
//              app boots cleanly even with no DB-stored credentials. Phase 2
//              will hydrate this registry from the ipo_ai_providers table on
//              every request, decrypted via the secrets service.
// reference: src/ipo/llm/provider.ts, src/ipo/llm/openai_compatible.ts,
//            src/ipo/llm/anthropic.ts, db/ipo_schema.sql (ipo_ai_providers)

import {
  type LlmProvider,
  type AiProviderCode,
  type ProviderConfig,
  type ProviderHealth,
  NotConfiguredError,
} from './provider';
import { OpenAiCompatibleProvider } from './openai_compatible';
import { AnthropicProvider } from './anthropic';

interface RegistryEntry {
  provider: LlmProvider;
  config: ProviderConfig;
  registered_at: string;
}

export class LlmProviderRegistry {
  private entries: Map<AiProviderCode, RegistryEntry> = new Map();
  private default_provider: AiProviderCode | null = null;

  /**
   * Register (or replace) a provider. Returns the live instance.
   */
  register(cfg: ProviderConfig, opts?: { make_default?: boolean }): LlmProvider {
    const provider = build_provider(cfg);
    this.entries.set(cfg.code, {
      provider,
      config: cfg,
      registered_at: new Date().toISOString(),
    });
    if (opts?.make_default || this.default_provider === null) {
      this.default_provider = cfg.code;
    }
    return provider;
  }

  unregister(code: AiProviderCode): void {
    this.entries.delete(code);
    if (this.default_provider === code) {
      this.default_provider = this.entries.keys().next().value ?? null;
    }
  }

  has(code: AiProviderCode): boolean {
    return this.entries.has(code);
  }

  get(code: AiProviderCode): LlmProvider {
    const e = this.entries.get(code);
    if (!e) throw new NotConfiguredError(code);
    return e.provider;
  }

  get_default(): LlmProvider {
    if (!this.default_provider) throw new NotConfiguredError('NONE');
    return this.get(this.default_provider);
  }

  set_default(code: AiProviderCode): void {
    if (!this.entries.has(code)) throw new NotConfiguredError(code);
    this.default_provider = code;
  }

  list_status(): Array<{
    code: AiProviderCode;
    display_name: string;
    is_default: boolean;
    default_chat_model: string;
    default_embedding_model: string | null;
    base_url_redacted: string;
    registered_at: string;
  }> {
    return Array.from(this.entries.values()).map(e => ({
      code: e.config.code,
      display_name: e.provider.display_name,
      is_default: this.default_provider === e.config.code,
      default_chat_model: e.provider.default_chat_model,
      default_embedding_model: e.provider.default_embedding_model,
      base_url_redacted: redact_url(e.config.base_url),
      registered_at: e.registered_at,
    }));
  }

  async health_check_all(): Promise<Record<AiProviderCode, ProviderHealth>> {
    const out: Partial<Record<AiProviderCode, ProviderHealth>> = {};
    await Promise.all(Array.from(this.entries.values()).map(async (e) => {
      out[e.config.code] = await e.provider.health_check();
    }));
    return out as Record<AiProviderCode, ProviderHealth>;
  }

  is_configured(): boolean {
    return this.entries.size > 0;
  }

  /**
   * Phase-1 bootstrap from environment variables. Only providers with a
   * non-empty IPO_<CODE>_API_KEY are registered. Caller should still
   * tolerate an empty registry (the orchestrator runs in registry-only
   * mode with no LLM calls).
   *
   * Recognized env vars:
   *   IPO_TOKENHOT_API_KEY,   IPO_TOKENHOT_BASE_URL,   IPO_TOKENHOT_CHAT_MODEL,   IPO_TOKENHOT_EMBED_MODEL
   *   IPO_OPENAI_API_KEY,     IPO_OPENAI_BASE_URL,     IPO_OPENAI_CHAT_MODEL,     IPO_OPENAI_EMBED_MODEL
   *   IPO_ANTHROPIC_API_KEY,  IPO_ANTHROPIC_BASE_URL,  IPO_ANTHROPIC_CHAT_MODEL
   *   IPO_DEEPSEEK_API_KEY,   IPO_DEEPSEEK_BASE_URL,   IPO_DEEPSEEK_CHAT_MODEL
   *   IPO_DEFAULT_PROVIDER  (one of TOKENHOT|OPENAI|ANTHROPIC|DEEPSEEK)
   */
  bootstrap_from_env(env: Record<string, string | undefined> = process.env): { registered: AiProviderCode[]; default_provider: AiProviderCode | null } {
    const registered: AiProviderCode[] = [];
    const try_register = (code: AiProviderCode, prefix: string) => {
      const key = env[`${prefix}_API_KEY`];
      if (!key) return;
      this.register({
        code,
        api_key: key,
        base_url: env[`${prefix}_BASE_URL`],
        default_chat_model: env[`${prefix}_CHAT_MODEL`],
        default_embedding_model: env[`${prefix}_EMBED_MODEL`],
      });
      registered.push(code);
    };
    try_register('TOKENHOT', 'IPO_TOKENHOT');
    try_register('OPENAI', 'IPO_OPENAI');
    try_register('ANTHROPIC', 'IPO_ANTHROPIC');
    try_register('DEEPSEEK', 'IPO_DEEPSEEK');

    const wanted_default = env['IPO_DEFAULT_PROVIDER'] as AiProviderCode | undefined;
    if (wanted_default && this.entries.has(wanted_default)) {
      this.default_provider = wanted_default;
    }
    return { registered, default_provider: this.default_provider };
  }
}

function build_provider(cfg: ProviderConfig): LlmProvider {
  if (cfg.code === 'ANTHROPIC') return new AnthropicProvider(cfg);
  return new OpenAiCompatibleProvider(cfg);
}

function redact_url(url: string | undefined): string {
  if (!url) return '(default)';
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return '(invalid)';
  }
}

// Singleton — populated at boot from env, then optionally augmented by the
// /api/ipo/providers endpoint when DB-backed providers are added.
export const llm_provider_registry = new LlmProviderRegistry();
