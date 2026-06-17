const { createClient } = require('@supabase/supabase-js');

// Urutan ini penting — tabel induk harus dipulihkan dulu sebelum tabel anak
// yang mereferensikannya (foreign key), supaya tidak gagal karena referensi belum ada.
const TABLE_ORDER = [
  'products', 'bahan_baku', 'suppliers', 'sales',
  'produksi', 'purchase_orders', 'resep', 'sale_items',
  'expenses', 'stok_log', 'retur'
];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Konfigurasi server belum lengkap (env var belum diset di Vercel)' });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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
    return res.status(403).json({ error: 'Hanya Owner yang bisa restore data' });
  }

  const backup = req.body;
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
    return res.status(400).json({ error: 'File backup tidak valid' });
  }

  const hasil = {};
  for (const table of TABLE_ORDER) {
    const rows = backup[table];
    if (!Array.isArray(rows) || rows.length === 0) { hasil[table] = 0; continue; }

    const { error } = await supabaseAdmin.from(table).upsert(rows, { onConflict: 'id' });
    if (error) {
      return res.status(500).json({
        error: `Gagal memulihkan tabel "${table}": ${error.message}`,
        hasilSebelumGagal: hasil
      });
    }
    hasil[table] = rows.length;
  }

  return res.status(200).json({ success: true, hasil });
};
