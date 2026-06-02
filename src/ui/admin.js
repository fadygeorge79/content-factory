/**
 * ui/admin.js — Admin dashboard with user management and token analytics.
 */

import { getUsers } from '../auth.js';
import { getAllTokenStats } from '../db.js';

export async function renderAdmin(container, callbacks) {
  container.innerHTML = `
    <div class="admin-view">
      <div class="admin-header">
        <div class="admin-header-bar"></div>
        <div class="admin-header-content">
          <button class="btn btn-ghost admin-back" id="admin-back">← Back to Factory</button>
          <h1 class="admin-title">Admin Dashboard</h1>
        </div>
      </div>
      <div class="admin-loading">
        <div class="loading-spark">✦</div>
        <p>Loading dashboard data...</p>
      </div>
    </div>
  `;

  document.getElementById('admin-back')?.addEventListener('click', () => {
    callbacks.onBack();
  });

  // Load data
  try {
    const [users, tokenStats] = await Promise.all([
      getUsers(),
      getAllTokenStats()
    ]);

    renderDashboard(container, users, tokenStats, callbacks);
  } catch (err) {
    container.querySelector('.admin-loading').innerHTML = `
      <div class="admin-error">
        <p>⚠️ Failed to load dashboard: ${escHtml(err.message)}</p>
      </div>
    `;
  }
}

function renderDashboard(container, users, tokenStats, callbacks) {
  const { projects } = tokenStats;

  const totalUsers = users.length;
  const totalProjects = projects.length;
  const totalTokens = users.reduce((sum, u) => sum + (u.tokenUsage?.total || 0), 0);

  const adminView = container.querySelector('.admin-view');
  if (!adminView) return;

  // Remove loading
  const loading = adminView.querySelector('.admin-loading');
  if (loading) loading.remove();

  // Stats row
  const statsRow = document.createElement('div');
  statsRow.className = 'admin-stats';
  statsRow.innerHTML = `
    <div class="stat-card glass">
      <div class="stat-value">${totalUsers}</div>
      <div class="stat-label">Total Users</div>
    </div>
    <div class="stat-card glass">
      <div class="stat-value">${totalProjects}</div>
      <div class="stat-label">Total Projects</div>
    </div>
    <div class="stat-card glass">
      <div class="stat-value">${formatTokens(totalTokens)}</div>
      <div class="stat-label">Total Tokens</div>
    </div>
  `;
  adminView.appendChild(statsRow);

  // Tabs
  let activeTab = 'users';
  const tabContainer = document.createElement('div');
  tabContainer.className = 'admin-tabs-wrapper';
  adminView.appendChild(tabContainer);

  const contentContainer = document.createElement('div');
  contentContainer.className = 'admin-content';
  adminView.appendChild(contentContainer);

  function renderTabs() {
    tabContainer.innerHTML = `
      <div class="admin-tabs">
        <button class="admin-tab ${activeTab === 'users' ? 'active' : ''}" data-tab="users">Users</button>
        <button class="admin-tab ${activeTab === 'tokens' ? 'active' : ''}" data-tab="tokens">Token Analytics</button>
      </div>
    `;

    tabContainer.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        renderTabs();
        renderTabContent();
      });
    });
  }

  function renderTabContent() {
    if (activeTab === 'users') {
      renderUsersTab(contentContainer, users, callbacks);
    } else {
      renderTokensTab(contentContainer, users, projects);
    }
  }

  renderTabs();
  renderTabContent();
}

function renderUsersTab(container, users, callbacks) {
  container.innerHTML = `
    <div class="admin-table-wrapper">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Status</th>
            <th>Role</th>
            <th>Signed Up</th>
            <th>Last Login</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td class="admin-email">${escHtml(user.email)}</td>
              <td>
                <span class="badge badge-${user.status || 'pending'}">
                  ${user.status || 'pending'}
                </span>
              </td>
              <td>${user.role || 'user'}</td>
              <td>${formatDate(user.createdAt)}</td>
              <td>${formatDate(user.lastLogin)}</td>
              <td class="admin-actions">
                ${user.status === 'pending' ? `
                  <button class="btn btn-sm btn-primary admin-approve" data-uid="${user.id}">Approve</button>
                  <button class="btn btn-sm btn-danger admin-reject" data-uid="${user.id}">Reject</button>
                ` : user.status === 'rejected' ? `
                  <button class="btn btn-sm btn-primary admin-approve" data-uid="${user.id}">Approve</button>
                ` : `
                  <span class="admin-check">✓</span>
                `}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Approve buttons
  container.querySelectorAll('.admin-approve').forEach(btn => {
    btn.addEventListener('click', () => {
      callbacks.onApprove(btn.dataset.uid);
    });
  });

  // Reject buttons
  container.querySelectorAll('.admin-reject').forEach(btn => {
    btn.addEventListener('click', () => {
      callbacks.onReject(btn.dataset.uid);
    });
  });
}

function renderTokensTab(container, users, projects) {
  const maxUserTokens = Math.max(...users.map(u => u.tokenUsage?.total || 0), 1);

  // Build per-project token map
  const projectTokenMap = {};
  for (const user of users) {
    const byProject = user.tokenUsage?.byProject || {};
    for (const [projId, count] of Object.entries(byProject)) {
      if (!projectTokenMap[projId]) projectTokenMap[projId] = { total: 0, owner: user.email };
      projectTokenMap[projId].total += count;
    }
  }

  // Merge with project names
  const projectRows = projects.map(p => ({
    name: p.name,
    owner: users.find(u => u.id === p.ownerId)?.email || 'Unknown',
    tokens: projectTokenMap[p.id]?.total || 0
  })).sort((a, b) => b.tokens - a.tokens);

  const maxProjTokens = Math.max(...projectRows.map(r => r.tokens), 1);

  container.innerHTML = `
    <div class="admin-analytics">
      <h3 class="analytics-title">Per-User Token Usage</h3>
      <div class="admin-table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Total Tokens</th>
              <th>Usage</th>
              <th>Projects Breakdown</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(user => {
              const total = user.tokenUsage?.total || 0;
              const pct = (total / maxUserTokens * 100).toFixed(1);
              const byProject = user.tokenUsage?.byProject || {};
              const breakdown = Object.entries(byProject)
                .map(([pid, count]) => {
                  const proj = projects.find(p => p.id === pid);
                  return `${proj?.name || pid}: ${formatTokens(count)}`;
                }).join(', ') || '—';

              return `
                <tr>
                  <td>${escHtml(user.email)}</td>
                  <td>${formatTokens(total)}</td>
                  <td>
                    <div class="usage-bar-wrap">
                      <div class="usage-bar" style="width:${pct}%"></div>
                    </div>
                  </td>
                  <td class="admin-breakdown">${breakdown}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <h3 class="analytics-title">Per-Project Token Usage</h3>
      <div class="admin-table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Owner</th>
              <th>Total Tokens</th>
              <th>Usage</th>
            </tr>
          </thead>
          <tbody>
            ${projectRows.map(row => {
              const pct = (row.tokens / maxProjTokens * 100).toFixed(1);
              return `
                <tr>
                  <td>${escHtml(row.name)}</td>
                  <td>${escHtml(row.owner)}</td>
                  <td>${formatTokens(row.tokens)}</td>
                  <td>
                    <div class="usage-bar-wrap">
                      <div class="usage-bar usage-bar-accent" style="width:${pct}%"></div>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── Utilities ────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return '—';
  try {
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return '—';
  }
}

function formatTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
