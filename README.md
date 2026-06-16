# ARENSI POS

Aplikasi kasir sederhana untuk ARENSI: transaksi penjualan, pencatatan produksi gula aren, dan laporan keuangan.

## Setup (sekali saja)

1. Buat project baru di https://supabase.com (gratis).
2. Buka **SQL Editor** di project tersebut, copy seluruh isi `sql/schema.sql`, lalu jalankan (Run).
3. Buka **Project Settings > API**, copy `Project URL` dan `anon public key`.
4. Edit `js/config.js`, isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` dengan nilai dari langkah 3.
5. Buka `produksi.html` di browser, tambahkan produk gula aren ARENSI (cetak, semut, serbuk, dll) lewat form "Tambah Produk Baru". Atau aktifkan contoh data di bagian bawah `schema.sql` sebelum menjalankannya.
6. Deploy ke GitHub Pages atau Vercel seperti project kamu yang lain — semua file statis, tidak perlu build step.

## Struktur file

- `index.html` — halaman kasir (transaksi penjualan)
- `produksi.html` — kelola produk & catat hasil produksi
- `dashboard.html` — laporan keuangan (pendapatan, pengeluaran, laba, margin per produk)
- `css/style.css` — semua styling
- `js/config.js` — kredensial Supabase (isi sendiri)
- `js/utils.js`, `js/kasir.js`, `js/produksi.js`, `js/dashboard.js` — logic tiap halaman
- `sql/schema.sql` — skema database lengkap (tabel, fungsi, RLS)

## Cara kerja inti

- **Checkout** (`index.html`) memanggil fungsi database `process_sale` — validasi stok, hitung kembalian, simpan transaksi, dan kurangi stok semuanya dalam satu transaksi atomik di Postgres. Kalau stok kurang, fungsi ini gagal total dan tidak ada data yang tersimpan.
- **Produksi** (`produksi.html`) memanggil `process_produksi` — sekali input, otomatis: catat batch produksi, tambah stok, hitung ulang HPP (harga_beli), dan catat dua baris pengeluaran (Modal Bahan Mentah + Biaya Produksi).
- **Dashboard** menghitung total pendapatan/pengeluaran dari tabel `sales` dan `expenses` sesuai periode, plus laba kotor per produk dari view `v_penjualan_detail`.

## Catatan keamanan (penting, sebelum dipakai jangka panjang)

Saat ini semua halaman bisa diakses dan ditulis oleh siapa pun yang punya link, karena policy RLS dibuat permisif sementara (role akses kasir vs pemilik belum dibahas). Jangan sebar link produksi ke publik. Saat fitur role akses sudah didesain, ganti policy di `schema.sql` bagian 5 dengan aturan berbasis Supabase Auth.
