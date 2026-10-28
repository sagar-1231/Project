-- Supabase > SQL Editor mein paste karke Run karein (sirf ek baar). Isse customer ko "Mere orders" dikhenge.
create or replace function public.my_orders(p_phone text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'count', (select count(*) from public.orders where phone = p_phone),
    'spent', (select coalesce(sum(total), 0) from public.orders where phone = p_phone),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('no', no, 'ts', ts, 'type', type, 'items', items, 'total', total, 'status', status) order by ts desc)
                        from (select * from public.orders where phone = p_phone order by ts desc limit 50) o), '[]'::jsonb));
$$;
revoke all on function public.my_orders(text) from public;
grant execute on function public.my_orders(text) to anon, authenticated;
