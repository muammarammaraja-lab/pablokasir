// Ganti dua nilai di bawah dengan punya project Supabase kamu sendiri
// (Project Settings > API di dashboard Supabase)
const SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
