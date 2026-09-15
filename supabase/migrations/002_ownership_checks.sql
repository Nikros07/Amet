-- AMET — Migration 002: Ownership-Checks für Fremdschlüssel
--
-- Lücke in schema.sql: Die RLS-Policies ("own rows only") prüfen nur
-- user_id = auth.uid() auf der jeweiligen Tabelle selbst. Die Foreign Keys
-- transactions.wallet_id, transactions.to_wallet_id, transactions.category_id
-- und budgets.category_id verweisen zwar auf eine EXISTIERENDE Zeile in
-- wallets/categories, prüfen aber nicht, dass diese Zeile demselben Nutzer
-- gehört wie die Transaktion/das Budget selbst.
--
-- Konkret: nichts in schema.sql hindert einen Client daran, eine Transaktion
-- mit user_id = auth.uid() (erlaubt der RLS-Check) aber wallet_id/to_wallet_id/
-- category_id eines FREMDEN Nutzers einzufügen, solange diese UUID irgendwo
-- in der wallets/categories-Tabelle existiert. Der fremde Nutzer sieht die
-- Zeile zwar nie (seine eigene RLS-Policy filtert transactions über
-- transactions.user_id, nicht über wallets/categories), trotzdem ist das ein
-- Integritäts-Loch und ein unnötiger Seitenkanal (man könnte über
-- Fehlermeldungen/Timing testen, ob eine geratene Wallet-/Kategorie-UUID bei
-- einem anderen Nutzer existiert). Diese Migration schließt die Lücke mit
-- BEFORE-Triggern, die bei jedem INSERT/UPDATE prüfen, dass referenzierte
-- Wallets/Kategorien demselben user_id gehören wie die Zeile selbst.
--
-- Ausführen: im Supabase-Dashboard unter "SQL Editor" NACH schema.sql einmal
-- komplett ausführen. Idempotent — kann gefahrlos mehrfach laufen. Ändert
-- keine bestehenden Daten, nur zukünftige Inserts/Updates werden geprüft.
-- (Falls in der Vergangenheit schon fremde Referenzen entstanden sein sollten,
-- meldet dieses Skript sie NICHT automatisch — bei Bedarf einmalig separat
-- mit einem SELECT gegen wallets/categories abgleichen.)

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

    return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists transactions_ownership_check on public.transactions;
create trigger transactions_ownership_check
    before insert or update on public.transactions
    for each row execute function public.check_transaction_ownership();

create or replace function public.check_budget_ownership()
returns trigger as $$
begin
    if new.category_id is not null and not exists (
        select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id
    ) then
        raise exception 'category_id gehört nicht dem Besitzer des Budgets';
    end if;

    return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists budgets_ownership_check on public.budgets;
create trigger budgets_ownership_check
    before insert or update on public.budgets
    for each row execute function public.check_budget_ownership();
