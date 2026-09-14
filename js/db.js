import { supabase } from './supabase-client.js';
import { state, WALLET_LABELS, DEFAULT_CATEGORIES } from './state.js';

async function ensureDefaults(userId) {
    const { data: wallets } = await supabase.from('wallets').select('*').eq('user_id', userId);
    if (!wallets || wallets.length === 0) {
        const rows = Object.entries(WALLET_LABELS).map(([key, name]) => ({ user_id: userId, key, name }));
        await supabase.from('wallets').insert(rows);
    }

    const { data: categories } = await supabase.from('categories').select('*').eq('user_id', userId);
    if (!categories || categories.length === 0) {
        const rows = [
            ...DEFAULT_CATEGORIES.income.map(name => ({ user_id: userId, type: 'income', name })),
            ...DEFAULT_CATEGORIES.expense.map(name => ({ user_id: userId, type: 'expense', name }))
        ];
        await supabase.from('categories').insert(rows);
    }

    const { data: settings } = await supabase.from('settings').select('*').eq('user_id', userId).maybeSingle();
    if (!settings) {
        await supabase.from('settings').insert({ user_id: userId });
    }
}

export async function loadAllFromDb(userId) {
    await ensureDefaults(userId);

    const [walletsRes, categoriesRes, settingsRes, transactionsRes, goalsRes, budgetsRes] = await Promise.all([
        supabase.from('wallets').select('*').eq('user_id', userId),
        supabase.from('categories').select('*').eq('user_id', userId),
        supabase.from('settings').select('*').eq('user_id', userId).single(),
        supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }),
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
