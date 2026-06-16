let scannerInstance = null;
let scannerCallback = null;

function ensureScannerModal() {
  if (document.getElementById('scannerModal')) return;
  const div = document.createElement('div');
  div.id = 'scannerModal';
  div.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(61,40,23,0.8);align-items:center;justify-content:center;z-index:300;padding:20px;';
  div.innerHTML = `
    <div class="card" style="width:100%;max-width:340px;">
      <h3 style="margin-bottom:10px;">Scan Barcode / QR</h3>
      <div id="scannerReader" style="width:100%;border-radius:8px;overflow:hidden;"></div>
      <p class="subtitle" style="margin-top:10px;margin-bottom:0;">Arahkan kamera ke barcode/QR di kemasan produk</p>
      <button class="btn btn-secondary btn-block" style="margin-top:12px;" onclick="closeScannerModal()">Batal</button>
    </div>
  `;
  document.body.appendChild(div);
}

async function openScanner(callback) {
  if (typeof Html5Qrcode === 'undefined') {
    showToast('Library scanner gagal dimuat, cek koneksi internet', 'danger');
    return;
  }
  ensureScannerModal();
  scannerCallback = callback;
  document.getElementById('scannerModal').style.display = 'flex';

  scannerInstance = new Html5Qrcode('scannerReader');
  try {
    await scannerInstance.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 220 },
      (decodedText) => { onScanSuccess(decodedText); },
      () => { /* gagal baca per-frame itu normal, diabaikan saja */ }
    );
  } catch (err) {
    showToast('Tidak bisa mengakses kamera — pastikan izin kamera diberikan dan situs diakses lewat HTTPS', 'danger');
    closeScannerModal();
  }
}

async function onScanSuccess(decodedText) {
  const cb = scannerCallback;
  await closeScannerModal();
  if (cb) cb(decodedText);
}

async function closeScannerModal() {
  if (scannerInstance) {
    try { await scannerInstance.stop(); } catch (e) { /* sudah berhenti, aman diabaikan */ }
    try { scannerInstance.clear(); } catch (e) { /* aman diabaikan */ }
    scannerInstance = null;
  }
  const modal = document.getElementById('scannerModal');
  if (modal) modal.style.display = 'none';
}
