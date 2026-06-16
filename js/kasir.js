let products = [];
let cart = [];

async function loadProducts() {
  const { data, error } = await sb.from('products').select('*').is('deleted_at', null).order('nama_produk');
  if (error) { console.error(error); return; }
  products = data;
  renderProducts(document.getElementById('searchProduct').value);
}

function renderProducts(filter = '') {
  const grid = document.getElementById('productGrid');
  const list = products.filter(p => p.nama_produk.toLowerCase().includes(filter.toLowerCase()));
  grid.innerHTML = list.map(p => `
    <div class="product-card ${p.stok <= 0 ? 'out' : ''}" onclick="addToCart('${p.id}')">
      <div class="nama">${p.nama_produk}</div>
      <div class="harga">${formatRupiah(p.harga_jual)} / ${p.satuan}</div>
      <div class="stok ${p.stok <= p.stok_minimum ? 'low' : ''}">Stok: ${p.stok} ${p.satuan}</div>
    </div>
  `).join('') || '<p style="color:var(--brown-500);font-size:13px;">Produk tidak ditemukan</p>';
}

function addToCart(productId) {
  const p = products.find(x => x.id === productId);
  if (!p || p.stok <= 0) return;
  const existing = cart.find(c => c.product_id === productId);
  if (existing) {
    if (existing.qty + 1 > p.stok) { showToast('Stok tidak cukup', 'danger'); return; }
    existing.qty += 1;
  } else {
    cart.push({
      product_id: p.id, nama_produk: p.nama_produk, qty: 1,
      harga_satuan: p.harga_jual, stok: p.stok,
      harga_jual: p.harga_jual, harga_grosir: p.harga_grosir, min_qty_grosir: p.min_qty_grosir
    });
  }
  updateCartPricing();
  renderCart();
}

function updateCartPricing() {
  cart.forEach(item => {
    const kenaGrosir = item.harga_grosir && item.min_qty_grosir && item.qty >= item.min_qty_grosir;
    if (kenaGrosir && item.harga_satuan === item.harga_jual) item.harga_satuan = item.harga_grosir;
    if (!kenaGrosir && item.harga_satuan === item.harga_grosir) item.harga_satuan = item.harga_jual;
  });
}

function changeQty(productId, delta) {
  const item = cart.find(c => c.product_id === productId);
  if (!item) return;
  const newQty = Math.round((item.qty + delta) * 100) / 100;
  if (newQty <= 0) { removeFromCart(productId); return; }
  if (newQty > item.stok) { showToast('Stok tidak cukup', 'danger'); return; }
  item.qty = newQty;
  updateCartPricing();
  renderCart();
}

function setQty(productId, val) {
  const item = cart.find(c => c.product_id === productId);
  if (!item) return;
  const newQty = parseFloat(val) || 0;
  if (newQty <= 0) { removeFromCart(productId); return; }
  if (newQty > item.stok) { showToast('Stok tidak cukup', 'danger'); renderCart(); return; }
  item.qty = newQty;
  updateCartPricing();
  renderCart();
}

function setHarga(productId, val) {
  const item = cart.find(c => c.product_id === productId);
  if (!item) return;
  item.harga_satuan = parseFloat(val) || 0;
  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter(c => c.product_id !== productId);
  renderCart();
}

function renderCart() {
  const cartEl = document.getElementById('cartItems');
  cartEl.innerHTML = cart.length === 0
    ? '<p style="color:var(--brown-500);font-size:13px;">Belum ada produk dipilih</p>'
    : cart.map(item => `
      <div class="cart-item">
        <div class="info">
          <div class="nama">${item.nama_produk}</div>
          <input type="number" step="0.01" value="${item.harga_satuan}" oninput="setHarga('${item.product_id}', this.value)" style="width:100px;padding:4px 6px;font-size:12px;">
        </div>
        <div class="qty-control">
          <button onclick="changeQty('${item.product_id}', -1)">-</button>
          <input type="number" step="0.01" value="${item.qty}" oninput="setQty('${item.product_id}', this.value)">
          <button onclick="changeQty('${item.product_id}', 1)">+</button>
        </div>
        <div style="width:90px;text-align:right;font-weight:600;font-size:13px;">${formatRupiah(item.qty * item.harga_satuan)}</div>
        <button onclick="removeFromCart('${item.product_id}')" style="background:none;border:none;color:var(--red-600);cursor:pointer;font-size:18px;line-height:1;">&times;</button>
      </div>
    `).join('');
  renderSummary();
}

