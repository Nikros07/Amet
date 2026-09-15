import { state, WALLET_LABELS } from './state.js';
import { updateSettings, insertCategory, deleteCategory, updateWalletOpeningBalance, resetAllData } from './db.js';
import { confirmDialog } from './modal.js';
import { showToast } from './toast.js';

let onChange = () => {};

export function setOnChange(fn) {
    onChange = fn;
}

export function renderSettingsForm() {
    const container = document.getElementById('settingsContainer');
    const s = state.settings;
    container.innerHTML = `
        <h2>Einstellungen</h2>
        <form id="settingsForm" novalidate>
            <div class="settings-form">
                <div class="form-group">
                    <label for="directMin">Direkt verfügbar — Minimum*</label>
                    <input type="number" id="directMin" data-field="directMin" step="1" min="0" value="${s.direct_available_min}">
                    <small>Konto + Handyhülle sollen normalerweise nicht darunter fallen</small>
                </div>
                <div class="form-group">
                    <label for="directMax">Direkt verfügbar — Maximum*</label>
                    <input type="number" id="directMax" data-field="directMax" step="1" min="0" value="${s.direct_available_max}">
                    <small>Alles darüber gehört als Reserve zum Bruder</small>
                </div>
                <div class="form-group">
                    <label for="currency">Währung*</label>
                    <input type="text" id="currency" data-field="currency" value="${s.currency}" maxlength="3">
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

        <div class="form-group">
            <label>Wallets &amp; Anfangssaldo</label>
            <small>Betrag, den ein Wallet schon hatte, bevor du angefangen hast, ihn in AMET zu erfassen. Spätere Transaktionen werden ab diesem Wert weitergerechnet.</small>
            <div id="walletBalanceList" class="wallet-balance-list"></div>
        </div>

        <div class="danger-zone">
            <h3>Danger Zone</h3>
            <p>Löscht unwiderruflich alle Transaktionen, Ziele und Budgets und setzt alle Anfangssalden auf 0. Kategorien, Einstellungen und dein Login-Zugang bleiben erhalten — ein kompletter Neustart mit leerem Verlauf.</p>
            <div class="danger-zone-confirm">
                <input type="text" id="resetConfirmInput" placeholder='Tippe ZURÜCKSETZEN zum Bestätigen' autocomplete="off">
                <button type="button" id="resetAllBtn" class="dangerBtn" disabled>Alles zurücksetzen</button>
            </div>
        </div>
    `;

    const form = document.getElementById('settingsForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        form.querySelectorAll('.field-error').forEach(el => el.remove());
        form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

        const directMin = parseFloat(form.directMin.value);
        const directMax = parseFloat(form.directMax.value);
        const currency = form.currency.value.trim().toUpperCase();
        let hasError = false;

        if (isNaN(directMin) || directMin < 0) { markError(form.directMin, 'Ungültiger Wert.'); hasError = true; }
        if (isNaN(directMax) || directMax <= directMin) { markError(form.directMax, 'Muss größer als Minimum sein.'); hasError = true; }
        if (!currency || !/^[A-Z]{3}$/.test(currency)) { markError(form.currency, '3 Buchstaben, z.B. EUR.'); hasError = true; }
        if (hasError) return;

        try {
            await updateSettings({ direct_available_min: directMin, direct_available_max: directMax, currency });
            showToast('Einstellungen gespeichert.', { type: 'success' });
            onChange();
        } catch (err) {
            showToast(`Speichern fehlgeschlagen: ${err.message || err}`, { type: 'error' });
        }
    });

    renderCategoryManager();
    renderWalletBalances();
    wireDangerZone();
}

