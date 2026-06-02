/**
 * ui/modals.js — Modal dialogs and toast notifications.
 */

import { PROVIDERS } from '../providers.js';

let activeModals = [];

// ── Modals Base ──────────────────────────────────────────

function createModalContainer() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);

  const modal = document.createElement('div');
  modal.className = 'modal';
  overlay.appendChild(modal);

  const closeBtn = () => {
    overlay.classList.add('closing');
    setTimeout(() => {
      overlay.remove();
      activeModals = activeModals.filter(m => m !== overlay);
    }, 250);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeBtn();
  });

  activeModals.push(overlay);

  return { overlay, modal, close: closeBtn };
}

export function closeAllModals() {
  activeModals.forEach(m => {
    m.classList.add('closing');
    setTimeout(() => m.remove(), 250);
  });
  activeModals = [];
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ── Modals ───────────────────────────────────────────────

export function showNewProjectModal(callback) {
  const { modal, close } = createModalContainer();

  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">New Project</h3>
      <button class="modal-close" title="Close">×</button>
    </div>
    <div class="modal-body">
      <div class="field-group">
        <label class="field-label">Project Name</label>
        <input type="text" id="np-name" class="field" placeholder="e.g. Acme Q3 Campaign" autofocus>
      </div>
      <br>
      <div class="field-group">
        <label class="field-label">Brand Name (Optional)</label>
        <input type="text" id="np-brand" class="field" placeholder="e.g. Acme Corp">
      </div>
      <br>
      <div class="field-group">
        <label class="field-label">Accent Color</label>
        <input type="color" id="np-accent" class="field" value="#facc15">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="np-cancel">Cancel</button>
      <button class="btn btn-y" id="np-create">Create Project</button>
    </div>
  `;

  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('#np-cancel').addEventListener('click', close);

  const createBtn = modal.querySelector('#np-create');
  const nameInput = modal.querySelector('#np-name');
  const brandInput = modal.querySelector('#np-brand');
  const accentInput = modal.querySelector('#np-accent');

  const submit = () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.classList.add('error');
      nameInput.focus();
      return;
    }
    callback({
      name,
      brandName: brandInput.value.trim(),
      accent: accentInput.value
    });
  };

  createBtn.addEventListener('click', submit);
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
    nameInput.classList.remove('error');
  });
}

export function showSettingsModal(currentSettings, callback) {
  const { modal, close } = createModalContainer();

  const provider = currentSettings.provider || 'openai';
  const model = currentSettings.model || 'gpt-4o';
  const apiKey = currentSettings.apiKey || '';
  const baseUrl = currentSettings.baseUrl || '';
  const maxTokens = currentSettings.maxTokens || '';
  const temp = currentSettings.temperature || '';

  let selectedProvider = provider;
  let provDef = PROVIDERS[selectedProvider];

  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">API & Engine Settings</h3>
      <button class="modal-close" title="Close">×</button>
    </div>
    <div class="modal-body">
      <div class="field-group">
        <label class="field-label">Provider</label>
        <div class="seg" id="st-providers" style="display:flex; flex-wrap:wrap;">
          ${Object.entries(PROVIDERS).map(([key, def]) => `
            <button class="btn ${key === selectedProvider ? 'btn-line active' : 'btn-ghost'}" data-provider="${key}" style="flex:1; min-width:30%;">
              ${escHtml(def.label)}
            </button>
          `).join('')}
        </div>
      </div>
      <br>
      <div class="field-group">
        <label class="field-label">API Key</label>
        <input type="password" id="st-key" class="field" placeholder="sk-..." value="${escHtml(apiKey)}">
        <div class="field-hint" id="st-hint">${escHtml(provDef.hint)}</div>
      </div>
      <br id="st-base-spacer" ${provDef.base ? '' : 'style="display:none"'}>
      <div class="field-group" id="st-base-group" ${provDef.base ? '' : 'style="display:none"'}>
        <label class="field-label">Base URL</label>
        <input type="text" id="st-base" class="field" placeholder="http://localhost:1234/v1" value="${escHtml(baseUrl)}">
      </div>
      <br>
      <div class="field-group">
        <label class="field-label">Model ID</label>
        <div style="display:flex; gap:8px;">
          <input type="text" id="st-model" class="field" value="${escHtml(model)}" style="flex:1;">
          <select class="field" id="st-presets" style="width:140px;">
            <option value="">Presets...</option>
            ${provDef.presets.map(p => `<option value="${escHtml(p)}">${escHtml(p)}</option>`).join('')}
          </select>
        </div>
      </div>
      <br>
      <details class="chat-instructions">
        <summary>Advanced Options</summary>
        <div class="chat-instructions-body" style="padding-top:12px;">
          <div style="display:flex; gap:16px;">
            <div class="field-group" style="flex:1;">
              <label class="field-label">Max Tokens</label>
              <input type="number" id="st-max" class="field" placeholder="4096" value="${maxTokens}">
            </div>
            <div class="field-group" style="flex:1;">
              <label class="field-label">Temperature</label>
              <input type="number" id="st-temp" class="field" placeholder="0.7" step="0.1" min="0" max="2" value="${temp}">
            </div>
          </div>
        </div>
      </details>
    </div>
    <div class="modal-footer" style="justify-content:space-between;">
      <button class="btn btn-line" id="st-test">Test Connection</button>
      <div>
        <button class="btn btn-ghost" id="st-cancel">Cancel</button>
        <button class="btn btn-y" id="st-save">Save Settings</button>
      </div>
    </div>
  `;

  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('#st-cancel').addEventListener('click', close);

  const provBtns = modal.querySelectorAll('#st-providers button');
  const keyInput = modal.querySelector('#st-key');
  const hintText = modal.querySelector('#st-hint');
  const baseSpacer = modal.querySelector('#st-base-spacer');
  const baseGroup = modal.querySelector('#st-base-group');
  const baseInput = modal.querySelector('#st-base');
  const modelInput = modal.querySelector('#st-model');
  const presetsSelect = modal.querySelector('#st-presets');
  const maxInput = modal.querySelector('#st-max');
  const tempInput = modal.querySelector('#st-temp');
  const testBtn = modal.querySelector('#st-test');
  const saveBtn = modal.querySelector('#st-save');

  // Switch provider
  provBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      provBtns.forEach(b => {
        b.classList.remove('btn-line', 'active');
        b.classList.add('btn-ghost');
      });
      btn.classList.remove('btn-ghost');
      btn.classList.add('btn-line', 'active');

      selectedProvider = btn.dataset.provider;
      provDef = PROVIDERS[selectedProvider];

      hintText.textContent = provDef.hint;
      
      if (provDef.base) {
        baseSpacer.style.display = '';
        baseGroup.style.display = 'flex';
      } else {
        baseSpacer.style.display = 'none';
        baseGroup.style.display = 'none';
      }

      presetsSelect.innerHTML = '<option value="">Presets...</option>' + 
        provDef.presets.map(p => `<option value="${escHtml(p)}">${escHtml(p)}</option>`).join('');
      
      if (provDef.presets.length > 0) {
        modelInput.value = provDef.presets[0];
      }
      
      keyInput.value = ''; // clear key when switching provider
    });
  });

  presetsSelect.addEventListener('change', () => {
    if (presetsSelect.value) modelInput.value = presetsSelect.value;
  });

  // Test connection
  testBtn.addEventListener('click', async () => {
    if (!keyInput.value) {
      toast('Please enter an API key', 'err');
      return;
    }
    
    testBtn.textContent = 'Testing...';
    testBtn.classList.add('loading');
    testBtn.disabled = true;

    try {
      const { sendMessage } = await import('../engine.js');
      const res = await sendMessage({
        provider: selectedProvider,
        apiKey: keyInput.value,
        model: modelInput.value,
        baseUrl: baseInput.value,
        maxTokens: 10,
        messages: [{ role: 'user', content: 'Say hello' }]
      });
      toast('Connection successful!', 'ok');
    } catch (err) {
      toast(`Connection failed: ${err.message}`, 'err');
    } finally {
      testBtn.textContent = 'Test Connection';
      testBtn.classList.remove('loading');
      testBtn.disabled = false;
    }
  });

  saveBtn.addEventListener('click', () => {
    callback({
      provider: selectedProvider,
      apiKey: keyInput.value,
      baseUrl: baseInput.value,
      model: modelInput.value,
      maxTokens: maxInput.value,
      temperature: tempInput.value
    });
  });
}

