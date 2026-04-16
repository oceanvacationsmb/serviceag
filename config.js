window.OV_CONFIG = {
  supabaseUrl: 'https://mevslbwcmxflofqyyeek.supabase.co',
  supabaseAnonKey: 'sb_publishable_N-QXQGjsJZgN_hVGnV_FEA_KIWEBPPg',
  requesterNameAddress: 'OCEAN VACATIONS INC.',
  ownerPageBaseUrl: 'https://oceanvacationsmb.github.io/serviceag/ovagreement.html'
};

window.getSupabaseClient = function () {
  return window.supabase.createClient(
    window.OV_CONFIG.supabaseUrl,
    window.OV_CONFIG.supabaseAnonKey
  );
};
