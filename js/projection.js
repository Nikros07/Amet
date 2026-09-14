import { state } from './state.js';
import { formatCurrency } from './format.js';

function expenseTotalsByCategory() {
    return state.transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
            const cat = t.category || 'Sonstige';
            acc[cat] = (acc[cat] || 0) + t.amount;
            return acc;
        }, {});
}

export function renderProjectionControls() {
    const container = document.getElementById('categoryReducers');
    const cur = state.settings.currency;
    const totals = Object.entries(expenseTotalsByCategory()).filter(([, amount]) => amount > 0);

    if (totals.length === 0) {
        container.innerHTML = '<p class="empty-hint">Erfasse zuerst ein paar Ausgaben, dann kannst du hier pro Kategorie eine Reduktion simulieren.</p>';
        return;
    }

    container.innerHTML = totals.map(([category, amount]) => `
        <div class="category-reducer">
            <label>${category}</label>
            <div>aktuell: ${formatCurrency(amount, cur)}/Monat</div>
            <input type="number" data-reducer="${category}" placeholder="%" min="0" max="100" value="0">
            <small>Reduktion</small>
        </div>
    `).join('');
}

export function calculateProjection() {
    const cur = state.settings.currency;
    const months = parseInt(document.getElementById('projectionMonths').value, 10) || 6;
    const currentSavingsRate = parseFloat(document.getElementById('savingsRate').value) || 0;

    let adjustedSavings = currentSavingsRate;
    document.querySelectorAll('[data-reducer]').forEach((input) => {
        const category = input.dataset.reducer;
        const amount = expenseTotalsByCategory()[category] || 0;
        const reductionPercent = parseFloat(input.value) || 0;
        adjustedSavings += amount * (reductionPercent / 100);
    });

    const projectedSavings = adjustedSavings * months;
    document.getElementById('projectionResult').innerHTML = `
        <h3>Ergebnis</h3>
        <p>Aktuelle monatliche Sparrate: <strong>${formatCurrency(currentSavingsRate, cur)}</strong></p>
        <p>Angepasste Sparrate (nach Reduktionen): <strong>${formatCurrency(adjustedSavings, cur)}</strong></p>
        <p>Projizierte Ersparnis in ${months} Monaten: <strong>${formatCurrency(projectedSavings, cur)}</strong></p>
        <p><em>Das ist dein zusätzlicher Vermögenszuwachs, wenn du die angegebenen Ausgaben reduzierst.</em></p>
    `;
}
