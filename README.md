# Amet — Buchhalter-Assistent

Dein persönlicher Finanzassistent im Stil von Stark Industries/JARVIS – mit Einnahmen-/Ausgaben-Tracking, Kategorien-Reports und Vermögensprojektion.

## Features

- 💰 **Einnahmen/Ausgaben-Tracking**: Transaktionen erfassen, bearbeiten, löschen
- 🏷️ **Kategorien**: Vorgefertigte Kategorien (u.a. Tabak, Alkohol, Ausrüstung) sowie eigene Kategorien
- 📊 **Reports**: Kreis- und Balkendiagramm zur Ausgaben-/Einnahmenverteilung (Chart.js)
- 🧾 **Steuerbericht**: Ausgaben nach Kategorie gruppiert, als Basis für mögliche Abzüge
- 📈 **Asset-Projektion**: Rechnet hoch, was eine prozentuale Reduktion einzelner Ausgabenkategorien über X Monate an zusätzlicher Ersparnis bringt
- ⚙️ **Einstellungen**: Steuer-ID (SI), Währung, eigene Kategorien verwalten
- 💾 **Import/Export**: Daten als JSON-Datei sichern und wieder laden — kein Backend, alles bleibt lokal

## Schnellstart

1. `index.html` im Browser öffnen (Doppelklick genügt, oder via GitHub Pages hosten)
2. Optional: vorhandene `amet-buchhalter-data.json` importieren
3. Transaktion hinzufügen: Typ, Beschreibung, Betrag, Datum, Kategorie wählen
4. Reports und Steuerbericht aktualisieren sich automatisch
5. Unter "Asset-Projektion": Monatshorizont + aktuelle Sparrate eintragen, pro Kategorie eine Reduktion in % angeben, "Projektion berechnen" klicken
6. Vor dem Schließen: "Daten exportieren", um nichts zu verlieren

## Datenformat

```json
{
  "settings": { "taxId": "DE123456789", "currency": "EUR" },
  "categories": {
    "income": ["Gehalt", "Freelance", "Geschenke", "Sonstige"],
    "expense": ["Lebensmittel", "Miete", "Transport", "Freizeit", "Tabak", "Alkohol", "Ausrüstung", "Abonnements", "Sonstige"]
  },
  "transactions": [
    { "id": "...", "type": "expense", "description": "Zigaretten", "amount": 8.5, "date": "2026-09-14", "category": "Tabak" }
  ]
}
```

## Technik

- HTML5, CSS3 (CSS-Variablen), Vanilla JavaScript (ES6+)
- Chart.js via CDN
- Kein Backend — läuft komplett im Browser, Daten verlassen nie den eigenen Rechner
- Hostbar direkt über GitHub Pages (Settings → Pages → Branch `main` / root)

## Wichtiger Hinweis

Dieses Tool dient der persönlichen Finanzübersicht und Motivation. Steuerbericht und Asset-Projektion sind vereinfachte Berechnungen (linear, ohne Zinseszins) und ersetzen keine professionelle Steuer- oder Finanzberatung.

## Lizenz

MIT
