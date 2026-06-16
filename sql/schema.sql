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
  tanggal timestamptz default now(),
  total_belanja numeric(12,2) not null,
  uang_bayar numeric(12,2) not null,
  uang_kembalian numeric(12,2) not null,
  metode_pembayaran text default 'Cash'
);

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
  catatan text
);

create table stok_log (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id),
  tanggal timestamptz default now(),
  tipe text check (tipe in ('Penjualan','Produksi','Koreksi Manual')),
  qty numeric(12,2) not null,           -- selisih: negatif = berkurang, positif = bertambah
  saldo_setelah numeric(12,2) not null, -- stok setelah pergerakan ini, untuk audit
  sale_id uuid references sales(id),
  produksi_id uuid references produksi(id),
  keterangan text,
  dibuat_oleh text default 'sistem'     -- nanti diisi otomatis saat role management aktif
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
) returns uuid as $$
declare
  v_sale_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_stok numeric;
  v_saldo_baru numeric;
begin
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

  insert into sales (total_belanja, uang_bayar, uang_kembalian, metode_pembayaran)
  values (v_total, p_uang_bayar, p_uang_bayar - v_total, p_metode)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into sale_items (sale_id, product_id, qty, harga_satuan)
    values (v_sale_id, (v_item->>'product_id')::uuid, (v_item->>'qty')::numeric, (v_item->>'harga_satuan')::numeric);

    update products set stok = stok - (v_item->>'qty')::numeric
    where id = (v_item->>'product_id')::uuid
    returning stok into v_saldo_baru;

    insert into stok_log (product_id, tipe, qty, saldo_setelah, sale_id)
    values ((v_item->>'product_id')::uuid, 'Penjualan', -((v_item->>'qty')::numeric), v_saldo_baru, v_sale_id);
  end loop;

  return v_sale_id;
end;
$$ language plpgsql;

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
begin
  if p_qty_hasil <= 0 then
    raise exception 'Qty hasil produksi harus lebih dari 0';
  end if;

  insert into produksi (product_id, qty_hasil, biaya_bahan_mentah, biaya_produksi, catatan)
  values (p_product_id, p_qty_hasil, p_biaya_bahan_mentah, p_biaya_produksi, p_catatan)
  returning id into v_produksi_id;

  update products set stok = stok + p_qty_hasil where id = p_product_id
  returning stok into v_saldo_baru;

  insert into stok_log (product_id, tipe, qty, saldo_setelah, produksi_id)
  values (p_product_id, 'Produksi', p_qty_hasil, v_saldo_baru, v_produksi_id);

  -- HPP di-replace penuh tiap batch baru (bukan rata-rata tertimbang) — simplifikasi awal
  v_hpp_baru := (p_biaya_bahan_mentah + p_biaya_produksi) / p_qty_hasil;
  update products set harga_beli = v_hpp_baru where id = p_product_id;

  insert into expenses (kategori, nominal, deskripsi, produksi_id)
  values ('Modal Bahan Mentah', p_biaya_bahan_mentah, 'Bahan baku untuk produksi ' || p_qty_hasil || ' unit', v_produksi_id);

  insert into expenses (kategori, nominal, deskripsi, produksi_id)
  values ('Biaya Produksi', p_biaya_produksi, 'Tenaga kerja, kayu bakar, kemasan', v_produksi_id);

  return v_produksi_id;
end;
$$ language plpgsql;

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
begin
  if p_alasan is null or trim(p_alasan) = '' then
    raise exception 'Alasan koreksi wajib diisi';
  end if;
  if p_qty_aktual < 0 then
    raise exception 'Stok tidak boleh negatif';
  end if;

  select stok into v_stok_sekarang from products where id = p_product_id for update;
  if v_stok_sekarang is null then
    raise exception 'Produk tidak ditemukan';
  end if;

  v_selisih := p_qty_aktual - v_stok_sekarang;

  update products set stok = p_qty_aktual where id = p_product_id;

  insert into stok_log (product_id, tipe, qty, saldo_setelah, keterangan)
  values (p_product_id, 'Koreksi Manual', v_selisih, p_qty_aktual, p_alasan);
end;
$$ language plpgsql;

-- 5. ROW LEVEL SECURITY -------------------------------------
-- SEMENTARA: akses penuh untuk siapa saja yang punya anon key (role akses belum dibahas)
-- TODO: ganti dengan policy berbasis auth.uid() saat fitur role kasir vs pemilik dibuat

alter table products enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table produksi enable row level security;
alter table expenses enable row level security;
alter table stok_log enable row level security;

create policy "akses_penuh_sementara" on products for all using (true) with check (true);
create policy "akses_penuh_sementara" on sales for all using (true) with check (true);
create policy "akses_penuh_sementara" on sale_items for all using (true) with check (true);
create policy "akses_penuh_sementara" on produksi for all using (true) with check (true);
create policy "akses_penuh_sementara" on expenses for all using (true) with check (true);
create policy "akses_penuh_sementara" on stok_log for all using (true) with check (true);

grant execute on function process_sale(jsonb, numeric, text) to anon, authenticated;
grant execute on function process_produksi(uuid, numeric, numeric, numeric, text) to anon, authenticated;
grant execute on function process_koreksi_stok(uuid, numeric, text) to anon, authenticated;

-- 6. (OPSIONAL) Contoh produk awal — sesuaikan/hapus sesuai produk asli ARENSI
-- insert into products (nama_produk, satuan, harga_jual, harga_grosir, min_qty_grosir, stok_minimum) values
-- ('Gula Aren Cetak', 'kg', 35000, 30000, 10, 5),
-- ('Gula Semut', 'kg', 45000, 40000, 10, 5),
-- ('Gula Serbuk', 'pack', 15000, 13000, 20, 10);
