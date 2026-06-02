import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, getDocs, collection,
  updateDoc, serverTimestamp, query, orderBy
} from 'firebase/firestore';
import { auth, db } from './firebase.js';

const ADMIN_EMAIL = 'fady.career@gmail.com';

/**
 * Create a new user account and Firestore user document.
 */
export async function signUp(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const isAdmin = email.toLowerCase() === ADMIN_EMAIL;

  const userData = {
    email,
    role: isAdmin ? 'admin' : 'user',
    status: isAdmin ? 'approved' : 'pending',
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    tokenUsage: {
      total: 0,
      byProject: {}
    }
  };

  await setDoc(doc(db, 'users', uid), userData);

  if (!isAdmin) {
    await firebaseSignOut(auth);
  }

  return { uid, ...userData };
}

/**
 * Sign in an existing user. Checks approval status.
 */
export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) {
    await firebaseSignOut(auth);
    throw new Error('User record not found');
  }

  const userData = snap.data();

  if (userData.status !== 'approved') {
    await firebaseSignOut(auth);
    throw new Error('Account pending approval');
  }

  // Update last login
  await updateDoc(doc(db, 'users', uid), {
    lastLogin: serverTimestamp()
  });

  return { uid, ...userData };
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  await firebaseSignOut(auth);
}

/**
 * Listen for auth state changes.
 * Callback receives { user, userData } or null.
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }

    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        callback({ user, userData: { id: snap.id, ...snap.data() } });
      } else {
        callback(null);
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      callback(null);
    }
  });
}

/**
 * Get all user documents (admin only).
 */
export async function getUsers() {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Approve a user by UID.
 */
export async function approveUser(uid) {
  await updateDoc(doc(db, 'users', uid), { status: 'approved' });
}

/**
 * Reject a user by UID.
 */
export async function rejectUser(uid) {
  await updateDoc(doc(db, 'users', uid), { status: 'rejected' });
}
