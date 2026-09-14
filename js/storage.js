import { state, replaceState, STORAGE_KEY } from './state.js';

export function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
        console.warn('Konnte nicht lokal speichern:', err);
    }
}

export function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (data && data.settings && Array.isArray(data.transactions)) {
            replaceState(data);
            return true;
        }
    } catch (err) {
        console.warn('Konnte lokale Daten nicht laden:', err);
    }
    return false;
}

export function loadDataFromFile(file) {
    return new Promise((resolve, reject) => {
        if (!file.name.endsWith('.json')) {
            reject('Bitte eine .json-Datei auswählen.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.settings && Array.isArray(data.transactions)) {
                    replaceState(data);
                    resolve();
                } else {
                    reject('Die Datei hat nicht das erwartete Amet-Format (settings/transactions fehlen).');
                }
            } catch (err) {
                reject(`Ungültiges JSON: ${err.message}`);
            }
        };
        reader.onerror = () => reject('Die Datei konnte nicht gelesen werden.');
        reader.readAsText(file);
    });
}

export function saveDataToFile() {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `amet-buchhalter-data_${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
