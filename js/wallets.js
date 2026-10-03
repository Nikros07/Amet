// Ledger-Berechnung: Wallet-Salden werden nie gespeichert, sondern immer aus
// der Transaktionshistorie abgeleitet. Transfers heben sich beim Gesamt-
// vermögen automatisch auf (−amount hier, +amount dort), ganz ohne Sonderfall.

import { state } from './state.js';

// excludeTransactionId lässt eine Transaktion aus der Summe raus — gebraucht,
// um beim Bearbeiten einer bestehenden Transaktion zu prüfen, ob der NEUE
// Betrag ginge, ohne dass die alte Version sich selbst mit-blockiert.
export function getWalletBalance(walletId, excludeTransactionId = null) {
    const wallet = state.wallets.find(w => w.id === walletId);
    const opening = wallet ? (wallet.opening_balance || 0) : 0;
    return state.transactions.reduce((balance, t) => {
        if (t.id === excludeTransactionId) return balance;
        if (t.type === 'income' && t.wallet_id === walletId) return balance + t.amount;
        if (t.type === 'expense' && t.wallet_id === walletId) return balance - t.amount;
        if (t.type === 'goal' && t.wallet_id === walletId) return balance - t.amount;
        if (t.type === 'transfer') {
            if (t.wallet_id === walletId) return balance - t.amount;
            if (t.to_wallet_id === walletId) return balance + t.amount;
        }
        return balance;
    }, opening);
}

export function getAllWalletBalances() {
    return Object.fromEntries(state.wallets.map(w => [w.key, getWalletBalance(w.id)]));
}

export function getWalletByKey(key) {
    return state.wallets.find(w => w.key === key);
}

// Geld in Sparzielen ist nicht mehr auf den Wallets, gehört aber weiterhin dir —
// der Beitrag ist wie ein Transfer in einen eigenen Topf und ändert das
// Gesamtvermögen nicht.
export function getGoalContributionsTotal() {
    return state.transactions
        .filter(t => t.type === 'goal')
        .reduce((sum, t) => sum + t.amount, 0);
}

export function getTotalWealth() {
    return state.wallets.reduce((sum, w) => sum + getWalletBalance(w.id), 0) + getGoalContributionsTotal();
}

// current_amount ist der (alte, manuell gepflegte) Startwert; Beiträge kommen
// aus der Transaktionshistorie.
export function getGoalProgress(goal) {
    const contributed = state.transactions
        .filter(t => t.type === 'goal' && t.goal_id === goal.id)
        .reduce((sum, t) => sum + t.amount, 0);
    return (goal.current_amount || 0) + contributed;
}

export function getDirectlyAvailable() {
    const account = getWalletByKey('account');
    const phoneCash = getWalletByKey('phone_cash');
    return (account ? getWalletBalance(account.id) : 0) + (phoneCash ? getWalletBalance(phoneCash.id) : 0);
}

export function getDirectlyAvailableStatus() {
    const value = getDirectlyAvailable();
    const { direct_available_min: min, direct_available_max: max } = state.settings;
    if (value < min) return { value, status: 'under', label: `Unter dem Zielbereich (${min}–${max})` };
    if (value > max) return { value, status: 'over', label: `Über dem Zielbereich (${min}–${max}) — Überschuss gehört zum Bruder` };
    return { value, status: 'in-range', label: `Im Zielbereich (${min}–${max})` };
}
