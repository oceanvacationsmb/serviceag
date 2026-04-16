const adminClient = getSupabaseClient();

const loginCard = document.getElementById('loginCard');
const adminApp = document.getElementById('adminApp');
const loginForm = document.getElementById('loginForm');
const loginStatus = document.getElementById('loginStatus');
const recordsList = document.getElementById('recordsList');
const adminForm = document.getElementById('adminForm');
const adminStatus = document.getElementById('adminStatus');
const refreshBtn = document.getElementById('refreshBtn');
const signOutBtn = document.getElementById('signOutBtn');
const saveBtn = document.getElementById('saveBtn');
const downloadBtn = document.getElementById('downloadBtn');
const previewWrap = document.getElementById('recordPreviewWrap');

let selectedRecord = null;

async function ensureSession() {
  const { data } = await adminClient.auth.getSession();
  if (data.session) {
    showAdmin();
    await loadRecords();
  }
}

function showAdmin() {
  loginCard.classList.add('hidden');
  adminApp.classList.remove('hidden');
}

function showLogin() {
  adminApp.classList.add('hidden');
  loginCard.classList.remove('hidden');
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginStatus.textContent = 'Signing in...';

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  const { error } = await adminClient.auth.signInWithPassword({ email, password });
  if (error) {
    loginStatus.textContent = error.message;
    return;
  }

  loginStatus.textContent = '';
  showAdmin();
  await loadRecords();
});

signOutBtn.addEventListener('click', async () => {
  await adminClient.auth.signOut();
  showLogin();
});

refreshBtn.addEventListener('click', loadRecords);
saveBtn.addEventListener('click', saveAdminFields);
downloadBtn.addEventListener('click', downloadPdf);

async function loadRecords() {
  adminStatus.textContent = '';
  recordsList.innerHTML = 'Loading...';

  const { data, error } = await adminClient
    .from('agreements')
    .select('id, owner_name, owner_email, property_address, property_city, property_state, property_zip, status, owner_payload, admin_payload, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    recordsList.textContent = error.message;
    return;
  }

  if (!data.length) {
    recordsList.textContent = 'No saved agreements yet.';
    return;
  }

  recordsList.innerHTML = '';
  data.forEach(row => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'record-item';
    btn.innerHTML = `
      <strong>${escapeHtml(row.owner_name || 'Unnamed owner')}</strong>
      <small>${escapeHtml(row.property_address || '')}</small>
      <small>${escapeHtml([row.property_city, row.property_state, row.property_zip].filter(Boolean).join(', '))}</small>
      <small>Status: ${escapeHtml(row.status || 'submitted')}</small>
    `;
    btn.addEventListener('click', () => selectRecord(row, btn));
    recordsList.appendChild(btn);
  });
}

function selectRecord(row, btnEl) {
  [...recordsList.querySelectorAll('.record-item')].forEach(el => el.classList.remove('active'));
  btnEl.classList.add('active');
  selectedRecord = row;

  const p = row.owner_payload || {};
  const a = row.admin_payload || {};

  document.getElementById('recordId').value = row.id;
  document.getElementById('admin_owner_name').value = p.owner_name || row.owner_name || '';
  document.getElementById('admin_owner_email').value = p.owner_email || row.owner_email || '';
  document.getElementById('admin_property_address').value = p.property_address || row.property_address || '';
  document.getElementById('admin_property_city').value = p.property_city || row.property_city || '';
  document.getElementById('admin_property_state').value = p.property_state || row.property_state || '';
  document.getElementById('admin_property_zip').value = p.property_zip || row.property_zip || '';
  document.getElementById('admin_effective_date').value = p.effective_date || '';
  document.getElementById('pmc_percent').value = a.pmc_percent || '';
  document.getElementById('owner_cleaning_fee').value = a.owner_cleaning_fee || '';
  document.getElementById('internal_notes').value = a.internal_notes || '';

  adminForm.classList.remove('hidden');
  previewWrap.classList.remove('hidden');
}

