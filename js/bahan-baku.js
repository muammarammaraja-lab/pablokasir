let bahanList = [];
let productsForResep = [];
let currentResepProductId = null;

async function loadBahanList() {
  const { data, error } = await sb.from('bahan_baku').select('*').is('deleted_at', null).order('nama_bahan');
  if (error) { console.error(error); return; }
  bahanList = data;
  renderBahanTable();
  renderBahanSelects();
}

function renderBahanTable() {
  const tbody = document.getElementById('bahanTableBody');
  tbody.innerHTML = bahanList.length ? bahanList.map(b => `
    <tr>
      <td>${b.nama_bahan}</td>
      <td>${b.satuan}</td>
      <td>${formatRupiah(b.harga_per_satuan)}</td>
      <td>${b.stok} ${b.satuan}${b.stok <= b.stok_minimum ? '<span class="badge badge-low">Menipis</span>' : '<span class="badge badge-ok">Aman</span>'}</td>
      <td><button class="btn btn-secondary" onclick="editBahan('${b.id}')">Edit</button></td>
      <td><button class="btn-icon-only" onclick="deleteBahan('${b.id}')">Arsipkan</button></td>
    </tr>
  `).join('') : '<tr class="muted-row"><td colspan="6">Belum ada bahan baku, tambahkan lewat form di atas</td></tr>';
}

function renderBahanSelects() {
  const options = bahanList.map(b => `<option value="${b.id}">${b.nama_bahan} (${b.satuan})</option>`).join('');
  document.getElementById('beliBahanId').innerHTML = options;
  document.getElementById('resepBahanSelect').innerHTML = options;
}

async function submitBahan(e) {
  e.preventDefault();
  const id = document.getElementById('bahanId').value;
  const payload = {
    nama_bahan: document.getElementById('namaBahan').value,
    satuan: document.getElementById('satuanBahan').value,
    stok_minimum: parseFloat(document.getElementById('stokMinimumBahan').value) || 5,
  };

  let error;
  if (id) {
    ({ error } = await sb.from('bahan_baku').update(payload).eq('id', id));
  } else {
    payload.stok = 0;
    ({ error } = await sb.from('bahan_baku').insert(payload));
  }

  if (error) { showToast('Gagal menyimpan bahan: ' + error.message, 'danger'); return; }
  showToast(id ? 'Bahan berhasil diperbarui' : 'Bahan baru berhasil ditambahkan', 'success');
  resetBahanForm();
  await loadBahanList();
}

function editBahan(id) {
  const b = bahanList.find(x => x.id === id);
  if (!b) return;
  document.getElementById('bahanId').value = b.id;
  document.getElementById('namaBahan').value = b.nama_bahan;
  document.getElementById('satuanBahan').value = b.satuan;
  document.getElementById('stokMinimumBahan').value = b.stok_minimum;
  document.getElementById('bahanFormTitle').textContent = 'Edit Bahan Baku';
}

function resetBahanForm() {
  document.getElementById('bahanForm').reset();
  document.getElementById('bahanId').value = '';
  document.getElementById('bahanFormTitle').textContent = 'Tambah Bahan Baku';
}

async function deleteBahan(id) {
  const b = bahanList.find(x => x.id === id);
  if (!b) return;
  const ok = await confirmDialog(
    `Arsipkan bahan "${b.nama_bahan}"? Bahan ini disembunyikan dari pilihan, tapi riwayatnya tetap aman dan bisa dipulihkan.`,
    'Arsipkan'
  );
  if (!ok) return;

  const { error } = await sb.from('bahan_baku').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast('Gagal mengarsipkan: ' + error.message, 'danger'); return; }
  showToast('Bahan berhasil diarsipkan', 'success');
  await loadBahanList();
}

let archivedBahanShown = false;

async function toggleArchivedBahan() {
  const section = document.getElementById('archivedBahanSection');
  const btn = document.getElementById('toggleArchivedBahanBtn');
  archivedBahanShown = !archivedBahanShown;
  if (archivedBahanShown) {
    await loadArchivedBahan();
    section.style.display = 'block';
    btn.textContent = 'Sembunyikan bahan diarsipkan';
  } else {
    section.style.display = 'none';
    btn.textContent = 'Lihat bahan diarsipkan';
  }
}

async function loadArchivedBahan() {
  const { data, error } = await sb.from('bahan_baku').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
  if (error) { console.error(error); return; }
  document.getElementById('archivedBahanTableBody').innerHTML = data.length ? data.map(b => `
    <tr>
      <td>${b.nama_bahan}</td>
      <td>${b.satuan}</td>
      <td>${formatTanggal(b.deleted_at)}</td>
      <td><button class="btn btn-secondary" onclick="restoreBahan('${b.id}')">Pulihkan</button></td>
    </tr>
  `).join('') : '<tr class="muted-row"><td colspan="4">Belum ada bahan yang diarsipkan</td></tr>';
}

