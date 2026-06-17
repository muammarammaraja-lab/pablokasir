function getDefaultDates() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dari: start.toISOString().slice(0, 10),
    sampai: now.toISOString().slice(0, 10)
  };
}

async function loadRiwayat() {
  const dari = document.getElementById('filterDari').value;
  const sampai = document.getElementById('filterSampai').value;
  const cari = document.getElementById('filterCari').value.trim();

  let query = sb.from('sales')
    .select('id, nomor_transaksi, tanggal, total_belanja, metode_pembayaran, dibuat_oleh')
    .gte('tanggal', dari)
    .lte('tanggal', sampai + 'T23:59:59')
    .order('tanggal', { ascending: false })
    .limit(200);

  if (cari) query = query.ilike('nomor_transaksi', `%${cari}%`);

  const { data, error } = await query;
  if (error) { showToast('Gagal memuat riwayat: ' + error.message, 'danger'); return; }

  document.getElementById('riwayatBody').innerHTML = data.length ? data.map(s => `
    <tr>
      <td>${s.nomor_transaksi || '-'}</td>
      <td>${formatTanggal(s.tanggal)} ${new Date(s.tanggal).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
      <td>${formatRupiah(s.total_belanja)}</td>
      <td>${s.metode_pembayaran}</td>
      <td style="font-size:12px;color:var(--brown-500);">${s.dibuat_oleh || '-'}</td>
      <td><button class="btn btn-secondary" onclick="showDetail('${s.id}')">Detail</button></td>
    </tr>
  `).join('') : '<tr class="muted-row"><td colspan="6">Tidak ada transaksi pada rentang ini</td></tr>';
}

async function showDetail(saleId) {
  const { data, error } = await sb
    .from('sale_items')
    .select('qty, harga_satuan, product_id, products(nama_produk, satuan)')
    .eq('sale_id', saleId);
  if (error) { showToast('Gagal memuat detail: ' + error.message, 'danger'); return; }

  document.getElementById('detailBody').innerHTML = data.length ? data.map(i => `
    <div class="total-row" style="align-items:center;">
      <span>${i.products?.nama_produk || '-'} x${i.qty}</span>
      <span style="display:flex;align-items:center;gap:8px;">
        ${formatRupiah(i.qty * i.harga_satuan)}
        <button class="btn-icon-only" onclick="openRetur('${saleId}', '${i.product_id}', '${i.products?.nama_produk || ''}')">Retur</button>
      </span>
    </div>
  `).join('') : '<p style="color:var(--brown-500);font-size:13px;">Tidak ada item</p>';
  document.getElementById('detailModal').style.display = 'flex';
}

function openRetur(saleId, productId, namaProduk) {
  document.getElementById('returSaleId').value = saleId;
  document.getElementById('returProductId').value = productId;
  document.getElementById('returProductLabel').textContent = namaProduk;
  document.getElementById('returModal').style.display = 'flex';
}

function closeRetur() {
  document.getElementById('returModal').style.display = 'none';
  document.getElementById('returForm').reset();
}

async function submitRetur(e) {
  e.preventDefault();
  const sale_id = document.getElementById('returSaleId').value;
  const product_id = document.getElementById('returProductId').value;
  const qty = parseFloat(document.getElementById('returQty').value);
  const alasan = document.getElementById('returAlasan').value.trim();
  const bisaDijual = document.getElementById('returBisaDijual').checked;

  if (!qty || qty <= 0) { showToast('Qty retur tidak valid', 'danger'); return; }
  if (!alasan) { showToast('Alasan retur wajib diisi', 'danger'); return; }

  const { error } = await sb.rpc('process_retur', {
    p_sale_id: sale_id,
    p_product_id: product_id,
    p_qty: qty,
    p_alasan: alasan,
    p_bisa_dijual_lagi: bisaDijual
  });

  if (error) { showToast('Gagal memproses retur: ' + error.message, 'danger'); return; }

  closeRetur();
  closeDetail();
  showToast('Retur berhasil diproses', 'success');
  await loadReturHistory();
}

async function loadReturHistory() {
  const { data, error } = await sb
    .from('retur')
    .select('nomor_retur, tanggal, qty, nominal_pengembalian, alasan, products(nama_produk, satuan)')
    .order('tanggal', { ascending: false })
    .limit(50);
  if (error) { console.error(error); return; }
  document.getElementById('returHistoryBody').innerHTML = data.length ? data.map(r => `
    <tr>
      <td>${r.nomor_retur || '-'}</td>
      <td>${formatTanggal(r.tanggal)}</td>
      <td>${r.products?.nama_produk || '-'}</td>
      <td>${r.qty} ${r.products?.satuan || ''}</td>
      <td>${formatRupiah(r.nominal_pengembalian)}</td>
      <td>${r.alasan}</td>
    </tr>
  `).join('') : '<tr class="muted-row"><td colspan="6">Belum ada retur</td></tr>';
}

function closeDetail() {
  document.getElementById('detailModal').style.display = 'none';
}

document.getElementById('filterForm').addEventListener('submit', (e) => {
  e.preventDefault();
  loadRiwayat();
});
document.getElementById('returForm').addEventListener('submit', submitRetur);

(async () => {
  const ok = await requireAuth(['owner']);
  if (!ok) return;
  const def = getDefaultDates();
  document.getElementById('filterDari').value = def.dari;
  document.getElementById('filterSampai').value = def.sampai;
  await loadRiwayat();
  await loadReturHistory();
})();
