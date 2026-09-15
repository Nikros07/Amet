import { state, findCategory } from './state.js';
import { formatCurrency } from './format.js';

// Palette matches the CSS custom properties in style.css (gold/green/red/navy
// plus a few muted tints) — this used to be a leftover reddish-gold "mafia"
// palette from an earlier design pass that didn't match the app's theme.
const PALETTE = ['#c8a24d', '#4f9d6e', '#b0554a', '#34506e', '#86898f', '#e0c384', '#7ba98f', '#5b6472'];

Chart.defaults.color = '#86898f';
Chart.defaults.borderColor = '#262a30';
Chart.defaults.font.family = "'Inter', sans-serif";

let expensePieChart = null;
let incomeBarChart = null;

function byCategory(transactions) {
    return transactions.reduce((acc, t) => {
        const name = findCategory(t.category_id)?.name || 'Sonstiges';
        acc[name] = (acc[name] || 0) + t.amount;
        return acc;
    }, {});
}

function moneyTooltip() {
    return {
        callbacks: {
            label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed.y ?? ctx.parsed, state.settings.currency)}`
        }
    };
}

export function renderCharts() {
    const expenseData = byCategory(state.transactions.filter(t => t.type === 'expense'));
    const incomeData = byCategory(state.transactions.filter(t => t.type === 'income'));

    if (expensePieChart) expensePieChart.destroy();
    if (incomeBarChart) incomeBarChart.destroy();

    const expenseCtx = document.getElementById('expensePieChart');
    if (expenseCtx && Object.keys(expenseData).length > 0) {
        expensePieChart = new Chart(expenseCtx, {
            type: 'pie',
            data: {
                labels: Object.keys(expenseData),
                datasets: [{ data: Object.values(expenseData), backgroundColor: PALETTE, borderColor: '#0a0b0d', borderWidth: 2 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' }, tooltip: moneyTooltip() }
            }
        });
    }

    const incomeCtx = document.getElementById('incomeBarChart');
    if (incomeCtx && Object.keys(incomeData).length > 0) {
        incomeBarChart = new Chart(incomeCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(incomeData),
                datasets: [{ label: state.settings.currency, data: Object.values(incomeData), backgroundColor: '#4f9d6e', borderRadius: 4 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: '#262a30' } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { display: false }, tooltip: moneyTooltip() }
            }
        });
    }
}
