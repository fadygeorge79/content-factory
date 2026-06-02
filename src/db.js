import {
  doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc,
  collection, query, where, orderBy, onSnapshot,
  serverTimestamp, arrayUnion, increment, writeBatch
} from 'firebase/firestore';
import { db } from './firebase.js';

// ── Projects ─────────────────────────────────────────────

/**
 * Create a new project.
 */
export async function createProject(userId, { name, brandName, accent }) {
  const ref = doc(collection(db, 'projects'));
  const data = {
    ownerId: userId,
    name: name || 'Untitled Project',
    brandName: brandName || '',
    accent: accent || '#facc15',
    skills: [],
    files: [],
    systemPrompt: '',
    createdAt: serverTimestamp()
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
}

/**
 * Get all projects for a user.
 */
export async function getProjects(userId) {
  const q = query(
    collection(db, 'projects'),
    where('ownerId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Real-time listener for user's projects.
 */
export function onProjectsChange(userId, callback) {
  const q = query(
    collection(db, 'projects'),
    where('ownerId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(projects);
  }, (err) => {
    console.error('Projects listener error:', err);
  });
}

/**
 * Update a project.
 */
export async function updateProject(projectId, data) {
  await updateDoc(doc(db, 'projects', projectId), data);
}

/**
 * Delete a project and all its chats.
 */
export async function deleteProject(projectId) {
  // Delete all chats in the subcollection
  const chatsSnap = await getDocs(collection(db, 'projects', projectId, 'chats'));
  const batch = writeBatch(db);
  chatsSnap.docs.forEach(chatDoc => {
    batch.delete(chatDoc.ref);
  });
  batch.delete(doc(db, 'projects', projectId));
  await batch.commit();
}

// ── Chats ────────────────────────────────────────────────

/**
 * Create a new chat in a project.
 */
export async function createChat(projectId, title) {
  const ref = doc(collection(db, 'projects', projectId, 'chats'));
  const data = {
    title: title || 'New Chat',
    instructions: '',
    messages: [],
    createdAt: serverTimestamp()
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
}

/**
 * Get all chats for a project.
 */
export async function getChats(projectId) {
  const q = query(
    collection(db, 'projects', projectId, 'chats'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Real-time listener for project chats.
 */
export function onChatsChange(projectId, callback) {
  const q = query(
    collection(db, 'projects', projectId, 'chats'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(chats);
  }, (err) => {
    console.error('Chats listener error:', err);
  });
}

/**
 * Update a chat.
 */
export async function updateChat(projectId, chatId, data) {
  await updateDoc(doc(db, 'projects', projectId, 'chats', chatId), data);
}

/**
 * Delete a chat.
 */
export async function deleteChat(projectId, chatId) {
  await deleteDoc(doc(db, 'projects', projectId, 'chats', chatId));
}

/**
 * Add a message to a chat using arrayUnion.
 */
export async function addMessage(projectId, chatId, message) {
  await updateDoc(doc(db, 'projects', projectId, 'chats', chatId), {
    messages: arrayUnion({
      ...message,
      timestamp: Date.now()
    })
  });
}

// ── Token Tracking ───────────────────────────────────────

/**
 * Update token usage for a user and project.
 */
export async function updateUserTokens(userId, projectId, tokenCount) {
  if (!tokenCount || tokenCount <= 0) return;

  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    'tokenUsage.total': increment(tokenCount),
    [`tokenUsage.byProject.${projectId}`]: increment(tokenCount)
  });
}

/**
 * Admin: get all users with token data.
 */
export async function getAllTokenStats() {
  const usersSnap = await getDocs(collection(db, 'users'));
  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const projectsSnap = await getDocs(collection(db, 'projects'));
  const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  return { users, projects };
}

// ── Export / Import ──────────────────────────────────────

/**
 * Export all projects with chats for a user.
 */
export async function exportProjects(userId) {
  const projects = await getProjects(userId);
  const result = [];

  for (const project of projects) {
    const chats = await getChats(project.id);
    result.push({
      ...project,
      chats
    });
  }

  return result;
}

/**
 * Import an array of projects with their chats.
 */
export async function importProjects(userId, projects) {
  let importedCount = 0;

  for (const projectData of projects) {
    const { chats, id: _oldId, ...projectFields } = projectData;

    // Create new project
    const projRef = doc(collection(db, 'projects'));
    await setDoc(projRef, {
      ...projectFields,
      ownerId: userId,
      createdAt: serverTimestamp()
    });

    // Create chats
    if (chats && Array.isArray(chats)) {
      for (const chatData of chats) {
        const { id: _oldChatId, ...chatFields } = chatData;
        const chatRef = doc(collection(db, 'projects', projRef.id, 'chats'));
        await setDoc(chatRef, {
          ...chatFields,
          createdAt: serverTimestamp()
        });
      }
    }

    importedCount++;
  }

  return importedCount;
}
