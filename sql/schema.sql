-- =========================================================
-- ARENSI POS — Skema Database Supabase (Postgres)
-- Jalankan SELURUH file ini sekali di Supabase SQL Editor
-- =========================================================

-- 1. TABEL -------------------------------------------------

create table products (
  id uuid primary key default gen_random_uuid(),
  nama_produk text not null,
  satuan text default 'kg',
  harga_beli numeric(12,2) default 0,        -- HPP, auto-update dari produksi
  harga_jual numeric(12,2) not null,         -- harga eceran
  harga_grosir numeric(12,2),                -- harga partai besar (boleh kosong)
  min_qty_grosir numeric(12,2) default 10,   -- ambang qty supaya kena harga grosir
  stok numeric(12,2) not null default 0 check (stok >= 0),
  stok_minimum numeric(12,2) default 5,
  deleted_at timestamptz,                    -- soft delete: null = aktif, terisi = diarsipkan
  created_at timestamptz default now()
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  nomor_transaksi text,
  tanggal timestamptz default now(),
  total_belanja numeric(12,2) not null,
  uang_bayar numeric(12,2) not null,
  uang_kembalian numeric(12,2) not null,
  metode_pembayaran text default 'Cash',
  dibuat_oleh text
);

create sequence if not exists transaksi_seq start 1;

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales(id) on delete cascade,
  product_id uuid references products(id),
  qty numeric(12,2) not null,
  harga_satuan numeric(12,2) not null
);

create table produksi (
  id uuid primary key default gen_random_uuid(),
  tanggal timestamptz default now(),
  product_id uuid references products(id),
  qty_hasil numeric(12,2) not null,
  biaya_bahan_mentah numeric(12,2) not null default 0,
  biaya_produksi numeric(12,2) not null default 0,
  catatan text,
  nomor_batch text
);

create sequence if not exists batch_seq start 1;

-- 1b. BOM FOUNDATION: bahan baku terpisah dari produk jadi ----
-- Produk jadi (gula cetak/semut/dll) dijual ke pembeli. Bahan baku (nira, kapur,
-- kemasan, dll) dipakai untuk MEMBUAT produk jadi. Resep menghubungkan keduanya:
-- berapa banyak tiap bahan baku dibutuhkan untuk menghasilkan 1 satuan produk jadi.

create table bahan_baku (
  id uuid primary key default gen_random_uuid(),
  nama_bahan text not null,
  satuan text default 'liter',
  stok numeric(12,2) not null default 0 check (stok >= 0),
  stok_minimum numeric(12,2) default 5,
  harga_per_satuan numeric(12,2) not null default 0,  -- auto-update tiap kali beli
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table resep (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  bahan_baku_id uuid references bahan_baku(id),
  qty_per_unit numeric(12,4) not null,  -- kebutuhan bahan ini per 1 satuan produk jadi
  created_at timestamptz default now(),
  unique (product_id, bahan_baku_id)
);

create table stok_log (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id),
  bahan_baku_id uuid references bahan_baku(id),
  tanggal timestamptz default now(),
  tipe text check (tipe in ('Penjualan','Produksi','Koreksi Manual','Pembelian Bahan','Konsumsi Produksi','Koreksi Bahan')),
  qty numeric(12,2) not null,           -- selisih: negatif = berkurang, positif = bertambah
  saldo_setelah numeric(12,2) not null, -- stok setelah pergerakan ini, untuk audit
  sale_id uuid references sales(id),
  produksi_id uuid references produksi(id),
  keterangan text,
  dibuat_oleh text                      -- email user yang melakukan aksi ini, diisi otomatis oleh fungsi
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  tanggal timestamptz default now(),
  kategori text check (kategori in ('Modal Bahan Mentah','Biaya Produksi','Operasional Toko','Gaji','Lainnya')),
  nominal numeric(12,2) not null,
  deskripsi text,
  produksi_id uuid references produksi(id)
);

-- 2. VIEW bantu laporan (gabungan penjualan + detail produk) ----

create or replace view v_penjualan_detail as
select si.id, si.sale_id, si.product_id, si.qty, si.harga_satuan,
       s.tanggal, p.nama_produk, p.satuan, p.harga_beli
from sale_items si
join sales s on s.id = si.sale_id
join products p on p.id = si.product_id;

-- 3. FUNGSI: checkout kasir (atomik, validasi stok otomatis) ----

create or replace function process_sale(
  p_items jsonb,           -- [{"product_id":"...","qty":2,"harga_satuan":35000}, ...]
  p_uang_bayar numeric,
  p_metode text default 'Cash'
) returns table(sale_id uuid, nomor_transaksi text) as $$
declare
  v_sale_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_stok numeric;
  v_saldo_baru numeric;
  v_email text;
  v_nomor_transaksi text;
