export function formatCurrency(amount, currency) {
    try {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount);
    } catch {
        // Ungültiger/unbekannter Währungscode (z.B. während der Nutzer noch tippt)
        return `${amount.toFixed(2)} ${currency}`;
    }
}

export function formatDate(isoDate) {
    return new Date(isoDate).toLocaleDateString('de-DE');
}
