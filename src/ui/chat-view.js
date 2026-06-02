/**
 * ui/chat-view.js — Chat messages, composer with file attachments, resize handle, markdown rendering.
 */

import { fileTypeIcon } from '../engine.js';

let attachedFiles = [];
let composerHeight = parseInt(localStorage.getItem('cf_composerH')) || 200;

export function renderChatView(container, project, chat, settings, callbacks, isSending) {
  const provider = settings.provider || 'openai';
  const model = settings.model || 'gpt-4o';
  const messages = chat.messages || [];

  // Preserve scroll position reference
  const shouldScrollBottom = true;

  container.innerHTML = `
    <div class="chat-view">
      <div class="chat-header">
        <div class="chat-header-left">
          <h2 class="chat-title" id="chat-title">${escHtml(chat.title)}</h2>
          <button class="btn btn-icon-only chat-rename" id="chat-rename" title="Rename chat">✏️</button>
        </div>
        <div class="chat-header-right">
          <div class="model-chip" id="chat-settings-btn" title="Change model settings">
            <span class="model-ping ${isSending ? 'sending' : 'idle'}"></span>
            <span class="model-name">${escHtml(model)}</span>
          </div>
        </div>
      </div>

      <details class="chat-instructions" ${chat.instructions ? 'open' : ''}>
        <summary>Chat Instructions</summary>
        <textarea class="chat-instructions-input" id="chat-instructions" placeholder="Add specific instructions for this chat...">${escHtml(chat.instructions || '')}</textarea>
      </details>

      <div class="chat-messages" id="chat-messages">
        ${messages.length === 0 ? `
          <div class="main-empty">
            <div class="main-empty-icon">✦</div>
            <p class="main-empty-desc">Start a conversation</p>
          </div>
        ` : messages.map((msg, i) => renderMessage(msg, i)).join('')}
        ${isSending ? `
          <div class="message message-assistant">
            <div class="message-avatar">✦</div>
            <div class="message-body">
              <div class="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="resize-handle" id="resize-handle" title="Drag to resize. Double-click to reset."></div>

      <div class="composer" id="composer" style="height:${composerHeight}px">
        <div class="composer-attachments" id="composer-attachments"></div>
        <div class="composer-row">
          <button class="btn btn-icon-only composer-attach" id="composer-attach" title="Attach file">📎</button>
          <textarea class="composer-input" id="composer-input" placeholder="Type your message..." ${isSending ? 'disabled' : ''}></textarea>
          <button class="btn btn-primary composer-send" id="composer-send" ${isSending ? 'disabled' : ''} title="Send message">
            ${isSending ? '⏳' : '➤'}
          </button>
        </div>
      </div>

      <input type="file" id="composer-file-input" multiple hidden
        accept=".pdf,.docx,.txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.py,image/*,video/*,audio/*">
    </div>
  `;

  // Scroll to bottom
  const messagesEl = document.getElementById('chat-messages');
  if (messagesEl && shouldScrollBottom) {
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  // Render attached files
  renderAttachments();

  // ── Event: Rename ──
  document.getElementById('chat-rename')?.addEventListener('click', () => {
    const current = chat.title;
    const newTitle = prompt('Rename chat:', current);
    if (newTitle && newTitle.trim() && newTitle !== current) {
      callbacks.onRename(newTitle.trim());
    }
  });

  // ── Event: Instructions ──
  let instrTimeout = null;
  document.getElementById('chat-instructions')?.addEventListener('input', (e) => {
    clearTimeout(instrTimeout);
    instrTimeout = setTimeout(() => {
      callbacks.onInstructionChange(e.target.value);
    }, 800);
  });

  // ── Event: Settings ──
  document.getElementById('chat-settings-btn')?.addEventListener('click', () => {
    callbacks.onSettings();
  });

  // ── Event: Attach File ──
  document.getElementById('composer-attach')?.addEventListener('click', () => {
    document.getElementById('composer-file-input')?.click();
  });

  document.getElementById('composer-file-input')?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    attachedFiles.push(...files);
    renderAttachments();
    e.target.value = '';
  });

  // ── Event: Send ──
  const sendHandler = () => {
    const input = document.getElementById('composer-input');
    const text = input?.value?.trim() || '';
    if (!text && attachedFiles.length === 0) return;
    if (isSending) return;

    callbacks.onSend({ text, files: [...attachedFiles] });
    if (input) input.value = '';
    attachedFiles = [];
    renderAttachments();
  };

  document.getElementById('composer-send')?.addEventListener('click', sendHandler);

  document.getElementById('composer-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendHandler();
    }
  });

  // ── Event: Copy buttons ──
  container.querySelectorAll('.message-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.content;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = '📋'; }, 1500);
      });
    });
  });

  // ── Resize Handle ──
  setupResize();
}

// ── Render a single message ──────────────────────────────

function renderMessage(msg, index) {
  const isUser = msg.role === 'user';
  const isError = msg.isError;

  let contentHtml = '';

  // Render text content with markdown
  if (msg.content) {
    contentHtml = renderMarkdown(msg.content);
  }

  // Render images
  let imagesHtml = '';
  if (msg.images && msg.images.length > 0) {
    imagesHtml = `
      <div class="message-images">
        ${msg.images.map(img => `
          <img class="message-image" src="${img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`}" alt="Attached image" loading="lazy">
        `).join('')}
      </div>
    `;
  }

  return `
    <div class="message ${isUser ? 'message-user' : 'message-assistant'} ${isError ? 'message-error' : ''}">
      <div class="message-avatar">${isUser ? '👤' : '✦'}</div>
      <div class="message-body">
        ${imagesHtml}
        <div class="message-content">${contentHtml}</div>
        ${!isUser ? `
          <button class="message-copy" data-content="${escAttr(msg.content || '')}" title="Copy to clipboard">📋</button>
        ` : ''}
      </div>
    </div>
  `;
}

