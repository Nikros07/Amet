import { supabase } from './supabase-client.js';
import { state, WALLET_LABELS, DEFAULT_CATEGORIES } from './state.js';

// state.transactions muss nach date DESC sortiert bleiben (created_at als
// Tiebreaker) — Dashboard/"Letzte Transaktionen" verlassen sich darauf und
// zeigen sonst z.B. eine gerade nachgetragene alte Transaktion fälschlich
// als die neueste an.
function sortTransactions() {
    state.transactions.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.created_at || '').localeCompare(a.created_at || '');
    });
}

// Erzeugt die Default-Zeilen (Wallets/Kategorien/Settings) beim ersten Login.
// Nutzt upsert+ignoreDuplicates statt insert: wenn derselbe Nutzer sich fast
// gleichzeitig in zwei Tabs/Geräten zum allerersten Mal einloggt, würde ein
// reines insert() im zweiten Tab an der unique-Constraint (user_id, key) bzw.
// (user_id, type, name) scheitern und — da der Fehler bisher nicht geprüft
// wurde — VOLLSTÄNDIG UNBEMERKT durchfallen, sodass der zweite Tab am Ende
// mit null/leeren Wallets weiterläuft. upsert mit ignoreDuplicates ist dagegen
// idempotent, und verbleibende Fehler werden jetzt geworfen statt verschluckt.
async function ensureDefaults(userId) {
    // Immer alle bekannten Wallet-Keys upserten (nicht nur wenn komplett leer):
    // idempotent dank ignoreDuplicates, aber so bekommen auch Bestandsnutzer neu
    // eingeführte Wallet-Typen (z.B. Krypto/Bargeld) automatisch beim nächsten
    // Login hinzu, statt für immer bei ihren ursprünglichen drei zu bleiben.
    const rows = Object.entries(WALLET_LABELS).map(([key, name]) => ({ user_id: userId, key, name }));
    const { error: walletsErr } = await supabase.from('wallets').upsert(rows, { onConflict: 'user_id,key', ignoreDuplicates: true });
    if (walletsErr) {
        // Falls Migration 003 (neue Wallet-Keys/opening_balance-Spalte) noch
        // nicht im Supabase-Projekt ausgeführt wurde, würde der CHECK-Constraint
        // hier scheitern. Statt den kompletten Login zu blockieren, mit den
        // ursprünglichen drei Wallets weitermachen — Krypto/Bargeld erscheinen
        // dann einfach erst nach der Migration.
        console.warn('Wallet-Upsert unvollständig (Migration 003 evtl. noch nicht ausgeführt):', walletsErr.message || walletsErr);
        const legacyRows = rows.filter(r => ['account', 'phone_cash', 'brother', 'crypto', 'cash'].includes(r.key));
        const { error: legacyErr } = await supabase.from('wallets').upsert(legacyRows, { onConflict: 'user_id,key', ignoreDuplicates: true });
        if (legacyErr) throw legacyErr;
    }

    const { data: categories, error: categoriesSelectErr } = await supabase.from('categories').select('*').eq('user_id', userId);
    if (categoriesSelectErr) throw categoriesSelectErr;
    if (!categories || categories.length === 0) {
        const rows = [
            ...DEFAULT_CATEGORIES.income.map(name => ({ user_id: userId, type: 'income', name })),
            ...DEFAULT_CATEGORIES.expense.map(name => ({ user_id: userId, type: 'expense', name }))
        ];
        const { error } = await supabase.from('categories').upsert(rows, { onConflict: 'user_id,type,name', ignoreDuplicates: true });
        if (error) throw error;
    }

    const { data: settings, error: settingsSelectErr } = await supabase.from('settings').select('*').eq('user_id', userId).maybeSingle();
    if (settingsSelectErr) throw settingsSelectErr;
    if (!settings) {
        const { error } = await supabase.from('settings').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
        if (error) throw error;
    }
}

