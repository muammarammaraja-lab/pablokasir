async function loadCurrentLogo() {
  const { data } = await sb.from('app_settings').select('logo_url').eq('id', 1).single();
  const preview = document.getElementById('currentLogoPreview');
  if (data?.logo_url) {
    preview.innerHTML = `
      <p style="font-size:13px;color:var(--brown-500);margin-bottom:6px;">Logo saat ini:</p>
      <img src="${data.logo_url}" alt="Logo saat ini" style="width:64px;height:64px;border-radius:8px;object-fit:cover;border:1px solid var(--border);">
    `;
  } else {
    preview.innerHTML = '<p style="font-size:13px;color:var(--brown-500);">Belum ada logo custom, masih pakai ikon tetesan default.</p>';
  }
}

async function uploadLogo() {
  const fileInput = document.getElementById('logoFile');
  if (!fileInput.files.length) { showToast('Pilih file logo dulu', 'danger'); return; }

  const file = fileInput.files[0];
  if (file.size > 1024 * 1024) { showToast('Ukuran file maksimal 1MB', 'danger'); return; }

  const ext = file.name.split('.').pop();
  const path = `logo.${ext}`;

  const { error: uploadError } = await sb.storage.from('branding').upload(path, file, { upsert: true });
  if (uploadError) { showToast('Gagal upload: ' + uploadError.message, 'danger'); return; }

  const { data: urlData } = sb.storage.from('branding').getPublicUrl(path);
  const logoUrl = urlData.publicUrl + '?t=' + Date.now(); // cache-bust supaya logo baru langsung kepakai

  const { error: updateError } = await sb.from('app_settings').update({ logo_url: logoUrl, updated_at: new Date().toISOString() }).eq('id', 1);
  if (updateError) { showToast('Gagal simpan setting: ' + updateError.message, 'danger'); return; }

  showToast('Logo berhasil diperbarui', 'success');
  fileInput.value = '';
  await loadCurrentLogo();
}

(async () => {
  const ok = await requireAuth(['owner']);
  if (!ok) return;
  await loadCurrentLogo();
})();
