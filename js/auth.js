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

    // Formular-Handler zuerst binden, BEVOR irgendein await läuft — falls
    // getSession() hängt oder wirft, soll der Login trotzdem klickbar sein.
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        document.getElementById('loginError').textContent = '';

        const submitBtn = document.getElementById('loginForm').querySelector('button');
        submitBtn.disabled = true;

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                document.getElementById('loginError').textContent = `Login fehlgeschlagen: ${error.message} (Status ${error.status ?? '?'})`;
                submitBtn.disabled = false;
                return;
            }
            // Voller Reload statt Live-Umschaltung: nutzt denselben Init-Pfad,
            // der eine bestehende Session beim Laden zuverlässig erkennt. Kurze
            // Pause davor, falls das Schreiben der Session in den Storage noch
            // nicht ganz abgeschlossen ist, wenn signInWithPassword auflöst.
            await new Promise((resolve) => setTimeout(resolve, 150));
            window.location.reload();
        } catch (err) {
            console.error('Login-Fehler:', err);
            document.getElementById('loginError').textContent = `Unerwarteter Fehler: ${err.message || err}`;
            submitBtn.disabled = false;
        }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        showToast('Abgemeldet.', { type: 'info' });
    });

    try {
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
    } catch (err) {
        console.error('Auth-Initialisierung fehlgeschlagen:', err);
        showLogin(`Verbindung zu Supabase fehlgeschlagen: ${err.message || err}`);
    }
}
