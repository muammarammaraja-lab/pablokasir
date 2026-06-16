let suppliersList = [];

async function loadSuppliers() {
  const { data, error } = await sb.from('suppliers').select('*').is('deleted_at', null).order('nama_supplier');
  if (error) { console.error(error); return; }
  suppliersList = data;
  renderSupplierTable();
  renderSupplierSelect();
}

function renderSupplierTable() {
  document.getElementById('supplierTableBody').innerHTML = suppliersList.length ? suppliersList.map(s => `
    <tr>
      <td>${s.nama_supplier}</td>
      <td>${s.kontak || '-'}</td>
      <td>${s.alamat || '-'}</td>
      <td><button class="btn btn-secondary" onclick="editSupplier('${s.id}')">Edit</button></td>
      <td><button class="btn-icon-only" onclick="deleteSupplier('${s.id}')">Arsipkan</button></td>
    </tr>
  `).join('') : '<tr class="muted-row"><td colspan="5">Belum ada supplier, tambahkan lewat form di atas</td></tr>';
}

function renderSupplierSelect() {
  document.getElementById('poSupplier').innerHTML = suppliersList.map(s => `<option value="${s.id}">${s.nama_supplier}</option>`).join('');
}

async function submitSupplier(e) {
  e.preventDefault();
  const id = document.getElementById('supplierId').value;
  const payload = {
    nama_supplier: document.getElementById('namaSupplier').value,
    kontak: document.getElementById('kontakSupplier').value,
    alamat: document.getElementById('alamatSupplier').value,
  };

  let error;
  if (id) {
    ({ error } = await sb.from('suppliers').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('suppliers').insert(payload));
  }

  if (error) { showToast('Gagal menyimpan supplier: ' + error.message, 'danger'); return; }
  showToast(id ? 'Supplier berhasil diperbarui' : 'Supplier baru berhasil ditambahkan', 'success');
  resetSupplierForm();
  await loadSuppliers();
}

function editSupplier(id) {
  const s = suppliersList.find(x => x.id === id);
  if (!s) return;
  document.getElementById('supplierId').value = s.id;
  document.getElementById('namaSupplier').value = s.nama_supplier;
  document.getElementById('kontakSupplier').value = s.kontak || '';
  document.getElementById('alamatSupplier').value = s.alamat || '';
  document.getElementById('supplierFormTitle').textContent = 'Edit Supplier';
}

function resetSupplierForm() {
  document.getElementById('supplierForm').reset();
  document.getElementById('supplierId').value = '';
  document.getElementById('supplierFormTitle').textContent = 'Tambah Supplier';
}

async function deleteSupplier(id) {
  const s = suppliersList.find(x => x.id === id);
  if (!s) return;
  const ok = await confirmDialog(`Arsipkan supplier "${s.nama_supplier}"? Riwayat PO-nya tetap aman.`, 'Arsipkan');
  if (!ok) return;
  const { error } = await sb.from('suppliers').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast('Gagal mengarsipkan: ' + error.message, 'danger'); return; }
  showToast('Supplier berhasil diarsipkan', 'success');
  await loadSuppliers();
}

async function loadBahanForPo() {
  const { data, error } = await sb.from('bahan_baku').select('id, nama_bahan, satuan').is('deleted_at', null).order('nama_bahan');
  if (error) { console.error(error); return; }
  document.getElementById('poBahan').innerHTML = data.map(b => `<option value="${b.id}">${b.nama_bahan} (${b.satuan})</option>`).join('');
}

