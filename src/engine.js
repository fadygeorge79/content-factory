/**
 * engine.js — Chat engine: prompt assembly, file reading, API dispatch, token tracking.
 */

import { PROVIDERS, extractTokens, estimateTokens } from './providers.js';

// ── System Prompt Assembly ───────────────────────────────

/**
 * Build the full system prompt from project config and chat instructions.
 */
export function buildSystem(project, chat) {
  const parts = [];

  // 1. Base system prompt
  if (project.systemPrompt && project.systemPrompt.trim()) {
    parts.push(project.systemPrompt.trim());
  }

  // 2. Enabled skills
  if (project.skills && project.skills.length > 0) {
    const enabledSkills = project.skills.filter(s => s.enabled !== false);
    if (enabledSkills.length > 0) {
      parts.push('--- SKILLS ---');
      for (const skill of enabledSkills) {
        parts.push(`[Skill: ${skill.name}]\n${skill.content}`);
      }
    }
  }

  // 3. Text briefing files (non-image files)
  if (project.files && project.files.length > 0) {
    const textFiles = project.files.filter(f => f.type === 'text');
    if (textFiles.length > 0) {
      parts.push('--- BRIEFING FILES ---');
      for (const file of textFiles) {
        parts.push(`[File: ${file.name}]\n${file.content}`);
      }
    }
  }

  // 4. Chat-specific instructions
  if (chat && chat.instructions && chat.instructions.trim()) {
    parts.push('--- CHAT INSTRUCTIONS ---');
    parts.push(chat.instructions.trim());
  }

  return parts.join('\n\n');
}

/**
 * Return image files from project briefing files for vision APIs.
 */
export function briefingImages(project) {
  if (!project.files) return [];
  return project.files
    .filter(f => f.type === 'image')
    .map(f => ({
      mime: f.mime,
      data: f.data,
      name: f.name
    }));
}

// ── API Request ──────────────────────────────────────────

/**
 * Send a message to an AI provider and return the response.
 *
 * @param {Object} params
 * @param {string} params.provider - Provider key
 * @param {string} params.apiKey - API key
 * @param {string} params.model - Model ID
 * @param {string} [params.baseUrl] - Base URL (for custom provider)
 * @param {number} [params.maxTokens] - Max output tokens
 * @param {number} [params.temp] - Temperature
 * @param {string} [params.system] - System prompt
 * @param {Array} params.messages - Conversation messages
 * @returns {{ text: string, tokens: { actual: number|null, estimated: number } }}
 */
export async function sendMessage({ provider, apiKey, model, baseUrl, maxTokens, temp, system, messages }) {
  const prov = PROVIDERS[provider];
  if (!prov) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  // Build the request
  const { url, headers, body } = prov.build({
    apiKey,
    model,
    baseUrl,
    system,
    messages,
    maxTokens: maxTokens || 4096,
    temp: temp ?? 0.7
  });

  // Make the request
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body
  });

  const data = await response.json();

  // Check for errors
  const errMsg = prov.err(data);
  if (errMsg) {
    throw new Error(errMsg);
  }

  if (!response.ok) {
    throw new Error(`API error (${response.status}): ${JSON.stringify(data)}`);
  }

  // Parse the response text
  const text = prov.parse(data);

  // Extract or estimate tokens
  const actualTokens = extractTokens(provider, data);
  const allText = (system || '') + messages.map(m => m.content || '').join('') + text;
  const estimated = estimateTokens(allText);

  return {
    text,
    tokens: {
      actual: actualTokens,
      estimated
    }
  };
}

// ── File Reading ─────────────────────────────────────────

/**
 * Read a File object as text. Supports PDF (via pdfjsLib), DOCX (via mammoth), and plain text.
 */
export async function readFileAsText(file) {
  const name = file.name.toLowerCase();

  // PDF
  if (name.endsWith('.pdf')) {
    if (typeof window !== 'undefined' && window.pdfjsLib) {
      const arrayBuf = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuf }).promise;
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        pages.push(pageText);
      }
      return pages.join('\n\n');
    }
    return `[PDF file: ${file.name} — PDF.js not loaded, cannot extract text]`;
  }

  // DOCX
  if (name.endsWith('.docx')) {
    if (typeof window !== 'undefined' && window.mammoth) {
      const arrayBuf = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer: arrayBuf });
      return result.value;
    }
    return `[DOCX file: ${file.name} — Mammoth.js not loaded, cannot extract text]`;
  }

  // Plain text / markdown / CSV / JSON / XML / etc.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file);
  });
}

/**
 * Read a File as a base64 data URL.
 * Returns { mime, data, name }.
 */
export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const mime = dataUrl.split(';')[0].split(':')[1];
      const data = dataUrl.split(',')[1];
      resolve({ mime, data, name: file.name, dataUrl });
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

// ── File Type Support ────────────────────────────────────

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi'];
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'flac', 'm4a'];
const DOC_EXTS = ['pdf', 'docx', 'txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py'];

/**
 * Get info about what file types a provider supports.
 */
export function getSupportedFileTypes(provider) {
  const base = {
    images: {
      supported: true,
      extensions: IMAGE_EXTS,
      note: 'Images are sent inline to the API'
    },
    documents: {
      supported: true,
      extensions: DOC_EXTS,
      note: 'Text extracted and included in message'
    },
    video: {
      supported: false,
      extensions: VIDEO_EXTS,
      note: 'Video files are not directly supported by most AI providers'
    },
    audio: {
      supported: false,
      extensions: AUDIO_EXTS,
      note: 'Audio files are not directly supported by most AI providers'
    }
  };

  // Google Gemini supports video and some audio
  if (provider === 'google') {
    base.video.supported = true;
    base.video.note = 'Google Gemini supports video input';
    base.audio.supported = true;
    base.audio.note = 'Google Gemini supports audio input';
  }

  return base;
}

/**
 * Determine if a file is an image based on MIME or extension.
 */
export function isImageFile(file) {
  if (file.type && file.type.startsWith('image/')) return true;
  const ext = (file.name || '').split('.').pop().toLowerCase();
  return IMAGE_EXTS.includes(ext);
}

/**
 * Determine if a file is a video based on MIME or extension.
 */
export function isVideoFile(file) {
  if (file.type && file.type.startsWith('video/')) return true;
  const ext = (file.name || '').split('.').pop().toLowerCase();
  return VIDEO_EXTS.includes(ext);
}

/**
 * Determine if a file is audio based on MIME or extension.
 */
export function isAudioFile(file) {
  if (file.type && file.type.startsWith('audio/')) return true;
  const ext = (file.name || '').split('.').pop().toLowerCase();
  return AUDIO_EXTS.includes(ext);
}

/**
 * Get a file type icon character for display.
 */
export function fileTypeIcon(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  if (IMAGE_EXTS.includes(ext)) return '🖼️';
  if (VIDEO_EXTS.includes(ext)) return '🎬';
  if (AUDIO_EXTS.includes(ext)) return '🎵';
  if (ext === 'pdf') return '📄';
  if (ext === 'docx') return '📝';
  if (['json', 'xml', 'csv'].includes(ext)) return '📊';
  if (['js', 'ts', 'py', 'css', 'html'].includes(ext)) return '💻';
  return '📎';
}
