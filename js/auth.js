import { supabase, isConfigured } from './supabase-client.js';
import { showToast } from './toast.js';

// Persistentes Debug-Log, das einen window.location.reload() übersteht (die
// normale Konsole wird dabei geleert). Zeigt sich klein unter dem Login-
// Formular. Entfernen, sobald der Login-Flow zuverlässig läuft.
const DEBUG_KEY = 'amet-auth-debug-log';
function debugLog(msg) {
    try {
        const log = JSON.parse(sessionStorage.getItem(DEBUG_KEY) || '[]');
        log.push(`${new Date().toISOString().slice(11, 19)} ${msg}`);
        sessionStorage.setItem(DEBUG_KEY, JSON.stringify(log.slice(-20)));
    } catch { /* sessionStorage evtl. blockiert */ }
    renderDebugLog();
}
function renderDebugLog() {
    let el = document.getElementById('authDebugLog');
    if (!el) {
        el = document.createElement('pre');
        el.id = 'authDebugLog';
        el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:40vh;overflow:auto;background:#000;color:#0f0;font-size:11px;padding:8px;margin:0;z-index:9999;white-space:pre-wrap;';
        document.body.appendChild(el);
    }
    try {
        const log = JSON.parse(sessionStorage.getItem(DEBUG_KEY) || '[]');
        el.textContent = log.join('\n');
    } catch { /* ignore */ }
}

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
    renderDebugLog();
    debugLog('initAuth() gestartet');

    if (!isConfigured) {
        debugLog('nicht konfiguriert -> zeige Hinweis');
        showLogin('Supabase ist noch nicht konfiguriert — trag Projekt-URL und anon key in js/config.js ein.');
        document.getElementById('loginForm').querySelector('button').disabled = true;
        return;
    }

    // Formular-Handler zuerst binden, BEVOR irgendein await läuft — falls
    // getSession() hängt oder wirft, soll der Login trotzdem klickbar sein.
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        debugLog('Formular submitted');
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        document.getElementById('loginError').textContent = '';

        const submitBtn = document.getElementById('loginForm').querySelector('button');
        submitBtn.disabled = true;

        try {
            debugLog('rufe signInWithPassword auf...');
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                debugLog(`signIn Fehler: ${error.message} (${error.status})`);
                document.getElementById('loginError').textContent = `Login fehlgeschlagen: ${error.message} (Status ${error.status ?? '?'})`;
                submitBtn.disabled = false;
                return;
            }
            debugLog(`signIn OK, session vorhanden: ${!!data.session}, user: ${data.session?.user?.email}`);
            debugLog(`localStorage sb-Key vorhanden: ${Object.keys(localStorage).some(k => k.includes('sb-'))}`);

            // Voller Reload statt Live-Umschaltung: nutzt denselben Init-Pfad,
            // der eine bestehende Session beim Laden zuverlässig erkennt. Kurze
            // Pause davor, falls das Schreiben der Session in den Storage noch
            // nicht ganz abgeschlossen ist, wenn signInWithPassword auflöst.
            await new Promise((resolve) => setTimeout(resolve, 150));
            debugLog('reloade Seite jetzt...');
            window.location.reload();
        } catch (err) {
            debugLog(`EXCEPTION beim Login: ${err.message || err}`);
            console.error('Login-Fehler:', err);
            document.getElementById('loginError').textContent = `Unerwarteter Fehler: ${err.message || err}`;
            submitBtn.disabled = false;
        }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        debugLog('Logout geklickt');
        await supabase.auth.signOut();
        showToast('Abgemeldet.', { type: 'info' });
    });

    try {
        debugLog('rufe getSession() auf...');
        const { data: { session } } = await supabase.auth.getSession();
        debugLog(`getSession() -> session vorhanden: ${!!session}${session ? ', user: ' + session.user.email : ''}`);
        if (session) {
            debugLog('-> showApp() + onSignedIn()');
            showApp();
            onSignedIn(session);
        } else {
            debugLog('-> showLogin()');
            showLogin();
        }

        supabase.auth.onAuthStateChange((event, session) => {
            debugLog(`onAuthStateChange Event: ${event}, session: ${!!session}`);
            if (event === 'SIGNED_IN' && session) {
                showApp();
                onSignedIn(session);
            } else if (event === 'SIGNED_OUT') {
                showLogin();
                onSignedOut();
            }
        });
    } catch (err) {
        debugLog(`EXCEPTION bei getSession(): ${err.message || err}`);
        console.error('Auth-Initialisierung fehlgeschlagen:', err);
        showLogin(`Verbindung zu Supabase fehlgeschlagen: ${err.message || err}`);
    }
}
