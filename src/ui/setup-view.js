/**
 * ui/setup-view.js — Standalone project setup page (not overlay).
 * Sections: project info, system prompt, skills, briefing files, delete.
 */

export function renderSetupView(container, project, callbacks) {
  const skills = project.skills || [];
  const files = project.files || [];

  container.innerHTML = `
    <div class="setup-view">
      <div class="setup-header">
        <button class="btn btn-ghost setup-back" id="setup-back">← Back to chats</button>
        <h2 class="setup-title">
          <span class="setup-dot" style="background:${project.accent || '#facc15'}"></span>
          ${escHtml(project.name)} — Setup
        </h2>
      </div>

      <!-- Section 1: Project Info -->
      <section class="setup-section">
        <h3 class="setup-section-title">Project Info</h3>
        <div class="setup-fields">
          <div class="form-field">
            <label for="setup-name">Project Name</label>
            <input type="text" id="setup-name" value="${escAttr(project.name || '')}" placeholder="Project name">
          </div>
          <div class="form-field">
            <label for="setup-brand">Brand Name</label>
            <input type="text" id="setup-brand" value="${escAttr(project.brandName || '')}" placeholder="Brand name">
          </div>
          <div class="form-field">
            <label for="setup-accent">Accent Color</label>
            <div class="color-field">
              <input type="color" id="setup-accent" value="${project.accent || '#facc15'}">
              <span class="color-value">${project.accent || '#facc15'}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 2: System Prompt -->
      <section class="setup-section">
        <h3 class="setup-section-title">System Prompt</h3>
        <p class="setup-hint">This prompt is prepended to every conversation in this project.</p>
        <textarea class="setup-textarea" id="setup-system" placeholder="Enter your system prompt...">${escHtml(project.systemPrompt || '')}</textarea>
      </section>

      <!-- Section: Project Memory -->
      <section class="setup-section">
        <div class="setup-section-header">
          <h3 class="setup-section-title">Project Memory</h3>
          <button class="btn btn-sm btn-line" id="setup-memory-clear">Clear</button>
        </div>
        <p class="setup-hint">Shared by every chat in this project and remembered across conversations. It builds automatically as you chat — capturing your preferences, recurring needs, and past corrections — and you can edit it directly.</p>
        <textarea class="setup-textarea" id="setup-memory" placeholder="The assistant builds this automatically as you chat. You can also add notes here…">${escHtml(project.memory || '')}</textarea>
      </section>

      <!-- Section 3: Skills -->
      <section class="setup-section">
        <div class="setup-section-header">
          <h3 class="setup-section-title">Skills</h3>
          <button class="btn btn-sm btn-primary" id="setup-add-skill">+ Add Skill</button>
        </div>
        <p class="setup-hint">Skills are reusable instruction blocks that get injected into the system prompt when enabled.</p>
        <div class="setup-skills" id="setup-skills">
          ${skills.length === 0 ? `
            <div class="setup-empty">No skills added yet</div>
          ` : skills.map((skill, i) => `
            <div class="setup-skill" data-index="${i}">
              <div class="setup-skill-left">
                <label class="toggle">
                  <input type="checkbox" class="skill-toggle" data-index="${i}" ${skill.enabled !== false ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
                <div class="setup-skill-info">
                  <div class="setup-skill-name">${escHtml(skill.name)}</div>
                  <div class="setup-skill-preview">${escHtml((skill.content || '').substring(0, 80))}${(skill.content || '').length > 80 ? '...' : ''}</div>
                </div>
              </div>
              <div class="setup-skill-actions">
                <button class="btn btn-icon-only skill-edit" data-index="${i}" title="Edit">✏️</button>
                <button class="btn btn-icon-only skill-delete" data-index="${i}" title="Delete">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Section 4: Briefing Files -->
      <section class="setup-section">
        <h3 class="setup-section-title">Briefing Files</h3>
        <p class="setup-hint">Files are included in the system context. Images are sent to vision-capable models. Text files are extracted and injected into the prompt.</p>
        <div class="setup-dropzone" id="setup-dropzone">
          <div class="dropzone-content">
            <span class="dropzone-icon">📁</span>
            <p>Drop files here or click to browse</p>
            <p class="dropzone-hint">Images, PDFs, DOCX, text files</p>
          </div>
          <input type="file" id="setup-file-input" multiple hidden
            accept=".pdf,.docx,.txt,.md,.csv,.json,.xml,.html,image/*">
        </div>
        <div class="setup-files" id="setup-files">
          ${files.map((file, i) => `
            <div class="setup-file" data-index="${i}">
              ${file.type === 'image' ? `
                <img class="setup-file-thumb" src="data:${file.mime};base64,${file.data}" alt="${escHtml(file.name)}">
              ` : `
                <div class="setup-file-icon">${getFileIcon(file.name)}</div>
              `}
              <span class="setup-file-name">${escHtml(file.name)}</span>
              <button class="btn btn-icon-only file-remove" data-index="${i}" title="Remove">×</button>
            </div>
          `).join('')}
        </div>
      </section>

      ${callbacks.isAdmin ? `
      <!-- Danger Zone (admins only) -->
      <section class="setup-section setup-danger">
        <h3 class="setup-section-title">Danger Zone</h3>
        <p class="setup-hint">Only an admin can delete a project. You'll be asked to re-enter your password to confirm.</p>
        <button class="btn btn-danger" id="setup-delete-project">🗑️ Delete Project</button>
      </section>
      ` : ''}
    </div>
  `;

  // ── Auto-save: Project Info ──
  let saveTimeout = null;
  const autoSave = (field, value) => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      callbacks.onUpdate({ [field]: value });
    }, 600);
  };

  document.getElementById('setup-name')?.addEventListener('input', (e) => {
    autoSave('name', e.target.value);
  });

  document.getElementById('setup-brand')?.addEventListener('input', (e) => {
    autoSave('brandName', e.target.value);
  });

  document.getElementById('setup-accent')?.addEventListener('input', (e) => {
    const color = e.target.value;
    container.querySelector('.color-value').textContent = color;
    container.querySelector('.setup-dot').style.background = color;
    autoSave('accent', color);
  });

  // ── Auto-save: System Prompt ──
  document.getElementById('setup-system')?.addEventListener('input', (e) => {
    autoSave('systemPrompt', e.target.value);
  });

  // ── Project Memory: edit + clear ──
  document.getElementById('setup-memory')?.addEventListener('input', (e) => {
    autoSave('memory', e.target.value);
  });
  document.getElementById('setup-memory-clear')?.addEventListener('click', () => {
    const ta = document.getElementById('setup-memory');
    if (ta) ta.value = '';
    callbacks.onUpdate({ memory: '' });
  });

  // ── Skills ──
  document.getElementById('setup-add-skill')?.addEventListener('click', () => {
    callbacks.onAddSkill();
  });

  container.querySelectorAll('.skill-toggle').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.index);
      const updatedSkills = [...skills];
      updatedSkills[idx] = { ...updatedSkills[idx], enabled: e.target.checked };
      callbacks.onUpdate({ skills: updatedSkills });
    });
  });

  container.querySelectorAll('.skill-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      callbacks.onEditSkill(parseInt(btn.dataset.index));
    });
  });

  container.querySelectorAll('.skill-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      callbacks.onDeleteSkill(parseInt(btn.dataset.index));
    });
  });

  // ── Files: Dropzone ──
  const dropzone = document.getElementById('setup-dropzone');
  const fileInput = document.getElementById('setup-file-input');

  dropzone?.addEventListener('click', () => fileInput?.click());

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) callbacks.onFilesAdded(files);
  });

  fileInput?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) callbacks.onFilesAdded(files);
    e.target.value = '';
  });

  // ── Files: Remove ──
  container.querySelectorAll('.file-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const updatedFiles = project.files.filter((_, i) => i !== idx);
      callbacks.onUpdate({ files: updatedFiles });
    });
  });

  // ── Delete Project ──
  document.getElementById('setup-delete-project')?.addEventListener('click', () => {
    callbacks.onDeleteProject();
  });

  // ── Back ──
  document.getElementById('setup-back')?.addEventListener('click', () => {
    callbacks.onBack();
  });
}

function getFileIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const icons = {
    pdf: '📄', docx: '📝', doc: '📝', txt: '📃', md: '📃',
    csv: '📊', json: '📊', xml: '📊', html: '🌐', css: '🎨',
    js: '💻', ts: '💻', py: '🐍'
  };
  return icons[ext] || '📎';
}

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
