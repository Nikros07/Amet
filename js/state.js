// Zentraler, veränderlicher Anwendungszustand. Andere Module importieren das
// `state`-Objekt und mutieren seine Felder direkt (nie neu zuweisen), damit
// jeder Modul-Import auf demselben Objekt bleibt.

export const STORAGE_KEY = 'amet-buchhalter-data';
export const PAYMENT_METHODS = ['Bar', 'Debitkarte', 'Kreditkarte', 'PayPal', 'Überweisung', 'Krypto'];

const DEFAULT_CATEGORIES = {
    income: ['Gehalt', 'Freelance', 'Geschenke', 'Sonstige'],
    expense: ['Lebensmittel', 'Miete', 'Transport', 'Freizeit',
              'Tabak', 'Alkohol', 'Ausrüstung', 'Abonnements', 'Sonstige']
};

export const state = {
    settings: {
        taxId: '',
        currency: 'EUR'
    },
    categories: {
        income: [...DEFAULT_CATEGORIES.income],
        expense: [...DEFAULT_CATEGORIES.expense]
    },
    transactions: [] // {id, type, description, amount, date, category, paymentMethod}
};

export function replaceState(data) {
    state.settings = { taxId: '', currency: 'EUR', ...data.settings };
    state.categories = data.categories || state.categories;
    state.transactions = Array.isArray(data.transactions) ? data.transactions : [];
}

export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
