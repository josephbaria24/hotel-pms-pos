-- Admin: reset student/staff PMS+POS practice progress with restorable history
-- Run after 010 / 011 / 012 in Supabase SQL Editor

create table if not exists public.admin_progress_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  action text not null default 'reset'
    check (action in ('reset', 'restore_backup')),
  note text,
  user_ids uuid[] not null default '{}',
  summary jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  restored_at timestamptz,
  restored_by uuid references public.profiles (id) on delete set null
);

create index if not exists admin_progress_snapshots_created_idx
  on public.admin_progress_snapshots (created_at desc);

alter table public.admin_progress_snapshots enable row level security;

drop policy if exists "admin progress snapshots" on public.admin_progress_snapshots;
create policy "admin progress snapshots" on public.admin_progress_snapshots
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.admin_progress_snapshots to authenticated;
grant all on public.admin_progress_snapshots to service_role;

-- ---------------------------------------------------------------------------
-- Capture one tenant's practice data into jsonb
-- ---------------------------------------------------------------------------
create or replace function public.admin_capture_tenant_progress(p_tenant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_onboarding boolean;
  v_payload jsonb;
begin
  select p.onboarding_completed into v_onboarding
  from public.profiles p
  where p.id = p_tenant;

  select jsonb_build_object(
    'user_id', p_tenant,
    'onboarding_completed', coalesce(v_onboarding, false),
    'guests', coalesce((
      select jsonb_agg(to_jsonb(g) order by g.created_at, g.id)
      from public.guests g where g.tenant_id = p_tenant
    ), '[]'::jsonb),
    'reservations', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at, r.id)
      from public.reservations r where r.tenant_id = p_tenant
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(to_jsonb(pay) order by pay.created_at, pay.id)
      from public.payments pay where pay.tenant_id = p_tenant
    ), '[]'::jsonb),
    'activity_logs', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at, a.id)
      from public.activity_logs a where a.tenant_id = p_tenant
    ), '[]'::jsonb),
    'pos_orders', coalesce((
      select jsonb_agg(to_jsonb(o) order by o.created_at, o.id)
      from public.pos_orders o where o.tenant_id = p_tenant
    ), '[]'::jsonb),
    'pos_order_items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.created_at, i.id)
      from public.pos_order_items i
      where i.tenant_id = p_tenant
         or i.order_id in (select o.id from public.pos_orders o where o.tenant_id = p_tenant)
    ), '[]'::jsonb),
    'pos_payments', coalesce((
      select jsonb_agg(to_jsonb(pp) order by pp.created_at, pp.id)
      from public.pos_payments pp
      where pp.tenant_id = p_tenant
         or pp.order_id in (select o.id from public.pos_orders o where o.tenant_id = p_tenant)
    ), '[]'::jsonb),
    'pos_stock_movements', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at, m.id)
      from public.pos_stock_movements m where m.tenant_id = p_tenant
    ), '[]'::jsonb),
    'product_stock', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'stock_qty', pr.stock_qty
      ) order by pr.id)
      from public.pos_products pr where pr.tenant_id = p_tenant
    ), '[]'::jsonb),
    'rooms_status', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rm.id,
        'status', rm.status,
        'condition', rm.condition,
        'do_not_disturb', rm.do_not_disturb
      ) order by rm.id)
      from public.rooms rm
      where rm.id in (
        select distinct res.room_id
        from public.reservations res
        where res.tenant_id = p_tenant
          and res.status in ('checked_in', 'reserved')
      )
    ), '[]'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$$;

