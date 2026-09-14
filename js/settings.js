import { state } from './state.js';
import { confirmDialog } from './modal.js';
import { showToast } from './toast.js';

let onChange = () => {};

export function setOnChange(fn) {
    onChange = fn;
}

export function renderSettingsForm() {
    const container = document.getElementById('settingsContainer');
    container.innerHTML = `
        <h2>Einstellungen</h2>
        <form id="settingsForm" novalidate>
            <div class="settings-form">
                <div class="form-group">
                    <label for="taxId">Steuer-ID (SI)*</label>
                    <input type="text" id="taxId" value="${state.settings.taxId}">
                    <small>Für Steuerberichte benötigt</small>
                </div>
                <div class="form-group">
                    <label for="currency">Währung*</label>
                    <input type="text" id="currency" value="${state.settings.currency}" maxlength="3">
                    <small>z.B. EUR, USD, CHF</small>
                </div>
            </div>
            <div class="form-actions" style="margin-top: 20px;">
                <button type="submit" class="addBtn">Einstellungen speichern</button>
            </div>
            <div class="form-group">
                <label>Kategorien verwalten</label>
                <div id="categoryManager">
                    <div id="incomeCategories">
                        <h4>Einnahmen-Kategorien</h4>
                        <div id="incomeCategoryList" class="category-list"></div>
                        <input type="text" id="newIncomeCategory" placeholder="Neue Kategorie hinzufügen">
                        <button type="button" id="addIncomeCategory" class="addBtn">Hinzufügen</button>
                    </div>
                    <div id="expenseCategories">
                        <h4>Ausgaben-Kategorien</h4>
                        <div id="expenseCategoryList" class="category-list"></div>
                        <input type="text" id="newExpenseCategory" placeholder="Neue Kategorie hinzufügen">
                        <button type="button" id="addExpenseCategory" class="addBtn">Hinzufügen</button>
                    </div>
                </div>
            </div>
        </form>
    `;

    const form = document.getElementById('settingsForm');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        form.querySelectorAll('.field-error').forEach(el => el.remove());
        form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

        const taxId = form.taxId.value.trim();
        const currency = form.currency.value.trim().toUpperCase();
        let hasError = false;

        if (!taxId || taxId.length < 5) {
            markError(form.taxId, 'Mindestens 5 Zeichen.');
            hasError = true;
        }
        if (!currency || !/^[A-Z]{3}$/.test(currency)) {
            markError(form.currency, '3 Buchstaben, z.B. EUR.');
            hasError = true;
        }
        if (hasError) return;

        state.settings.taxId = taxId;
        state.settings.currency = currency;
        showToast('Einstellungen gespeichert.', { type: 'success' });
        onChange();
    });

    renderCategoryManager();
}

function markError(input, message) {
    input.classList.add('input-error');
    const msg = document.createElement('small');
    msg.className = 'field-error';
    msg.textContent = message;
    input.insertAdjacentElement('afterend', msg);
}

function renderCategoryManager() {
    const incomeList = document.getElementById('incomeCategoryList');
    const expenseList = document.getElementById('expenseCategoryList');

    incomeList.innerHTML = state.categories.income
        .map(cat => `<span class="category-tag">${cat}<button type="button" data-type="income" data-category="${cat}">×</button></span>`)
        .join('');
    expenseList.innerHTML = state.categories.expense
        .map(cat => `<span class="category-tag">${cat}<button type="button" data-type="expense" data-category="${cat}">×</button></span>`)
        .join('');

    document.querySelectorAll('.category-tag button').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const { type, category } = e.currentTarget.dataset;
            const ok = await confirmDialog(`Kategorie "${category}" wirklich löschen? Bestehende Transaktionen behalten sie als Text.`);
            if (!ok) return;
            state.categories[type] = state.categories[type].filter(c => c !== category);
            onChange();
        });
    });

    bindAddCategory('addIncomeCategory', 'newIncomeCategory', 'income');
    bindAddCategory('addExpenseCategory', 'newExpenseCategory', 'expense');
}

function bindAddCategory(buttonId, inputId, type) {
    const button = document.getElementById(buttonId);
    const input = document.getElementById(inputId);
    const submit = () => {
        const category = input.value.trim();
        if (!category) return;
        if (state.categories[type].includes(category)) {
            showToast(`"${category}" existiert schon.`, { type: 'error' });
            return;
        }
        state.categories[type].push(category);
        onChange();
    };
    button.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
}
