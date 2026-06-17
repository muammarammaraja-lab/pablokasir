function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka || 0);
}

function formatTanggal(iso) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function confirmDialog(message, labelOk = 'Hapus') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <p>${message}</p>
        <div style="display:flex;gap:8px;margin-top:16px;">
          <button class="btn btn-secondary" style="flex:1;margin-right:0;" data-act="cancel">Batal</button>
          <button class="btn" style="flex:1;margin-right:0;background:var(--red-600);color:#fff;" data-act="ok">${labelOk}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.dataset.act === 'cancel') { overlay.remove(); resolve(false); }
      if (e.target.dataset.act === 'ok') { overlay.remove(); resolve(true); }
    });
  });
}

async function applyCustomLogo() {
  try {
    const { data } = await sb.from('app_settings').select('logo_url').eq('id', 1).single();
    if (data?.logo_url) {
      document.querySelectorAll('.logo-mark').forEach(el => {
        const img = document.createElement('img');
        img.src = data.logo_url;
        img.alt = 'Logo';
        img.className = 'logo-mark';
        img.style.cssText = 'width:20px;height:20px;border-radius:5px;vertical-align:-5px;margin-right:8px;object-fit:cover;';
        el.replaceWith(img);
      });
    }
  } catch (e) { /* gagal ambil setting logo, biarkan logo default tetap tampil */ }
}

function toggleNav() {
  const nav = document.querySelector('.topbar nav');
  if (nav) nav.classList.toggle('nav-open');
}

// Tutup menu otomatis kalau klik di luar nav (termasuk setelah pilih menu)
document.addEventListener('click', (e) => {
  const nav = document.querySelector('.topbar nav');
  const toggleBtn = document.querySelector('.nav-toggle');
  if (!nav || !nav.classList.contains('nav-open')) return;
  if (nav.contains(e.target) && e.target.tagName !== 'A') return;
  if (toggleBtn && toggleBtn.contains(e.target)) return;
  nav.classList.remove('nav-open');
});
