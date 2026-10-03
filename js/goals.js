import { state } from './state.js';
import { insertGoal, insertTransaction, deleteGoal } from './db.js';
import { getWalletBalance, getGoalProgress } from './wallets.js';
import { formatCurrency, todayLocalISODate } from './format.js';
import { confirmDialog } from './modal.js';
import { showToast } from './toast.js';

let onChange = () => {};

export function setOnChange(fn) {
    onChange = fn;
}

export function renderGoalAddRow() {
    const container = document.getElementById('goalAddRow');
    if (!container) return;
    container.innerHTML = `
        <input type="text" id="newGoalName" placeholder="Ziel (z.B. BMW, Urlaub)">
        <input type="number" id="newGoalTarget" placeholder="Zielbetrag" min="1" step="1">
        <button type="button" id="addGoalBtn" class="addBtn">Ziel anlegen</button>
    `;

    const addBtn = document.getElementById('addGoalBtn');
    addBtn.addEventListener('click', async () => {
        const name = document.getElementById('newGoalName').value.trim();
        const target = parseFloat(document.getElementById('newGoalTarget').value);
        if (!name || isNaN(target) || target <= 0) {
            showToast('Bitte Name und einen gültigen Zielbetrag angeben.', { type: 'error' });
            return;
        }
        // Ohne diese Sperre erzeugt ein Doppelklick zwei identische Sparziele —
        // anders als bei Budgets/Kategorien gibt es dafür keine DB-Unique-
        // Constraint, die das auffangen würde.
        addBtn.disabled = true;
        try {
            await insertGoal({ name, target_amount: target, current_amount: 0 });
            showToast('Sparziel angelegt.', { type: 'success' });
            onChange();
        } catch (err) {
            showToast(`Anlegen fehlgeschlagen: ${err.message || err}`, { type: 'error' });
            addBtn.disabled = false;
        }
    });
}

export function renderGoals() {
    const container = document.getElementById('goalsContainer');
    if (!container) return;
    const cur = state.settings.currency;

    if (state.goals.length === 0) {
        container.innerHTML = '<p class="empty-hint">Noch keine Sparziele. Leg oben eins an.</p>';
        return;
    }

    const walletOptions = state.wallets
        .map(w => `<option value="${w.id}" data-key="${w.key}">${w.name} (${formatCurrency(getWalletBalance(w.id), cur)})</option>`)
        .join('');

    container.innerHTML = state.goals.map(g => {
        const progress = getGoalProgress(g);
        const pct = Math.min(100, Math.round((progress / g.target_amount) * 100));
        return `
            <div class="goal-card" data-id="${g.id}">
                <h4>${g.name} <button type="button" class="deleteGoalBtn" data-id="${g.id}" aria-label="Löschen">×</button></h4>
                <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
                <div class="progress-label">
                    <span>${formatCurrency(progress, cur)} / ${formatCurrency(g.target_amount, cur)}</span>
                    <span>${pct}%</span>
                </div>
                <div class="goal-add-row goal-contribution-row">
                    <select class="goalWallet" data-id="${g.id}" aria-label="Von Wallet">${walletOptions}</select>
                    <input type="number" class="goalContribution" data-id="${g.id}" placeholder="Beitrag" min="0.01" step="0.01">
                    <button type="button" class="addContributionBtn" data-id="${g.id}">+ Hinzufügen</button>
                </div>
            </div>
        `;
    }).join('');

    // Standardmäßig vom Konto abbuchen (Hauptquelle von "Direkt verfügbar").
    container.querySelectorAll('.goalWallet').forEach(select => {
        const account = select.querySelector('option[data-key="account"]');
        if (account) select.value = account.value;
    });

    container.querySelectorAll('.deleteGoalBtn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const ok = await confirmDialog('Dieses Sparziel wirklich löschen? Bereits eingezahlte Beträge gehen zurück auf die Wallets, von denen sie kamen.');
            if (!ok) return;
            try {
                await deleteGoal(id);
                onChange();
            } catch (err) {
                showToast(`Löschen fehlgeschlagen: ${err.message || err}`, { type: 'error' });
            }
        });
    });

    container.querySelectorAll('.addContributionBtn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const input = container.querySelector(`.goalContribution[data-id="${id}"]`);
            const select = container.querySelector(`.goalWallet[data-id="${id}"]`);
            const amount = parseFloat(input.value);
            if (isNaN(amount) || amount <= 0) {
                showToast('Bitte einen gültigen Betrag eingeben.', { type: 'error' });
                return;
            }
            // Wie bei Ausgaben/Transfers: kein Wallet darf ins Minus rutschen.
            const available = getWalletBalance(select.value);
            if (amount > available) {
                const walletName = select.selectedOptions[0].textContent.replace(/\s*\(.*\)$/, '');
                showToast(`Nicht genug auf ${walletName} (verfügbar: ${formatCurrency(available, cur)}).`, { type: 'error' });
                return;
            }
            // Sperren, damit ein Doppelklick nicht zwei Buchungen auslöst,
            // bevor der Saldo-Check oben den neuen Stand sehen konnte.
            const target = e.currentTarget;
            target.disabled = true;
            input.disabled = true;
            select.disabled = true;
            try {
                await insertTransaction({
                    type: 'goal',
                    amount,
                    date: todayLocalISODate(),
                    wallet_id: select.value,
                    to_wallet_id: null,
                    category_id: null,
                    goal_id: id,
                    note: null
                });
                showToast('Beitrag gebucht.', { type: 'success' });
                onChange();
            } catch (err) {
                select.disabled = false;
                showToast(`Speichern fehlgeschlagen: ${err.message || err}`, { type: 'error' });
                target.disabled = false;
                input.disabled = false;
            }
        });
    });
}
