let productsList = [];

async function loadProductsList() {
  const { data, error } = await sb.from('products').select('*').order('nama_produk');
  if (error) { console.error(error); return; }
  productsList = data;
  renderProductTable();
  renderProduksiSelect();
}

function renderProductTable() {
  const tbody = document.getElementById('productTableBody');
  tbody.innerHTML = productsList.length ? productsList.map(p => `
    <tr>
      <td>${p.nama_produk}</td>
      <td>${p.satuan}</td>
      <td>${formatRupiah(p.harga_beli)}</td>
      <td>${formatRupiah(p.harga_jual)}</td>
      <td>${p.harga_grosir ? formatRupiah(p.harga_grosir) + ' (min ' + p.min_qty_grosir + ' ' + p.satuan + ')' : '-'}</td>
      <td>${p.stok} ${p.satuan}${p.stok <= p.stok_minimum ? '<span class="badge badge-low">Menipis</span>' : '<span class="badge badge-ok">Aman</span>'}</td>
      <td><button class="btn btn-secondary" onclick="editProduct('${p.id}')">Edit</button></td>
    </tr>
  `).join('') : '<tr><td colspan="7" style="color:var(--brown-500);">Belum ada produk, tambahkan lewat form di atas</td></tr>';
}

function renderProduksiSelect() {
  const sel = document.getElementById('produksiProduct');
  sel.innerHTML = productsList.map(p => `<option value="${p.id}">${p.nama_produk}</option>`).join('');
}

async function submitProduk(e) {
  e.preventDefault();
  const id = document.getElementById('productId').value;
  const payload = {
    nama_produk: document.getElementById('namaProduk').value,
    satuan: document.getElementById('satuan').value,
    harga_jual: parseFloat(document.getElementById('hargaJual').value) || 0,
    harga_grosir: parseFloat(document.getElementById('hargaGrosir').value) || null,
    min_qty_grosir: parseFloat(document.getElementById('minQtyGrosir').value) || null,
    stok_minimum: parseFloat(document.getElementById('stokMinimum').value) || 5,
  };

  let error;
  if (id) {
    ({ error } = await sb.from('products').update(payload).eq('id', id));
  } else {
    payload.stok = 0;
    ({ error } = await sb.from('products').insert(payload));
  }

  if (error) { alert('Gagal menyimpan produk: ' + error.message); return; }
  resetProdukForm();
  await loadProductsList();
}

function editProduct(id) {
  const p = productsList.find(x => x.id === id);
  if (!p) return;
  document.getElementById('productId').value = p.id;
  document.getElementById('namaProduk').value = p.nama_produk;
  document.getElementById('satuan').value = p.satuan;
  document.getElementById('hargaJual').value = p.harga_jual;
  document.getElementById('hargaGrosir').value = p.harga_grosir || '';
  document.getElementById('minQtyGrosir').value = p.min_qty_grosir || '';
  document.getElementById('stokMinimum').value = p.stok_minimum;
  document.getElementById('produkFormTitle').textContent = 'Edit Produk';
}

function resetProdukForm() {
  document.getElementById('produkForm').reset();
  document.getElementById('productId').value = '';
  document.getElementById('produkFormTitle').textContent = 'Tambah Produk Baru';
}

async function submitProduksi(e) {
  e.preventDefault();
  const product_id = document.getElementById('produksiProduct').value;
  const qty_hasil = parseFloat(document.getElementById('qtyHasil').value) || 0;
  const biaya_bahan = parseFloat(document.getElementById('biayaBahan').value) || 0;
  const biaya_produksi = parseFloat(document.getElementById('biayaProduksi').value) || 0;
  const catatan = document.getElementById('catatanProduksi').value;

  if (!product_id) { alert('Tambahkan produk dulu sebelum mencatat produksi'); return; }
  if (qty_hasil <= 0) { alert('Qty hasil produksi harus lebih dari 0'); return; }

  const { error } = await sb.rpc('process_produksi', {
    p_product_id: product_id,
    p_qty_hasil: qty_hasil,
    p_biaya_bahan_mentah: biaya_bahan,
    p_biaya_produksi: biaya_produksi,
    p_catatan: catatan
  });

  if (error) { alert('Gagal mencatat produksi: ' + error.message); return; }

  document.getElementById('produksiForm').reset();
  await loadProductsList();
  await loadRecentProduksi();
  alert('Produksi berhasil dicatat — stok dan HPP sudah diperbarui');
}

async function loadRecentProduksi() {
  const { data, error } = await sb
    .from('produksi')
    .select('tanggal, qty_hasil, biaya_bahan_mentah, biaya_produksi, products(nama_produk, satuan)')
    .order('tanggal', { ascending: false })
    .limit(10);
  if (error) { console.error(error); return; }
  const tbody = document.getElementById('produksiHistoryBody');
  tbody.innerHTML = data.length ? data.map(r => `
    <tr>
      <td>${formatTanggal(r.tanggal)}</td>
      <td>${r.products?.nama_produk || '-'}</td>
      <td>${r.qty_hasil} ${r.products?.satuan || ''}</td>
      <td>${formatRupiah(Number(r.biaya_bahan_mentah) + Number(r.biaya_produksi))}</td>
    </tr>
  `).join('') : '<tr><td colspan="4" style="color:var(--brown-500);">Belum ada riwayat produksi</td></tr>';
}

document.getElementById('produkForm').addEventListener('submit', submitProduk);
document.getElementById('produksiForm').addEventListener('submit', submitProduksi);

loadProductsList();
loadRecentProduksi();