-- ---------------------------------------------------------------------------
-- Wipe practice data for one tenant (accounts + catalog kept)
-- ---------------------------------------------------------------------------
create or replace function public.admin_wipe_tenant_progress(
  p_tenant uuid,
  p_reset_tour boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counts jsonb;
  v_guests bigint;
  v_reservations bigint;
  v_payments bigint;
  v_activity bigint;
  v_pos_orders bigint;
  v_pos_items bigint;
  v_pos_payments bigint;
  v_stock bigint;
begin
  select count(*) into v_payments from public.payments where tenant_id = p_tenant;
  select count(*) into v_pos_payments
    from public.pos_payments
    where tenant_id = p_tenant
       or order_id in (select id from public.pos_orders where tenant_id = p_tenant);
  select count(*) into v_pos_items
    from public.pos_order_items
    where tenant_id = p_tenant
       or order_id in (select id from public.pos_orders where tenant_id = p_tenant);
  select count(*) into v_pos_orders from public.pos_orders where tenant_id = p_tenant;
  select count(*) into v_stock from public.pos_stock_movements where tenant_id = p_tenant;
  select count(*) into v_reservations from public.reservations where tenant_id = p_tenant;
  select count(*) into v_guests from public.guests where tenant_id = p_tenant;
  select count(*) into v_activity from public.activity_logs where tenant_id = p_tenant;

  -- Free rooms that this tenant had checked in / reserved
  update public.rooms rm
  set status = 'available',
      condition = case when lower(coalesce(rm.condition, '')) = 'dirty' then rm.condition else 'clean' end,
      do_not_disturb = false,
      updated_at = now()
  where rm.id in (
    select distinct res.room_id
    from public.reservations res
    where res.tenant_id = p_tenant
      and res.status in ('checked_in', 'reserved')
  );

  delete from public.payments where tenant_id = p_tenant;

  delete from public.pos_payments
  where tenant_id = p_tenant
     or order_id in (select id from public.pos_orders where tenant_id = p_tenant);

  delete from public.pos_order_items
  where tenant_id = p_tenant
     or order_id in (select id from public.pos_orders where tenant_id = p_tenant);

  delete from public.pos_orders where tenant_id = p_tenant;
  delete from public.pos_stock_movements where tenant_id = p_tenant;
  delete from public.reservations where tenant_id = p_tenant;
  delete from public.guests where tenant_id = p_tenant;
  delete from public.activity_logs where tenant_id = p_tenant;

  if p_reset_tour then
    update public.profiles
    set onboarding_completed = false,
        updated_at = now()
    where id = p_tenant;
  end if;

  v_counts := jsonb_build_object(
    'guests', v_guests,
    'reservations', v_reservations,
    'payments', v_payments,
    'activity_logs', v_activity,
    'pos_orders', v_pos_orders,
    'pos_order_items', v_pos_items,
    'pos_payments', v_pos_payments,
    'pos_stock_movements', v_stock
  );
  return v_counts;
end;
$$;

-- ---------------------------------------------------------------------------
-- Restore one tenant from captured payload
-- ---------------------------------------------------------------------------
create or replace function public.admin_restore_tenant_progress(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_item jsonb;
begin
  v_tenant := (p_payload->>'user_id')::uuid;
  if v_tenant is null then
    raise exception 'Invalid progress payload: missing user_id';
  end if;

  -- Guests
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'guests', '[]'::jsonb))
  loop
    insert into public.guests
    select * from jsonb_populate_record(null::public.guests, v_item)
    on conflict (id) do update set
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      phone = excluded.phone,
      email = excluded.email,
      address = excluded.address,
      id_type = excluded.id_type,
      id_number = excluded.id_number,
      nationality = excluded.nationality,
      notes = excluded.notes,
      tenant_id = excluded.tenant_id,
      updated_at = excluded.updated_at;
  end loop;

  -- Reservations
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'reservations', '[]'::jsonb))
  loop
    insert into public.reservations
    select * from jsonb_populate_record(null::public.reservations, v_item)
    on conflict (id) do update set
      reservation_number = excluded.reservation_number,
      guest_id = excluded.guest_id,
      room_id = excluded.room_id,
      check_in_date = excluded.check_in_date,
      check_out_date = excluded.check_out_date,
      adults = excluded.adults,
      children = excluded.children,
      status = excluded.status,
      source = excluded.source,
      total_amount = excluded.total_amount,
      paid_amount = excluded.paid_amount,
      notes = excluded.notes,
      created_by = excluded.created_by,
      actual_check_in_at = excluded.actual_check_in_at,
      actual_check_out_at = excluded.actual_check_out_at,
      tenant_id = excluded.tenant_id,
      updated_at = excluded.updated_at;
  end loop;

  -- PMS payments
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'payments', '[]'::jsonb))
  loop
    insert into public.payments
    select * from jsonb_populate_record(null::public.payments, v_item)
    on conflict (id) do update set
      reservation_id = excluded.reservation_id,
      amount = excluded.amount,
      method = excluded.method,
      reference_no = excluded.reference_no,
      note = excluded.note,
      received_by = excluded.received_by,
      tenant_id = excluded.tenant_id,
      created_at = excluded.created_at;
  end loop;

  -- POS orders
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'pos_orders', '[]'::jsonb))
  loop
    insert into public.pos_orders
    select * from jsonb_populate_record(null::public.pos_orders, v_item)
    on conflict (id) do update set
      order_number = excluded.order_number,
      status = excluded.status,
      order_type = excluded.order_type,
      table_id = excluded.table_id,
      guest_id = excluded.guest_id,
      reservation_id = excluded.reservation_id,
      room_id = excluded.room_id,
      customer_name = excluded.customer_name,
      subtotal = excluded.subtotal,
      discount_amount = excluded.discount_amount,
      tax_amount = excluded.tax_amount,
      total_amount = excluded.total_amount,
      paid_amount = excluded.paid_amount,
      notes = excluded.notes,
      opened_by = excluded.opened_by,
      closed_by = excluded.closed_by,
      opened_at = excluded.opened_at,
      closed_at = excluded.closed_at,
      tenant_id = excluded.tenant_id,
      updated_at = excluded.updated_at;
  end loop;

  -- POS order items
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'pos_order_items', '[]'::jsonb))
  loop
    insert into public.pos_order_items
    select * from jsonb_populate_record(null::public.pos_order_items, v_item)
    on conflict (id) do update set
      order_id = excluded.order_id,
      product_id = excluded.product_id,
      product_name = excluded.product_name,
      unit_price = excluded.unit_price,
      quantity = excluded.quantity,
      line_total = excluded.line_total,
      notes = excluded.notes,
      sort_order = excluded.sort_order,
      tenant_id = excluded.tenant_id;
  end loop;

  -- POS payments
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'pos_payments', '[]'::jsonb))
  loop
    insert into public.pos_payments
    select * from jsonb_populate_record(null::public.pos_payments, v_item)
    on conflict (id) do update set
      order_id = excluded.order_id,
      amount = excluded.amount,
      method = excluded.method,
      reference_no = excluded.reference_no,
      note = excluded.note,
      received_by = excluded.received_by,
      tenant_id = excluded.tenant_id,
      created_at = excluded.created_at;
  end loop;

  -- Stock movements
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'pos_stock_movements', '[]'::jsonb))
  loop
    insert into public.pos_stock_movements
    select * from jsonb_populate_record(null::public.pos_stock_movements, v_item)
    on conflict (id) do update set
      tenant_id = excluded.tenant_id,
      product_id = excluded.product_id,
      type = excluded.type,
      quantity = excluded.quantity,
      qty_before = excluded.qty_before,
      qty_after = excluded.qty_after,
      reason = excluded.reason,
      reference_no = excluded.reference_no,
      note = excluded.note,
      created_by = excluded.created_by,
      created_at = excluded.created_at;
  end loop;

  -- Activity logs
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'activity_logs', '[]'::jsonb))
  loop
    insert into public.activity_logs
    select * from jsonb_populate_record(null::public.activity_logs, v_item)
    on conflict (id) do update set
      user_id = excluded.user_id,
      action = excluded.action,
      entity = excluded.entity,
      entity_id = excluded.entity_id,
      details = excluded.details,
      tenant_id = excluded.tenant_id,
      created_at = excluded.created_at;
  end loop;

  -- Product stock qty
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'product_stock', '[]'::jsonb))
  loop
    update public.pos_products
    set stock_qty = coalesce((v_item->>'stock_qty')::numeric, stock_qty),
        updated_at = now()
    where id = v_item->>'id';
  end loop;

  -- Room statuses
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'rooms_status', '[]'::jsonb))
  loop
    update public.rooms
    set status = coalesce(v_item->>'status', status),
        condition = coalesce(v_item->>'condition', condition),
        do_not_disturb = coalesce((v_item->>'do_not_disturb')::boolean, do_not_disturb),
        updated_at = now()
    where id = v_item->>'id';
  end loop;

  if p_payload ? 'onboarding_completed' then
    update public.profiles
    set onboarding_completed = coalesce((p_payload->>'onboarding_completed')::boolean, false),
        updated_at = now()
    where id = v_tenant;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reset selected (or all staff) progress — saves history first