begin
  select email into v_email from auth.users where id = auth.uid();
  v_nomor_transaksi := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('transaksi_seq')::text, 4, '0');

  -- Validasi stok dulu untuk SEMUA item, sebelum nulis apapun.
  -- FOR UPDATE mengunci baris produk ini sampai transaksi selesai, supaya kalau ada
  -- transaksi lain yang checkout produk sama di waktu hampir bersamaan, dia menunggu
  -- dan membaca stok yang sudah akurat — bukan nilai basi dari sebelum transaksi ini commit.
  for v_item in select * from jsonb_array_elements(p_items) loop
    select stok into v_stok from products where id = (v_item->>'product_id')::uuid for update;
    if v_stok is null or v_stok < (v_item->>'qty')::numeric then
      raise exception 'Stok tidak cukup untuk salah satu produk';
    end if;
    v_total := v_total + (v_item->>'qty')::numeric * (v_item->>'harga_satuan')::numeric;
  end loop;

  if p_uang_bayar < v_total then
    raise exception 'Uang bayar kurang dari total belanja';
  end if;

  insert into sales (nomor_transaksi, total_belanja, uang_bayar, uang_kembalian, metode_pembayaran, dibuat_oleh)
  values (v_nomor_transaksi, v_total, p_uang_bayar, p_uang_bayar - v_total, p_metode, v_email)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into sale_items (sale_id, product_id, qty, harga_satuan)
    values (v_sale_id, (v_item->>'product_id')::uuid, (v_item->>'qty')::numeric, (v_item->>'harga_satuan')::numeric);

    update products set stok = stok - (v_item->>'qty')::numeric
    where id = (v_item->>'product_id')::uuid
    returning stok into v_saldo_baru;

    insert into stok_log (product_id, tipe, qty, saldo_setelah, sale_id, dibuat_oleh)
    values ((v_item->>'product_id')::uuid, 'Penjualan', -((v_item->>'qty')::numeric), v_saldo_baru, v_sale_id, v_email);
  end loop;

  return query select v_sale_id, v_nomor_transaksi;
end;
$$ language plpgsql security definer set search_path = public;

-- 4. FUNGSI: catat produksi (atomik — stok, HPP, dan 2 expenses sekaligus) ----

create or replace function process_produksi(
  p_product_id uuid,
  p_qty_hasil numeric,
  p_biaya_bahan_mentah numeric,
  p_biaya_produksi numeric,
  p_catatan text default null
) returns uuid as $$
declare
  v_produksi_id uuid;
  v_hpp_baru numeric;
  v_saldo_baru numeric;
  v_role text;
  v_email text;
  v_nomor_batch text;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role is distinct from 'owner' then
    raise exception 'Hanya Owner yang bisa mencatat produksi';
  end if;

  if p_qty_hasil <= 0 then
    raise exception 'Qty hasil produksi harus lebih dari 0';
  end if;

  select email into v_email from auth.users where id = auth.uid();
  v_nomor_batch := 'PRD-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('batch_seq')::text, 4, '0');

  insert into produksi (product_id, qty_hasil, biaya_bahan_mentah, biaya_produksi, catatan, nomor_batch)
  values (p_product_id, p_qty_hasil, p_biaya_bahan_mentah, p_biaya_produksi, p_catatan, v_nomor_batch)
  returning id into v_produksi_id;

  update products set stok = stok + p_qty_hasil where id = p_product_id
  returning stok into v_saldo_baru;

  insert into stok_log (product_id, tipe, qty, saldo_setelah, produksi_id, dibuat_oleh)
  values (p_product_id, 'Produksi', p_qty_hasil, v_saldo_baru, v_produksi_id, v_email);

  -- HPP di-replace penuh tiap batch baru (bukan rata-rata tertimbang) — simplifikasi awal
  v_hpp_baru := (p_biaya_bahan_mentah + p_biaya_produksi) / p_qty_hasil;
  update products set harga_beli = v_hpp_baru where id = p_product_id;

  insert into expenses (kategori, nominal, deskripsi, produksi_id)
  values ('Modal Bahan Mentah', p_biaya_bahan_mentah, 'Bahan baku untuk produksi ' || p_qty_hasil || ' unit (batch ' || v_nomor_batch || ')', v_produksi_id);

  insert into expenses (kategori, nominal, deskripsi, produksi_id)
  values ('Biaya Produksi', p_biaya_produksi, 'Tenaga kerja, kayu bakar, kemasan (batch ' || v_nomor_batch || ')', v_produksi_id);

  return v_produksi_id;
end;
$$ language plpgsql security definer set search_path = public;

-- 4b. FUNGSI: koreksi stok manual (wajib alasan, tercatat di stok_log) ----
-- Satu-satunya jalur resmi untuk membetulkan stok kalau fisiknya beda dengan sistem
-- (rusak, hilang, salah hitung) — mencegah perubahan stok diam-diam lewat Table Editor.

create or replace function process_koreksi_stok(
  p_product_id uuid,
  p_qty_aktual numeric,
  p_alasan text
) returns void as $$
declare
  v_stok_sekarang numeric;
  v_selisih numeric;
  v_role text;
  v_email text;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role is distinct from 'owner' then
    raise exception 'Hanya Owner yang bisa melakukan koreksi stok';
  end if;

  if p_alasan is null or trim(p_alasan) = '' then
    raise exception 'Alasan koreksi wajib diisi';
  end if;
  if p_qty_aktual < 0 then
    raise exception 'Stok tidak boleh negatif';
  end if;

  select email into v_email from auth.users where id = auth.uid();
  select stok into v_stok_sekarang from products where id = p_product_id for update;
  if v_stok_sekarang is null then
    raise exception 'Produk tidak ditemukan';
  end if;

  v_selisih := p_qty_aktual - v_stok_sekarang;

  update products set stok = p_qty_aktual where id = p_product_id;

  insert into stok_log (product_id, tipe, qty, saldo_setelah, keterangan, dibuat_oleh)
  values (p_product_id, 'Koreksi Manual', v_selisih, p_qty_aktual, p_alasan, v_email);
