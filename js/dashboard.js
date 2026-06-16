let currentPeriode = 'bulan';

function getStartDate(periode) {
  const now = new Date();
  return periode === 'hari'
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : new Date(now.getFullYear(), now.getMonth(), 1);
}

async function loadDashboard(periode = currentPeriode) {
  const startIso = getStartDate(periode).toISOString();

  const { data: sales } = await sb.from('sales').select('total_belanja').gte('tanggal', startIso);
  const totalPendapatan = (sales || []).reduce((s, r) => s + Number(r.total_belanja), 0);

  const { data: expenses } = await sb.from('expenses').select('kategori, nominal').gte('tanggal', startIso);

  // Hanya kategori operasional murni yang dikurangkan dari laba kotor.
  // Modal Bahan Mentah & Biaya Produksi TIDAK dipakai di sini lagi karena sudah
  // tercermin di HPP produk, yang sudah dipotong saat menghitung laba kotor per produk.
  const KATEGORI_OPERASIONAL = ['Operasional Toko', 'Gaji', 'Lainnya'];
  const totalBiayaOperasional = (expenses || [])
    .filter(e => KATEGORI_OPERASIONAL.includes(e.kategori))
    .reduce((s, r) => s + Number(r.nominal), 0);

  const totalLabaKotor = await loadMarginReport(startIso);

  document.getElementById('statPendapatan').textContent = formatRupiah(totalPendapatan);
  document.getElementById('statLabaKotor').textContent = formatRupiah(totalLabaKotor);
  document.getElementById('statOperasional').textContent = formatRupiah(totalBiayaOperasional);
  document.getElementById('statLaba').textContent = formatRupiah(totalLabaKotor - totalBiayaOperasional);

  // Breakdown tetap menampilkan SEMUA kategori (termasuk Modal Bahan Mentah & Biaya Produksi)
  // — ini cuma untuk transparansi arus kas keluar, bukan dasar hitung laba bersih.
  const breakdown = {};
  (expenses || []).forEach(e => { breakdown[e.kategori] = (breakdown[e.kategori] || 0) + Number(e.nominal); });
  const kategoriList = Object.keys(breakdown).sort((a, b) => breakdown[b] - breakdown[a]);
  document.getElementById('breakdownBody').innerHTML = kategoriList.length
    ? kategoriList.map(k => `<tr><td>${k}</td><td style="text-align:right;">${formatRupiah(breakdown[k])}</td></tr>`).join('')
    : '<tr class="muted-row"><td colspan="2">Belum ada pengeluaran periode ini</td></tr>';
}

async function loadMarginReport(startIso) {
  const { data, error } = await sb.from('v_penjualan_detail').select('*').gte('tanggal', startIso);
  if (error) { console.error(error); return 0; }

  const byProduct = {};
  (data || []).forEach(row => {
    const nama = row.nama_produk || 'Tidak diketahui';
    const hpp = Number(row.harga_beli || 0);
    if (!byProduct[nama]) byProduct[nama] = { qty: 0, omzet: 0, laba: 0, satuan: row.satuan || '' };
    byProduct[nama].qty += Number(row.qty);
    byProduct[nama].omzet += Number(row.qty) * Number(row.harga_satuan);
    byProduct[nama].laba += Number(row.qty) * (Number(row.harga_satuan) - hpp);
  });

  const rows = Object.entries(byProduct).sort((a, b) => b[1].laba - a[1].laba);
  document.getElementById('marginBody').innerHTML = rows.length
    ? rows.map(([nama, r]) => `
        <tr>
          <td>${nama}</td>
          <td>${r.qty} ${r.satuan}</td>
          <td>${formatRupiah(r.omzet)}</td>
          <td>${formatRupiah(r.laba)}</td>
        </tr>`).join('')
    : '<tr class="muted-row"><td colspan="4">Belum ada penjualan periode ini</td></tr>';

  return rows.reduce((sum, [, r]) => sum + r.laba, 0);
}

async function submitExpense(e) {
  e.preventDefault();
  const payload = {
    kategori: document.getElementById('expKategori').value,
    nominal: parseFloat(document.getElementById('expNominal').value) || 0,
    deskripsi: document.getElementById('expDeskripsi').value,
  };
  const { error } = await sb.from('expenses').insert(payload);
  if (error) { showToast('Gagal menyimpan: ' + error.message, 'danger'); return; }
  showToast('Pengeluaran berhasil disimpan', 'success');
  document.getElementById('expenseForm').reset();
  await loadDashboard(currentPeriode);
}

document.getElementById('filterPeriode').addEventListener('change', (e) => {
  currentPeriode = e.target.value;
  loadDashboard(currentPeriode);
});
document.getElementById('expenseForm').addEventListener('submit', submitExpense);

function exportCSV() {
  const periodeLabel = currentPeriode === 'hari' ? 'Hari_Ini' : 'Bulan_Ini';
  const tanggal = new Date().toISOString().slice(0, 10);

  const rows = [];
  rows.push(['Laporan Keuangan ARENSI', periodeLabel]);
  rows.push(['Tanggal dibuat', tanggal]);
  rows.push([]);
  rows.push(['Ringkasan']);
  rows.push(['Total Pendapatan', document.getElementById('statPendapatan').textContent]);
  rows.push(['Laba Kotor', document.getElementById('statLabaKotor').textContent]);
  rows.push(['Biaya Operasional', document.getElementById('statOperasional').textContent]);
  rows.push(['Laba / Rugi Bersih', document.getElementById('statLaba').textContent]);
  rows.push([]);
  rows.push(['Breakdown Pengeluaran per Kategori (semua kategori, termasuk modal & produksi)']);
  rows.push(['Kategori', 'Nominal']);
  document.querySelectorAll('#breakdownBody tr').forEach(tr => {
    const cells = [...tr.children].map(td => td.textContent.trim());
    if (cells.length === 2) rows.push(cells);
  });
  rows.push([]);
  rows.push(['Laba Kotor per Produk']);
  rows.push(['Produk', 'Terjual', 'Omzet', 'Laba Kotor']);
  document.querySelectorAll('#marginBody tr').forEach(tr => {
    const cells = [...tr.children].map(td => td.textContent.trim());
    if (cells.length === 4) rows.push(cells);
  });

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Laporan_ARENSI_${periodeLabel}_${tanggal}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Laporan berhasil diunduh', 'success');
}

(async () => {
  const ok = await requireAuth(['owner']);
  if (!ok) return;
  loadDashboard(currentPeriode);
})();