async function submitPo(e) {
  e.preventDefault();
  const supplier_id = document.getElementById('poSupplier').value;
  const bahan_baku_id = document.getElementById('poBahan').value;
  const qty = parseFloat(document.getElementById('poQty').value);
  const hargaEstimasi = parseFloat(document.getElementById('poHargaEstimasi').value) || null;
  const catatan = document.getElementById('poCatatan').value;

  if (!supplier_id) { showToast('Tambahkan supplier dulu sebelum buat PO', 'danger'); return; }
  if (!bahan_baku_id) { showToast('Tambahkan bahan baku dulu sebelum buat PO', 'danger'); return; }
  if (!qty || qty <= 0) { showToast('Qty pesan tidak valid', 'danger'); return; }

  const { error } = await sb.rpc('process_buat_po', {
    p_supplier_id: supplier_id,
    p_bahan_baku_id: bahan_baku_id,
    p_qty_pesan: qty,
    p_harga_estimasi: hargaEstimasi,
    p_catatan: catatan
  });

  if (error) { showToast('Gagal membuat PO: ' + error.message, 'danger'); return; }
  document.getElementById('poForm').reset();
  await loadPo();
  showToast('PO berhasil dibuat', 'success');
}

async function loadPo() {
  const { data, error } = await sb
    .from('purchase_orders')
    .select('id, nomor_po, qty_pesan, status, tanggal_pesan, suppliers(nama_supplier), bahan_baku(nama_bahan, satuan)')
    .order('tanggal_pesan', { ascending: false })
    .limit(50);
  if (error) { console.error(error); return; }

  document.getElementById('poTableBody').innerHTML = data.length ? data.map(po => {
    const badgeClass = po.status === 'Diterima' ? 'badge-ok' : 'badge-low';
    const aksi = po.status === 'Dipesan'
      ? `<button class="btn btn-primary" onclick="openTerima('${po.id}')">Terima</button> <button class="btn-icon-only" onclick="batalkanPo('${po.id}')">Batalkan</button>`
      : '-';
    return `
    <tr>
      <td>${po.nomor_po || '-'}</td>
      <td>${po.suppliers?.nama_supplier || '-'}</td>
      <td>${po.bahan_baku?.nama_bahan || '-'}</td>
      <td>${po.qty_pesan} ${po.bahan_baku?.satuan || ''}</td>
      <td><span class="badge ${badgeClass}">${po.status}</span></td>
      <td>${formatTanggal(po.tanggal_pesan)}</td>
      <td>${aksi}</td>
    </tr>`;
  }).join('') : '<tr class="muted-row"><td colspan="7">Belum ada PO</td></tr>';
}

function openTerima(poId) {
  document.getElementById('terimaPoId').value = poId;
  document.getElementById('terimaModal').style.display = 'flex';
}

function closeTerima() {
  document.getElementById('terimaModal').style.display = 'none';
  document.getElementById('terimaForm').reset();
}

async function submitTerima(e) {
  e.preventDefault();
  const po_id = document.getElementById('terimaPoId').value;
  const qty = parseFloat(document.getElementById('terimaQty').value);
  const harga = parseFloat(document.getElementById('terimaHarga').value);

  if (!qty || qty <= 0) { showToast('Qty terima tidak valid', 'danger'); return; }
  if (!harga || harga < 0) { showToast('Harga aktual tidak valid', 'danger'); return; }

  const { error } = await sb.rpc('process_terima_po', {
    p_po_id: po_id,
    p_qty_terima: qty,
    p_harga_aktual: harga
  });

  if (error) { showToast('Gagal menerima PO: ' + error.message, 'danger'); return; }
  closeTerima();
  await loadPo();
  showToast('PO diterima, stok bahan baku sudah bertambah', 'success');
}

async function batalkanPo(poId) {
  const ok = await confirmDialog('Batalkan PO ini? Tindakan ini tidak bisa dibatalkan.', 'Batalkan');
  if (!ok) return;
  const { error } = await sb.rpc('process_batalkan_po', { p_po_id: poId });
  if (error) { showToast('Gagal membatalkan: ' + error.message, 'danger'); return; }
  showToast('PO dibatalkan', 'success');
  await loadPo();
}

document.getElementById('supplierForm').addEventListener('submit', submitSupplier);
document.getElementById('poForm').addEventListener('submit', submitPo);
document.getElementById('terimaForm').addEventListener('submit', submitTerima);

(async () => {
  const ok = await requireAuth(['owner']);
  if (!ok) return;
  await loadSuppliers();
  await loadBahanForPo();
  await loadPo();
})();
