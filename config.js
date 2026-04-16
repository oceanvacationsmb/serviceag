window.OV_CONFIG = {
  supabaseUrl: 'https://mevslbwcmxflofqyyeek.supabase.co',
  supabaseAnonKey: 'sb_publishable_N-QXQGjsJZgN_hVGnV_FEA_KIWEBPPg',
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
