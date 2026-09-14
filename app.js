// Amet — Buchhalter-Assistent
// Datenmodell, Speicherung (Import/Export als JSON), Rendering und Interaktion.

const STORAGE_KEY = 'amet-buchhalter-data';
const PAYMENT_METHODS = ['Bar', 'Debitkarte', 'Kreditkarte', 'PayPal', 'Überweisung', 'Krypto'];

let currentData = {
    settings: {
        taxId: '', // Steuer-ID
        currency: 'EUR'
    },
    categories: {
        income: ['Gehalt', 'Freelance', 'Geschenke', 'Sonstige'],
        expense: ['Lebensmittel', 'Miete', 'Transport', 'Freizeit',
                  'Tabak', 'Alkohol', 'Ausrüstung', 'Abonnements', 'Sonstige']
    },
    transactions: [] // {id, type, description, amount, date, category, paymentMethod}
};

let editingTransactionId = null;
let expensePieChart = null;
let incomeBarChart = null;
let paymentMethodChart = null;

function generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function isValidCategory(type, category) {
    return currentData.categories[type] && currentData.categories[type].includes(category);
}

// ---------- Lokale Datenbank (localStorage) ----------

function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
    } catch (err) {
        console.warn('Konnte nicht lokal speichern:', err);
    }
}

function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (data && data.settings && Array.isArray(data.transactions)) {
            if (!data.categories) data.categories = currentData.categories;
            currentData = data;
            return true;
        }
    } catch (err) {
        console.warn('Konnte lokale Daten nicht laden:', err);
    }
    return false;
}

// ---------- Datei-Import/Export (Backup) ----------

function loadDataFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.settings && data.transactions !== undefined) {
                    if (!data.categories) {
                        data.categories = currentData.categories;
                    }
                    currentData = data;
                    resolve(true);
                } else {
                    reject('Ungültiges Dateiformat');
                }
            } catch (err) {
                reject(`Fehler beim Parsen der JSON-Datei: ${err.message}`);
            }
        };
        reader.onerror = () => reject('Fehler beim Lesen der Datei');
        reader.readAsText(file);
    });
}

function saveDataToFile() {
    const dataStr = JSON.stringify(currentData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'amet-buchhalter-data.json';
    a.click();
    URL.revokeObjectURL(url);
}

// ---------- Zusammenfassung & Steuerbericht ----------

function renderSummary() {
    const container = document.getElementById('summaryContainer');
    const incomeTotal = currentData.transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = currentData.transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    const net = incomeTotal - expenseTotal;

    container.innerHTML = `
        <div class="summary-card income">
            <h3>Gesamteinnahmen</h3>
            <div class="value">${incomeTotal.toFixed(2)} ${currentData.settings.currency}</div>
        </div>
        <div class="summary-card expense">
            <h3>Gesamtausgaben</h3>
            <div class="value">${expenseTotal.toFixed(2)} ${currentData.settings.currency}</div>
        </div>
        <div class="summary-card net">
            <h3>Netto</h3>
            <div class="value">${net.toFixed(2)} ${currentData.settings.currency}</div>
        </div>
    `;
}

function renderTaxReport() {
    const expensesByCategory = currentData.transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
            const cat = t.category || 'Sonstige';
            acc[cat] = (acc[cat] || 0) + t.amount;
            return acc;
        }, {});

    let table = '<table class="tax-report-table"><thead><tr><th>Kategorie</th><th>Betrag</th></tr></thead><tbody>';
    let totalDeductible = 0;
    for (const [category, amount] of Object.entries(expensesByCategory)) {
        table += `<tr><td>${category}</td><td>${amount.toFixed(2)} ${currentData.settings.currency}</td></tr>`;
        totalDeductible += amount;
    }
    table += `<tr><td><strong>Gesamt abzugsfähig</strong></td><td><strong>${totalDeductible.toFixed(2)} ${currentData.settings.currency}</strong></td></tr>`;
    table += '</tbody></table>';

    document.getElementById('taxReportContent').innerHTML = `
        <p>Basierend auf deinen Ausgaben hier ist eine Übersicht möglicher abzugsfähiger Beträge gemäß deiner Steuer-ID (SI): <strong>${currentData.settings.taxId || 'nicht gesetzt'}</strong>.</p>
        ${table}
        <p><em>Hinweis: Dies ist keine Steuerberatung. Konsultiere einen Steuerberater für verbindliche Auskünfte.</em></p>
    `;
}

