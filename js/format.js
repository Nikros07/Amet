// Nutzereingaben (KI-Fragen) und KI-Antworten landen über innerHTML im DOM
// (js/ai.js) — ohne Escaping könnte "<img src=x onerror=...>" als eigene
// Frage im Chatverlauf ausgeführt werden. Reines Text-Escaping reicht, da der
// KI-Chat kein eigenes Markup rendern soll.
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function formatCurrency(amount, currency) {
    try {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount);
    } catch {
        // Ungültiger/unbekannter Währungscode (z.B. während der Nutzer noch tippt)
        return `${amount.toFixed(2)} ${currency}`;
    }
}

// SQL "date"-Spalten kommen als reine "YYYY-MM-DD"-Strings zurück. `new
// Date(dateStr)` parst das als UTC-Mitternacht — kombiniert mit den überall
// verwendeten *lokalen* Gettern (getFullYear/getMonth/getDate) verschiebt das
// den Tag für jeden, der westlich von UTC lebt (z.B. Amerika), unbemerkt um
// einen Tag zurück. Stattdessen die Teile einzeln parsen, damit das Ergebnis
// immer lokale Mitternacht an genau diesem Kalendertag ist.
export function parseLocalDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

export function formatDate(isoDate) {
    return parseLocalDate(isoDate).toLocaleDateString('de-DE');
}

// Lokales Kalenderdatum als "YYYY-MM-DD", z.B. als Default fürs Datumsfeld.
// `new Date().toISOString()` würde zuerst nach UTC konvertieren, was kurz vor
// Mitternacht in einer UTC-negativen Zeitzone auf den Vor- bzw. Folgetag
// umschlagen kann.
export function todayLocalISODate() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Parst Beträge in gängigen Locale-Formaten: "1234", "1234,56", "1234.56",
// "1.234,56" (DE, Punkt = Tausender) und "1,234.56" (US, Komma = Tausender).
// Heuristik: die LETZTE Trenner-Stelle ist der Dezimalpunkt, wenn ihr genau
// 1-2 Ziffern folgen (Cent-Beträge haben nie mehr); alle anderen Trenner in
// der Zahl sind dann Tausender-Gruppierungen und werden entfernt.
export function parseLocaleNumber(token) {
    const cleaned = token.trim();
    const seps = cleaned.match(/[.,]/g);
    if (!seps) return parseFloat(cleaned);

    const lastSepIndex = cleaned.lastIndexOf(seps[seps.length - 1]);
    const decimalDigits = cleaned.length - lastSepIndex - 1;

    if (decimalDigits >= 1 && decimalDigits <= 2) {
        const integerPart = cleaned.slice(0, lastSepIndex).replace(/[.,]/g, '');
        const decimalPart = cleaned.slice(lastSepIndex + 1);
        return parseFloat(`${integerPart}.${decimalPart}`);
    }
    return parseFloat(cleaned.replace(/[.,]/g, ''));
}
