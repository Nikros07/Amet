-- AMET — Migration 003: Krypto/Bargeld-Wallets + Anfangssaldo pro Wallet.
-- Im Supabase-Dashboard unter "SQL Editor" einmal komplett ausführen.
--
-- Hintergrund: Wallet-Salden werden weiterhin nie direkt gespeichert, sondern
-- aus der Transaktionshistorie berechnet (js/wallets.js). opening_balance ist
-- kein Widerspruch dazu, sondern der Startpunkt dieser Berechnung — der Betrag,
-- den ein Wallet schon hatte, BEVOR die erste Transaktion in AMET erfasst wurde.

alter table public.wallets drop constraint if exists wallets_key_check;
alter table public.wallets add constraint wallets_key_check
    check (key in ('account', 'phone_cash', 'brother', 'crypto', 'cash'));

alter table public.wallets add column if not exists opening_balance numeric not null default 0;
