-- AMET — Supabase-Schema (Phase A)
-- Im Supabase-Dashboard unter "SQL Editor" einmal komplett ausführen.
--
-- Ledger-Prinzip: Wallet-Salden werden NICHT gespeichert, sondern immer aus
-- der Transaktionshistorie berechnet (siehe js/wallets.js). Das verhindert
-- Drift zwischen gespeichertem Saldo und tatsächlichen Buchungen.

create extension if not exists pgcrypto;

-- ---------- Tabellen ----------

create table if not exists public.settings (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references auth.users(id) on delete cascade,
    direct_available_min numeric not null default 100,
    direct_available_max numeric not null default 150,
    currency text not null default 'EUR',
    created_at timestamptz not null default now()
);

create table if not exists public.wallets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    key text not null check (key in ('account', 'phone_cash', 'brother')),
    name text not null,
    created_at timestamptz not null default now(),
    unique (user_id, key)
);

create table if not exists public.categories (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    type text not null check (type in ('income', 'expense')),
    name text not null,
    created_at timestamptz not null default now(),
    unique (user_id, type, name)
);

create table if not exists public.transactions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    type text not null check (type in ('income', 'expense', 'transfer')),
    amount numeric not null check (amount > 0),
    date date not null,
    wallet_id uuid not null references public.wallets(id) on delete restrict,
    to_wallet_id uuid references public.wallets(id) on delete restrict,
    category_id uuid references public.categories(id) on delete set null,
    note text,
    work_hours numeric,
    work_rate numeric,
    created_at timestamptz not null default now(),
    constraint transfer_needs_target check (
        (type = 'transfer' and to_wallet_id is not null and to_wallet_id <> wallet_id)
        or (type <> 'transfer' and to_wallet_id is null)
    )
);

create table if not exists public.goals (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    target_amount numeric not null check (target_amount > 0),
    current_amount numeric not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.budgets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    category_id uuid not null references public.categories(id) on delete cascade,
    month date not null,
    limit_amount numeric not null check (limit_amount > 0),
    created_at timestamptz not null default now(),
    unique (user_id, category_id, month)
);

create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);

-- ---------- Row-Level-Security ----------
-- Jede Tabelle: ein Nutzer sieht/ändert ausschließlich seine eigenen Zeilen.

alter table public.settings enable row level security;
alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;
alter table public.budgets enable row level security;

do $$
declare
    t text;
begin
    foreach t in array array['settings', 'wallets', 'categories', 'transactions', 'goals', 'budgets']
    loop
        execute format('drop policy if exists "own rows only" on public.%I', t);
        execute format(
            'create policy "own rows only" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
            t
        );
    end loop;
end $$;

-- ---------- Hinweis zum Login ----------
-- Die App hat keinen öffentlichen Signup-Button. Lege deinen einen Nutzer an unter
-- Supabase-Dashboard → Authentication → Users → "Add user" (E-Mail + Passwort,
-- "Auto Confirm User" aktivieren). Wallets/Kategorien/Settings legt die App beim
-- ersten Login automatisch an (siehe js/db.js: ensureDefaults()).
