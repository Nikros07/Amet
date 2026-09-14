import { state, generateId, PAYMENT_METHODS } from './state.js';
import { formatCurrency, formatDate } from './format.js';
import { confirmDialog } from './modal.js';
import { showToast } from './toast.js';

let editingTransactionId = null;
let onChange = () => {};
let listFilters = { search: '', type: 'all' };

export function setOnChange(fn) {
    onChange = fn;
}

function validateTransaction({ description, amount, date }) {
    const errors = {};
    if (!description || description.trim().length < 2) {
        errors.description = 'Mindestens 2 Zeichen.';
    }
    if (isNaN(amount) || amount <= 0) {
        errors.amount = 'Muss größer als 0 sein.';
    }
    if (!date) {
        errors.date = 'Bitte ein Datum wählen.';
    }
    return errors;
}

function applyFieldErrors(form, errors) {
    form.querySelectorAll('.field-error').forEach(el => el.remove());
    form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    Object.entries(errors).forEach(([field, message]) => {
        const input = form.querySelector(`#${field}`);
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
    const transaction = isEditing
        ? state.transactions.find(t => t.id === editingTransactionId)
        : { type: 'income', description: '', amount: '', date: new Date().toISOString().split('T')[0], category: '', paymentMethod: 'Bar' };

    // Falls die gespeicherte Kategorie inzwischen gelöscht wurde, trotzdem
    // anzeigen statt sie stillschweigend durch die erste Listenoption zu ersetzen.
    let categoryPool = state.categories[transaction.type];
    if (transaction.category && !categoryPool.includes(transaction.category)) {
        categoryPool = [transaction.category, ...categoryPool];
    }
    const categoryOptions = categoryPool
        .map(cat => `<option value="${cat}" ${transaction.category === cat ? 'selected' : ''}>${cat}</option>`)
        .join('');
    const paymentMethodOptions = PAYMENT_METHODS
        .map(pm => `<option value="${pm}" ${transaction.paymentMethod === pm ? 'selected' : ''}>${pm}</option>`)
        .join('');

    container.innerHTML = `
        <h2>${isEditing ? 'Transaktion bearbeiten' : 'Transaktion hinzufügen'}</h2>
        <form id="transactionForm" novalidate>
            <div class="form-group">
                <label for="type">Typ*</label>
                <select id="type">
                    <option value="income" ${transaction.type === 'income' ? 'selected' : ''}>Einnahme</option>
                    <option value="expense" ${transaction.type === 'expense' ? 'selected' : ''}>Ausgabe</option>
                </select>
            </div>
            <div class="form-group">
                <label for="description">Beschreibung*</label>
                <input type="text" id="description" value="${transaction.description}">
            </div>
            <div class="form-group">
                <label for="amount">Betrag* (${state.settings.currency})</label>
                <input type="number" id="amount" step="0.01" min="0" value="${transaction.amount || ''}">
            </div>
            <div class="form-group">
                <label for="date">Datum*</label>
                <input type="date" id="date" value="${transaction.date}">
            </div>
            <div class="form-group">
                <label for="category">Kategorie*</label>
                <select id="category">${categoryOptions}</select>
            </div>
            <div class="form-group">
                <label for="paymentMethod">Zahlungsart*</label>
                <select id="paymentMethod">${paymentMethodOptions}</select>
            </div>
            <div class="form-actions">
                <button type="submit" class="addBtn">${isEditing ? 'Aktualisieren' : 'Hinzufügen'}</button>
                ${isEditing ? '<button type="button" class="cancelBtn">Abbrechen</button>' : ''}
            </div>
        </form>
    `;

    const form = document.getElementById('transactionForm');
    form.querySelector('#type').addEventListener('change', (e) => {
        form.querySelector('#category').innerHTML = state.categories[e.target.value]
            .map(cat => `<option value="${cat}">${cat}</option>`)
            .join('');
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const description = form.description.value.trim();
        const amount = parseFloat(form.amount.value);
        const date = form.date.value;

        const errors = validateTransaction({ description, amount, date });
        applyFieldErrors(form, errors);
        if (Object.keys(errors).length > 0) return;

        const transactionData = {
            type: form.type.value,
            description,
            amount,
            date,
            category: form.category.value,
            paymentMethod: form.paymentMethod.value
        };

        if (isEditing) {
            const index = state.transactions.findIndex(t => t.id === editingTransactionId);
            state.transactions[index] = { ...transactionData, id: editingTransactionId };
            editingTransactionId = null;
            showToast('Transaktion aktualisiert.', { type: 'success' });
        } else {
            state.transactions.push({ ...transactionData, id: generateId() });
            showToast('Transaktion hinzugefügt.', { type: 'success' });
        }

        onChange();
    });

    const cancelBtn = form.querySelector('.cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            editingTransactionId = null;
            onChange();
        });
    }
}

function matchesFilters(t) {
    const term = listFilters.search.trim().toLowerCase();
    const matchesSearch = !term
        || t.description.toLowerCase().includes(term)
        || (t.category || '').toLowerCase().includes(term);
    const matchesType = listFilters.type === 'all' || t.type === listFilters.type;
    return matchesSearch && matchesType;
}

export function renderTransactionList() {
    const container = document.getElementById('transactionsContainer');
    const cur = state.settings.currency;

    if (state.transactions.length === 0) {
        container.innerHTML = '<p class="empty-hint">Noch keine Transaktionen vorhanden. Trag oben deine erste ein.</p>';
        return;
    }

    const filtered = state.transactions
        .filter(matchesFilters)
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const rows = filtered.length === 0
        ? '<tr><td colspan="7" class="empty-hint">Keine Transaktionen passen zu deiner Suche/Filter.</td></tr>'
        : filtered.map(t => `
            <tr>
                <td class="transaction-date">${formatDate(t.date)}</td>
                <td class="transaction-type-${t.type}">${t.type === 'income' ? 'Einnahme' : 'Ausgabe'}</td>
                <td>${t.description}</td>
                <td>${formatCurrency(t.amount, cur)}</td>
                <td>${t.category || '-'}</td>
                <td>${t.paymentMethod || '-'}</td>
                <td>
                    <button class="editBtn" data-id="${t.id}" title="Bearbeiten" aria-label="Bearbeiten">✎</button>
                    <button class="deleteBtn" data-id="${t.id}" title="Löschen" aria-label="Löschen">🗑</button>
                </td>
            </tr>
        `).join('');

    container.innerHTML = `
        <table class="transaction-table">
            <thead><tr>
                <th>Datum</th><th>Typ</th><th>Beschreibung</th><th>Betrag</th><th>Kategorie</th><th>Zahlungsart</th><th>Aktionen</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    container.querySelectorAll('.editBtn').forEach(btn => {
        btn.addEventListener('click', (e) => editTransaction(e.currentTarget.dataset.id));
    });
    container.querySelectorAll('.deleteBtn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteTransaction(e.currentTarget.dataset.id));
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
    onChange();
    document.getElementById('formContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteTransaction(id) {
    const ok = await confirmDialog('Diese Transaktion wirklich löschen? Das kann nicht rückgängig gemacht werden.');
    if (!ok) return;
    state.transactions = state.transactions.filter(t => t.id !== id);
    showToast('Transaktion gelöscht.', { type: 'info' });
    onChange();
}
