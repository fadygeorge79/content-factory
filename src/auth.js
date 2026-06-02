import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential
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
 * Re-authenticate the currently signed-in user with their password.
 * Used to confirm sensitive actions (e.g. deleting a project).
 * Throws Error('Incorrect password') when the password is wrong.
 */
export async function reauthenticate(password) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('You are not signed in');
  try {
    const cred = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, cred);
  } catch (err) {
    const code = err && err.code;
    if (
      code === 'auth/wrong-password' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/invalid-login-credentials'
    ) {
      throw new Error('Incorrect password');
    }
    if (code === 'auth/too-many-requests') {
      throw new Error('Too many attempts. Please try again later.');
    }
    throw new Error('Could not verify password. Please try again.');
  }
}

/**
 * Is the given user record an admin?
 */
export function isAdminUser(userData) {
  return !!userData && userData.role === 'admin';
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
