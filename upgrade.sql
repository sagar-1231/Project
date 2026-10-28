-- Supabase > SQL Editor mein paste karke Run karein (sirf ek baar). Naye features: dukaan band/chalu, delivery charge, minimum order.
alter table public.settings add column if not exists open boolean not null default true, add column if not exists delivery_fee numeric not null default 0, add column if not exists min_order numeric not null default 0, add column if not exists free_above numeric not null default 0;
alter table public.orders add column if not exists fee numeric not null default 0;

create or replace function public.place_order(p_name text, p_phone text, p_type text, p_addr text, p_note text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare it jsonb; m public.menu%rowtype; q int; sz text; pr numeric; tot numeric := 0; outi jsonb := '[]'; oid bigint; onum text; nm text; ty text := p_type; st public.settings%rowtype; fee numeric := 0;
begin
  select * into st from public.settings where id = 1;
  if st.open is false then raise exception 'Dukaan abhi band hai. Thodi der baad order karein.'; end if;
  if coalesce(p_phone,'') !~ '^[6-9][0-9]{9}$' then raise exception 'Sahi 10 digit mobile number chahiye.'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'Apna naam likhein.'; end if;
  if ty is distinct from 'delivery' then ty := 'takeaway'; end if;
  if ty = 'delivery' and length(coalesce(p_addr,'')) < 8 then raise exception 'Delivery ka poora pata likhein.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 40 then raise exception 'Cart khaali hai.'; end if;
  for it in select value from jsonb_array_elements(p_items) loop
    select * into m from public.menu where id = (it->>'id')::bigint;
    if not found then raise exception 'Menu badal gaya hai. Page dobara kholein.'; end if;
    if not m.avail then raise exception '% abhi available nahi hai.', m.name; end if;
    q := least(50, greatest(1, coalesce((it->>'qty')::int, 1)));
    sz := case when it->>'size' = 'h' then 'h' else 'f' end;
    if sz = 'h' and m.half is null then raise exception '% mein half nahi hai. Page dobara kholein.', m.name; end if;
    pr := case when sz = 'h' then m.half else m.price end;
    nm := m.name || case when m.half is not null then case when sz = 'h' then ' (Half)' else ' (Full)' end else '' end;
    tot := tot + q * pr;
    outi := outi || jsonb_build_array(jsonb_build_object('id', m.id, 'name', nm, 'size', sz, 'qty', q, 'price', pr));
  end loop;
  if st.min_order > 0 and tot < st.min_order then raise exception 'Kam se kam Rs % ka order karna hoga.', st.min_order; end if;
  if ty = 'delivery' and st.delivery_fee > 0 and not (st.free_above > 0 and tot >= st.free_above) then fee := st.delivery_fee; end if;
  insert into public.orders(ts, name, phone, type, addr, note, items, total, fee)
  values ((extract(epoch from now()) * 1000)::bigint, left(trim(p_name), 60), p_phone, ty,
          case when ty = 'delivery' then left(p_addr, 300) else '' end, left(coalesce(p_note,''), 200), outi, tot + fee, fee)
  returning id into oid;
  onum := 'AK-' || lpad(oid::text, 4, '0');
  update public.orders set no = onum where id = oid;
  return jsonb_build_object('no', onum, 'total', tot + fee, 'fee', fee, 'items', outi);
end $$;
revoke all on function public.place_order(text,text,text,text,text,jsonb) from public;
grant execute on function public.place_order(text,text,text,text,text,jsonb) to anon, authenticated;
