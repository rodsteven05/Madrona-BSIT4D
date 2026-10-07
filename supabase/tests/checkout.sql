-- Run in the Supabase SQL editor after both migrations. Sample writes are rolled back.
begin;
do $$
declare
  payload jsonb;
  changed jsonb;
  new_id uuid := gen_random_uuid();
  result uuid;
begin
  payload := jsonb_build_object('id', new_id, 'reference', 'TEST-' || new_id,
    'completed_at', now(), 'total', 4500, 'payment_method', 'Cash',
    'amount_paid', 5000, 'change_amount', 500, 'status', 'Payment Successful',
    'items', jsonb_build_array(jsonb_build_object('product_id', 'coffee', 'product_name', 'Brewed Coffee',
      'unit_price', 4500, 'quantity', 1, 'subtotal', 4500)));
  result := public.create_pos_transaction(payload);
  if result <> new_id then raise exception 'Incorrect transaction ID'; end if;
  perform public.create_pos_transaction(payload);
  if (select count(*) from public.transactions where id = new_id) <> 1
    or (select count(*) from public.transaction_items where transaction_id = new_id) <> 1 then
    raise exception 'Retry created duplicate records';
  end if;
  changed := jsonb_set(payload, '{total}', '1');
  begin
    perform public.create_pos_transaction(changed);
    raise exception 'TEST FAILED: conflicting retry accepted';
  exception when others then
    if SQLERRM like 'TEST FAILED:%' then raise; end if;
  end;
  changed := jsonb_set(payload, '{id}', to_jsonb(gen_random_uuid()));
  changed := jsonb_set(changed, '{items,0,unit_price}', '1');
  begin
    perform public.create_pos_transaction(changed);
    raise exception 'TEST FAILED: altered catalog price accepted';
  exception when others then
    if SQLERRM like 'TEST FAILED:%' then raise; end if;
  end;
  changed := jsonb_set(payload, '{id}', to_jsonb(gen_random_uuid()));
  changed := jsonb_set(changed, '{payment_method}', '"QR Payment"');
  begin
    perform public.create_pos_transaction(changed);
    raise exception 'TEST FAILED: QR overpayment accepted';
  exception when others then
    if SQLERRM like 'TEST FAILED:%' then raise; end if;
  end;
  changed := jsonb_set(changed, '{amount_paid}', '4500');
  changed := jsonb_set(changed, '{change_amount}', '0');
  changed := jsonb_set(changed, '{reference}', to_jsonb('TEST-' || (changed->>'id')));
  perform public.create_pos_transaction(changed);
end;
$$;
rollback;