function renderWalletBalances() {
    const container = document.getElementById('walletBalanceList');
    if (!container) return;

    container.innerHTML = state.wallets.map(w => `
        <div class="wallet-balance-row" data-id="${w.id}">
            <label for="opening-${w.id}">${WALLET_LABELS[w.key] || w.name}</label>
            <input type="number" id="opening-${w.id}" step="0.01" min="0" value="${w.opening_balance ?? 0}">
            <button type="button" class="saveWalletBalanceBtn" data-id="${w.id}">Speichern</button>
        </div>
    `).join('');

    container.querySelectorAll('.saveWalletBalanceBtn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const input = document.getElementById(`opening-${id}`);
            const value = parseFloat(input.value);
            if (isNaN(value) || value < 0) {
                showToast('Ungültiger Betrag — Wallets können nicht negativ starten.', { type: 'error' });
                return;
            }
            btn.disabled = true;
            try {
                await updateWalletOpeningBalance(id, value);
                showToast('Anfangssaldo gespeichert.', { type: 'success' });
                onChange();
            } catch (err) {
                showToast(`Speichern fehlgeschlagen: ${err.message || err}`, { type: 'error' });
                btn.disabled = false;
            }
        });
    });
}

function wireDangerZone() {
    const input = document.getElementById('resetConfirmInput');
    const button = document.getElementById('resetAllBtn');
    if (!input || !button) return;

    input.addEventListener('input', () => {
        button.disabled = input.value.trim() !== 'ZURÜCKSETZEN';
    });

    button.addEventListener('click', async () => {
        const ok = await confirmDialog('Wirklich ALLE Transaktionen, Ziele und Budgets löschen und Anfangssalden auf 0 setzen? Das kann nicht rückgängig gemacht werden.');
        if (!ok) return;
        button.disabled = true;
        try {
            await resetAllData();
            showToast('Zurückgesetzt — bereit für einen frischen Start.', { type: 'success' });
            onChange();
        } catch (err) {
            showToast(`Zurücksetzen fehlgeschlagen: ${err.message || err}`, { type: 'error' });
            button.disabled = false;
        }
    });
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
        .map(c => `<span class="category-tag">${c.name}<button type="button" data-type="income" data-id="${c.id}" data-name="${c.name}">×</button></span>`)
        .join('');
    expenseList.innerHTML = state.categories.expense
        .map(c => `<span class="category-tag">${c.name}<button type="button" data-type="expense" data-id="${c.id}" data-name="${c.name}">×</button></span>`)
        .join('');

    document.querySelectorAll('.category-tag button').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const { type, id, name } = e.currentTarget.dataset;
            const ok = await confirmDialog(`Kategorie "${name}" wirklich löschen? Bestehende Transaktionen behalten sie, verlieren aber die Zuordnung.`);
            if (!ok) return;
            try {
                await deleteCategory(id, type);
                onChange();
            } catch (err) {
                showToast(`Löschen fehlgeschlagen: ${err.message || err}`, { type: 'error' });
            }
        });
    });

    bindAddCategory('addIncomeCategory', 'newIncomeCategory', 'income');
    bindAddCategory('addExpenseCategory', 'newExpenseCategory', 'expense');
}

function bindAddCategory(buttonId, inputId, type) {
    const button = document.getElementById(buttonId);
    const input = document.getElementById(inputId);
    let submitting = false;
    const submit = async () => {
        const name = input.value.trim();
        if (!name || submitting) return;
        if (state.categories[type].some(c => c.name.toLowerCase() === name.toLowerCase())) {
            showToast(`"${name}" existiert schon.`, { type: 'error' });
            return;
        }
        // Button-Klick und Enter-Taste rufen beide submit() auf — ohne Sperre
        // könnte ein Klick+Enter-Doppelschlag zwei Inserts auslösen, bevor der
        // obige Duplikat-Check den lokalen State neu sehen konnte.
        submitting = true;
        button.disabled = true;
        try {
            await insertCategory(type, name);
            onChange();
        } catch (err) {
            showToast(`Anlegen fehlgeschlagen: ${err.message || err}`, { type: 'error' });
            submitting = false;
            button.disabled = false;
        }
    };
    button.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
}