function getTotal() {
  return cart.reduce((sum, item) => sum + item.qty * item.harga_satuan, 0);
}

function renderSummary() {
  const total = getTotal();
  document.getElementById('totalBelanja').textContent = formatRupiah(total);
  const bayar = parseFloat(document.getElementById('uangBayar').value) || 0;
  document.getElementById('uangKembalian').textContent = formatRupiah(Math.max(bayar - total, 0));

  const stokKurang = cart.some(item => item.qty > item.stok);
  const checkoutBtn = document.getElementById('btnCheckout');
  const alertEl = document.getElementById('cartAlert');

  if (stokKurang) {
    alertEl.innerHTML = '<div class="alert alert-danger">Stok tidak cukup untuk salah satu produk</div>';
    checkoutBtn.disabled = true;
  } else if (cart.length === 0) {
    alertEl.innerHTML = '';
    checkoutBtn.disabled = true;
  } else if (bayar < total) {
    alertEl.innerHTML = '<div class="alert alert-danger">Uang bayar kurang dari total belanja</div>';
    checkoutBtn.disabled = true;
  } else {
    alertEl.innerHTML = '';
    checkoutBtn.disabled = false;
  }
}

async function checkout() {
  if (cart.length === 0) { showToast('Keranjang masih kosong', 'danger'); return; }

  const total = getTotal();
  const bayar = parseFloat(document.getElementById('uangBayar').value) || 0;
  const metode = document.getElementById('metodeBayar').value;
  const btn = document.getElementById('btnCheckout');
  btn.disabled = true;
  btn.textContent = 'Memproses...';

  const items = cart.map(c => ({ product_id: c.product_id, qty: c.qty, harga_satuan: c.harga_satuan }));

  const { error } = await sb.rpc('process_sale', {
    p_items: items,
    p_uang_bayar: bayar,
    p_metode: metode
  });

  if (error) {
    showToast('Transaksi gagal: ' + error.message, 'danger');
    btn.disabled = false;
    btn.textContent = 'Selesaikan transaksi';
    return;
  }

  showReceipt({ total, bayar, kembalian: bayar - total, metode, items: [...cart] });
  cart = [];
  document.getElementById('uangBayar').value = '';
  renderCart();
  await loadProducts();
  btn.textContent = 'Selesaikan transaksi';
}

function showReceipt(trx) {
  document.getElementById('receiptBody').innerHTML = `
    <p style="color:var(--brown-500);font-size:13px;margin-bottom:10px;">${new Date().toLocaleString('id-ID')}</p>
    ${trx.items.map(i => `<div class="total-row"><span>${i.nama_produk} x${i.qty}</span><span>${formatRupiah(i.qty * i.harga_satuan)}</span></div>`).join('')}
    <div class="total-row grand"><span>Total</span><span>${formatRupiah(trx.total)}</span></div>
    <div class="total-row"><span>Bayar (${trx.metode})</span><span>${formatRupiah(trx.bayar)}</span></div>
    <div class="total-row"><span>Kembalian</span><span>${formatRupiah(trx.kembalian)}</span></div>
  `;
  document.getElementById('receiptModal').style.display = 'flex';
}

function closeReceipt() {
  document.getElementById('receiptModal').style.display = 'none';
}

document.getElementById('uangBayar').addEventListener('input', renderSummary);
document.getElementById('searchProduct').addEventListener('input', (e) => renderProducts(e.target.value));

renderCart();
loadProducts();