-- ---------------------------------------------------------------------------
create or replace function public.admin_reset_student_progress(
  p_user_ids uuid[] default null,
  p_reset_tour boolean default true,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_uid uuid;
  v_tenants jsonb := '[]'::jsonb;
  v_summaries jsonb := '[]'::jsonb;
  v_counts jsonb;
  v_snapshot_id uuid;
  v_users_reset int := 0;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  if p_user_ids is null or cardinality(p_user_ids) = 0 then
    select coalesce(array_agg(p.id), '{}'::uuid[])
    into v_ids
    from public.profiles p
    where p.role = 'staff';
  else
    v_ids := p_user_ids;
  end if;

  if cardinality(v_ids) is null or cardinality(v_ids) = 0 then
    return jsonb_build_object(
      'snapshot_id', null,
      'users_reset', 0,
      'message', 'No users to reset'
    );
  end if;

  foreach v_uid in array v_ids
  loop
    if not exists (select 1 from public.profiles where id = v_uid) then
      continue;
    end if;
    v_tenants := v_tenants || jsonb_build_array(public.admin_capture_tenant_progress(v_uid));
    v_counts := public.admin_wipe_tenant_progress(v_uid, p_reset_tour);
    v_summaries := v_summaries || jsonb_build_array(
      jsonb_build_object('user_id', v_uid) || v_counts
    );
    v_users_reset := v_users_reset + 1;
  end loop;

  insert into public.admin_progress_snapshots (
    created_by, action, note, user_ids, summary, payload
  )
  values (
    auth.uid(),
    'reset',
    nullif(trim(coalesce(p_note, '')), ''),
    v_ids,
    jsonb_build_object(
      'users_reset', v_users_reset,
      'reset_tour', p_reset_tour,
      'per_user', v_summaries
    ),
    jsonb_build_object('tenants', v_tenants)
  )
  returning id into v_snapshot_id;

  return jsonb_build_object(
    'snapshot_id', v_snapshot_id,
    'users_reset', v_users_reset,
    'summary', v_summaries
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Restore from a history snapshot (backs up current state first)
-- ---------------------------------------------------------------------------
create or replace function public.admin_restore_student_progress(
  p_snapshot_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snap public.admin_progress_snapshots%rowtype;
  v_tenant jsonb;
  v_uid uuid;
  v_ids uuid[] := '{}';
  v_backup jsonb := '[]'::jsonb;
  v_backup_id uuid;
  v_restored int := 0;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  select * into v_snap
  from public.admin_progress_snapshots
  where id = p_snapshot_id;

  if not found then
    raise exception 'Snapshot not found';
  end if;

  if v_snap.action <> 'reset' then
    raise exception 'Only reset snapshots can be restored';
  end if;

  -- Backup current progress for the same users before overwrite
  foreach v_uid in array v_snap.user_ids
  loop
    if exists (select 1 from public.profiles where id = v_uid) then
      v_backup := v_backup || jsonb_build_array(public.admin_capture_tenant_progress(v_uid));
      v_ids := array_append(v_ids, v_uid);
    end if;
  end loop;

  if cardinality(v_ids) > 0 then
    insert into public.admin_progress_snapshots (
      created_by, action, note, user_ids, summary, payload
    )
    values (
      auth.uid(),
      'restore_backup',
      coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Auto-backup before restore'),
      v_ids,
      jsonb_build_object(
        'restored_from', p_snapshot_id,
        'users', cardinality(v_ids)
      ),
      jsonb_build_object('tenants', v_backup)
    )
    returning id into v_backup_id;
  end if;

  for v_tenant in
    select * from jsonb_array_elements(coalesce(v_snap.payload->'tenants', '[]'::jsonb))
  loop
    v_uid := (v_tenant->>'user_id')::uuid;
    if v_uid is null or not exists (select 1 from public.profiles where id = v_uid) then
      continue;
    end if;
    perform public.admin_wipe_tenant_progress(v_uid, false);
    perform public.admin_restore_tenant_progress(v_tenant);
    v_restored := v_restored + 1;
  end loop;

  update public.admin_progress_snapshots
  set restored_at = now(),
      restored_by = auth.uid()
  where id = p_snapshot_id;

  return jsonb_build_object(
    'restored_users', v_restored,
    'backup_snapshot_id', v_backup_id,
    'source_snapshot_id', p_snapshot_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- List history (without heavy payload)
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_progress_snapshots()
returns table (
  id uuid,
  created_at timestamptz,
  created_by uuid,
  created_by_name text,
  action text,
  note text,
  user_ids uuid[],
  user_count integer,
  summary jsonb,
  restored_at timestamptz,
  restored_by uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select
    s.id,
    s.created_at,
    s.created_by,
    (select p.full_name from public.profiles p where p.id = s.created_by),
    s.action,
    s.note,
    s.user_ids,
    coalesce(cardinality(s.user_ids), 0),
    s.summary,
    s.restored_at,
    s.restored_by
  from public.admin_progress_snapshots s
  order by s.created_at desc
  limit 100;
end;
$$;

-- Internal helpers stay owner-only; callers use the admin_* entrypoints below.
revoke all on function public.admin_capture_tenant_progress(uuid) from public, authenticated;
revoke all on function public.admin_wipe_tenant_progress(uuid, boolean) from public, authenticated;
revoke all on function public.admin_restore_tenant_progress(jsonb) from public, authenticated;

grant execute on function public.admin_reset_student_progress(uuid[], boolean, text) to authenticated;
grant execute on function public.admin_restore_student_progress(uuid, text) to authenticated;
grant execute on function public.admin_list_progress_snapshots() to authenticated;
