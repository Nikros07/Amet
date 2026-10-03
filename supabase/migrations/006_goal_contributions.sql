-- AMET — Migration 006: Sparziel-Beiträge als echte Buchungen.
-- Im Supabase-Dashboard unter "SQL Editor" NACH 005_merge_cash_wallets.sql ausführen.
--
-- Ein Beitrag zu einem Sparziel wird jetzt als Transaktion vom Typ 'goal'
-- gebucht: er zieht den Betrag vom gewählten Wallet ab (Direkt verfügbar sinkt),
-- zählt aber weiter zum Gesamtvermögen (wie ein Transfer in einen eigenen Topf).
-- Wird ein Sparziel gelöscht, verschwinden seine Beiträge per CASCADE und das
-- Geld ist automatisch wieder auf den Wallets (Salden werden aus der
-- Transaktionshistorie berechnet).

alter table public.transactions add column if not exists goal_id uuid
    references public.goals(id) on delete cascade;

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check
    check (type in ('income', 'expense', 'transfer', 'goal'));

alter table public.transactions drop constraint if exists goal_needs_goal_id;
alter table public.transactions add constraint goal_needs_goal_id
    check ((type = 'goal' and goal_id is not null) or (type <> 'goal' and goal_id is null));

create index if not exists transactions_goal_idx on public.transactions (goal_id);

-- Ownership-Check (aus Migration 002) um goal_id erweitern.
create or replace function public.check_transaction_ownership()
returns trigger as $$
begin
    if new.wallet_id is not null and not exists (
        select 1 from public.wallets w where w.id = new.wallet_id and w.user_id = new.user_id
    ) then
        raise exception 'wallet_id gehört nicht dem Besitzer der Transaktion';
    end if;

    if new.to_wallet_id is not null and not exists (
        select 1 from public.wallets w where w.id = new.to_wallet_id and w.user_id = new.user_id
    ) then
        raise exception 'to_wallet_id gehört nicht dem Besitzer der Transaktion';
    end if;

    if new.category_id is not null and not exists (
        select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id
    ) then
        raise exception 'category_id gehört nicht dem Besitzer der Transaktion';
    end if;

    if new.goal_id is not null and not exists (
        select 1 from public.goals g where g.id = new.goal_id and g.user_id = new.user_id
    ) then
        raise exception 'goal_id gehört nicht dem Besitzer der Transaktion';
    end if;

    return new;
end;
$$ language plpgsql security definer set search_path = public;
