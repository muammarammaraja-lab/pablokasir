async function getAccessToken() {
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token;
}

async function loadUsers() {
  const token = await getAccessToken();
  const res = await fetch('/api/users', { headers: { Authorization: 'Bearer ' + token } });
  const json = await res.json();

  if (!res.ok) { showToast('Gagal memuat user: ' + json.error, 'danger'); return; }

  document.getElementById('userTableBody').innerHTML = json.users.length ? json.users.map(u => `
    <tr>
      <td>${u.nama || '-'}</td>
      <td>${u.email}</td>
      <td><span class="badge ${u.role === 'owner' ? 'badge-ok' : 'badge-low'}">${u.role}</span></td>
      <td>${formatTanggal(u.created_at)}</td>
    </tr>
  `).join('') : '<tr class="muted-row"><td colspan="4">Belum ada user</td></tr>';
}

async function submitUser(e) {
  e.preventDefault();
  const nama = document.getElementById('userNama').value;
  const email = document.getElementById('userEmail').value;
  const password = document.getElementById('userPassword').value;
  const role = document.getElementById('userRole').value;

  if (password.length < 6) { showToast('Password minimal 6 karakter', 'danger'); return; }

  const token = await getAccessToken();
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ email, password, role, nama })
  });
  const json = await res.json();

  if (!res.ok) { showToast('Gagal membuat user: ' + json.error, 'danger'); return; }

  document.getElementById('userForm').reset();
  showToast('User berhasil dibuat', 'success');
  await loadUsers();
}

document.getElementById('userForm').addEventListener('submit', submitUser);

(async () => {
  const ok = await requireAuth(['owner']);
  if (!ok) return;
  await loadUsers();
})();
