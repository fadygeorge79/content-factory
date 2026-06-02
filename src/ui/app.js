/**
 * ui/app.js — Main app shell, routing, state management.
 */

import { onAuthChange, signOut, reauthenticate } from '../auth.js';
import { onProjectsChange, onChatsChange, createProject, createChat, deleteChat, deleteProject, updateProject, updateChat, addMessage, updateUserTokens, exportProjects, importProjects } from '../db.js';
import { buildSystem, briefingImages, sendMessage, updateProjectMemory, readFileAsText, readFileAsBase64, isImageFile, isVideoFile, isAudioFile } from '../engine.js';
import { renderAuthScreen } from './auth-screen.js';
import { renderRail } from './rail.js';
import { renderChatPanel } from './chat-panel.js';
import { renderChatView } from './chat-view.js';
import { renderSetupView } from './setup-view.js';
import { renderAdmin } from './admin.js';
import { showNewProjectModal, showSettingsModal, showSkillModal, showConfirmModal, showPasswordModal, closeAllModals, toast } from './modals.js';

let currentUser = null;
let currentUserData = null;
let projects = [];
let chats = [];
let activeProjectId = null;
let activeChatId = null;
let currentView = 'chat'; // 'chat' | 'setup' | 'admin'
let unsubProjects = null;
let unsubChats = null;
let isSending = false;

// ── Public State Accessors ───────────────────────────────

export function getActiveProject() {
  return projects.find(p => p.id === activeProjectId) || null;
}

export function getActiveChat() {
  return chats.find(c => c.id === activeChatId) || null;
}

export function setActiveProject(id) {
  activeProjectId = id;
  activeChatId = null;
  localStorage.setItem('cf_activeProject', id || '');
  localStorage.removeItem('cf_activeChat');
  subscribeChats();
  currentView = 'chat';
  renderAll();
}

export function setActiveChat(id) {
  activeChatId = id;
  localStorage.setItem('cf_activeChat', id || '');
  currentView = 'chat';
  renderAll();
}

// ── Settings ─────────────────────────────────────────────

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem('cf_settings') || '{}');
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  localStorage.setItem('cf_settings', JSON.stringify(settings));
}

function getApiKey(provider) {
  try {
    const keys = JSON.parse(localStorage.getItem('cf_apiKeys') || '{}');
    return keys[provider] || '';
  } catch {
    return '';
  }
}

function saveApiKey(provider, key) {
  try {
    const keys = JSON.parse(localStorage.getItem('cf_apiKeys') || '{}');
    keys[provider] = key;
    localStorage.setItem('cf_apiKeys', JSON.stringify(keys));
  } catch { /* ignore */ }
}

// ── Subscription Management ──────────────────────────────

function subscribeProjects() {
  if (unsubProjects) unsubProjects();
  if (!currentUser) return;

  unsubProjects = onProjectsChange(currentUserData, (projs) => {
    projects = projs;

    // If active project no longer exists, reset
    if (activeProjectId && !projects.find(p => p.id === activeProjectId)) {
      activeProjectId = projects.length > 0 ? projects[0].id : null;
      localStorage.setItem('cf_activeProject', activeProjectId || '');
      subscribeChats();
    }

    renderAll();
  });
}

function subscribeChats() {
  if (unsubChats) unsubChats();
  if (!activeProjectId) {
    chats = [];
    return;
  }

  unsubChats = onChatsChange(activeProjectId, (ch) => {
    chats = ch;

    // If active chat no longer exists, reset
    if (activeChatId && !chats.find(c => c.id === activeChatId)) {
      activeChatId = chats.length > 0 ? chats[0].id : null;
      localStorage.setItem('cf_activeChat', activeChatId || '');
    }

    renderAll();
  });
}

// ── Render ───────────────────────────────────────────────