async function saveAdminFields() {
  if (!selectedRecord) {
    adminStatus.textContent = 'Choose a saved agreement first.';
    return;
  }

  adminStatus.textContent = 'Saving...';

  const payload = {
    pmc_percent: document.getElementById('pmc_percent').value,
    owner_cleaning_fee: document.getElementById('owner_cleaning_fee').value,
    internal_notes: document.getElementById('internal_notes').value
  };

  const { error } = await adminClient
    .from('agreements')
    .update({
      admin_payload: payload,
      status: 'reviewed'
    })
    .eq('id', selectedRecord.id);

  if (error) {
    adminStatus.textContent = error.message;
    return;
  }

  selectedRecord.admin_payload = payload;
  selectedRecord.status = 'reviewed';
  adminStatus.textContent = 'Saved.';
  await loadRecords();
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[s]);
}

function normalizeDateForPdf(v) {
  if (!v) return '';
  const d = new Date(v + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return v;
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

function monthDayYearParts(v) {
  if (!v) return { month: '', day: '', year: '' };
  const d = new Date(v + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return { month: '', day: '', year: '' };
  return {
    month: d.toLocaleString('en-US', { month: 'long' }),
    day: String(d.getDate()),
    year: String(d.getFullYear())
  };
}

async function fetchTemplatePdf() {
  const res = await fetch('agreement-template.pdf');
  if (!res.ok) throw new Error('Could not load agreement-template.pdf');
  return res.arrayBuffer();
}

function serviceSummary(services) {
  const lines = [];
  if (services?.pool) lines.push('Pool Cleaning');
  if (services?.pest) lines.push('Pest Control per unit');
  if (services?.landscaping) lines.push('Basic Landscaping');
  if (services?.notes) lines.push(services.notes);
  return lines.join('; ');
}

function drawText(page, text, x, y, options = {}) {
  const { font, size = 10 } = options;
  if (!text) return;
  page.drawText(String(text), { x, y, size, font });
}

function drawFitText(page, text, x, y, maxWidth, options = {}) {
  const { font, size = 10 } = options;
  if (!text) return;
  let current = String(text);
  let fontSize = size;

  while (font.widthOfTextAtSize(current, fontSize) > maxWidth && fontSize > 7) {
    fontSize -= 0.5;
  }

  page.drawText(current, { x, y, size: fontSize, font });
}

async function drawW9(pdfDoc, page, data, font) {
  const w9 = data.w9 || {};
  const requester = data.requester_name_address || window.OV_CONFIG.requesterNameAddress;

  drawFitText(page, w9.name, 152, 604, 325, { font, size: 13 });
  drawFitText(page, w9.business_name, 152, 580, 325, { font, size: 12 });

  const checks = {
    individual: [190, 547],
    c_corp: [274, 547],
    s_corp: [335, 547],
    partnership: [392, 547],
    trust_estate: [455, 547],
    llc_c: [193, 530],
    llc_s: [193, 530],
    llc_p: [193, 530],
    other: [193, 494]
  };

  const box = checks[w9.classification];
  if (box) drawText(page, 'X', box[0], box[1], { font, size: 12 });

  if (w9.classification?.startsWith('llc_')) {
    const taxLetter = w9.classification === 'llc_c' ? 'C' : w9.classification === 'llc_s' ? 'S' : 'P';
    drawText(page, taxLetter, 365, 530, { font, size: 11 });
  }

  drawFitText(page, w9.exemptions, 488, 532, 90, { font, size: 9 });
  drawFitText(page, w9.address, 152, 474, 320, { font, size: 12 });
  drawFitText(page, requester, 492, 474, 94, { font, size: 8.8 });
  drawFitText(page, `${w9.city}, ${w9.state} ${w9.zip}`, 152, 449, 320, { font, size: 12 });

  const raw = String(w9.tax_id || '').replace(/\D/g, '');
  const taxType = w9.tax_id_type || '';

  if (taxType === 'SSN') {
    const ssnBoxes = [453, 473, 493, 527, 547, 581, 601, 621, 641];
    raw.slice(0, 9).split('').forEach((ch, i) => drawText(page, ch, ssnBoxes[i], 392, { font, size: 18 }));
  } else if (taxType === 'EIN') {
    const einBoxes = [451, 489, 509, 529, 549, 569, 589, 609, 629];
    raw.slice(0, 9).split('').forEach((ch, i) => drawText(page, ch, einBoxes[i], 355, { font, size: 18 }));
  }

  if (w9.signature_data_url && w9.signature_data_url.startsWith('data:image/png')) {
    const png = await pdfDoc.embedPng(w9.signature_data_url);
    page.drawImage(png, { x: 165, y: 144, width: 160, height: 42 });
  }

  drawText(page, normalizeDateForPdf(w9.signature_date), 460, 148, { font, size: 11 });
}

async function downloadPdf() {
  if (!selectedRecord) {
    adminStatus.textContent = 'Choose a saved agreement first.';
    return;
  }

  const p = selectedRecord.owner_payload || {};
  const a = {
    pmc_percent: document.getElementById('pmc_percent').value,
    owner_cleaning_fee: document.getElementById('owner_cleaning_fee').value,
    internal_notes: document.getElementById('internal_notes').value
  };

  if (!a.pmc_percent || !a.owner_cleaning_fee) {
    adminStatus.textContent = 'Add PMC and owner-use cleaning fee first.';
    return;
  }

  adminStatus.textContent = 'Building PDF...';

  try {
    const pdfBytes = await fetchTemplatePdf();
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    const page1 = pages[0];
    drawFitText(page1, p.property_address, 188, 686, 300, { font, size: 11.5 });
    drawFitText(page1, p.owner_name, 101, 655, 170, { font, size: 11.5 });
    drawFitText(page1, normalizeDateForPdf(p.effective_date), 214, 610, 175, { font, size: 11.5 });
    drawFitText(page1, a.pmc_percent, 438, 440, 45, { font, size: 11.5 });

    const page4 = pages[3];
    drawFitText(page4, a.owner_cleaning_fee, 425, 535, 120, { font, size: 11.5 });
    drawFitText(page4, serviceSummary(p.conditional_services), 345, 440, 220, { font, size: 9.5 });
    const sigParts = monthDayYearParts(p.effective_date);
    drawFitText(page4, sigParts.day, 420, 292, 28, { font, size: 11 });
    drawFitText(page4, sigParts.month, 468, 292, 65, { font, size: 11 });
    drawFitText(page4, sigParts.year, 545, 292, 36, { font, size: 11 });
    drawFitText(page4, p.owner_name, 118, 268, 160, { font, size: 11.5 });

    const page5 = pages[4];
    drawFitText(page5, p.owner_name, 103, 700, 210, { font, size: 12 });
    drawFitText(page5, p.bank_name, 160, 645, 210, { font, size: 11.5 });
    drawFitText(page5, p.routing_number, 151, 622, 125, { font, size: 11.5 });
    drawFitText(page5, p.account_number, 382, 622, 140, { font, size: 11.5 });
    drawFitText(page5, p.ach_amount, 245, 599, 190, { font, size: 11.5 });
    drawFitText(page5, p.ach_frequency, 136, 576, 100, { font, size: 11.5 });
    drawFitText(page5, normalizeDateForPdf(p.ach_start_date), 356, 576, 100, { font, size: 11.5 });
    drawFitText(page5, p.owner_name, 134, 434, 180, { font, size: 11.5 });
    drawFitText(page5, normalizeDateForPdf(p.effective_date), 136, 411, 140, { font, size: 11.5 });

    const page6 = pages[5];
    await drawW9(pdfDoc, page6, p, font);

    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'agreement.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    await adminClient
      .from('agreements')
      .update({ admin_payload: a, status: 'ready_for_signature' })
      .eq('id', selectedRecord.id);

    adminStatus.textContent = 'Downloaded.';
  } catch (err) {
    console.error(err);
    adminStatus.textContent = err.message || 'Could not build the PDF.';
  }
}

ensureSession();