end;
$$ language plpgsql security definer set search_path = public;

-- 4c. FUNGSI: pembelian bahan baku (restock + auto update harga per satuan + log) ----

create or replace function process_beli_bahan(
  p_bahan_baku_id uuid,
  p_qty numeric,
  p_total_harga numeric
) returns void as $$
declare
  v_role text;
  v_email text;
  v_saldo_baru numeric;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role is distinct from 'owner' then
    raise exception 'Hanya Owner yang bisa mencatat pembelian bahan baku';
  end if;
  if p_qty <= 0 then
    raise exception 'Qty pembelian harus lebih dari 0';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  update bahan_baku set stok = stok + p_qty, harga_per_satuan = p_total_harga / p_qty
  where id = p_bahan_baku_id
  returning stok into v_saldo_baru;

  insert into stok_log (bahan_baku_id, tipe, qty, saldo_setelah, keterangan, dibuat_oleh)
  values (p_bahan_baku_id, 'Pembelian Bahan', p_qty, v_saldo_baru, 'Pembelian bahan baku', v_email);

  insert into expenses (kategori, nominal, deskripsi)
  values ('Modal Bahan Mentah', p_total_harga, 'Pembelian bahan baku ' || p_qty || ' unit');
end;
$$ language plpgsql security definer set search_path = public;

-- 5. ROW LEVEL SECURITY -------------------------------------
-- Owner: akses penuh. Kasir: cuma baca produk (untuk halaman Kasir) + checkout lewat
-- fungsi resmi. Anon (belum login): tidak ada akses sama sekali.

alter table products enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table produksi enable row level security;
alter table expenses enable row level security;
alter table stok_log enable row level security;

-- products: semua user login boleh baca, cuma owner yang boleh tulis langsung
create policy "products_select" on products for select to authenticated using (true);
create policy "products_insert_owner" on products for insert to authenticated with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);
create policy "products_update_owner" on products for update to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);

-- sales & sale_items: cuma owner yang boleh baca (laporan); insert cuma lewat process_sale
create policy "sales_select_owner" on sales for select to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);
create policy "sale_items_select_owner" on sale_items for select to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);

-- produksi: cuma owner yang boleh baca; insert cuma lewat process_produksi
create policy "produksi_select_owner" on produksi for select to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);

-- expenses: cuma owner yang boleh baca & catat manual
create policy "expenses_select_owner" on expenses for select to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);
create policy "expenses_insert_owner" on expenses for insert to authenticated with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);

-- stok_log: cuma owner yang boleh baca; insert cuma lewat fungsi resmi
create policy "stok_log_select_owner" on stok_log for select to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);

-- bahan_baku & resep: murni urusan produksi, cuma owner
alter table bahan_baku enable row level security;
alter table resep enable row level security;

create policy "bahan_baku_select_owner" on bahan_baku for select to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);
create policy "bahan_baku_insert_owner" on bahan_baku for insert to authenticated with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);
create policy "bahan_baku_update_owner" on bahan_baku for update to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);

create policy "resep_select_owner" on resep for select to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);
create policy "resep_insert_owner" on resep for insert to authenticated with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);
create policy "resep_delete_owner" on resep for delete to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);

grant execute on function process_sale(jsonb, numeric, text) to authenticated;
grant execute on function process_produksi(uuid, numeric, numeric, numeric, text) to authenticated;
grant execute on function process_koreksi_stok(uuid, numeric, text) to authenticated;
grant execute on function process_beli_bahan(uuid, numeric, numeric) to authenticated;

-- 6. ROLE MANAGEMENT: profil & peran pengguna -----------------
-- Owner = akses penuh (kasir, produksi, laporan). Kasir = cuma halaman Kasir.
-- Profil dibuat otomatis (default 'kasir') tiap kali ada user baru di Supabase Auth;
-- ubah jadi 'owner' manual lewat SQL untuk akun pemilik.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text,
  role text not null check (role in ('owner', 'kasir')) default 'kasir',
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "user baca profil sendiri" on profiles for select using (auth.uid() = id);

create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, role) values (new.id, 'kasir');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 7. (OPSIONAL) Contoh produk awal — sesuaikan/hapus sesuai produk asli ARENSI
-- insert into products (nama_produk, satuan, harga_jual, harga_grosir, min_qty_grosir, stok_minimum) values
-- ('Gula Aren Cetak', 'kg', 35000, 30000, 10, 5),
-- ('Gula Semut', 'kg', 45000, 40000, 10, 5),
-- ('Gula Serbuk', 'pack', 15000, 13000, 20, 10);