// ---------- Kategorie-Reports (Charts) ----------

const PALETTE = ['#d4af37', '#8b0000', '#c81e1e', '#a89a83', '#f4d675', '#5c4a2e', '#6b1414', '#e8c96a'];

Chart.defaults.color = '#a89a83';
Chart.defaults.borderColor = '#3a2f22';
Chart.defaults.font.family = "'Inter', sans-serif";

function renderReports() {
    const expenseData = currentData.transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
            const cat = t.category || 'Sonstige';
            acc[cat] = (acc[cat] || 0) + t.amount;
            return acc;
        }, {});

    const incomeData = currentData.transactions
        .filter(t => t.type === 'income')
        .reduce((acc, t) => {
            const cat = t.category || 'Sonstige';
            acc[cat] = (acc[cat] || 0) + t.amount;
            return acc;
        }, {});

    const paymentData = currentData.transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
            const method = t.paymentMethod || 'Bar';
            acc[method] = (acc[method] || 0) + t.amount;
            return acc;
        }, {});

    if (expensePieChart) expensePieChart.destroy();
    if (incomeBarChart) incomeBarChart.destroy();
    if (paymentMethodChart) paymentMethodChart.destroy();

    const expenseCtx = document.getElementById('expensePieChart');
    if (expenseCtx && Object.keys(expenseData).length > 0) {
        expensePieChart = new Chart(expenseCtx, {
            type: 'pie',
            data: {
                labels: Object.keys(expenseData),
                datasets: [{
                    data: Object.values(expenseData),
                    backgroundColor: PALETTE,
                    borderColor: '#14100d',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    const incomeCtx = document.getElementById('incomeBarChart');
    if (incomeCtx && Object.keys(incomeData).length > 0) {
        incomeBarChart = new Chart(incomeCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(incomeData),
                datasets: [{
                    label: 'Betrag (' + currentData.settings.currency + ')',
                    data: Object.values(incomeData),
                    backgroundColor: '#3bb54a',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: '#3a2f22' } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    const paymentCtx = document.getElementById('paymentMethodChart');
    if (paymentCtx && Object.keys(paymentData).length > 0) {
        paymentMethodChart = new Chart(paymentCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(paymentData),
                datasets: [{
                    data: Object.values(paymentData),
                    backgroundColor: PALETTE,
                    borderColor: '#14100d',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
}

// ---------- Asset-Projektion ----------

function renderProjectionControls() {
    const container = document.getElementById('categoryReducers');
    container.innerHTML = '';

    const expenseTotals = currentData.transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
            const cat = t.category || 'Sonstige';
            acc[cat] = (acc[cat] || 0) + t.amount;
            return acc;
        }, {});

    Object.entries(expenseTotals)
        .filter(([_, amount]) => amount > 0)
        .forEach(([category, amount]) => {
            const reducerDiv = document.createElement('div');
            reducerDiv.className = 'category-reducer';
            reducerDiv.innerHTML = `
                <label>${category}</label>
                <div>aktuell: ${amount.toFixed(2)} ${currentData.settings.currency}/Monat</div>
                <input type="number" id="reducer_${category.replace(/\s+/g, '_')}"
                       placeholder="%" min="0" max="100" value="0">
                <small>Reduktion</small>
            `;
            container.appendChild(reducerDiv);
        });
}

function calculateProjection() {
    const months = parseInt(document.getElementById('projectionMonths').value) || 6;
    const currentSavingsRate = parseFloat(document.getElementById('savageRate').value) || 0;

    let adjustedSavings = currentSavingsRate;
    const expenseTotals = currentData.transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
            const cat = t.category || 'Sonstige';
            acc[cat] = (acc[cat] || 0) + t.amount;
            return acc;
        }, {});

    Object.entries(expenseTotals).forEach(([category, amount]) => {
        const reducerInput = document.getElementById(`reducer_${category.replace(/\s+/g, '_')}`);
        const reductionPercent = reducerInput ? (parseFloat(reducerInput.value) || 0) : 0;
        adjustedSavings += amount * (reductionPercent / 100);
    });

    const projectedSavings = adjustedSavings * months;
    document.getElementById('projectionResult').innerHTML = `
        <h3>Ergebnis</h3>
        <p>Aktuelle monatliche Sparrate: <strong>${currentSavingsRate.toFixed(2)} ${currentData.settings.currency}</strong></p>
        <p>Angepasste Sparrate (nach Reduktionen): <strong>${adjustedSavings.toFixed(2)} ${currentData.settings.currency}</strong></p>
        <p>Projizierte Ersparnis in ${months} Monaten: <strong>${projectedSavings.toFixed(2)} ${currentData.settings.currency}</strong></p>
        <p><em>Das ist dein zusätzlicher Vermögenszuwachs, wenn du die angegebenen Ausgaben reduzierst.</em></p>
    `;
}

// ---------- Transaktionen ----------

function renderTransactions() {
    const container = document.getElementById('transactionsContainer');
    if (currentData.transactions.length === 0) {
        container.innerHTML = '<p>Keine Transaktionen vorhanden. Füge eine hinzu!</p>';
        return;
    }

    let table = '<table class="transaction-table"><thead><tr>';
    table += '<th>Datum</th><th>Typ</th><th>Beschreibung</th><th>Betrag</th><th>Kategorie</th><th>Zahlungsart</th><th>Aktionen</th>';
    table += '</tr></thead><tbody>';

    currentData.transactions
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach(t => {
            const date = new Date(t.date).toLocaleDateString('de-DE');
            table += `<tr>
                <td class="transaction-date">${date}</td>
                <td class="transaction-type-${t.type}">${t.type === 'income' ? 'Einnahme' : 'Ausgabe'}</td>
                <td>${t.description}</td>
                <td>${t.amount.toFixed(2)} ${currentData.settings.currency}</td>
                <td>${t.category || '-'}</td>
                <td>${t.paymentMethod || '-'}</td>
                <td>
                    <button class="editBtn" data-id="${t.id}">Bearbeiten</button>
                    <button class="deleteBtn" data-id="${t.id}">Löschen</button>
                </td>
            </tr>`;
        });

    table += '</tbody></table>';
    container.innerHTML = table;

    container.querySelectorAll('.editBtn').forEach(btn => {
        btn.addEventListener('click', (e) => editTransaction(e.target.dataset.id));
    });
    container.querySelectorAll('.deleteBtn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteTransaction(e.target.dataset.id));
    });
}

function renderTransactionForm() {
    const container = document.getElementById('formContainer');
    const isEditing = editingTransactionId !== null;
    const transaction = isEditing
        ? currentData.transactions.find(t => t.id === editingTransactionId)
        : { type: 'income', description: '', amount: '', date: new Date().toISOString().split('T')[0], category: '', paymentMethod: 'Bar' };

    // Falls die gespeicherte Kategorie inzwischen gelöscht wurde, trotzdem anzeigen
    // statt sie stillschweigend durch die erste Listenoption zu ersetzen.
    let categoryPool = currentData.categories[transaction.type];
    if (transaction.category && !categoryPool.includes(transaction.category)) {
        categoryPool = [transaction.category, ...categoryPool];
    }
    const categoryOptions = categoryPool
        .map(cat => `<option value="${cat}" ${transaction.category === cat ? 'selected' : ''}>${cat}</option>`)
        .join('');
    const paymentMethodOptions = PAYMENT_METHODS
        .map(pm => `<option value="${pm}" ${transaction.paymentMethod === pm ? 'selected' : ''}>${pm}</option>`)
        .join('');

    container.innerHTML = `
        <h2>${isEditing ? 'Transaktion bearbeiten' : 'Transaktion hinzufügen'}</h2>
        <form id="transactionForm">
            <div class="form-group">
                <label for="type">Typ*</label>
                <select id="type" required>
                    <option value="income" ${transaction.type === 'income' ? 'selected' : ''}>Einnahme</option>
                    <option value="expense" ${transaction.type === 'expense' ? 'selected' : ''}>Ausgabe</option>
                </select>
            </div>
            <div class="form-group">
                <label for="description">Beschreibung*</label>
                <input type="text" id="description" required value="${transaction.description}">
            </div>
            <div class="form-group">
                <label for="amount">Betrag* (${currentData.settings.currency})</label>
                <input type="number" id="amount" step="0.01" min="0" required value="${transaction.amount || ''}">
            </div>
            <div class="form-group">
                <label for="date">Datum*</label>
                <input type="date" id="date" required value="${transaction.date}">
            </div>
            <div class="form-group">
                <label for="category">Kategorie*</label>
                <select id="category" required>${categoryOptions}</select>
            </div>
            <div class="form-group">
                <label for="paymentMethod">Zahlungsart*</label>
                <select id="paymentMethod" required>${paymentMethodOptions}</select>
            </div>
            <div class="form-actions">
                <button type="submit" class="addBtn">${isEditing ? 'Aktualisieren' : 'Hinzufügen'}</button>
                <button type="button" class="cancelBtn">Abbrechen</button>
            </div>
        </form>
    `;

    const form = document.getElementById('transactionForm');
    const typeSelect = form.querySelector('#type');
    typeSelect.addEventListener('change', () => {
        const catSelect = form.querySelector('#category');
        catSelect.innerHTML = currentData.categories[typeSelect.value]
            .map(cat => `<option value="${cat}">${cat}</option>`)
            .join('');
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const description = form.description.value.trim();
        const amount = parseFloat(form.amount.value);
        const date = form.date.value;

        if (!description || description.length < 2) {
            alert('Bitte gib eine Beschreibung mit mindestens 2 Zeichen ein.');
            return;
        }
        if (isNaN(amount) || amount <= 0) {
            alert('Bitte gib einen gültigen Betrag größer als 0 ein.');
            return;
        }
        if (!date) {
            alert('Bitte wähle ein Datum aus.');
            return;
        }

        const transactionData = {
            type: form.type.value,
            description,
            amount,
            date,
            category: form.category.value,
            paymentMethod: form.paymentMethod.value
        };

        if (isEditing) {
            const index = currentData.transactions.findIndex(t => t.id === editingTransactionId);
            currentData.transactions[index] = { ...transactionData, id: editingTransactionId };
            editingTransactionId = null;
        } else {
            currentData.transactions.push({ ...transactionData, id: generateId() });
        }

        renderApp();
    });

    form.querySelector('.cancelBtn').addEventListener('click', () => {
        editingTransactionId = null;
        renderApp();
    });
}

function editTransaction(id) {
    editingTransactionId = id;
    renderApp();
}

function deleteTransaction(id) {
    if (confirm('Möchtest du diese Transaktion wirklich löschen?')) {
        currentData.transactions = currentData.transactions.filter(t => t.id !== id);
        renderApp();
    }
}

// ---------- Einstellungen & Kategorie-Verwaltung ----------

function renderSettingsForm() {
    const container = document.getElementById('settingsContainer');
    container.innerHTML = `
        <h2>Einstellungen</h2>
        <form id="settingsForm">
            <div class="settings-form">
                <div class="form-group">
                    <label for="taxId">Steuer-ID (SI)*</label>
                    <input type="text" id="taxId" required value="${currentData.settings.taxId}">
                    <small>Für Steuerberichte benötigt</small>
                </div>
                <div class="form-group">
                    <label for="currency">Währung*</label>
                    <input type="text" id="currency" required value="${currentData.settings.currency}" maxlength="3">
                    <small>z.B. EUR, USD, CHF</small>
                </div>
            </div>
            <div class="form-actions" style="margin-top: 20px;">
                <button type="submit" class="addBtn">Einstellungen speichern</button>
            </div>
            <div class="form-group">
                <label>Kategorien verwalten</label>
                <div id="categoryManager">
                    <div id="incomeCategories">
                        <h4>Einnahmen-Kategorien</h4>
                        <div id="incomeCategoryList" class="category-list"></div>
                        <input type="text" id="newIncomeCategory" placeholder="Neue Kategorie hinzufügen">
                        <button type="button" id="addIncomeCategory" class="addBtn">Hinzufügen</button>
                    </div>
                    <div id="expenseCategories">
                        <h4>Ausgaben-Kategorien</h4>
                        <div id="expenseCategoryList" class="category-list"></div>
                        <input type="text" id="newExpenseCategory" placeholder="Neue Kategorie hinzufügen">
                        <button type="button" id="addExpenseCategory" class="addBtn">Hinzufügen</button>
                    </div>
                </div>
            </div>
        </form>
    `;

    const form = document.getElementById('settingsForm');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const taxId = form.taxId.value.trim();
        const currency = form.currency.value.trim().toUpperCase();

        if (!taxId || taxId.length < 5) {
            alert('Bitte gib eine gültige Steuer-ID ein (mindestens 5 Zeichen).');
            return;
        }
        if (!currency || !/^[A-Z]{3}$/.test(currency)) {
            alert('Bitte gib einen gültigen 3-stelligen Währungscode ein (z.B. EUR).');
            return;
        }

        currentData.settings.taxId = taxId;
        currentData.settings.currency = currency;
        renderApp();
        alert('Einstellungen gespeichert!');
    });

    renderCategoryManager();
}

function renderCategoryManager() {
    const incomeList = document.getElementById('incomeCategoryList');
    const expenseList = document.getElementById('expenseCategoryList');

    incomeList.innerHTML = currentData.categories.income
        .map(cat => `<span class="category-tag">${cat}<button type="button" data-type="income" data-category="${cat}">×</button></span>`)
        .join('');
    expenseList.innerHTML = currentData.categories.expense
        .map(cat => `<span class="category-tag">${cat}<button type="button" data-type="expense" data-category="${cat}">×</button></span>`)
        .join('');

    document.querySelectorAll('.category-tag button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.target.dataset.type;
            const category = e.target.dataset.category;
            if (confirm(`Kategorie "${category}" wirklich löschen?`)) {
                currentData.categories[type] = currentData.categories[type].filter(c => c !== category);
                renderApp();
            }
        });
    });

    document.getElementById('addIncomeCategory').addEventListener('click', () => {
        const input = document.getElementById('newIncomeCategory');
        const category = input.value.trim();
        if (category && !currentData.categories.income.includes(category)) {
            currentData.categories.income.push(category);
            renderApp();
        }
    });

    document.getElementById('addExpenseCategory').addEventListener('click', () => {
        const input = document.getElementById('newExpenseCategory');
        const category = input.value.trim();
        if (category && !currentData.categories.expense.includes(category)) {
            currentData.categories.expense.push(category);
            renderApp();
        }
    });
}

// ---------- KI-Tipps (lokale Heuristik) ----------
// Hinweis: Das ist bewusst kein Aufruf an ein echtes LLM. Eine Web-App ohne Backend
// kann keinen API-Key sicher halten — jeder könnte ihn aus dem Quelltext auslesen
// und auf eure Kosten nutzen. Echte KI-Tipps bräuchten einen kleinen Server, der
// den Key hält und die Anfrage weiterleitet. Bis dahin: einfache Regeln auf den
// eigenen Daten, die schon einen echten Mehrwert liefern.

function generateTips() {
    const tips = [];
    const expenses = currentData.transactions.filter(t => t.type === 'expense');
    const incomeTotal = currentData.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenseTotal = expenses.reduce((s, t) => s + t.amount, 0);

    if (currentData.transactions.length === 0) {
        tips.push('Noch keine Transaktionen erfasst. Trag deine erste Ausgabe oder Einnahme ein, dann kann ich dir was sagen.');
    } else {
        if (expenseTotal > incomeTotal) {
            tips.push(`Du gibst mehr aus (${expenseTotal.toFixed(2)} ${currentData.settings.currency}) als du einnimmst (${incomeTotal.toFixed(2)} ${currentData.settings.currency}). Das läuft auf Dauer nicht gut — schau dir deine größte Ausgabenkategorie unten an.`);
        }

        const byCategory = expenses.reduce((acc, t) => {
            const cat = t.category || 'Sonstige';
            acc[cat] = (acc[cat] || 0) + t.amount;
            return acc;
        }, {});
        const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
            const [topCategory, topAmount] = sorted[0];
            const share = expenseTotal > 0 ? (topAmount / expenseTotal * 100).toFixed(0) : 0;
            tips.push(`Größter Posten: "${topCategory}" mit ${topAmount.toFixed(2)} ${currentData.settings.currency} (${share}% deiner Ausgaben).`);
        }

        ['Tabak', 'Alkohol'].forEach(cat => {
            if (byCategory[cat] > 0) {
                const yearly = byCategory[cat] * 12;
                tips.push(`Bei "${cat}" gehen ${byCategory[cat].toFixed(2)} ${currentData.settings.currency}/Monat raus — hochgerechnet ${yearly.toFixed(2)} ${currentData.settings.currency}/Jahr. Schau dir die Asset-Projektion an, was eine Reduktion bringen würde.`);
            }
        });

        const byMethod = expenses.reduce((acc, t) => {
            const m = t.paymentMethod || 'Bar';
            acc[m] = (acc[m] || 0) + t.amount;
            return acc;
        }, {});
        const topMethod = Object.entries(byMethod).sort((a, b) => b[1] - a[1])[0];
        if (topMethod && Object.keys(byMethod).length > 1) {
            tips.push(`Die meisten Ausgaben laufen über "${topMethod[0]}". Wenn du mehrere Zahlungsarten mischst, lohnt sich ein Blick, ob eine davon (z.B. Kreditkarte) versteckte Gebühren hat.`);
        }
    }

    return tips;
}

function renderAiTips() {
    const list = document.getElementById('aiTipsList');
    const tips = generateTips();
    list.innerHTML = tips.map(tip => `<li>${tip}</li>`).join('');
}

// ---------- App-Lebenszyklus ----------

function renderApp() {
    renderSummary();
    renderTaxReport();
    renderReports();
    renderTransactionForm();
    renderTransactions();
    renderProjectionControls();
    renderSettingsForm();
    saveToStorage();
}

document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();

    document.getElementById('generateTipsBtn').addEventListener('click', renderAiTips);

    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            loadDataFromFile(file).then(() => {
                alert('Daten erfolgreich geladen!');
                renderApp();
            }).catch(err => {
                alert('Fehler beim Laden: ' + err);
            });
            e.target.value = '';
        }
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
        saveDataToFile();
    });

    document.getElementById('calculateProjection').addEventListener('click', calculateProjection);

    renderApp();
});
