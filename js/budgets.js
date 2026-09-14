import { state, findCategory } from './state.js';
import { insertBudget, deleteBudget } from './db.js';
import { formatCurrency } from './format.js';
import { confirmDialog } from './modal.js';
import { showToast } from './toast.js';

let onChange = () => {};

export function setOnChange(fn) {
    onChange = fn;
}

function currentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function spentThisMonth(categoryId) {
    const now = new Date();
    return state.transactions
        .filter(t => t.type === 'expense' && t.category_id === categoryId)
        .filter(t => {
            const d = new Date(t.date);
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        })
        .reduce((sum, t) => sum + t.amount, 0);
}

export function renderBudgetAddRow() {
    const container = document.getElementById('budgetAddRow');
    if (!container) return;
    const categoryOptions = state.categories.expense
        .map(c => `<option value="${c.id}">${c.name}</option>`)
        .join('');

    container.innerHTML = `
        <select id="newBudgetCategory">${categoryOptions}</select>
        <input type="number" id="newBudgetLimit" placeholder="Limit pro Monat" min="1" step="1">
        <button type="button" id="addBudgetBtn" class="addBtn">Budget anlegen</button>
    `;

    document.getElementById('addBudgetBtn').addEventListener('click', async () => {
        const categoryId = document.getElementById('newBudgetCategory').value;
        const limit = parseFloat(document.getElementById('newBudgetLimit').value);
        if (!categoryId || isNaN(limit) || limit <= 0) {
            showToast('Bitte Kategorie und ein gültiges Limit angeben.', { type: 'error' });
            return;
        }
        const month = currentMonthKey();
        if (state.budgets.some(b => b.category_id === categoryId && b.month === month)) {
            showToast('Für diese Kategorie existiert diesen Monat schon ein Budget.', { type: 'error' });
            return;
        }
        try {
            await insertBudget({ category_id: categoryId, month, limit_amount: limit });
            showToast('Budget angelegt.', { type: 'success' });
            onChange();
        } catch (err) {
            showToast(`Anlegen fehlgeschlagen: ${err.message || err}`, { type: 'error' });
        }
    });
}

export function renderBudgets() {
    const container = document.getElementById('budgetsContainer');
    if (!container) return;
    const cur = state.settings.currency;
    const month = currentMonthKey();
    const thisMonthBudgets = state.budgets.filter(b => b.month === month);

    if (thisMonthBudgets.length === 0) {
        container.innerHTML = '<p class="empty-hint">Noch keine Budgets für diesen Monat. Leg oben eins an.</p>';
        return;
    }

    container.innerHTML = thisMonthBudgets.map(b => {
        const spent = spentThisMonth(b.category_id);
        const pct = Math.min(100, Math.round((spent / b.limit_amount) * 100));
        const over = spent > b.limit_amount;
        const categoryName = findCategory(b.category_id)?.name || 'Sonstiges';
        return `
            <div class="budget-card" data-id="${b.id}">
                <h4>${categoryName} <button type="button" class="deleteBudgetBtn" data-id="${b.id}" aria-label="Löschen">×</button></h4>
                <div class="progress-bar"><div class="progress-bar-fill ${over ? 'over-budget' : ''}" style="width:${pct}%"></div></div>
                <div class="progress-label">
                    <span>${formatCurrency(spent, cur)} / ${formatCurrency(b.limit_amount, cur)}</span>
                    <span>${pct}%</span>
                </div>
                ${over ? '<p class="field-error" style="margin-top:8px;">Limit überschritten.</p>' : ''}
            </div>
        `;
    }).join('');

    container.querySelectorAll('.deleteBudgetBtn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const ok = await confirmDialog('Dieses Budget wirklich löschen?');
            if (!ok) return;
            try {
                await deleteBudget(id);
                onChange();
            } catch (err) {
                showToast(`Löschen fehlgeschlagen: ${err.message || err}`, { type: 'error' });
            }
        });
    });
}
