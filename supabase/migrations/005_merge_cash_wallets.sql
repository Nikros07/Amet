-- AMET — Migration 005: Cash + Cash-Reserve zuhause zusammenlegen in Geldbeutel.
-- Im Supabase-Dashboard unter "SQL Editor" NACH 004_wallet_expansion_2.sql ausführen.
--
-- Hintergrund: Bargeld landet in der Praxis ohnehin immer im Geldbeutel —
-- "Bargeld" und "Cash-Reserve zuhause" als eigene Wallets waren unnötige
-- Aufteilung ohne echten Unterschied. Diese Migration führt beide in das
-- bestehende "wallet"-Wallet (Geldbeutel) zusammen: Anfangssalden werden
-- addiert, Transaktionen umgehängt, die alten Wallet-Zeilen gelöscht.

-- 1) Transfers, die durch die Zusammenlegung zu einem "Transfer zu sich
--    selbst" würden (z.B. Cash -> Geldbeutel, oder Cash -> Cash-Reserve
--    zuhause), löschen. Finanziell neutral: so ein Transfer verschiebt Geld
--    zwischen zwei Töpfen, die danach derselbe Topf sind — netto ±0 auf den
--    zusammengelegten Saldo, egal ob die Buchung bleibt oder nicht.
delete from public.transactions t
where t.type = 'transfer'
  and exists (
      select 1 from public.wallets a, public.wallets b
      where a.id = t.wallet_id and b.id = t.to_wallet_id
        and a.user_id = t.user_id and b.user_id = t.user_id
        and (
            (a.key = 'wallet' and b.key in ('cash', 'home_cash'))
            or (b.key = 'wallet' and a.key in ('cash', 'home_cash'))
            or (a.key in ('cash', 'home_cash') and b.key in ('cash', 'home_cash'))
        )
  );

-- 2) Restliche Transaktionen (Einnahme/Ausgabe auf cash/home_cash, oder ein
--    Transfer, dessen andere Seite ein echtes anderes Wallet ist) aufs
--    Geldbeutel-Wallet umhängen.
update public.transactions t
set wallet_id = w.id
from public.wallets old, public.wallets w
where old.id = t.wallet_id
  and old.key in ('cash', 'home_cash')
  and w.user_id = old.user_id
  and w.key = 'wallet';

update public.transactions t
set to_wallet_id = w.id
from public.wallets old, public.wallets w
where old.id = t.to_wallet_id
  and old.key in ('cash', 'home_cash')
  and w.user_id = old.user_id
  and w.key = 'wallet';

-- 3) Anfangssalden von cash/home_cash ins Geldbeutel-Wallet addieren.
update public.wallets w
set opening_balance = w.opening_balance + coalesce((
    select sum(o.opening_balance) from public.wallets o
    where o.user_id = w.user_id and o.key in ('cash', 'home_cash')
), 0)
where w.key = 'wallet';

-- 4) Die jetzt überflüssigen Wallet-Zeilen löschen.
delete from public.wallets where key in ('cash', 'home_cash');

-- 5) Constraint wieder verengen — cash/home_cash sind keine gültigen Keys mehr.
alter table public.wallets drop constraint if exists wallets_key_check;
alter table public.wallets add constraint wallets_key_check
    check (key in ('account', 'phone_cash', 'brother', 'crypto', 'wallet'));
