window.OV_CONFIG = {
  supabaseUrl: 'PASTE_YOUR_SUPABASE_URL_HERE',
  supabaseAnonKey: 'PASTE_YOUR_SUPABASE_ANON_KEY_HERE',
  requesterNameAddress: 'OCEAN VACATIONS INC.'
};

window.getSupabaseClient = function () {
  if (!window.OV_CONFIG.supabaseUrl || window.OV_CONFIG.supabaseUrl.includes('PASTE_')) {
    throw new Error('Update config.js with your Supabase URL and anon key first.');
  }
  return window.supabase.createClient(
    window.OV_CONFIG.supabaseUrl,
    window.OV_CONFIG.supabaseAnonKey
  );
};
