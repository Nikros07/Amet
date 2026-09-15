// Parser für die Schnelleingabe ("+80 Arbeit", "-12 Essen Kino", "50 Konto zu Bruder").
// Liefert nur einen VORSCHLAG — gespeichert wird nichts hier, das übernimmt das
// normale, bereits vorhandene Transaktionsformular nach Bestätigung durch den Nutzer.

import { state } from './state.js';
import { parseLocaleNumber } from './format.js';

const WALLET_ALIASES = {
    account: ['konto', 'account', 'bank'],
    phone_cash: ['handyhülle', 'handyhuelle', 'hülle', 'huelle', 'phone', 'handy'],
    brother: ['bruder', 'brother'],
    crypto: ['krypto', 'crypto', 'bitcoin', 'btc'],
    // Bargeld landet in der Praxis ohnehin immer im Geldbeutel — "bargeld"/
    // "cash"/"zuhause" usw. zeigen deshalb alle direkt auf dasselbe Wallet,
    // statt eigene (verwirrende) Wallets dafür zu brauchen.
    wallet: ['geldbeutel', 'wallet', 'portemonnaie', 'portmonee', 'geldbörse', 'geldboerse', 'bargeld', 'cash', 'bar', 'zuhause', 'daheim']
};

function resolveWalletAlias(token) {
    const t = token.toLowerCase();
    for (const [key, aliases] of Object.entries(WALLET_ALIASES)) {
        if (aliases.includes(t)) return key;
    }
    return null;
}

function findCategoryByName(type, name) {
    const list = state.categories[type];
    const lower = name.toLowerCase();
    return list.find(c => c.name.toLowerCase() === lower)
        || list.find(c => c.name.toLowerCase().startsWith(lower))
        || null;
}

/**
 * @returns {null | {type:'transfer', amount:number, fromWalletKey:string, toWalletKey:string}
 *                 | {type:'income'|'expense', amount:number, categoryId:string|null, categoryGuess:string, note:string}}
 */
export function parseQuickEntry(raw) {
    const input = raw.trim();
    if (!input) return null;

    const transferMatch = input.match(/^(\d+(?:[.,]\d+)*)\s*€?\s*(\S+)\s+(?:zu|nach|an|->|→)\s+(\S+)$/i);
    if (transferMatch) {
        const amount = parseLocaleNumber(transferMatch[1]);
        const fromKey = resolveWalletAlias(transferMatch[2]);
        const toKey = resolveWalletAlias(transferMatch[3]);
        if (fromKey && toKey && fromKey !== toKey && amount > 0) {
            return { type: 'transfer', amount, fromWalletKey: fromKey, toWalletKey: toKey };
        }
    }

    const moveMatch = input.match(/^([+-])\s*(\d+(?:[.,]\d+)*)\s*(\S+)(?:\s+(.*))?$/);
    if (moveMatch) {
        const type = moveMatch[1] === '+' ? 'income' : 'expense';
        const amount = parseLocaleNumber(moveMatch[2]);
        if (!(amount > 0)) return null;
        const categoryToken = moveMatch[3];
        const category = findCategoryByName(type, categoryToken);
        return {
            type,
            amount,
            categoryId: category ? category.id : null,
            categoryGuess: categoryToken,
            note: moveMatch[4] || ''
        };
    }

    return null;
}
