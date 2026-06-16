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
    .select('qty, harga_satuan, products(nama_produk, satuan)')
    .eq('sale_id', saleId);
  if (error) { showToast('Gagal memuat detail: ' + error.message, 'danger'); return; }

  document.getElementById('detailBody').innerHTML = data.length ? data.map(i => `
    <div class="total-row"><span>${i.products?.nama_produk || '-'} x${i.qty}</span><span>${formatRupiah(i.qty * i.harga_satuan)}</span></div>
  `).join('') : '<p style="color:var(--brown-500);font-size:13px;">Tidak ada item</p>';
  document.getElementById('detailModal').style.display = 'flex';
}

function closeDetail() {
  document.getElementById('detailModal').style.display = 'none';
}

document.getElementById('filterForm').addEventListener('submit', (e) => {
  e.preventDefault();
  loadRiwayat();
});

(async () => {
  const ok = await requireAuth(['owner']);
  if (!ok) return;
  const def = getDefaultDates();
  document.getElementById('filterDari').value = def.dari;
  document.getElementById('filterSampai').value = def.sampai;
  await loadRiwayat();
})();
