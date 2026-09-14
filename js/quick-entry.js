// Parser für die Schnelleingabe ("+80 Arbeit", "-12 Essen Kino", "50 Konto zu Bruder").
// Liefert nur einen VORSCHLAG — gespeichert wird nichts hier, das übernimmt das
// normale, bereits vorhandene Transaktionsformular nach Bestätigung durch den Nutzer.

import { state } from './state.js';

const WALLET_ALIASES = {
    account: ['konto', 'account', 'bank'],
    phone_cash: ['handyhülle', 'handyhuelle', 'hülle', 'huelle', 'phone', 'handy', 'bargeld', 'cash'],
    brother: ['bruder', 'brother']
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

    const transferMatch = input.match(/^(\d+(?:[.,]\d+)?)\s*€?\s*(\S+)\s+(?:zu|nach|an|->|→)\s+(\S+)$/i);
    if (transferMatch) {
        const amount = parseFloat(transferMatch[1].replace(',', '.'));
        const fromKey = resolveWalletAlias(transferMatch[2]);
        const toKey = resolveWalletAlias(transferMatch[3]);
        if (fromKey && toKey && fromKey !== toKey) {
            return { type: 'transfer', amount, fromWalletKey: fromKey, toWalletKey: toKey };
        }
    }

    const moveMatch = input.match(/^([+-])\s*(\d+(?:[.,]\d+)?)\s*(\S+)(?:\s+(.*))?$/);
    if (moveMatch) {
        const type = moveMatch[1] === '+' ? 'income' : 'expense';
        const amount = parseFloat(moveMatch[2].replace(',', '.'));
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
