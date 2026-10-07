begin;
grant select on public.products to anon, authenticated;
revoke all on public.transactions, public.transaction_items from anon, authenticated;

create or replace function public.create_pos_transaction(transaction_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := (transaction_data->>'id')::uuid;
  expected_total bigint := 0;
  supplied_total integer := (transaction_data->>'total')::integer;
  item jsonb;
  catalog public.products%rowtype;
  existing public.transactions%rowtype;
begin
  if jsonb_typeof(transaction_data->'items') is distinct from 'array' then
    raise exception 'Transaction requires an item array';
  end if;
  if jsonb_array_length(transaction_data->'items') = 0 then
    raise exception 'Transaction requires at least one item';
  end if;
  -- Serialize retries for the same checkout before looking up its ID.
  perform pg_advisory_xact_lock(hashtextextended(new_id::text, 0));
  select * into existing from public.transactions where id = new_id;
  if found then
    if existing.reference is distinct from transaction_data->>'reference'
      or existing.total is distinct from supplied_total
      or existing.payment_method is distinct from transaction_data->>'payment_method'
      or existing.amount_paid is distinct from (transaction_data->>'amount_paid')::integer
      or existing.change_amount is distinct from (transaction_data->>'change_amount')::integer
      or existing.completed_at is distinct from (transaction_data->>'completed_at')::timestamptz
      or existing.status is distinct from transaction_data->>'status'
      or (select jsonb_agg(jsonb_build_object('product_id', product_id, 'product_name', product_name,
          'unit_price', unit_price, 'quantity', quantity, 'subtotal', subtotal) order by product_id)
          from public.transaction_items where transaction_id = new_id)
        is distinct from (select jsonb_agg(value order by value->>'product_id')
          from jsonb_array_elements(transaction_data->'items')) then
      raise exception 'Transaction ID conflict';
    end if;
    return new_id;
  end if;
  if (select count(*) <> count(distinct value->>'product_id') from jsonb_array_elements(transaction_data->'items')) then
    raise exception 'Duplicate product lines';
  end if;
  for item in select value from jsonb_array_elements(transaction_data->'items') loop
    select * into catalog from public.products where id = item->>'product_id' and active for share;
    if not found then raise exception 'Product is unavailable'; end if;
    if (item->>'quantity')::integer is null or (item->>'quantity')::integer <= 0
      or (item->>'unit_price')::integer is distinct from catalog.price
      or item->>'product_name' is distinct from catalog.name
      or (item->>'subtotal')::bigint is distinct from catalog.price::bigint * (item->>'quantity')::integer then
      raise exception 'Invalid product price, name, quantity, or subtotal';
    end if;
    expected_total := expected_total + (item->>'subtotal')::bigint;
  end loop;
  if supplied_total is null or expected_total <> supplied_total then raise exception 'Transaction total is invalid'; end if;
  if transaction_data->>'payment_method' in ('QR Payment', 'Credit/Debit Card')
    and ((transaction_data->>'amount_paid')::integer is distinct from supplied_total
      or (transaction_data->>'change_amount')::integer is distinct from 0) then
    raise exception 'Simulated payment must equal the total with zero change';
  end if;
  insert into public.transactions (id, reference, completed_at, total, payment_method, amount_paid, change_amount, status)
  values (new_id, transaction_data->>'reference', (transaction_data->>'completed_at')::timestamptz,
    supplied_total, transaction_data->>'payment_method', (transaction_data->>'amount_paid')::integer,
    (transaction_data->>'change_amount')::integer, transaction_data->>'status');
  insert into public.transaction_items (transaction_id, product_id, product_name, unit_price, quantity, subtotal)
  select new_id, value->>'product_id', value->>'product_name', (value->>'unit_price')::integer,
    (value->>'quantity')::integer, (value->>'subtotal')::integer
  from jsonb_array_elements(transaction_data->'items');
  return new_id;
end;
$$;
revoke all on function public.create_pos_transaction(jsonb) from public;
grant execute on function public.create_pos_transaction(jsonb) to anon, authenticated;
commit;
