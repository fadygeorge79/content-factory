import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBhIpTpMaTWdTmm2z6OuslTQA9VzEu3ZP4",
  authDomain: "fady-content-factory.firebaseapp.com",
  projectId: "fady-content-factory",
  storageBucket: "fady-content-factory.firebasestorage.app",
  messagingSenderId: "66774491190",
  appId: "1:66774491190:web:c7e13f983c095697313897"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
