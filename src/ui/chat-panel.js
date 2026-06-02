/**
 * ui/chat-panel.js — Chat list panel with project context and chat management.
 */

export function renderChatPanel(container, project, chats, activeChatId, callbacks) {
  const skillCount = (project.skills || []).filter(s => s.enabled !== false).length;
  const fileCount = (project.files || []).length;

  container.innerHTML = `
    <div class="cpanel-inner">
      <div class="cpanel-header">
        <div class="cpanel-project">
          <span class="cpanel-dot" style="background:${project.accent || '#facc15'}"></span>
          <span class="cpanel-project-name">${escHtml(project.name)}</span>
        </div>
        <div class="cpanel-actions">
          <button class="btn btn-sm btn-primary" id="cpanel-new-chat">
            <span class="btn-icon">+</span> Chat
          </button>
          <button class="btn btn-sm btn-ghost" id="cpanel-setup" title="Project Setup">⚙ Setup</button>
        </div>
      </div>

      ${(skillCount > 0 || fileCount > 0) ? `
        <div class="cpanel-tags">
          ${skillCount > 0 ? `<span class="tag tag-skill">🧠 ${skillCount} skill${skillCount !== 1 ? 's' : ''}</span>` : ''}
          ${fileCount > 0 ? `<span class="tag tag-file">📎 ${fileCount} file${fileCount !== 1 ? 's' : ''}</span>` : ''}
        </div>
      ` : ''}

      <div class="cpanel-chats" id="cpanel-chats">
        ${chats.length === 0 ? `
          <div class="cpanel-empty">
            <p>No chats yet</p>
            <p class="cpanel-empty-hint">Create a chat to start a conversation</p>
          </div>
        ` : chats.map(chat => `
          <div class="cpanel-chat ${chat.id === activeChatId ? 'active' : ''}" data-id="${chat.id}">
            <div class="cpanel-chat-icon">💬</div>
            <div class="cpanel-chat-info">
              <div class="cpanel-chat-title">${escHtml(chat.title)}</div>
              <div class="cpanel-chat-meta">${chat.messages ? chat.messages.length : 0} messages</div>
            </div>
            <button class="cpanel-chat-delete" data-id="${chat.id}" title="Delete chat">×</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Event: New Chat
  document.getElementById('cpanel-new-chat')?.addEventListener('click', () => {
    callbacks.onNewChat();
  });

  // Event: Setup
  document.getElementById('cpanel-setup')?.addEventListener('click', () => {
    callbacks.onSetup();
  });

  // Event: Select Chat
  container.querySelectorAll('.cpanel-chat').forEach(el => {
    el.addEventListener('click', (e) => {
      // Don't select if clicking delete button
      if (e.target.classList.contains('cpanel-chat-delete')) return;
      callbacks.onSelectChat(el.dataset.id);
    });
  });

  // Event: Delete Chat
  container.querySelectorAll('.cpanel-chat-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      callbacks.onDeleteChat(btn.dataset.id);
    });
  });
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
