// Ledger-Berechnung: Wallet-Salden werden nie gespeichert, sondern immer aus
// der Transaktionshistorie abgeleitet. Transfers heben sich beim Gesamt-
// vermögen automatisch auf (−amount hier, +amount dort), ganz ohne Sonderfall.

import { state } from './state.js';

export function getWalletBalance(walletId) {
    return state.transactions.reduce((balance, t) => {
        if (t.type === 'income' && t.wallet_id === walletId) return balance + t.amount;
        if (t.type === 'expense' && t.wallet_id === walletId) return balance - t.amount;
        if (t.type === 'transfer') {
            if (t.wallet_id === walletId) return balance - t.amount;
            if (t.to_wallet_id === walletId) return balance + t.amount;
        }
        return balance;
    }, 0);
}

export function getAllWalletBalances() {
    return Object.fromEntries(state.wallets.map(w => [w.key, getWalletBalance(w.id)]));
}

export function getWalletByKey(key) {
    return state.wallets.find(w => w.key === key);
}

export function getTotalWealth() {
    return state.wallets.reduce((sum, w) => sum + getWalletBalance(w.id), 0);
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
