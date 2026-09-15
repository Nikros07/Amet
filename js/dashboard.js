import { state, findCategory, findWallet } from './state.js';
import { getTotalWealth, getWalletByKey, getWalletBalance, getDirectlyAvailableStatus } from './wallets.js';
import { formatCurrency, formatDate, parseLocalDate } from './format.js';
import { parseQuickEntry } from './quick-entry.js';
import { prefillForm } from './transactions.js';
import { showToast } from './toast.js';

function walletCard(key, label) {
    const wallet = getWalletByKey(key);
    const balance = wallet ? getWalletBalance(wallet.id) : 0;
    return `
        <div class="wallet-card wallet-${key}">
            <h3>${label}</h3>
            <div class="value">${formatCurrency(balance, state.settings.currency)}</div>
        </div>
    `;
}

function periodStatsRange(fromDate, toDate) {
    const relevant = state.transactions.filter(t => {
        const d = parseLocalDate(t.date);
        return d >= fromDate && d < toDate;
    });
    const income = relevant.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = relevant.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense, net: income - expense };
}

// Vergleich zur direkt vorangegangenen, gleich langen Periode (Spec: "Entwicklung
// gegenüber vorherigen Zeiträumen"). Bei einer Vorperiode von 0 ist ein Prozent-
// Vergleich bedeutungslos (Division durch 0 bzw. "unendlich % mehr") — dann wird
// nur die absolute Differenz gezeigt statt einer irreführenden Prozentzahl.
function trendVsPrevious(current, previous) {
    const diff = current.net - previous.net;
    if (previous.net === 0) {
        if (diff === 0) return null;
        return { diff, pct: null };
    }
    return { diff, pct: Math.round((diff / Math.abs(previous.net)) * 100) };
}

function recapRow(label, stats, prevStats, cur) {
    const sign = stats.net >= 0 ? '+' : '';
    const trend = trendVsPrevious(stats, prevStats);
    let trendHtml = '';
    if (trend) {
        const arrow = trend.diff >= 0 ? '▲' : '▼';
        const trendClass = trend.diff >= 0 ? 'trend-up' : 'trend-down';
        const trendText = trend.pct === null
            ? `${arrow} ${formatCurrency(Math.abs(trend.diff), cur)} ggü. Vorperiode`
            : `${arrow} ${Math.abs(trend.pct)}% ggü. Vorperiode`;
        trendHtml = `<span class="recap-trend ${trendClass}">${trendText}</span>`;
    }
    return `
        <div class="recap-row">
            <span>${label}${trendHtml}</span>
            <span class="recap-figures">
                <span class="recent-amount recent-income">+${formatCurrency(stats.income, cur)}</span>
                <span class="recent-amount recent-expense">−${formatCurrency(stats.expense, cur)}</span>
                <strong>${sign}${formatCurrency(stats.net, cur)}</strong>
            </span>
        </div>
    `;
}

export function renderDashboard() {
    const container = document.getElementById('dashboardContainer');
    if (!container) return;

    const cur = state.settings.currency;
    const totalWealth = getTotalWealth();
    const directStatus = getDirectlyAvailableStatus();

    const recent = state.transactions.slice(0, 5).map(t => {
        const label = t.type === 'transfer'
            ? `${findWallet(t.wallet_id)?.name || '?'} → ${findWallet(t.to_wallet_id)?.name || '?'}`
            : findCategory(t.category_id)?.name || 'Sonstiges';
        const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
        return `
            <li class="recent-item">
                <span class="recent-label">${label}</span>
                <span class="recent-date">${formatDate(t.date)}</span>
                <span class="recent-amount recent-${t.type}">${sign}${formatCurrency(t.amount, cur)}</span>
            </li>
        `;
    }).join('') || '<li class="empty-hint">Noch keine Transaktionen.</li>';

    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14);
    const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 30);
    const twoMonthsAgo = new Date(now); twoMonthsAgo.setDate(now.getDate() - 60);
    const weekStats = periodStatsRange(weekAgo, now);
    const prevWeekStats = periodStatsRange(twoWeeksAgo, weekAgo);
    const monthStats = periodStatsRange(monthAgo, now);
    const prevMonthStats = periodStatsRange(twoMonthsAgo, monthAgo);

    container.innerHTML = `
        <div class="total-wealth-block">
            <h3>Total Wealth</h3>
            <div class="total-wealth-value">${formatCurrency(totalWealth, cur)}</div>
        </div>

        <div class="wallet-grid">
            <div class="wallet-card wallet-direct status-${directStatus.status}">
                <h3>Directly Available</h3>
                <div class="value">${formatCurrency(directStatus.value, cur)}</div>
                <small>${directStatus.label}</small>
            </div>
            ${walletCard('account', 'Account')}
            ${walletCard('phone_cash', 'Phone Cash')}
            ${walletCard('brother', 'Brother')}
        </div>

        <div class="quick-entry">
            <label for="quickEntryInput">Schnelleingabe</label>
            <div class="quick-entry-row">
                <input type="text" id="quickEntryInput" placeholder="+80 Arbeit · -12 Essen · 50 Konto zu Bruder" autocomplete="off">
                <button type="button" id="quickEntrySubmit" class="addBtn">Erkennen</button>
            </div>
            <small id="quickEntryHint" class="field-hint"></small>
        </div>

        <div class="recent-transactions">
            <h3>Recap</h3>
            <div class="recap-list">
                ${recapRow('Diese Woche', weekStats, prevWeekStats, cur)}
                ${recapRow('Diesen Monat', monthStats, prevMonthStats, cur)}
            </div>
        </div>

        <div class="recent-transactions">
            <h3>Letzte Transaktionen</h3>
            <ul class="recent-list">${recent}</ul>
        </div>
    `;

    const input = document.getElementById('quickEntryInput');
    const submit = document.getElementById('quickEntrySubmit');
    const hint = document.getElementById('quickEntryHint');

    const handleQuickEntry = () => {
        const parsed = parseQuickEntry(input.value);
        if (!parsed) {
            hint.textContent = 'Nicht erkannt — Formate: "+80 Arbeit", "-12 Essen", "50 Konto zu Bruder".';
            return;
        }
        hint.textContent = '';
        input.value = '';
        prefillForm(parsed);
        showToast('Vorschlag ins Formular übernommen — bitte prüfen und bestätigen.', { type: 'info' });
        document.getElementById('formContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    submit.addEventListener('click', handleQuickEntry);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleQuickEntry(); }
    });
}
