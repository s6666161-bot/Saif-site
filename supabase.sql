-- ============================================
-- Saif Outdoors: قاعدة بيانات المتجر
-- الصق هذا الملف كامل في Supabase ← SQL Editor ← Run
-- ============================================

-- المنتجات
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'Camping',
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  stock integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- الطلبات
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null,
  total numeric(10,2) not null,
  full_name text not null,
  phone text not null,
  address text not null,
  city text not null,
  postcode text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- الحماية (RLS)
alter table public.products enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Anyone can view active products" on public.products;
create policy "Anyone can view active products"
  on public.products for select
  using (active = true);

drop policy if exists "Customers see their own orders" on public.orders;
create policy "Customers see their own orders"
  on public.orders for select
  to authenticated
  using (user_id = auth.uid());

-- ما فيه سياسة insert على orders: الطلب يتسجل فقط عن طريق الدالة تحت،
-- والدالة تحسب الأسعار من قاعدة البيانات عشان محد يقدر يغيّر السعر من المتصفح.
create or replace function public.place_order(
  p_items jsonb, p_full_name text, p_phone text,
  p_address text, p_city text, p_postcode text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_item jsonb;
  v_product products%rowtype;
  v_qty int;
  v_total numeric(10,2) := 0;
  v_lines jsonb := '[]'::jsonb;
  v_order uuid;
begin
  if v_user is null then
    raise exception 'Sign in to place an order';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := greatest(1, least(20, (v_item->>'qty')::int));
    select * into v_product from products
      where id = (v_item->>'id')::uuid and active = true;
    if not found then
      raise exception 'A product in your cart is no longer available';
    end if;
    if v_product.stock < v_qty then
      raise exception '% has only % left', v_product.name, v_product.stock;
    end if;
    update products set stock = stock - v_qty where id = v_product.id;
    v_total := v_total + v_product.price * v_qty;
    v_lines := v_lines || jsonb_build_object(
      'id', v_product.id, 'name', v_product.name,
      'price', v_product.price, 'qty', v_qty);
  end loop;

  insert into orders (user_id, items, total, full_name, phone, address, city, postcode)
  values (v_user, v_lines, v_total, p_full_name, p_phone, p_address, p_city, p_postcode)
  returning id into v_order;

  return v_order;
end;
$$;

revoke all on function public.place_order(jsonb,text,text,text,text,text) from public, anon;
grant execute on function public.place_order(jsonb,text,text,text,text,text) to authenticated;

-- منتجات تجريبية (عدّلها أو احذفها من Table Editor)
insert into public.products (name, description, category, price, stock)
select * from (values
  ('Two-person dome tent', 'Freestanding tent with a full-coverage fly and two vestibules. Pitches in about ten minutes.', 'Camping', 189.00, 12),
  ('Folding camp chair', 'Steel frame, cup holder and side pocket. Holds up to 120 kg and folds into its own bag.', 'Camping', 39.95, 30),
  ('LED camping lantern', 'Rechargeable lantern with three brightness levels and around 20 hours of light on low.', 'Camping', 29.50, 40),
  ('Insulated water bottle 1L', 'Double-wall stainless steel. Keeps water cold for 24 hours in the car or on the trail.', 'Outdoor', 34.00, 50),
  ('Raised garden bed kit', 'Galvanised steel bed, 120 x 60 x 30 cm. No tools needed to assemble.', 'Garden', 79.00, 15),
  ('Expandable garden hose 15m', 'Lightweight hose that stretches to 15 m and shrinks back for storage. Includes a 7-pattern spray nozzle.', 'Garden', 44.90, 25),
  ('Pruning shears', 'Bypass secateurs with a non-stick blade and a safety lock. Cuts branches up to 20 mm.', 'Garden', 24.95, 35),
  ('Solar path lights (8 pack)', 'Charge during the day and switch on at dusk. Stake straight into the ground.', 'Garden', 49.00, 20)
) as seed(name, description, category, price, stock)
where not exists (select 1 from public.products);
