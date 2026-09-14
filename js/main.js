import { initAuth, setAuthCallbacks } from './auth.js';
import { loadAllFromDb } from './db.js';
import { resetState } from './state.js';
import { renderSummary, renderTaxReport } from './reports.js';
import { renderCharts } from './charts.js';
import { renderAnalyticsCharts, renderForecast } from './analytics.js';
import { renderDashboard } from './dashboard.js';
import {
    renderTransactionForm,
    renderTransactions,
    setOnChange as setTransactionsOnChange,
    setListFilters
} from './transactions.js';
import { renderSettingsForm, setOnChange as setSettingsOnChange } from './settings.js';
import { renderGoals, renderGoalAddRow, setOnChange as setGoalsOnChange } from './goals.js';
import { renderBudgets, renderBudgetAddRow, setOnChange as setBudgetsOnChange } from './budgets.js';
import { renderAiPanel } from './ai.js';
import { showToast } from './toast.js';

function renderApp() {
    renderDashboard();
    renderSummary();
    renderTaxReport();
    renderCharts();
    renderAnalyticsCharts();
    renderForecast();
    renderTransactionForm();
    renderTransactions();
    renderSettingsForm();
    renderGoalAddRow();
    renderGoals();
    renderBudgetAddRow();
    renderBudgets();
}

setTransactionsOnChange(renderApp);
setSettingsOnChange(renderApp);
setGoalsOnChange(renderApp);
setBudgetsOnChange(renderApp);

function wireStaticControls() {
    const searchInput = document.getElementById('transactionSearch');
    const typeFilter = document.getElementById('transactionTypeFilter');
    searchInput.addEventListener('input', () => setListFilters({ search: searchInput.value }));
    typeFilter.addEventListener('change', () => setListFilters({ type: typeFilter.value }));
}

function wireNavigation() {
    const buttons = document.querySelectorAll('.app-nav button');
    const sections = document.querySelectorAll('.view-section');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            buttons.forEach(b => b.classList.toggle('active', b === btn));
            sections.forEach(s => { s.hidden = s.dataset.view !== view; });
            if (view === 'ai') renderAiPanel();
        });
    });
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
    wireNavigation();
    initAuth();
});
