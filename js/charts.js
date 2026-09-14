import { state } from './state.js';
import { formatCurrency } from './format.js';

const PALETTE = ['#d4af37', '#8b0000', '#c81e1e', '#a89a83', '#f4d675', '#5c4a2e', '#6b1414', '#e8c96a'];

Chart.defaults.color = '#a89a83';
Chart.defaults.borderColor = '#3a2f22';
Chart.defaults.font.family = "'Inter', sans-serif";

let expensePieChart = null;
let incomeBarChart = null;
let paymentMethodChart = null;

function byKey(transactions, keyFn) {
    return transactions.reduce((acc, t) => {
        const key = keyFn(t) || 'Sonstige';
        acc[key] = (acc[key] || 0) + t.amount;
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
    const expenses = state.transactions.filter(t => t.type === 'expense');
    const income = state.transactions.filter(t => t.type === 'income');
    const expenseData = byKey(expenses, t => t.category);
    const incomeData = byKey(income, t => t.category);
    const paymentData = byKey(expenses, t => t.paymentMethod);

    if (expensePieChart) expensePieChart.destroy();
    if (incomeBarChart) incomeBarChart.destroy();
    if (paymentMethodChart) paymentMethodChart.destroy();

    const expenseCtx = document.getElementById('expensePieChart');
    if (expenseCtx && Object.keys(expenseData).length > 0) {
        expensePieChart = new Chart(expenseCtx, {
            type: 'pie',
            data: {
                labels: Object.keys(expenseData),
                datasets: [{ data: Object.values(expenseData), backgroundColor: PALETTE, borderColor: '#14100d', borderWidth: 2 }]
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
                datasets: [{ label: state.settings.currency, data: Object.values(incomeData), backgroundColor: '#3bb54a', borderRadius: 4 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: '#3a2f22' } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { display: false }, tooltip: moneyTooltip() }
            }
        });
    }

    const paymentCtx = document.getElementById('paymentMethodChart');
    if (paymentCtx && Object.keys(paymentData).length > 0) {
        paymentMethodChart = new Chart(paymentCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(paymentData),
                datasets: [{ data: Object.values(paymentData), backgroundColor: PALETTE, borderColor: '#14100d', borderWidth: 2 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: { legend: { position: 'bottom' }, tooltip: moneyTooltip() }
            }
        });
    }
}
