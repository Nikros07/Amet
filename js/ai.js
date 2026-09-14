// KI-Assistent: Die App berechnet ALLE Zahlen selbst (siehe wallets.js,
// analytics.js) und schickt nur das fertige, strukturierte Ergebnis an die
// Supabase Edge Function, die es an OpenRouter weiterreicht. Die KI bekommt
// nie rohe Transaktionen und soll nie selbst rechnen — nur formulieren.

import { supabase } from './supabase-client.js';
import { state, findCategory } from './state.js';
import { getTotalWealth, getDirectlyAvailableStatus, getAllWalletBalances } from './wallets.js';
import { showToast } from './toast.js';

const QUICK_ACTIONS = [
    'Wie steh ich?',
    'Kann ich heute 50€ ausgeben?',
    'Wo ist mein Geld hin?',
    'Wie läuft dieser Monat?'
];

let history = [];

function periodTotals(days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const relevant = state.transactions.filter(t => new Date(t.date) >= cutoff);
    return {
        income: relevant.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        expense: relevant.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    };
}

function topExpenseCategories(days, limit = 3) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const byCategory = {};
    state.transactions
        .filter(t => t.type === 'expense' && new Date(t.date) >= cutoff)
        .forEach(t => {
            const name = findCategory(t.category_id)?.name || 'Sonstiges';
            byCategory[name] = (byCategory[name] || 0) + t.amount;
        });
    return Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, amount]) => ({ name, amount }));
}

/** Baut die strukturierte Zusammenfassung, die die KI als einzige Datenquelle bekommt. */
export function computeFinancialSummary() {
    return {
        currency: state.settings.currency,
        totalWealth: getTotalWealth(),
        directlyAvailable: getDirectlyAvailableStatus(),
        wallets: getAllWalletBalances(),
        today: periodTotals(1),
        thisWeek: periodTotals(7),
        thisMonth: periodTotals(30),
        topExpenseCategoriesThisMonth: topExpenseCategories(30),
        goals: state.goals.map(g => ({ name: g.name, target: g.target_amount, current: g.current_amount })),
        budgets: state.budgets.map(b => ({
            category: findCategory(b.category_id)?.name || 'Sonstiges',
            limit: b.limit_amount
        }))
    };
}

export async function askAI(question) {
    const summary = computeFinancialSummary();
    const { data, error } = await supabase.functions.invoke('ai-advisor', {
        body: { question, summary }
    });
    if (error) throw error;
    return data.answer;
}

export function renderAiPanel() {
    const container = document.getElementById('aiContainer');
    if (!container) return;

    container.innerHTML = `
        <h2 class="ai-heading">AMET AI</h2>
        <p class="ai-subheading">Your Private Financial Assistant</p>
        <div class="ai-quick-actions">
            ${QUICK_ACTIONS.map(q => `<button type="button" class="ai-quick-btn" data-q="${q}">${q}</button>`).join('')}
        </div>
        <div class="ai-input-row">
            <input type="text" id="aiInput" placeholder="Frag was zu deinen Finanzen…">
            <button type="button" id="aiAskBtn" class="addBtn">Fragen</button>
        </div>
        <div class="ai-history" id="aiHistory"></div>
    `;

    renderHistory();

    const input = document.getElementById('aiInput');
    const ask = async (question) => {
        if (!question.trim()) return;
        history.push({ role: 'user', text: question });
        renderHistory();
        input.value = '';
        try {
            const answer = await askAI(question);
            history.push({ role: 'assistant', text: answer });
        } catch (err) {
            history.push({ role: 'error', text: `KI nicht erreichbar: ${err.message || err}` });
        }
        renderHistory();
    };

    document.getElementById('aiAskBtn').addEventListener('click', () => ask(input.value));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); ask(input.value); }
    });
    container.querySelectorAll('.ai-quick-btn').forEach(btn => {
        btn.addEventListener('click', () => ask(btn.dataset.q));
    });
}

function renderHistory() {
    const el = document.getElementById('aiHistory');
    if (!el) return;
    el.innerHTML = history.map(m => `<div class="ai-message ${m.role}">${m.text}</div>`).join('');
    el.scrollTop = el.scrollHeight;
}
