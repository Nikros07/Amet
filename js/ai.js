// KI-Assistent: Die App berechnet ALLE Zahlen selbst (siehe wallets.js,
// analytics.js) und schickt nur das fertige, strukturierte Ergebnis an die
// Supabase Edge Function, die es an OpenRouter weiterreicht. Die KI bekommt
// nie rohe Transaktionen und soll nie selbst rechnen — nur formulieren.

import { supabase } from './supabase-client.js';
import { state, findCategory } from './state.js';
import { getTotalWealth, getDirectlyAvailableStatus, getAllWalletBalances } from './wallets.js';
import { formatCurrency, parseLocalDate, parseLocaleNumber } from './format.js';

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
    const relevant = state.transactions.filter(t => parseLocalDate(t.date) >= cutoff);
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
        .filter(t => t.type === 'expense' && parseLocalDate(t.date) >= cutoff)
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

// Fällt zurück, wenn die Edge Function (noch) nicht deployed oder erreichbar
// ist (siehe Spec: "Wenn alle AI-Modelle nicht erreichbar sind: eine
// einfache lokale/rule-based Antwort verwenden"). Erkennt nur ein paar
// simple Muster — kein Ersatz für die echte KI, aber besser als nichts.
function localFallbackAnswer(question) {
    const cur = state.settings.currency;
    const s = computeFinancialSummary();
    const q = question.toLowerCase();

    const spendMatch = q.match(/(\d+(?:[.,]\d+)*)\s*€?.*(ausgeben|leisten|kaufen)/);
    if (spendMatch) {
        const amount = parseLocaleNumber(spendMatch[1]);
        const remaining = s.directlyAvailable.value - amount;
        const min = state.settings.direct_available_min;
        if (remaining >= min) {
            return `Ja, das sollte gehen — danach blieben dir ${formatCurrency(remaining, cur)} direkt verfügbar. (Lokale Schätzung, keine KI verbunden.)`;
        }
        return `Eher knapp — direkt verfügbar sind aktuell ${formatCurrency(s.directlyAvailable.value, cur)}, danach blieben nur ${formatCurrency(remaining, cur)} (Zielbereich ab ${formatCurrency(min, cur)}). (Lokale Schätzung, keine KI verbunden.)`;
    }

    if (/(wie steh|wie läuft|money|status)/.test(q)) {
        return `Gesamtvermögen ${formatCurrency(s.totalWealth, cur)}, direkt verfügbar ${formatCurrency(s.directlyAvailable.value, cur)} (${s.directlyAvailable.label}). (Lokale Schätzung, keine KI verbunden.)`;
    }

    if (/(wo.*geld|ausgegeben|kategorien)/.test(q)) {
        if (s.topExpenseCategoriesThisMonth.length === 0) {
            return 'Noch keine Ausgaben diesen Monat erfasst. (Lokale Schätzung, keine KI verbunden.)';
        }
        const top = s.topExpenseCategoriesThisMonth.map(c => `${c.name} (${formatCurrency(c.amount, cur)})`).join(', ');
        return `Diesen Monat bisher am meisten: ${top}. (Lokale Schätzung, keine KI verbunden.)`;
    }

    return `KI-Backend nicht erreichbar. Aktuell: ${formatCurrency(s.totalWealth, cur)} Gesamtvermögen, ${formatCurrency(s.directlyAvailable.value, cur)} direkt verfügbar.`;
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
            console.warn('AI-Backend nicht erreichbar, nutze lokalen Fallback:', err);
            history.push({ role: 'assistant', text: localFallbackAnswer(question) });
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