export function showSkillModal(existingSkill, callback) {
  const { modal, close } = createModalContainer();

  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${existingSkill ? 'Edit Skill' : 'New Skill'}</h3>
      <button class="modal-close" title="Close">×</button>
    </div>
    <div class="modal-body">
      <div class="field-group">
        <label class="field-label">Skill Name</label>
        <input type="text" id="sk-name" class="field" value="${escHtml(existingSkill?.name || '')}" placeholder="e.g. Tone of Voice">
      </div>
      <br>
      <div class="field-group">
        <label class="field-label">Content (Markdown / Text)</label>
        <textarea id="sk-content" class="field" style="min-height:180px; font-family:monospace;" placeholder="Write skill rules here...">${escHtml(existingSkill?.content || '')}</textarea>
      </div>
      <br>
      <div style="text-align:center;">
        <button class="btn btn-line btn-sm" id="sk-upload">Upload .skill file</button>
        <input type="file" id="sk-file" accept=".skill,.md,.txt" hidden>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="sk-cancel">Cancel</button>
      <button class="btn btn-y" id="sk-save">Save Skill</button>
    </div>
  `;

  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('#sk-cancel').addEventListener('click', close);

  const nameInput = modal.querySelector('#sk-name');
  const contentInput = modal.querySelector('#sk-content');
  const uploadBtn = modal.querySelector('#sk-upload');
  const fileInput = modal.querySelector('#sk-file');
  const saveBtn = modal.querySelector('#sk-save');

  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      contentInput.value = text;
      if (!nameInput.value) {
        nameInput.value = file.name.replace(/\.[^/.]+$/, '');
      }
    } catch (err) {
      toast('Failed to read file', 'err');
    }
  });

  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const content = contentInput.value.trim();
    if (!name) {
      nameInput.classList.add('error');
      return;
    }
    callback({ name, content });
  });
}

export function showConfirmModal(message, callback) {
  const { modal, close } = createModalContainer();

  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">Confirm</h3>
      <button class="modal-close" title="Close">×</button>
    </div>
    <div class="modal-body">
      <p style="color:var(--text); font-size:14px;">${escHtml(message)}</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="cf-cancel">Cancel</button>
      <button class="btn btn-danger" id="cf-confirm">Confirm</button>
    </div>
  `;

  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('#cf-cancel').addEventListener('click', close);
  
  modal.querySelector('#cf-confirm').addEventListener('click', () => {
    close();
    callback();
  });
}

// ── Toasts ───────────────────────────────────────────────

export function toast(message, type = 'info') {
  const container = document.getElementById('toasts');
  if (!container) return;

  const t = document.createElement('div');
  t.className = `toast toast-${type === 'ok' ? 'success' : type === 'err' ? 'error' : 'info'}`;

  const icon = type === 'ok' ? '✓' : type === 'err' ? '✕' : 'ℹ';

  t.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-message">${escHtml(message)}</div>
    <div class="toast-dismiss">×</div>
    <div class="toast-progress"></div>
  `;

  container.appendChild(t);

  const remove = () => {
    if (t.classList.contains('removing')) return;
    t.classList.add('removing');
    setTimeout(() => t.remove(), 300);
  };

  t.querySelector('.toast-dismiss').addEventListener('click', remove);
  setTimeout(remove, 4000);
}
