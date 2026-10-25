// Firebase initialization — shared by client-portal.html and admin-panel.html.
// These web config values are public identifiers, not secrets; access is
// controlled by Firebase Authentication and security rules.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAzFA6z_JNuC9yaKMncbQ6JIMFRPhstCc0',
  authDomain: 'quest-for-wellness-1a0f4.firebaseapp.com',
  projectId: 'quest-for-wellness-1a0f4',
  storageBucket: 'quest-for-wellness-1a0f4.firebasestorage.app',
  messagingSenderId: '48058785449',
  appId: '1:48058785449:web:082788b8df5f39865913b8'
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Only this account may open the admin panel
export const ADMIN_EMAIL = 'questforwellness22@gmail.com';