export async function loadAllFromDb(userId) {
    await ensureDefaults(userId);

    const [walletsRes, categoriesRes, settingsRes, transactionsRes, goalsRes, budgetsRes] = await Promise.all([
        supabase.from('wallets').select('*').eq('user_id', userId),
        supabase.from('categories').select('*').eq('user_id', userId),
        supabase.from('settings').select('*').eq('user_id', userId).single(),
        supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('goals').select('*').eq('user_id', userId),
        supabase.from('budgets').select('*').eq('user_id', userId)
    ]);

    for (const res of [walletsRes, categoriesRes, settingsRes, transactionsRes, goalsRes, budgetsRes]) {
        if (res.error) throw res.error;
    }

    state.userId = userId;
    state.wallets = walletsRes.data;
    state.categories = {
        income: categoriesRes.data.filter(c => c.type === 'income'),
        expense: categoriesRes.data.filter(c => c.type === 'expense')
    };
    state.settings = settingsRes.data;
    state.transactions = transactionsRes.data;
    state.goals = goalsRes.data;
    state.budgets = budgetsRes.data;
}

export async function insertTransaction(payload) {
    const { data, error } = await supabase
        .from('transactions')
        .insert({ ...payload, user_id: state.userId })
        .select()
        .single();
    if (error) throw error;
    state.transactions.unshift(data);
    sortTransactions();
    return data;
}

export async function updateTransaction(id, payload) {
    const { data, error } = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    const index = state.transactions.findIndex(t => t.id === id);
    if (index !== -1) state.transactions[index] = data;
    sortTransactions();
    return data;
}

export async function deleteTransaction(id) {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
    state.transactions = state.transactions.filter(t => t.id !== id);
}

export async function insertCategory(type, name) {
    const { data, error } = await supabase
        .from('categories')
        .insert({ user_id: state.userId, type, name })
        .select()
        .single();
    if (error) throw error;
    state.categories[type].push(data);
    return data;
}

export async function deleteCategory(id, type) {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    state.categories[type] = state.categories[type].filter(c => c.id !== id);
}

export async function updateWalletOpeningBalance(walletId, openingBalance) {
    const { data, error } = await supabase
        .from('wallets')
        .update({ opening_balance: openingBalance })
        .eq('id', walletId)
        .select()
        .single();
    if (error) throw error;
    const index = state.wallets.findIndex(w => w.id === walletId);
    if (index !== -1) state.wallets[index] = data;
    return data;
}

// Setzt den Nutzer komplett zurück: alle Transaktionen/Ziele/Budgets weg,
// Anfangssalden auf 0. Kategorien, Settings und der Login-Account bleiben
// erhalten — ein "frischer Start", kein neuer Account.
export async function resetAllData() {
    const userId = state.userId;
    const [txRes, goalsRes, budgetsRes] = await Promise.all([
        supabase.from('transactions').delete().eq('user_id', userId),
        supabase.from('goals').delete().eq('user_id', userId),
        supabase.from('budgets').delete().eq('user_id', userId)
    ]);
    for (const res of [txRes, goalsRes, budgetsRes]) {
        if (res.error) throw res.error;
    }
    const { data: wallets, error: walletsErr } = await supabase
        .from('wallets')
        .update({ opening_balance: 0 })
        .eq('user_id', userId)
        .select();
    if (walletsErr) throw walletsErr;

    state.transactions = [];
    state.goals = [];
    state.budgets = [];
    state.wallets = wallets;
}

export async function updateSettings(payload) {
    const { data, error } = await supabase
        .from('settings')
        .update(payload)
        .eq('user_id', state.userId)
        .select()
        .single();
    if (error) throw error;
    state.settings = data;
    return data;
}

// ---------- Goals ----------

export async function insertGoal(payload) {
    const { data, error } = await supabase
        .from('goals')
        .insert({ ...payload, user_id: state.userId })
        .select()
        .single();
    if (error) throw error;
    state.goals.push(data);
    return data;
}

export async function updateGoal(id, payload) {
    const { data, error } = await supabase
        .from('goals')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    const index = state.goals.findIndex(g => g.id === id);
    if (index !== -1) state.goals[index] = data;
    return data;
}

export async function deleteGoal(id) {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) throw error;
    state.goals = state.goals.filter(g => g.id !== id);
}

// ---------- Budgets ----------

export async function insertBudget(payload) {
    const { data, error } = await supabase
        .from('budgets')
        .insert({ ...payload, user_id: state.userId })
        .select()
        .single();
    if (error) throw error;
    state.budgets.push(data);
    return data;
}

export async function deleteBudget(id) {
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) throw error;
    state.budgets = state.budgets.filter(b => b.id !== id);
}