function renderAll() {
  const rail = document.getElementById('rail');
  const cpanel = document.getElementById('cpanel');
  const main = document.getElementById('main');
  if (!rail || !cpanel || !main) return;

  // Rail
  renderRail(rail, projects, activeProjectId, {
    onNewProject: handleNewProject,
    onSelectProject: setActiveProject,
    onSettings: handleOpenSettings,
    onExport: handleExport,
    onImport: handleImport,
    onAdmin: handleAdmin,
    onRenameProject: handleRenameProject,
    onShareProject: handleShareProject,
    onDeleteProject: handleDeleteProject
  }, currentUserData);

  // Chat panel
  const activeProject = getActiveProject();
  if (activeProject) {
    cpanel.classList.remove('hidden');
    renderChatPanel(cpanel, activeProject, chats, activeChatId, {
      onNewChat: handleNewChat,
      onSetup: handleSetup,
      onSelectChat: setActiveChat,
      onDeleteChat: handleDeleteChat
    });
  } else {
    cpanel.classList.add('hidden');
  }

  // Main view
  if (currentView === 'admin') {
    renderAdmin(main, {
      onBack: () => { currentView = 'chat'; renderAll(); },
      onApprove: handleApproveUser,
      onReject: handleRejectUser
    });
  } else if (currentView === 'setup' && activeProject) {
    renderSetupView(main, activeProject, {
      isAdmin: currentUserData?.role === 'admin',
      onUpdate: (data) => updateProject(activeProjectId, data),
      onBack: () => { currentView = 'chat'; renderAll(); },
      onAddSkill: handleAddSkill,
      onEditSkill: handleEditSkill,
      onDeleteSkill: handleDeleteSkill,
      onDeleteProject: handleDeleteProject,
      onFilesAdded: handleFilesAdded
    });
  } else if (activeProject && activeChatId) {
    const activeChat = getActiveChat();
    if (activeChat) {
      const settings = getSettings();
      renderChatView(main, activeProject, activeChat, settings, {
        onSend: handleSend,
        onRename: handleRenameChat,
        onInstructionChange: handleInstructionChange,
        onSettings: handleOpenSettings
      }, isSending);
    } else {
      renderEmpty(main, 'Select a chat or create a new one');
    }
  } else if (activeProject) {
    renderEmpty(main, 'Select a chat or create a new one');
  } else {
    renderEmpty(main, 'Create your first project to get started');
  }
}

function renderEmpty(container, message) {
  container.innerHTML = `
    <div class="main-empty">
      <div class="main-empty-icon">✦</div>
      <p class="main-empty-desc">${message}</p>
    </div>
  `;
}

// ── Event Handlers ───────────────────────────────────────

