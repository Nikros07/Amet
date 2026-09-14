import { loadFromStorage, saveToStorage, loadDataFromFile, saveDataToFile } from './storage.js';
import { renderSummary, renderTaxReport } from './reports.js';
import { renderCharts } from './charts.js';
import { renderProjectionControls, calculateProjection } from './projection.js';
import { renderAiTips } from './tips.js';
import {
    renderTransactionForm,
    renderTransactions,
    setOnChange as setTransactionsOnChange,
    setListFilters
} from './transactions.js';
import { renderSettingsForm, setOnChange as setSettingsOnChange } from './settings.js';
import { showToast } from './toast.js';

function renderApp() {
    renderSummary();
    renderTaxReport();
    renderCharts();
    renderTransactionForm();
    renderTransactions();
    renderProjectionControls();
    renderSettingsForm();
    saveToStorage();
}

setTransactionsOnChange(renderApp);
setSettingsOnChange(renderApp);

function wireStaticControls() {
    document.getElementById('generateTipsBtn').addEventListener('click', renderAiTips);
    document.getElementById('calculateProjection').addEventListener('click', calculateProjection);

    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
            await loadDataFromFile(file);
            showToast('Daten erfolgreich importiert.', { type: 'success' });
            renderApp();
        } catch (err) {
            showToast(`Import fehlgeschlagen: ${err}`, { type: 'error', duration: 6000 });
        }
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
        saveDataToFile();
        showToast('Backup wird heruntergeladen…', { type: 'info' });
    });

    const searchInput = document.getElementById('transactionSearch');
    const typeFilter = document.getElementById('transactionTypeFilter');
    searchInput.addEventListener('input', () => setListFilters({ search: searchInput.value }));
    typeFilter.addEventListener('change', () => setListFilters({ type: typeFilter.value }));
}

document.addEventListener('DOMContentLoaded', () => {
    const hadSavedData = loadFromStorage();
    wireStaticControls();
    renderApp();
    if (hadSavedData) {
        showToast('Willkommen zurück — deine Daten wurden geladen.', { type: 'info', duration: 3000 });
    }
});
