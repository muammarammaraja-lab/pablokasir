let currentUser = null;
let currentRole = null;

/**
 * Panggil di awal setiap halaman yang butuh login.
 * allowedRoles: peran yang boleh mengakses halaman ini, misal ['owner'] atau ['owner','kasir'].
 * Return true kalau boleh lanjut render halaman, false kalau sudah di-redirect.
 */
async function requireAuth(allowedRoles) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return false;
  }
  currentUser = session.user;

  const { data: profile, error } = await sb
    .from('profiles')
    .select('role, nama')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    // Profil tidak ditemukan/gagal diambil — demi keamanan, paksa logout daripada lanjut tanpa role jelas.
    await sb.auth.signOut();
    window.location.href = 'login.html';
    return false;
  }
  currentRole = profile.role;

  if (!allowedRoles.includes(currentRole)) {
    window.location.href = 'index.html';
    return false;
  }

  applyRoleUI();
  return true;
}

function applyRoleUI() {
  if (currentRole === 'owner') {
    document.querySelectorAll('.owner-only').forEach(el => el.classList.remove('owner-only'));
  }
}

async function logout() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}
