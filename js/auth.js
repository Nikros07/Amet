import { supabase, isConfigured } from './supabase-client.js';
import { showToast } from './toast.js';

let onSignedIn = () => {};
let onSignedOut = () => {};

export function setAuthCallbacks({ signedIn, signedOut }) {
    onSignedIn = signedIn || onSignedIn;
    onSignedOut = signedOut || onSignedOut;
}

function showLogin(message) {
    document.getElementById('appRoot').hidden = true;
    const login = document.getElementById('loginScreen');
    login.hidden = false;
    if (message) {
        document.getElementById('loginError').textContent = message;
    }
}

function showApp() {
    document.getElementById('loginScreen').hidden = true;
    document.getElementById('appRoot').hidden = false;
}

export async function initAuth() {
    if (!isConfigured) {
        showLogin('Supabase ist noch nicht konfiguriert — trag Projekt-URL und anon key in js/config.js ein.');
        document.getElementById('loginForm').querySelector('button').disabled = true;
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        showApp();
        onSignedIn(session);
    } else {
        showLogin();
    }

    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            showApp();
            onSignedIn(session);
        } else if (event === 'SIGNED_OUT') {
            showLogin();
            onSignedOut();
        }
    });

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        document.getElementById('loginError').textContent = '';

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            document.getElementById('loginError').textContent = 'Login fehlgeschlagen: E-Mail oder Passwort falsch.';
        }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        showToast('Abgemeldet.', { type: 'info' });
    });
}
