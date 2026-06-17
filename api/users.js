const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Konfigurasi server belum lengkap (env var belum diset di Vercel)' });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Verifikasi pemanggil benar-benar sudah login dan role-nya owner.
  // Tanpa ini, siapa pun yang tahu URL endpoint ini bisa bikin akun sesukanya.
  const accessToken = (req.headers.authorization || '').replace('Bearer ', '');
  if (!accessToken) {
    return res.status(401).json({ error: 'Tidak ada sesi login' });
  }

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(accessToken);
  if (callerError || !callerData?.user) {
    return res.status(401).json({ error: 'Sesi tidak valid, silakan login ulang' });
  }

  const { data: callerProfile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', callerData.user.id)
    .single();

  if (callerProfile?.role !== 'owner') {
    return res.status(403).json({ error: 'Hanya Owner yang bisa mengakses ini' });
  }

  if (req.method === 'GET') {
    const { data: authList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) return res.status(500).json({ error: listError.message });

    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, role, nama');
    const merged = authList.users.map(u => {
      const p = profiles?.find(p => p.id === u.id);
      return {
        id: u.id,
        email: u.email,
        role: p?.role || 'kasir',
        nama: p?.nama || '',
        created_at: u.created_at
      };
    });
    return res.status(200).json({ users: merged });
  }

  if (req.method === 'POST') {
    const { email, password, role, nama } = req.body || {};

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, password, dan role wajib diisi' });
    }
    if (!['owner', 'kasir'].includes(role)) {
      return res.status(400).json({ error: 'Role tidak valid' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter' });
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (createError) {
      return res.status(400).json({ error: createError.message });
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ role, nama: nama || null })
      .eq('id', newUser.user.id);

    if (updateError) {
      return res.status(500).json({ error: 'User dibuat tapi gagal set role: ' + updateError.message });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
