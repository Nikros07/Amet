import { initAuth, setAuthCallbacks } from './auth.js';
import { loadAllFromDb } from './db.js';
import { resetState } from './state.js';
import { renderSummary, renderTaxReport } from './reports.js';
import { renderCharts } from './charts.js';
import { renderDashboard } from './dashboard.js';
import {
    renderTransactionForm,
    renderTransactions,
    setOnChange as setTransactionsOnChange,
    setListFilters
} from './transactions.js';
import { renderSettingsForm, setOnChange as setSettingsOnChange } from './settings.js';
import { showToast } from './toast.js';

function renderApp() {
    renderDashboard();
    renderSummary();
    renderTaxReport();
    renderCharts();
    renderTransactionForm();
    renderTransactions();
    renderSettingsForm();
}

setTransactionsOnChange(renderApp);
setSettingsOnChange(renderApp);

function wireStaticControls() {
    const searchInput = document.getElementById('transactionSearch');
    const typeFilter = document.getElementById('transactionTypeFilter');
    searchInput.addEventListener('input', () => setListFilters({ search: searchInput.value }));
    typeFilter.addEventListener('change', () => setListFilters({ type: typeFilter.value }));
}

// Supabase feuert onAuthStateChange nicht nur bei einem echten Login neu,
// sondern u.a. auch beim Zurückkommen in den Tab (Fokus-/Sichtbarkeitswechsel,
// Token-Refresh). Ohne diese Sperre würde jeder Tab-Wechsel einen kompletten
// Neu-Ladevorgang aller Tabellen auslösen.
let loadedForUserId = null;
let loadInFlight = false;

setAuthCallbacks({
    signedIn: async (session) => {
        if (loadInFlight || loadedForUserId === session.user.id) return;
        loadInFlight = true;
        try {
            await loadAllFromDb(session.user.id);
            renderApp();
            loadedForUserId = session.user.id;
        } catch (err) {
            console.error(err);
            showToast(`Daten konnten nicht geladen werden: ${err.message || err}`, { type: 'error', duration: 8000 });
        } finally {
            loadInFlight = false;
        }
    },
    signedOut: () => {
        resetState();
        loadedForUserId = null;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    wireStaticControls();
    initAuth();
});