async function restoreBahan(id) {
  const { error } = await sb.from('bahan_baku').update({ deleted_at: null }).eq('id', id);
  if (error) { showToast('Gagal memulihkan: ' + error.message, 'danger'); return; }
  showToast('Bahan berhasil dipulihkan', 'success');
  await loadArchivedBahan();
  await loadBahanList();
}

async function submitBeliBahan(e) {
  e.preventDefault();
  const bahan_baku_id = document.getElementById('beliBahanId').value;
  const qty = parseFloat(document.getElementById('beliQty').value);
  const total_harga = parseFloat(document.getElementById('beliTotalHarga').value);

  if (!bahan_baku_id) { showToast('Pilih bahan baku dulu', 'danger'); return; }
  if (!qty || qty <= 0) { showToast('Qty pembelian tidak valid', 'danger'); return; }
  if (!total_harga || total_harga < 0) { showToast('Total harga tidak valid', 'danger'); return; }

  const { error } = await sb.rpc('process_beli_bahan', {
    p_bahan_baku_id: bahan_baku_id,
    p_qty: qty,
    p_total_harga: total_harga
  });

  if (error) { showToast('Gagal mencatat pembelian: ' + error.message, 'danger'); return; }

  document.getElementById('beliBahanForm').reset();
  await loadBahanList();
  showToast('Pembelian bahan baku berhasil dicatat', 'success');
}

async function loadProductsForResep() {
  const { data, error } = await sb.from('products').select('id, nama_produk').is('deleted_at', null).order('nama_produk');
  if (error) { console.error(error); return; }
  productsForResep = data;
  const sel = document.getElementById('resepProductSelect');
  sel.innerHTML = data.map(p => `<option value="${p.id}">${p.nama_produk}</option>`).join('');
  if (data.length) loadResep(data[0].id);
}

async function loadResep(productId) {
  currentResepProductId = productId;
  const { data, error } = await sb
    .from('resep')
    .select('id, qty_per_unit, bahan_baku(id, nama_bahan, satuan)')
    .eq('product_id', productId);
  if (error) { console.error(error); return; }
  document.getElementById('resepTableBody').innerHTML = data.length ? data.map(r => `
    <tr>
      <td>${r.bahan_baku?.nama_bahan || '-'}</td>
      <td>${r.qty_per_unit} ${r.bahan_baku?.satuan || ''}</td>
      <td><button class="btn-icon-only" onclick="deleteResepBaris('${r.id}')">Hapus</button></td>
    </tr>
  `).join('') : '<tr class="muted-row"><td colspan="3">Belum ada resep untuk produk ini — produksi akan pakai input biaya manual seperti biasa</td></tr>';
}

async function submitResep(e) {
  e.preventDefault();
  if (!currentResepProductId) { showToast('Pilih produk dulu', 'danger'); return; }
  const bahan_baku_id = document.getElementById('resepBahanSelect').value;
  const qty_per_unit = parseFloat(document.getElementById('resepQty').value);

  if (!bahan_baku_id) { showToast('Pilih bahan baku dulu', 'danger'); return; }
  if (!qty_per_unit || qty_per_unit <= 0) { showToast('Qty per satuan tidak valid', 'danger'); return; }

  const { error } = await sb.from('resep').insert({
    product_id: currentResepProductId,
    bahan_baku_id,
    qty_per_unit
  });

  if (error) {
    if (error.code === '23505') {
      showToast('Bahan ini sudah ada di resep produk ini', 'danger');
    } else {
      showToast('Gagal menyimpan resep: ' + error.message, 'danger');
    }
    return;
  }

  document.getElementById('resepForm').reset();
  await loadResep(currentResepProductId);
  showToast('Resep berhasil ditambahkan', 'success');
}

async function deleteResepBaris(id) {
  const ok = await confirmDialog('Hapus bahan ini dari resep?', 'Hapus');
  if (!ok) return;
  const { error } = await sb.from('resep').delete().eq('id', id);
  if (error) { showToast('Gagal menghapus: ' + error.message, 'danger'); return; }
  showToast('Bahan dihapus dari resep', 'success');
  await loadResep(currentResepProductId);
}

document.getElementById('bahanForm').addEventListener('submit', submitBahan);
document.getElementById('beliBahanForm').addEventListener('submit', submitBeliBahan);
document.getElementById('resepForm').addEventListener('submit', submitResep);

(async () => {
  const ok = await requireAuth(['owner']);
  if (!ok) return;
  await loadBahanList();
  await loadProductsForResep();
})();
