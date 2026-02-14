import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { ref, set, onValue, update, push, query, orderByChild, limitToLast, serverTimestamp } from 'firebase/database';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDAEbCwIrpBmC-hSDEHcKquU-jXX6C1Q4E",
  authDomain: "reakt-v2-f5e46.firebaseapp.com",
  databaseURL: "https://reakt-v2-f5e46-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "reakt-v2-f5e46",
  storageBucket: "reakt-v2-f5e46.firebasestorage.app",
  messagingSenderId: "109598378592",
  appId: "1:109598378592:web:9bf5f3539478a20f5c9105"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export { ref, set, onValue, update, push, query, orderByChild, limitToLast, serverTimestamp, storageRef as sRef, uploadBytesResumable, getDownloadURL, onAuthStateChanged, signInAnonymously };