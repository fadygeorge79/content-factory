/**
 * ui/rail.js — Left sidebar with project list, brand header, and footer actions.
 */

export function renderRail(container, projects, activeProjectId, callbacks, userData) {
  const isAdmin = userData && userData.role === 'admin';

  container.innerHTML = `
    <div class="rail-inner">
      <div class="rail-header">
        <div class="rail-brand">
          <span class="spark-logo small">✦</span>
          <div>
            <div class="rail-title">CONTENT FACTORY</div>
            <div class="rail-subtitle">Powered by Fady George</div>
          </div>
        </div>
      </div>

      <button class="rail-new-btn" id="rail-new-project">
        <span class="btn-icon">+</span> New Project
      </button>

      <div class="rail-projects" id="rail-projects">
        ${projects.length === 0 ? `
          <div class="rail-empty">
            <p>No projects yet</p>
          </div>
        ` : projects.map(p => `
          <div class="rail-item ${p.id === activeProjectId ? 'active' : ''}" data-id="${p.id}">
            <div class="rail-item-icon" style="color:${p.accent || '#facc15'}; border-color:${p.accent || '#facc15'}">${escHtml(p.name).charAt(0).toUpperCase()}</div>
            <div class="rail-item-text">
              <div class="rail-item-name">${escHtml(p.name)}</div>
              ${p.brandName ? `<div class="rail-item-meta">${escHtml(p.brandName)}</div>` : ''}
            </div>
            <div class="rail-item-actions">
              <button class="rail-action-btn" data-action="share" data-id="${p.id}" title="Share">🤝</button>
              <button class="rail-action-btn" data-action="rename" data-id="${p.id}" title="Rename">✏️</button>
              ${isAdmin ? `<button class="rail-action-btn" data-action="delete" data-id="${p.id}" title="Delete">🗑️</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="rail-footer">
        <button class="btn btn-ghost btn-block rail-btn" id="rail-settings">
          <span class="btn-icon">⚙</span> API & Engine
        </button>
        <div class="rail-footer-row">
          <button class="btn btn-ghost rail-btn-sm" id="rail-export" title="Export projects">📤 Export</button>
          <button class="btn btn-ghost rail-btn-sm" id="rail-import" title="Import projects">📥 Import</button>
        </div>
        ${isAdmin ? `
          <button class="btn btn-ghost btn-block rail-btn rail-admin-btn" id="rail-admin">
            <span class="btn-icon">⚡</span> Admin
          </button>
        ` : ''}
      </div>
    </div>
  `;

  // Event: New Project
  document.getElementById('rail-new-project')?.addEventListener('click', () => {
    callbacks.onNewProject();
  });

  // Event: Select Project
  container.querySelectorAll('.rail-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.rail-action-btn')) return;
      callbacks.onSelectProject(el.dataset.id);
    });
  });

  // Event: Rail Actions
  container.querySelectorAll('.rail-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'share' && callbacks.onShareProject) callbacks.onShareProject(id);
      if (action === 'rename' && callbacks.onRenameProject) callbacks.onRenameProject(id);
      if (action === 'delete' && callbacks.onDeleteProject) callbacks.onDeleteProject(id);
    });
  });

  // Event: Settings
  document.getElementById('rail-settings')?.addEventListener('click', () => {
    callbacks.onSettings();
  });

  // Event: Export
  document.getElementById('rail-export')?.addEventListener('click', () => {
    callbacks.onExport();
  });

  // Event: Import
  document.getElementById('rail-import')?.addEventListener('click', () => {
    callbacks.onImport();
  });

  // Event: Admin
  document.getElementById('rail-admin')?.addEventListener('click', () => {
    callbacks.onAdmin();
  });
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
