// Zentraler, veränderlicher Anwendungszustand. Andere Module importieren das
// `state`-Objekt und mutieren seine Felder direkt (nie neu zuweisen), damit
// jeder Modul-Import auf demselben Objekt bleibt.

export const WALLET_LABELS = {
    account: 'Konto',
    phone_cash: 'Handyhülle',
    brother: 'Bruder'
};

export const DEFAULT_CATEGORIES = {
    income: ['Arbeit', 'Geschenke', 'Sonstiges'],
    expense: ['Essen', 'Kleidung', 'Transport', 'Freizeit', 'Technik', 'Sonstiges']
};

export const state = {
    userId: null,
    settings: {
        direct_available_min: 100,
        direct_available_max: 150,
        currency: 'EUR'
    },
    wallets: [],       // [{id, key, name}]
    categories: {
        income: [],    // [{id, name}]
        expense: []
    },
    transactions: [],  // [{id, type, amount, date, wallet_id, to_wallet_id, category_id, note, work_hours, work_rate}]
    goals: [],
    budgets: []
};

export function resetState() {
    state.userId = null;
    state.settings = { direct_available_min: 100, direct_available_max: 150, currency: 'EUR' };
    state.wallets = [];
    state.categories = { income: [], expense: [] };
    state.transactions = [];
    state.goals = [];
    state.budgets = [];
}

export function findWallet(id) {
    return state.wallets.find(w => w.id === id);
}

export function findCategory(id) {
    return [...state.categories.income, ...state.categories.expense].find(c => c.id === id);
}
