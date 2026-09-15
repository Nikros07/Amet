-- AMET — Migration 004: Geldbeutel (physisches Wallet) + Cash-Reserve zuhause.
-- Im Supabase-Dashboard unter "SQL Editor" NACH 003_wallet_expansion.sql ausführen.

alter table public.wallets drop constraint if exists wallets_key_check;
alter table public.wallets add constraint wallets_key_check
    check (key in ('account', 'phone_cash', 'brother', 'crypto', 'cash', 'wallet', 'home_cash'));
