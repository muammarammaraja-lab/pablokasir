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
  const totalPengeluaran = (expenses || []).reduce((s, r) => s + Number(r.nominal), 0);

  document.getElementById('statPendapatan').textContent = formatRupiah(totalPendapatan);
  document.getElementById('statPengeluaran').textContent = formatRupiah(totalPengeluaran);
  document.getElementById('statLaba').textContent = formatRupiah(totalPendapatan - totalPengeluaran);

  const breakdown = {};
  (expenses || []).forEach(e => { breakdown[e.kategori] = (breakdown[e.kategori] || 0) + Number(e.nominal); });
  const kategoriList = Object.keys(breakdown).sort((a, b) => breakdown[b] - breakdown[a]);
  document.getElementById('breakdownBody').innerHTML = kategoriList.length
    ? kategoriList.map(k => `<tr><td>${k}</td><td style="text-align:right;">${formatRupiah(breakdown[k])}</td></tr>`).join('')
    : '<tr><td colspan="2" style="color:var(--brown-500);">Belum ada pengeluaran periode ini</td></tr>';

  await loadMarginReport(startIso);
}

async function loadMarginReport(startIso) {
  const { data, error } = await sb.from('v_penjualan_detail').select('*').gte('tanggal', startIso);
  if (error) { console.error(error); return; }

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
    : '<tr><td colspan="4" style="color:var(--brown-500);">Belum ada penjualan periode ini</td></tr>';
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

loadDashboard(currentPeriode);
