create table public.products (
  id text primary key,
  name text not null,
  description text not null default '',
  category text not null,
  price integer not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key,
  reference text not null unique,
  completed_at timestamptz not null,
  total integer not null check (total >= 0),
  payment_method text not null check (payment_method in ('Cash', 'QR Payment', 'Credit/Debit Card')),
  amount_paid integer not null check (amount_paid >= total),
  change_amount integer not null check (change_amount = amount_paid - total),
  status text not null check (status = 'Payment Successful'),
  created_at timestamptz not null default now()
);

create table public.transaction_items (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.transactions(id) on delete restrict,
  product_id text not null,
  product_name text not null,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  subtotal integer not null check (subtotal = unit_price * quantity)
);

create index transaction_items_transaction_id_idx on public.transaction_items(transaction_id);

alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;

create policy "Anyone can view active products"
on public.products for select
to anon, authenticated
using (active = true);

create or replace function public.create_pos_transaction(transaction_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := (transaction_data->>'id')::uuid;
  expected_total integer;
  supplied_total integer := (transaction_data->>'total')::integer;
begin
  if jsonb_typeof(transaction_data->'items') <> 'array' or jsonb_array_length(transaction_data->'items') = 0 then
    raise exception 'Transaction requires at least one item';
  end if;

  select sum((item->>'subtotal')::integer)
  into expected_total
  from jsonb_array_elements(transaction_data->'items') item
  where (item->>'quantity')::integer > 0
    and (item->>'unit_price')::integer >= 0
    and (item->>'subtotal')::integer = (item->>'unit_price')::integer * (item->>'quantity')::integer;

  if expected_total is null or expected_total <> supplied_total then
    raise exception 'Transaction total is invalid';
  end if;

  insert into public.transactions (id, reference, completed_at, total, payment_method, amount_paid, change_amount, status)
  values (
    new_id,
    transaction_data->>'reference',
    (transaction_data->>'completed_at')::timestamptz,
    supplied_total,
    transaction_data->>'payment_method',
    (transaction_data->>'amount_paid')::integer,
    (transaction_data->>'change_amount')::integer,
    transaction_data->>'status'
  );

  insert into public.transaction_items (transaction_id, product_id, product_name, unit_price, quantity, subtotal)
  select
    new_id,
    item->>'product_id',
    item->>'product_name',
    (item->>'unit_price')::integer,
    (item->>'quantity')::integer,
    (item->>'subtotal')::integer
  from jsonb_array_elements(transaction_data->'items') item;

  return new_id;
end;
$$;

revoke all on function public.create_pos_transaction(jsonb) from public;
grant execute on function public.create_pos_transaction(jsonb) to anon, authenticated;

insert into public.products (id, name, description, category, price) values
  ('coffee', 'Brewed Coffee', 'Freshly brewed campus blend', 'Drinks', 4500),
  ('sandwich', 'Club Sandwich', 'Toasted and made fresh', 'Meals', 5000),
  ('soft-drink', 'Soft Drink', 'Chilled 330 ml can', 'Drinks', 3500),
  ('cookies', 'Chocolate Cookies', 'Pack of three cookies', 'Snacks', 2500),
  ('water', 'Bottled Water', 'Purified water, 500 ml', 'Drinks', 2000),
  ('chocolate', 'Chocolate Bar', 'Classic milk chocolate', 'Snacks', 2500),
  ('rice-meal', 'Chicken Rice Meal', 'Chicken, rice, and vegetables', 'Meals', 9500),
  ('notebook', 'Campus Notebook', '80-page ruled notebook', 'Merchandise', 6000);