// ── Markdown Rendering ───────────────────────────────────

function renderMarkdown(text) {
  // Try marked + DOMPurify
  if (typeof window !== 'undefined' && window.marked && window.DOMPurify) {
    try {
      const html = window.marked.parse(text);
      return window.DOMPurify.sanitize(html);
    } catch { /* fall through */ }
  }

  // Try marked only
  if (typeof window !== 'undefined' && window.marked) {
    try {
      return window.marked.parse(text);
    } catch { /* fall through */ }
  }

  // Fallback: basic formatting
  return basicMarkdown(text);
}

function basicMarkdown(text) {
  let html = escHtml(text);

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

// ── Attachment Preview ───────────────────────────────────

function renderAttachments() {
  const container = document.getElementById('composer-attachments');
  if (!container) return;

  if (attachedFiles.length === 0) {
    container.innerHTML = '';
    container.classList.remove('has-files');
    return;
  }

  container.classList.add('has-files');
  container.innerHTML = attachedFiles.map((file, i) => {
    const isImg = file.type && file.type.startsWith('image/');
    return `
      <div class="attachment-chip" data-index="${i}">
        ${isImg ? `<img class="attachment-thumb" src="${URL.createObjectURL(file)}" alt="${escHtml(file.name)}">` : `<span class="attachment-icon">${fileTypeIcon(file.name)}</span>`}
        <span class="attachment-name">${escHtml(file.name)}</span>
        <button class="attachment-remove" data-index="${i}">×</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.attachment-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      attachedFiles.splice(idx, 1);
      renderAttachments();
    });
  });
}

// ── Resize Handle ────────────────────────────────────────

function setupResize() {
  const handle = document.getElementById('resize-handle');
  const composer = document.getElementById('composer');
  const messagesEl = document.getElementById('chat-messages');
  if (!handle || !composer || !messagesEl) return;

  let startY = 0;
  let startH = 0;
  let isDragging = false;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = true;
    startY = e.clientY;
    startH = composer.offsetHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (!isDragging) return;
      const delta = startY - ev.clientY;
      const newH = Math.max(100, Math.min(600, startH + delta));
      composer.style.height = newH + 'px';
      composerHeight = newH;
    };

    const onUp = () => {
      isDragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('cf_composerH', composerHeight.toString());
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Touch support
  handle.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isDragging = true;
    startY = e.touches[0].clientY;
    startH = composer.offsetHeight;

    const onMove = (ev) => {
      if (!isDragging) return;
      const delta = startY - ev.touches[0].clientY;
      const newH = Math.max(100, Math.min(600, startH + delta));
      composer.style.height = newH + 'px';
      composerHeight = newH;
    };

    const onUp = () => {
      isDragging = false;
      localStorage.setItem('cf_composerH', composerHeight.toString());
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };

    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onUp);
  });

  // Double-click to reset
  handle.addEventListener('dblclick', () => {
    composerHeight = 200;
    composer.style.height = '200px';
    localStorage.setItem('cf_composerH', '200');
  });
}

// ── Utilities ────────────────────────────────────────────

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escAttr(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
