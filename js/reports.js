import { state } from './state.js';
import { formatCurrency } from './format.js';

export function renderSummary() {
    const container = document.getElementById('summaryContainer');
    const incomeTotal = state.transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = state.transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    const net = incomeTotal - expenseTotal;
    const cur = state.settings.currency;

    container.innerHTML = `
        <div class="summary-card income">
            <h3>Gesamteinnahmen</h3>
            <div class="value">${formatCurrency(incomeTotal, cur)}</div>
        </div>
        <div class="summary-card expense">
            <h3>Gesamtausgaben</h3>
            <div class="value">${formatCurrency(expenseTotal, cur)}</div>
        </div>
        <div class="summary-card net">
            <h3>Netto</h3>
            <div class="value">${formatCurrency(net, cur)}</div>
        </div>
    `;
}

export function renderTaxReport() {
    const cur = state.settings.currency;
    const expensesByCategory = state.transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
            const cat = t.category || 'Sonstige';
            acc[cat] = (acc[cat] || 0) + t.amount;
            return acc;
        }, {});

    const rows = Object.entries(expensesByCategory);
    let totalDeductible = 0;
    let table = '<table class="tax-report-table"><thead><tr><th>Kategorie</th><th>Betrag</th></tr></thead><tbody>';
    for (const [category, amount] of rows) {
        table += `<tr><td>${category}</td><td>${formatCurrency(amount, cur)}</td></tr>`;
        totalDeductible += amount;
    }
    table += `<tr><td><strong>Gesamt abzugsfähig</strong></td><td><strong>${formatCurrency(totalDeductible, cur)}</strong></td></tr>`;
    table += '</tbody></table>';

    document.getElementById('taxReportContent').innerHTML = rows.length === 0
        ? '<p class="empty-hint">Noch keine Ausgaben erfasst — der Steuerbericht füllt sich, sobald du welche einträgst.</p>'
        : `
        <p>Basierend auf deinen Ausgaben hier ist eine Übersicht möglicher abzugsfähiger Beträge gemäß deiner Steuer-ID (SI): <strong>${state.settings.taxId || 'nicht gesetzt'}</strong>.</p>
        ${table}
        <p><em>Hinweis: Dies ist keine Steuerberatung. Konsultiere einen Steuerberater für verbindliche Auskünfte.</em></p>
    `;
}
