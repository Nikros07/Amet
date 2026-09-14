# Amet — Private Finance

Privates Finance Command Center: trackt drei reale Geldbereiche (Konto, Bargeld in der Handyhülle, Reserve beim Bruder), rechnet daraus dein Gesamtvermögen und dein "direkt verfügbares" Geld gegen einen konfigurierbaren Zielbereich (Standard 100–150 €).

Kein Bank-Zugriff, kein Open Banking, keine automatische Synchronisierung — alle Transaktionen werden manuell erfasst.

> **Status**: Phasen A–D umgesetzt (Datenmodell/Persistenz/Schnelleingabe, Redesign + Navigation, Analytics/Goals/Budgets/Forecast). KI-Assistent ist clientseitig fertig, die Supabase Edge Function muss noch einmalig deployed werden (siehe unten).

## Setup

### 1. Supabase-Projekt

1. Projekt auf [supabase.com](https://supabase.com) anlegen (kostenlos).
2. Im SQL-Editor den kompletten Inhalt von [`supabase/schema.sql`](supabase/schema.sql) ausführen — legt Tabellen, Constraints und Row-Level-Security an.
3. Unter **Authentication → Providers** sicherstellen, dass "Email" aktiv ist, **Signups aber nicht öffentlich** sind (die App hat bewusst keinen Registrieren-Button).
4. Unter **Authentication → Users → Add user** deinen einen Account anlegen (E-Mail + Passwort, "Auto Confirm User" aktivieren).
5. Unter **Project Settings → API** die **Project URL** und den **anon public key** kopieren.

### 2. Client konfigurieren

In [`js/config.js`](js/config.js) die beiden Platzhalter durch deine echten Werte ersetzen:

```js
export const SUPABASE_URL = 'https://dein-projekt.supabase.co';
export const SUPABASE_ANON_KEY = 'dein-anon-key';
```

Der anon key ist laut Supabase-Design öffentlich (der eigentliche Schutz kommt aus Row-Level-Security) — er darf im Repo/Client stehen.

### 3. Lokal starten

Kein Build-Schritt nötig (Vanilla ES-Module). Über einen einfachen HTTP-Server servieren, z.B.:

```bash
python -m http.server 8420
```

`ES Modules` funktionieren nicht über `file://` — immer über `http://localhost:...` öffnen.

## Wie dein Geld modelliert wird

Drei Wallets, jede ein eigenes Konto im Ledger-Sinn:

- **Konto** (`account`) — normales Bankguthaben
- **Handyhülle** (`phone_cash`) — Bargeld-Notgroschen, normalerweise 50 €
- **Bruder** (`brother`) — Reserve, die dein Bruder für dich hält

Jede Transaktion ist genau einer von drei Typen:

- **Einnahme** — erhöht ein Wallet, zählt zum Vermögenszuwachs
- **Ausgabe** — verringert ein Wallet, zählt zum Vermögensrückgang
- **Transfer** — verschiebt Geld zwischen deinen eigenen Wallets, ändert dein **Gesamtvermögen nicht** (Konto sinkt, Bruder steigt exakt um denselben Betrag)

Wallet-Salden werden nie gespeichert, sondern immer live aus der kompletten Transaktionshistorie berechnet (`js/wallets.js`) — kein Risiko von Drift zwischen "Anzeige" und "Fakten".

**Direkt verfügbar** = Konto + Handyhülle. Der Zielbereich (Standard 100–150 €) ist in den Einstellungen änderbar.

## Schnelleingabe

Statt eines vollen Formulars kannst du oben im Dashboard kurze Ausdrücke eintippen:

- `+80 Arbeit` → Einnahme, 80 €, Kategorie "Arbeit"
- `-12 Essen` → Ausgabe, 12 €, Kategorie "Essen"
- `+300 Arbeit Metzgerei` → Einnahme, 300 €, Kategorie "Arbeit", Notiz "Metzgerei"
- `50 Konto zu Bruder` → Transfer, 50 €, Konto → Bruder

Das Ergebnis wird **nicht sofort gespeichert** — es füllt das normale Formular vor, du prüfst/korrigierst und bestätigst explizit.

## Navigation

Fünf Bereiche oben: **Dashboard** (Zahlen, Schnelleingabe, letzte Transaktionen), **Transactions** (Formular + Liste + Suche/Filter), **Analytics** (Vermögensverlauf, Income vs Expenses, Kategorien-Charts, Ausgabenbericht, Forecast), **Goals** (Sparziele + Budgets), **AI** (Assistent). **Settings** ist bewusst separat.

## Sparziele & Budgets

- **Sparziele**: Name + Zielbetrag anlegen, Fortschritt manuell per Beitrag erhöhen (kein automatisches Verknüpfen mit Transaktionen in dieser Version).
- **Budgets**: Monatslimit pro Ausgaben-Kategorie, Fortschrittsbalken zeigt Ist-Ausgaben des laufenden Monats gegen das Limit.

## KI-Assistent (AMET AI)

Wichtigstes Prinzip: **Die App berechnet alle Zahlen selbst** (`js/wallets.js`, `js/analytics.js`, `js/ai.js: computeFinancialSummary()`). Die KI bekommt nur das fertige JSON-Ergebnis und formuliert daraus eine kurze, persönliche Antwort — sie rechnet nie selbst und erfindet keine Zahlen.

Architektur: `Frontend → computeFinancialSummary() → Supabase Edge Function (ai-advisor) → OpenRouter (mit Modell-Fallback-Kette) → Antwort`. Der OpenRouter-Key liegt ausschließlich als Supabase-Secret auf dem Server, nie im Client.

### Deployment der Edge Function (einmalig)

Voraussetzung: [Supabase CLI](https://supabase.com/docs/guides/cli) installiert und eingeloggt (`supabase login`), Projekt verknüpft (`supabase link --project-ref <dein-ref>`).

```bash
supabase functions deploy ai-advisor
supabase secrets set OPENROUTER_API_KEY=sk-or-dein-key
```

Optional, um die Modelle zu ändern (sonst greifen sinnvolle Defaults):

```bash
supabase secrets set AI_MODEL_PRIMARY=anthropic/claude-3.5-haiku
supabase secrets set AI_MODEL_FALLBACK=openai/gpt-4o-mini,meta-llama/llama-3.1-8b-instruct
```

Fällt das primäre Modell aus (Fehler, Timeout, Rate Limit, ungültige Antwort), probiert die Funktion automatisch die Fallback-Modelle der Reihe nach durch.

## Technik

- HTML5, CSS3, Vanilla JavaScript (ES-Module, kein Build-Schritt)
- [Supabase](https://supabase.com) (Postgres + Auth) als Datenbank — Zugriff ausschließlich über Row-Level-Security, kein eigenes Backend nötig
- Chart.js via CDN für alle Diagramme
- Supabase Edge Function (Deno) als KI-Proxy zu OpenRouter
- Hostbar über GitHub Pages (Settings → Pages → Branch `main` / root); Supabase läuft unabhängig davon

## Sicherheit

- Keine Bank-API, kein Open Banking, keine automatischen Finanztransaktionen — die App verwaltet ausschließlich manuell eingetragene Daten.
- Zugriff nur nach Login (Supabase Auth), Daten pro Nutzer durch Row-Level-Security isoliert.
- Der Supabase **anon key** ist bewusst öffentlich (Standard-Pattern) — er gewährt ohne gültige Session keinen Zugriff auf fremde Zeilen.
- Ein künftiger KI-Assistent (OpenRouter) läuft serverseitig über eine Supabase Edge Function; der API-Key landet nie im Client.

## Lizenz

MIT