async function handleNewProject() {
  showNewProjectModal(async ({ name, brandName, accent }) => {
    try {
      const proj = await createProject(currentUser.uid, currentUserData.email, { name, brandName, accent });
      setActiveProject(proj.id);
      closeAllModals();
      toast('Project created', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    }
  });
}

async function handleNewChat() {
  if (!activeProjectId) return;
  try {
    const chat = await createChat(activeProjectId, 'New Chat');
    setActiveChat(chat.id);
    toast('Chat created', 'ok');
  } catch (err) {
    toast(err.message, 'err');
  }
}

function handleSetup() {
  currentView = 'setup';
  renderAll();
}

async function handleDeleteChat(chatId) {
  showConfirmModal('Delete this chat? This cannot be undone.', async () => {
    try {
      await deleteChat(activeProjectId, chatId);
      if (activeChatId === chatId) {
        activeChatId = null;
        localStorage.removeItem('cf_activeChat');
      }
      closeAllModals();
      toast('Chat deleted', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    }
  });
}

async function handleRenameChat(newTitle) {
  if (!activeProjectId || !activeChatId) return;
  try {
    await updateChat(activeProjectId, activeChatId, { title: newTitle });
  } catch (err) {
    toast(err.message, 'err');
  }
}

async function handleInstructionChange(instructions) {
  if (!activeProjectId || !activeChatId) return;
  try {
    await updateChat(activeProjectId, activeChatId, { instructions });
  } catch (err) {
    toast(err.message, 'err');
  }
}

function handleOpenSettings() {
  const settings = getSettings();
  const provider = settings.provider || 'openai';
  settings.apiKey = getApiKey(provider);

  showSettingsModal(settings, (newSettings) => {
    const { apiKey, ...rest } = newSettings;
    saveSettings(rest);
    if (apiKey !== undefined) {
      saveApiKey(rest.provider || provider, apiKey);
    }
    closeAllModals();
    toast('Settings saved', 'ok');
    renderAll();
  });
}

async function handleSend({ text, files }) {
  if (isSending) return;

  const settings = getSettings();
  const provider = settings.provider || 'openai';
  const apiKey = getApiKey(provider);

  if (!apiKey) {
    toast('Please set your API key in Settings', 'err');
    return;
  }

  const project = getActiveProject();
  const chat = getActiveChat();
  if (!project || !chat) return;

  // Process attached files
  const images = [];
  let fileTexts = [];

  if (files && files.length > 0) {
    for (const file of files) {
      if (isImageFile(file)) {
        const b64 = await readFileAsBase64(file);
        images.push(b64.dataUrl);
      } else if (isVideoFile(file) || isAudioFile(file)) {
        toast('This AI provider may not support video/audio files directly', 'err');
        // Still try to mention the file
        fileTexts.push(`[Attached ${isVideoFile(file) ? 'video' : 'audio'} file: ${file.name}]`);
      } else {
        // Document — extract text
        try {
          const content = await readFileAsText(file);
          fileTexts.push(`[File: ${file.name}]\n${content}`);
        } catch (err) {
          toast(`Failed to read ${file.name}: ${err.message}`, 'err');
        }
      }
    }
  }

  // Build user message content
  let fullText = text || '';
  if (fileTexts.length > 0) {
    fullText += (fullText ? '\n\n' : '') + fileTexts.join('\n\n');
  }

  if (!fullText.trim() && images.length === 0) return;

  // Add user message
  const userMsg = {
    role: 'user',
    content: fullText,
    images: images.length > 0 ? images : undefined
  };

  try {
    await addMessage(activeProjectId, activeChatId, userMsg);
  } catch (err) {
    toast(err.message, 'err');
    return;
  }

  // Send to AI
  isSending = true;
  renderAll();

  try {
    const system = buildSystem(project, chat);
    const projImages = briefingImages(project);

    // Build messages array for API
    const currentChat = getActiveChat();
    const apiMessages = [...(currentChat?.messages || [])];
    // Ensure the user message is included
    if (!apiMessages.find(m => m.content === userMsg.content && m.role === 'user' && m.timestamp === userMsg.timestamp)) {
      apiMessages.push(userMsg);
    }

    // Add briefing images to first user message if available
    if (projImages.length > 0 && apiMessages.length > 0) {
      const firstUser = apiMessages.find(m => m.role === 'user');
      if (firstUser && !firstUser._briefingAdded) {
        firstUser.images = [
          ...(firstUser.images || []),
          ...projImages.map(img => `data:${img.mime};base64,${img.data}`)
        ];
      }
    }

    const result = await sendMessage({
      provider,
      apiKey,
      model: settings.model || 'gpt-4o',
      baseUrl: settings.baseUrl,
      maxTokens: settings.maxTokens ? parseInt(settings.maxTokens) : 4096,
      temp: settings.temperature != null ? parseFloat(settings.temperature) : 0.7,
      system,
      messages: apiMessages.map(m => ({
        role: m.role,
        content: m.content,
        images: m.images
      }))
    });

    // Add assistant response
    const assistantMsg = {
      role: 'assistant',
      content: result.text
    };
    await addMessage(activeProjectId, activeChatId, assistantMsg);

    // Track tokens
    const tokenCount = result.tokens.actual || result.tokens.estimated;
    await updateUserTokens(currentUser.uid, activeProjectId, tokenCount);

    // Learn: update the shared project memory in the background (never blocks chat)
    maybeUpdateProjectMemory(project, apiMessages, result.text, {
      provider,
      apiKey,
      model: settings.model || 'gpt-4o',
      baseUrl: settings.baseUrl
    });

  } catch (err) {
    console.error('Send error:', err);
    toast(err.message, 'err');
    // Add error message
    await addMessage(activeProjectId, activeChatId, {
      role: 'assistant',
      content: `⚠️ Error: ${err.message}`,
      isError: true
    });
  } finally {
    isSending = false;
    renderAll();
  }
}

/**
 * Distill the latest exchange into the project's shared memory.
 * Fire-and-forget: any failure is logged and never affects the chat.
 * When it saves, onProjectsChange refreshes the project everywhere.
 */
async function maybeUpdateProjectMemory(project, apiMessages, assistantText, opts) {
  try {
    if (!project || !project.id) return;

    const transcript = [...apiMessages, { role: 'assistant', content: assistantText }]
      .slice(-8)
      .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${(m.content || '').slice(0, 2000)}`)
      .join('\n\n');

    const newMemory = await updateProjectMemory({
      provider: opts.provider,
      apiKey: opts.apiKey,
      model: opts.model,
      baseUrl: opts.baseUrl,
      currentMemory: project.memory || '',
      transcript
    });

    if (newMemory && newMemory !== (project.memory || '').trim()) {
      await updateProject(project.id, { memory: newMemory });
    }
  } catch (err) {
    console.warn('Project memory update skipped:', err?.message || err);
  }
}

// ── Skills ───────────────────────────────────────────────

function handleAddSkill() {
  showSkillModal(null, async (skill) => {
    const project = getActiveProject();
    if (!project) return;
    const skills = [...(project.skills || []), { ...skill, enabled: true }];
    await updateProject(activeProjectId, { skills });
    closeAllModals();
    toast('Skill added', 'ok');
  });
}

function handleEditSkill(index) {
  const project = getActiveProject();
  if (!project) return;
  const existing = project.skills[index];
  showSkillModal(existing, async (skill) => {
    const skills = [...project.skills];
    skills[index] = { ...skills[index], ...skill };
    await updateProject(activeProjectId, { skills });
    closeAllModals();
    toast('Skill updated', 'ok');
  });
}

async function handleDeleteSkill(index) {
  const project = getActiveProject();
  if (!project) return;
  showConfirmModal('Delete this skill?', async () => {
    const skills = project.skills.filter((_, i) => i !== index);
    await updateProject(activeProjectId, { skills });
    closeAllModals();
    toast('Skill deleted', 'ok');
  });
}

async function handleDeleteProject(id) {
  const targetId = typeof id === 'string' ? id : activeProjectId;
  if (!targetId) return;

  // Only admins may delete projects.
  if (!currentUserData || currentUserData.role !== 'admin') {
    toast('Only an admin can delete projects', 'err');
    return;
  }

  showPasswordModal({
    title: 'Delete Project',
    message: 'This permanently deletes the project and all of its chats. Enter your admin password to confirm.',
    confirmText: 'Delete Project',
    danger: true
  }, async (password) => {
    // Verify the admin's password — throws on failure, keeping the modal open.
    await reauthenticate(password);

    // Password confirmed → perform the deletion.
    await deleteProject(targetId);
    if (activeProjectId === targetId) {
      activeProjectId = null;
      activeChatId = null;
      localStorage.removeItem('cf_activeProject');
      localStorage.removeItem('cf_activeChat');
      currentView = 'chat';
    }
    toast('Project deleted', 'ok');
    renderAll();
  });
}

async function handleRenameProject(id) {
  const proj = projects.find(p => p.id === id);
  if (!proj) return;
  
  const newName = prompt('Enter new project name:', proj.name);
  if (newName && newName.trim()) {
    try {
      await updateProject(id, { name: newName.trim() });
      toast('Project renamed', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    }
  }
}

async function handleShareProject(id) {
  const proj = projects.find(p => p.id === id);
  if (!proj) return;
  
  const email = prompt('Enter the email address of the user to share this project with:');
  if (email && email.trim()) {
    try {
      const { arrayUnion } = await import('firebase/firestore');
      await updateProject(id, { memberEmails: arrayUnion(email.trim().toLowerCase()) });
      toast('Project shared successfully!', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    }
  }
}

async function handleFilesAdded(fileList) {
  const project = getActiveProject();
  if (!project) return;
  const newFiles = [...(project.files || [])];

  for (const file of fileList) {
    if (isImageFile(file)) {
      const b64 = await readFileAsBase64(file);
      newFiles.push({
        type: 'image',
        name: file.name,
        mime: b64.mime,
        data: b64.data
      });
    } else {
      try {
        const content = await readFileAsText(file);
        newFiles.push({
          type: 'text',
          name: file.name,
          content
        });
      } catch (err) {
        toast(`Failed to read ${file.name}`, 'err');
      }
    }
  }

  await updateProject(activeProjectId, { files: newFiles });
  toast('Files added', 'ok');
}

// ── Export / Import ──────────────────────────────────────

async function handleExport() {
  try {
    const data = await exportProjects(currentUserData);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-factory-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Projects exported', 'ok');
  } catch (err) {
    toast(err.message, 'err');
  }
}

function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('Invalid export format');
      const count = await importProjects(currentUser.uid, currentUserData.email, data);
      toast(`Imported ${count} project(s)`, 'ok');
    } catch (err) {
      toast(err.message, 'err');
    }
  };
  input.click();
}

// ── Admin ────────────────────────────────────────────────

function handleAdmin() {
  currentView = 'admin';
  renderAll();
}

async function handleApproveUser(uid) {
  try {
    const { approveUser } = await import('../auth.js');
    await approveUser(uid);
    toast('User approved', 'ok');
    renderAll();
  } catch (err) {
    toast(err.message, 'err');
  }
}

async function handleRejectUser(uid) {
  try {
    const { rejectUser } = await import('../auth.js');
    await rejectUser(uid);
    toast('User rejected', 'ok');
    renderAll();
  } catch (err) {
    toast(err.message, 'err');
  }
}

// ── Mobile Nav ───────────────────────────────────────────

function setupMobileNav() {
  const scrim = document.getElementById('scrim');
  if (scrim) {
    scrim.addEventListener('click', () => {
      document.getElementById('rail')?.classList.remove('open');
      document.getElementById('cpanel')?.classList.remove('open');
      scrim.classList.remove('active');
    });
  }
}

// ── Init ─────────────────────────────────────────────────

export function initApp() {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  // Show loading
  appEl.innerHTML = `
    <div class="loading-screen">
      <div class="loading-spark">✦</div>
      <p>Loading Content Factory...</p>
    </div>
  `;

  onAuthChange((authState) => {
    if (!authState) {
      // Not signed in
      currentUser = null;
      currentUserData = null;
      projects = [];
      chats = [];
      if (unsubProjects) unsubProjects();
      if (unsubChats) unsubChats();
      renderAuthScreen(appEl);
      return;
    }

    const { user, userData } = authState;

    if (userData.status !== 'approved') {
      // Pending approval
      appEl.innerHTML = `
        <div class="pending-screen">
          <div class="pending-card glass">
            <div class="pending-pulse"></div>
            <div class="spark-logo">✦</div>
            <h2>Account Pending</h2>
            <p>Your account is awaiting admin approval.</p>
            <p class="pending-email">${user.email}</p>
            <button class="btn btn-ghost" id="pending-signout">Sign Out</button>
          </div>
        </div>
      `;
      document.getElementById('pending-signout')?.addEventListener('click', signOut);
      return;
    }

    // Approved user — show main app
    currentUser = user;
    currentUserData = userData;

    // Restore active project/chat from localStorage
    activeProjectId = localStorage.getItem('cf_activeProject') || null;
    activeChatId = localStorage.getItem('cf_activeChat') || null;

    // Build app shell
    appEl.innerHTML = `
      <div class="app">
        <aside class="rail" id="rail"></aside>
        <section class="cpanel hidden" id="cpanel"></section>
        <main class="main" id="main"></main>
      </div>
      <div class="scrim" id="scrim"></div>
    `;

    setupMobileNav();
    subscribeProjects();
    subscribeChats();
    renderAll();
  });
}
