/**
 * providers.js — AI Provider configurations and request/response builders.
 *
 * Each provider has:
 *   label, hint, presets, base (bool),
 *   build(params) → { url, headers, body },
 *   parse(response) → text,
 *   err(response) → error string
 */

// ── Shared Helpers ───────────────────────────────────────

/**
 * Build an OpenAI-compatible request body.
 */
export function oaiBuild({ model, system, messages, maxTokens, temp, imageMessages }) {
  const msgs = [];

  if (system) {
    msgs.push({ role: 'system', content: system });
  }

  for (const m of messages) {
    if (m.role === 'user' && m.images && m.images.length > 0) {
      const content = [
        { type: 'text', text: m.content || '' },
        ...m.images.map(img => ({
          type: 'image_url',
          image_url: { url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}` }
        }))
      ];
      msgs.push({ role: 'user', content });
    } else {
      msgs.push({ role: m.role, content: m.content });
    }
  }

  const body = {
    model,
    messages: msgs,
    max_tokens: maxTokens || 4096,
    temperature: temp ?? 0.7
  };

  return body;
}

/**
 * Parse an OpenAI-compatible response.
 */
export function oaiParse(data) {
  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message?.content || data.choices[0].text || '';
  }
  return '';
}

/**
 * Extract text content from OpenAI-compatible response for error checking.
 */
export function oaiContent(data) {
  if (data.error) return null;
  return oaiParse(data);
}

/**
 * Build content array for Anthropic format.
 */
export function anthropicContent(messages) {
  const result = [];

  for (const m of messages) {
    if (m.role === 'user' && m.images && m.images.length > 0) {
      const content = [];
      if (m.content) {
        content.push({ type: 'text', text: m.content });
      }
      for (const img of m.images) {
        const base64 = img.startsWith('data:') ? img.split(',')[1] : img;
        const mediaType = img.startsWith('data:')
          ? img.split(';')[0].split(':')[1]
          : 'image/jpeg';
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 }
        });
      }
      result.push({ role: 'user', content });
    } else {
      result.push({ role: m.role, content: m.content });
    }
  }

  return result;
}

/**
 * Build parts array for Gemini format.
 */
export function geminiParts(messages) {
  const contents = [];

  for (const m of messages) {
    const parts = [];

    if (m.content) {
      parts.push({ text: m.content });
    }

    if (m.images && m.images.length > 0) {
      for (const img of m.images) {
        const base64 = img.startsWith('data:') ? img.split(',')[1] : img;
        const mimeType = img.startsWith('data:')
          ? img.split(';')[0].split(':')[1]
          : 'image/jpeg';
        parts.push({
          inline_data: { mime_type: mimeType, data: base64 }
        });
      }
    }

    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts
    });
  }

  return contents;
}

// ── Provider Definitions ─────────────────────────────────

export const PROVIDERS = {
  anthropic: {
    label: 'Anthropic',
    hint: 'sk-ant-...',
    presets: [
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307'
    ],
    base: false,
    build({ apiKey, model, system, messages, maxTokens, temp }) {
      return {
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens || 4096,
          temperature: temp ?? 0.7,
          system: system || undefined,
          messages: anthropicContent(messages)
        })
      };
    },
    parse(data) {
      if (data.content && data.content.length > 0) {
        return data.content.map(c => c.text || '').join('');
      }
      return '';
    },
    err(data) {
      return data.error?.message || null;
    }
  },

  openai: {
    label: 'OpenAI',
    hint: 'sk-...',
    presets: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'o1-preview',
      'o1-mini'
    ],
    base: false,
    build({ apiKey, model, system, messages, maxTokens, temp }) {
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(oaiBuild({ model, system, messages, maxTokens, temp }))
      };
    },
    parse: oaiParse,
    err(data) {
      return data.error?.message || null;
    }
  },

  openrouter: {
    label: 'OpenRouter',
    hint: 'sk-or-...',
    presets: [
      'anthropic/claude-sonnet-4',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-2.5-pro-preview',
      'google/gemini-2.5-flash-preview',
      'openai/gpt-4o',
      'meta-llama/llama-3.1-405b-instruct',
      'deepseek/deepseek-chat-v3'
    ],
    base: false,
    build({ apiKey, model, system, messages, maxTokens, temp }) {
      return {
        url: 'https://openrouter.ai/api/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Content Factory'
        },
        body: JSON.stringify(oaiBuild({ model, system, messages, maxTokens, temp }))
      };
    },
    parse: oaiParse,
    err(data) {
      return data.error?.message || null;
    }
  },

  google: {
    label: 'Google AI',
    hint: 'AIza...',
    presets: [
      'gemini-2.5-pro-preview-05-06',
      'gemini-2.5-flash-preview-05-20',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash'
    ],
    base: false,
    build({ apiKey, model, system, messages, maxTokens, temp }) {
      const contents = geminiParts(messages);
      const body = {
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens || 4096,
          temperature: temp ?? 0.7
        }
      };
      if (system) {
        body.systemInstruction = { parts: [{ text: system }] };
      }
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      };
    },
    parse(data) {
      if (data.candidates && data.candidates.length > 0) {
        const parts = data.candidates[0].content?.parts || [];
        return parts.map(p => p.text || '').join('');
      }
      return '';
    },
    err(data) {
      return data.error?.message || null;
    }
  },

  deepseek: {
    label: 'DeepSeek',
    hint: 'sk-...',
    presets: [
      'deepseek-chat',
      'deepseek-reasoner'
    ],
    base: false,
    build({ apiKey, model, system, messages, maxTokens, temp }) {
      return {
        url: 'https://api.deepseek.com/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(oaiBuild({ model, system, messages, maxTokens, temp }))
      };
    },
    parse: oaiParse,
    err(data) {
      return data.error?.message || null;
    }
  },

  kimi: {
    label: 'Kimi (Moonshot)',
    hint: 'sk-...',
    presets: [
      'moonshot-v1-8k',
      'moonshot-v1-32k',
      'moonshot-v1-128k'
    ],
    base: false,
    build({ apiKey, model, system, messages, maxTokens, temp }) {
      return {
        url: 'https://api.moonshot.cn/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(oaiBuild({ model, system, messages, maxTokens, temp }))
      };
    },
    parse: oaiParse,
    err(data) {
      return data.error?.message || null;
    }
  },

  glm: {
    label: 'GLM (Zhipu)',
    hint: 'your-api-key',
    presets: [
      'glm-4-plus',
      'glm-4',
      'glm-4-flash',
      'glm-4v-plus',
      'glm-4v'
    ],
    base: false,
    build({ apiKey, model, system, messages, maxTokens, temp }) {
      return {
        url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(oaiBuild({ model, system, messages, maxTokens, temp }))
      };
    },
    parse: oaiParse,
    err(data) {
      return data.error?.message || null;
    }
  },

  custom: {
    label: 'Custom (OpenAI-compatible)',
    hint: 'your-api-key',
    presets: [],
    base: true,
    build({ apiKey, model, baseUrl, system, messages, maxTokens, temp }) {
      const url = (baseUrl || '').replace(/\/+$/, '') + '/chat/completions';
      return {
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(oaiBuild({ model, system, messages, maxTokens, temp }))
      };
    },
    parse: oaiParse,
    err(data) {
      return data.error?.message || null;
    }
  }
};

// ── Token Extraction ─────────────────────────────────────

/**
 * Try to extract actual token count from API response data.
 * Returns null if not available.
 */
export function extractTokens(provider, responseData) {
  if (!responseData) return null;

  try {
    switch (provider) {
      case 'anthropic': {
        const u = responseData.usage;
        if (u && (u.input_tokens != null || u.output_tokens != null)) {
          return (u.input_tokens || 0) + (u.output_tokens || 0);
        }
        return null;
      }

      case 'google': {
        const meta = responseData.usageMetadata;
        if (meta && meta.totalTokenCount != null) {
          return meta.totalTokenCount;
        }
        if (meta && (meta.promptTokenCount != null || meta.candidatesTokenCount != null)) {
          return (meta.promptTokenCount || 0) + (meta.candidatesTokenCount || 0);
        }
        return null;
      }

      // OpenAI-compatible: openai, openrouter, deepseek, kimi, glm, custom
      default: {
        const u = responseData.usage;
        if (u && u.total_tokens != null) {
          return u.total_tokens;
        }
        if (u && (u.prompt_tokens != null || u.completion_tokens != null)) {
          return (u.prompt_tokens || 0) + (u.completion_tokens || 0);
        }
        return null;
      }
    }
  } catch {
    return null;
  }
}

/**
 * Rough token estimate: ~4 chars per token.
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
