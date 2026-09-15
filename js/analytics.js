import { state } from './state.js';
import { formatCurrency, parseLocalDate } from './format.js';

let netWorthChart = null;
let incomeExpenseChart = null;

function monthKey(dateStr) {
    const d = parseLocalDate(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function computeNetWorthByDay() {
    const sorted = [...state.transactions].sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));
    let total = 0;
    const byDay = new Map();
    for (const t of sorted) {
        if (t.type === 'income') total += t.amount;
        else if (t.type === 'expense') total -= t.amount;
        byDay.set(t.date, total); // Transfers verändern das Gesamtvermögen nicht
    }
    return [...byDay.entries()].map(([date, value]) => ({ date, value }));
}

function computeMonthlyIncomeExpense() {
    const byMonth = {};
    state.transactions.forEach(t => {
        if (t.type !== 'income' && t.type !== 'expense') return;
        const key = monthKey(t.date);
        byMonth[key] = byMonth[key] || { income: 0, expense: 0 };
        byMonth[key][t.type] += t.amount;
    });
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b));
}

export function renderAnalyticsCharts() {
    const cur = state.settings.currency;

    const netWorthCtx = document.getElementById('netWorthChart');
    if (netWorthChart) netWorthChart.destroy();
    const series = computeNetWorthByDay();
    if (netWorthCtx && series.length > 0) {
        netWorthChart = new Chart(netWorthCtx, {
            type: 'line',
            data: {
                labels: series.map(p => p.date),
                datasets: [{
                    data: series.map(p => p.value),
                    borderColor: '#c8a24d',
                    backgroundColor: 'rgba(200, 162, 77, 0.1)',
                    fill: true,
                    tension: 0.25,
                    pointRadius: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => formatCurrency(ctx.parsed.y, cur) } }
                },
                scales: {
                    y: { grid: { color: '#262a30' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    const ieCtx = document.getElementById('incomeExpenseChart');
    if (incomeExpenseChart) incomeExpenseChart.destroy();
    const monthly = computeMonthlyIncomeExpense();
    if (ieCtx && monthly.length > 0) {
        incomeExpenseChart = new Chart(ieCtx, {
            type: 'bar',
            data: {
                labels: monthly.map(([m]) => m),
                datasets: [
                    { label: 'Einnahmen', data: monthly.map(([, v]) => v.income), backgroundColor: '#4f9d6e' },
                    { label: 'Ausgaben', data: monthly.map(([, v]) => v.expense), backgroundColor: '#b0554a' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y, cur)}` } }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#262a30' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
}

export function renderForecast() {
    const container = document.getElementById('forecastContainer');
    if (!container) return;
    const cur = state.settings.currency;

    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const thisMonthNet = state.transactions
        .filter(t => {
            const d = parseLocalDate(t.date);
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        })
        .reduce((sum, t) => {
            if (t.type === 'income') return sum + t.amount;
            if (t.type === 'expense') return sum - t.amount;
            return sum;
        }, 0);

    if (dayOfMonth < 2) {
        container.innerHTML = '<p class="empty-hint">Noch zu früh im Monat für eine sinnvolle Schätzung.</p>';
        return;
    }

    const dailyAverage = thisMonthNet / dayOfMonth;
    const projected = dailyAverage * daysInMonth;

    container.innerHTML = `
        <p>Bisher diesen Monat: <strong>${formatCurrency(thisMonthNet, cur)}</strong> Netto (Tag ${dayOfMonth} von ${daysInMonth}).</p>
        <p>Hochgerechnet aufs Monatsende: <strong>${formatCurrency(projected, cur)}</strong></p>
        <p class="field-hint">Einfache lineare Schätzung basierend auf deinem bisherigen Tagesdurchschnitt — keine Prognose im eigentlichen Sinn, nur eine grobe Richtung.</p>
    `;
}
