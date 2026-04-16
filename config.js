window.OV_CONFIG = {
  supabaseUrl: 'https://mevslbwcmxflofqyyeek.supabase.co',
  supabaseAnonKey: 'PASTE_YOUR_PUBLISHABLE_KEY_HERE',
  requesterNameAddress: 'OCEAN VACATIONS INC.',
  ownerPageBaseUrl: 'https://oceanvacationsmb.github.io/serviceag/ovagreement.html'
};

window.getSupabaseClient = function () {
  return window.supabase.createClient(
    window.OV_CONFIG.supabaseUrl,
    window.OV_CONFIG.supabaseAnonKey
  );
};
