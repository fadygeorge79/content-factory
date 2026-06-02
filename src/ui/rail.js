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

      <button class="btn btn-primary btn-block rail-new-project" id="rail-new-project">
        <span class="btn-icon">+</span> New Project
      </button>

      <div class="rail-projects" id="rail-projects">
        ${projects.length === 0 ? `
          <div class="rail-empty">
            <p>No projects yet</p>
          </div>
        ` : projects.map(p => `
          <div class="rail-project ${p.id === activeProjectId ? 'active' : ''}" data-id="${p.id}">
            <div class="rail-project-dot" style="background:${p.accent || '#facc15'}"></div>
            <div class="rail-project-info">
              <div class="rail-project-name">${escHtml(p.name)}</div>
              ${p.brandName ? `<div class="rail-project-brand">${escHtml(p.brandName)}</div>` : ''}
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
  container.querySelectorAll('.rail-project').forEach(el => {
    el.addEventListener('click', () => {
      callbacks.onSelectProject(el.dataset.id);
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
