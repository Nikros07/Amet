import { state, findWallet, findCategory, WALLET_LABELS } from './state.js';
import { insertTransaction, updateTransaction, deleteTransaction as dbDeleteTransaction } from './db.js';
import { getWalletBalance } from './wallets.js';
import { formatCurrency, formatDate, todayLocalISODate } from './format.js';
import { confirmDialog } from './modal.js';
import { showToast } from './toast.js';

let editingTransactionId = null;
let prefill = null; // Vorschlag aus der Schnelleingabe, einmalig beim nächsten Render verwendet
let onChange = () => {};
let listFilters = { search: '', type: 'all' };

export function setOnChange(fn) {
    onChange = fn;
}

export function prefillForm(suggestion) {
    editingTransactionId = null;
    prefill = suggestion;
    onChange();
}

function walletOptions(selectedId) {
    return state.wallets
        .map(w => `<option value="${w.id}" ${w.id === selectedId ? 'selected' : ''}>${w.name}</option>`)
        .join('');
}

function categoryOptions(type, selectedId) {
    return state.categories[type]
        .map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.name}</option>`)
        .join('');
}

function blankTransaction() {
    const accountWallet = state.wallets.find(w => w.key === 'account');
    return {
        type: 'income',
        amount: '',
        date: todayLocalISODate(),
        wallet_id: accountWallet ? accountWallet.id : '',
        to_wallet_id: '',
        category_id: state.categories.income[0]?.id || '',
        note: ''
    };
}

function applyPrefill(base) {
    if (!prefill) return base;
    const t = { ...base };
    if (prefill.type === 'transfer') {
        t.type = 'transfer';
        const from = state.wallets.find(w => w.key === prefill.fromWalletKey);
        const to = state.wallets.find(w => w.key === prefill.toWalletKey);
        t.amount = prefill.amount;
        t.wallet_id = from ? from.id : t.wallet_id;
        t.to_wallet_id = to ? to.id : '';
    } else {
        t.type = prefill.type;
        t.amount = prefill.amount;
        t.category_id = prefill.categoryId || state.categories[prefill.type][0]?.id || '';
        t.note = prefill.note || '';
        t._categoryGuess = !prefill.categoryId ? prefill.categoryGuess : null;
    }
    return t;
}

function validateTransaction(t, excludeId = null) {
    const errors = {};
    if (isNaN(t.amount) || t.amount <= 0) errors.amount = 'Muss größer als 0 sein.';
    if (!t.date) errors.date = 'Bitte ein Datum wählen.';
    if (t.type === 'transfer') {
        if (!t.wallet_id) errors.fromWallet = 'Von-Wallet fehlt.';
        if (!t.to_wallet_id) errors.toWallet = 'Nach-Wallet fehlt.';
        if (t.wallet_id && t.wallet_id === t.to_wallet_id) errors.toWallet = 'Von und nach müssen unterschiedlich sein.';
    } else {
        if (!t.wallet_id) errors.wallet = 'Wallet fehlt.';
        if (!t.category_id) errors.category = 'Kategorie fehlt.';
    }

    // Die Wallets bilden echtes Geld ab — kein Wallet darf durch eine Ausgabe
    // oder einen Transfer ins Minus rutschen, das wäre real gar nicht möglich.
    if (!errors.amount && t.wallet_id && (t.type === 'expense' || t.type === 'transfer')) {
        const available = getWalletBalance(t.wallet_id, excludeId);
        if (t.amount > available) {
            const walletName = findWallet(t.wallet_id)?.name || 'diesem Wallet';
            errors.amount = `Nicht genug auf ${walletName} (verfügbar: ${formatCurrency(available, state.settings.currency)}).`;
        }
    }
    return errors;
}

function applyFieldErrors(form, errors) {
    form.querySelectorAll('.field-error').forEach(el => el.remove());
    form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    Object.entries(errors).forEach(([field, message]) => {
        const input = form.querySelector(`[data-field="${field}"]`);
        if (!input) return;
        input.classList.add('input-error');
        const msg = document.createElement('small');
        msg.className = 'field-error';
        msg.textContent = message;
        input.insertAdjacentElement('afterend', msg);
    });
}

export function renderTransactionForm() {
    const container = document.getElementById('formContainer');
    const isEditing = editingTransactionId !== null;
    const raw = isEditing ? state.transactions.find(t => t.id === editingTransactionId) : applyPrefill(blankTransaction());
    if (!raw) { editingTransactionId = null; return; }

    const isTransfer = raw.type === 'transfer';
    const categoryHint = raw._categoryGuess
        ? `<small class="field-hint">Kategorie "${raw._categoryGuess}" nicht gefunden — bitte auswählen.</small>`
        : '';

    container.innerHTML = `
        <h2>${isEditing ? 'Transaktion bearbeiten' : 'Transaktion hinzufügen'}</h2>
        <form id="transactionForm" novalidate>
            <div class="form-group">
                <label for="type">Typ*</label>
                <select id="type" data-field="type">
                    <option value="income" ${raw.type === 'income' ? 'selected' : ''}>Einnahme</option>
                    <option value="expense" ${raw.type === 'expense' ? 'selected' : ''}>Ausgabe</option>
                    <option value="transfer" ${isTransfer ? 'selected' : ''}>Transfer (eigene Wallets)</option>
                </select>
            </div>
            <div class="form-group">
                <label for="amount">Betrag* (${state.settings.currency})</label>
                <input type="number" id="amount" data-field="amount" step="0.01" min="0" value="${raw.amount || ''}">
            </div>
            <div id="workHoursFields" class="work-hours-fields" ${raw.type === 'income' ? '' : 'hidden'}>
                <div class="form-group" style="margin-right:0;">
                    <label for="workHours">Stunden (optional)</label>
                    <input type="number" id="workHours" step="0.25" min="0" value="${raw.work_hours || ''}" placeholder="z.B. 4">
                </div>
                <div class="form-group">
                    <label for="workRate">€/Stunde (optional)</label>
                    <input type="number" id="workRate" step="0.01" min="0" value="${raw.work_rate || ''}" placeholder="z.B. 16">
                </div>
            </div>
            <div class="form-group">
                <label for="date">Datum*</label>
                <input type="date" id="date" data-field="date" value="${raw.date}">
            </div>
            <div id="moveFields" ${isTransfer ? 'hidden' : ''}>
                <div class="form-group">
                    <label for="wallet">Wallet*</label>
                    <select id="wallet" data-field="wallet">${walletOptions(raw.wallet_id)}</select>
                </div>
                <div class="form-group">
                    <label for="category">Kategorie*</label>
                    <select id="category" data-field="category">${categoryOptions(raw.type === 'transfer' ? 'expense' : raw.type, raw.category_id)}</select>
                    ${categoryHint}
                </div>
            </div>
            <div id="transferFields" ${isTransfer ? '' : 'hidden'}>
                <div class="form-group">
                    <label for="fromWallet">Von*</label>
                    <select id="fromWallet" data-field="fromWallet">${walletOptions(raw.wallet_id)}</select>
                </div>
                <div class="form-group">
                    <label for="toWallet">Nach*</label>
                    <select id="toWallet" data-field="toWallet">${walletOptions(raw.to_wallet_id)}</select>
                </div>
            </div>
            <div class="form-group">
                <label for="note">Notiz</label>
                <input type="text" id="note" value="${raw.note || ''}" placeholder="optional">
            </div>
            <div class="form-actions">
                <button type="submit" class="addBtn">${isEditing ? 'Aktualisieren' : 'Hinzufügen'}</button>
                ${isEditing ? '<button type="button" class="cancelBtn">Abbrechen</button>' : ''}
            </div>
        </form>
    `;

    prefill = null; // nur einmal anwenden

    const form = document.getElementById('transactionForm');
    const typeSelect = form.querySelector('#type');
    typeSelect.addEventListener('change', () => {
        const transfer = typeSelect.value === 'transfer';
        form.querySelector('#moveFields').hidden = transfer;
        form.querySelector('#transferFields').hidden = !transfer;
        form.querySelector('#workHoursFields').hidden = typeSelect.value !== 'income';
        if (!transfer) {
            form.querySelector('#category').innerHTML = categoryOptions(typeSelect.value, null);
        }
    });

    const workHoursInput = form.querySelector('#workHours');
    const workRateInput = form.querySelector('#workRate');
    const recomputeFromHours = () => {
        const hours = parseFloat(workHoursInput.value);
        const rate = parseFloat(workRateInput.value);
        if (!isNaN(hours) && !isNaN(rate) && hours > 0 && rate > 0) {
            form.querySelector('#amount').value = (hours * rate).toFixed(2);
        }
    };
    workHoursInput.addEventListener('input', recomputeFromHours);
    workRateInput.addEventListener('input', recomputeFromHours);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = form.type.value;
        const amount = parseFloat(form.amount.value);
        const date = form.date.value;
        const workHours = type === 'income' ? parseFloat(workHoursInput.value) : NaN;
        const workRate = type === 'income' ? parseFloat(workRateInput.value) : NaN;

        const candidate = type === 'transfer'
            ? { type, amount, date, wallet_id: form.fromWallet.value, to_wallet_id: form.toWallet.value, category_id: null }
            : { type, amount, date, wallet_id: form.wallet.value, to_wallet_id: null, category_id: form.category.value };
        candidate.work_hours = !isNaN(workHours) ? workHours : null;
        candidate.work_rate = !isNaN(workRate) ? workRate : null;

        const errors = validateTransaction(candidate, editingTransactionId);
        applyFieldErrors(form, errors);
        if (Object.keys(errors).length > 0) return;

        candidate.note = form.note.value.trim() || null;

        const submitBtn = form.querySelector('.addBtn');
        submitBtn.disabled = true;
        try {
            if (isEditing) {
                await updateTransaction(editingTransactionId, candidate);
                showToast('Transaktion aktualisiert.', { type: 'success' });
            } else {
                await insertTransaction(candidate);
                showToast('Transaktion gespeichert.', { type: 'success' });
            }
            editingTransactionId = null;
            onChange();
        } catch (err) {
            showToast(`Speichern fehlgeschlagen: ${err.message || err}`, { type: 'error', duration: 6000 });
            submitBtn.disabled = false;
        }
    });

    const cancelBtn = form.querySelector('.cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            editingTransactionId = null;
            onChange();
        });
    }
}

function describeTransaction(t) {
    if (t.type === 'transfer') {
        const from = findWallet(t.wallet_id);
        const to = findWallet(t.to_wallet_id);
        return `${from?.name || '?'} → ${to?.name || '?'}`;
    }
    const category = findCategory(t.category_id);
    const wallet = findWallet(t.wallet_id);
    return `${category?.name || 'Sonstiges'} · ${wallet?.name || '?'}`;
}

function matchesFilters(t) {
    const term = listFilters.search.trim().toLowerCase();
    const haystack = `${describeTransaction(t)} ${t.note || ''}`.toLowerCase();
    const matchesSearch = !term || haystack.includes(term);
    const matchesType = listFilters.type === 'all' || t.type === listFilters.type;
    return matchesSearch && matchesType;
}

const TYPE_LABEL = { income: 'Einnahme', expense: 'Ausgabe', transfer: 'Transfer' };

export function renderTransactionList() {
    const container = document.getElementById('transactionsContainer');
    const cur = state.settings.currency;

    if (state.transactions.length === 0) {
        container.innerHTML = '<p class="empty-hint">Noch keine Transaktionen vorhanden. Trag oben deine erste ein.</p>';
        return;
    }

    const filtered = state.transactions.filter(matchesFilters);
    const rows = filtered.length === 0
        ? '<tr><td colspan="6" class="empty-hint">Keine Transaktionen passen zu deiner Suche/Filter.</td></tr>'
        : filtered.map(t => `
            <tr>
                <td class="transaction-date">${formatDate(t.date)}</td>
                <td class="transaction-type-${t.type}">${TYPE_LABEL[t.type]}</td>
                <td>${describeTransaction(t)}${t.note ? ` <span class="note-text">— ${t.note}</span>` : ''}</td>
                <td>${formatCurrency(t.amount, cur)}</td>
                <td>
                    <button class="editBtn" data-id="${t.id}" title="Bearbeiten" aria-label="Bearbeiten">✎</button>
                    <button class="deleteBtn" data-id="${t.id}" title="Löschen" aria-label="Löschen">🗑</button>
                </td>
            </tr>
        `).join('');

    container.innerHTML = `
        <table class="transaction-table">
            <thead><tr><th>Datum</th><th>Typ</th><th>Details</th><th>Betrag</th><th>Aktionen</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    container.querySelectorAll('.editBtn').forEach(btn => {
        btn.addEventListener('click', (e) => editTransaction(e.currentTarget.dataset.id));
    });
    container.querySelectorAll('.deleteBtn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteTransactionFlow(e.currentTarget.dataset.id));
    });
}

export function renderTransactions() {
    renderTransactionList();
}

export function setListFilters(partial) {
    listFilters = { ...listFilters, ...partial };
    renderTransactionList();
}

function editTransaction(id) {
    editingTransactionId = id;
    prefill = null;
    onChange();
    document.getElementById('formContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteTransactionFlow(id) {
    const ok = await confirmDialog('Diese Transaktion wirklich löschen? Das kann nicht rückgängig gemacht werden.');
    if (!ok) return;
    try {
        await dbDeleteTransaction(id);
        showToast('Transaktion gelöscht.', { type: 'info' });
        onChange();
    } catch (err) {
        showToast(`Löschen fehlgeschlagen: ${err.message || err}`, { type: 'error' });
    }
}
