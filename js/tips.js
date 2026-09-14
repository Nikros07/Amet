// Lokale Regel-Analyse als Stand-in für "KI-Tipps". Bewusst kein Aufruf an ein
// echtes LLM: eine reine Frontend-Seite kann keinen API-Key sicher halten —
// jeder könnte ihn aus dem Quelltext auslesen und auf fremde Kosten nutzen.
// Echte KI-Tipps bräuchten ein kleines Backend, das den Key hält (siehe README).

import { state } from './state.js';
import { formatCurrency } from './format.js';

export function generateTips() {
    const cur = state.settings.currency;
    const expenses = state.transactions.filter(t => t.type === 'expense');
    const incomeTotal = state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenseTotal = expenses.reduce((s, t) => s + t.amount, 0);

    if (state.transactions.length === 0) {
        return ['Noch keine Transaktionen erfasst. Trag deine erste Ausgabe oder Einnahme ein, dann kann ich dir was sagen.'];
    }

    const tips = [];

    if (expenseTotal > incomeTotal) {
        tips.push(`Du gibst mehr aus (${formatCurrency(expenseTotal, cur)}) als du einnimmst (${formatCurrency(incomeTotal, cur)}). Das läuft auf Dauer nicht gut — schau dir deine größte Ausgabenkategorie unten an.`);
    }

    const byCategory = expenses.reduce((acc, t) => {
        const cat = t.category || 'Sonstige';
        acc[cat] = (acc[cat] || 0) + t.amount;
        return acc;
    }, {});
    const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    if (sortedCategories.length > 0) {
        const [topCategory, topAmount] = sortedCategories[0];
        const share = expenseTotal > 0 ? Math.round((topAmount / expenseTotal) * 100) : 0;
        tips.push(`Größter Posten: "${topCategory}" mit ${formatCurrency(topAmount, cur)} (${share}% deiner Ausgaben).`);
    }

    ['Tabak', 'Alkohol'].forEach((cat) => {
        if (byCategory[cat] > 0) {
            const yearly = byCategory[cat] * 12;
            tips.push(`Bei "${cat}" gehen ${formatCurrency(byCategory[cat], cur)}/Monat raus — hochgerechnet ${formatCurrency(yearly, cur)}/Jahr. Schau dir die Asset-Projektion an, was eine Reduktion bringen würde.`);
        }
    });

    const byMethod = expenses.reduce((acc, t) => {
        const m = t.paymentMethod || 'Bar';
        acc[m] = (acc[m] || 0) + t.amount;
        return acc;
    }, {});
    const methodEntries = Object.entries(byMethod).sort((a, b) => b[1] - a[1]);
    if (methodEntries.length > 1) {
        tips.push(`Die meisten Ausgaben laufen über "${methodEntries[0][0]}". Wenn du mehrere Zahlungsarten mischst, lohnt sich ein Blick, ob eine davon versteckte Gebühren hat.`);
    }

    if (tips.length === 0) {
        tips.push('Sieht sauber aus — keine Auffälligkeiten in deinen aktuellen Daten.');
    }

    return tips;
}

export function renderAiTips() {
    const list = document.getElementById('aiTipsList');
    list.innerHTML = generateTips().map(tip => `<li>${tip}</li>`).join('');
}
