const adminClient = getSupabaseClient();

const newAgreementForm = document.getElementById('newAgreementForm');
const newAgreementStatus = document.getElementById('newAgreementStatus');
const clientLinkDisplay = document.getElementById('clientLinkDisplay');
const copyClientLinkBtn = document.getElementById('copyClientLinkBtn');
const emailClientBtn = document.getElementById('emailClientBtn');
const reviewNewAgreementBtn = document.getElementById('reviewNewAgreementBtn');

const recordsList = document.getElementById('recordsList');
const refreshBtn = document.getElementById('refreshBtn');
const adminForm = document.getElementById('adminForm');
const adminStatus = document.getElementById('adminStatus');
const saveBtn = document.getElementById('saveBtn');
const reviewLoadedAgreementBtn = document.getElementById('reviewLoadedAgreementBtn');
const deleteBtn = document.getElementById('deleteBtn');
const signDownloadBtn = document.getElementById('signDownloadBtn');

const pdfPreviewFrameLarge = document.getElementById('pdfPreviewFrameLarge');
const previewModal = document.getElementById('previewModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalBackdrop = document.getElementById('modalBackdrop');

const adminSignatureCanvas = document.getElementById('adminSignaturePad');
const adminSignatureCtx = adminSignatureCanvas.getContext('2d');

let selectedRecord = null;
let currentPreviewUrl = null;
let latestClientLink = '';
let lastCreatedDraft = null;

function ownerFormLinkForToken(token) {
  return `${window.OV_CONFIG.ownerPageBaseUrl}?token=${encodeURIComponent(token)}`;
}

function resizeCanvas(canvas, ctx) {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = canvas.getBoundingClientRect();
  const displayWidth = Math.max(300, Math.floor(rect.width || 700));
  const displayHeight = 190;
  canvas.width = Math.floor(displayWidth * ratio);
  canvas.height = Math.floor(displayHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.2;
}

function setupPad(canvas, ctx, clearBtnId) {
  resizeCanvas(canvas, ctx);

  let drawing = false;
  let lastX = 0;
  let lastY = 0;

  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - r.left, y: point.clientY - r.top };
  }

  function start(e) {
    e.preventDefault();
    const p = getPos(e);
    drawing = true;
    lastX = p.x;
    lastY = p.y;
  }

  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastX = p.x;
    lastY = p.y;
  }

  function end(e) {
    if (e) e.preventDefault();
    drawing = false;
  }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('touchend', end, { passive: false });

  document.getElementById(clearBtnId).addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
}

function clearPreview() {
  if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
  currentPreviewUrl = null;
  pdfPreviewFrameLarge.src = '';
}

function openModal() {
  previewModal.classList.remove('hidden');
}

function closeModal() {
  previewModal.classList.add('hidden');
}

closeModalBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

function calculateAchStartDate(value) {
  if (!value) return '';
  const d = new Date(value + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return '';
  const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 5);
  return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(nextMonth.getDate()).padStart(2, '0')}`;
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

refreshBtn.addEventListener('click', loadRecords);

newAgreementForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  newAgreementStatus.textContent = 'Creating...';

  const token = (window.crypto?.randomUUID?.() || `ov-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
  const clientEmail = document.getElementById('new_client_email').value.trim();
  const pmcPercent = document.getElementById('new_pmc_percent').value;
  const ownerCleaningFee = document.getElementById('new_owner_cleaning_fee').value;

  const servicePool = document.getElementById('new_service_pool').checked;
  const servicePest = document.getElementById('new_service_pest').checked;
  const serviceLandscaping = document.getElementById('new_service_landscaping').checked;
  const servicesNotes = document.getElementById('new_services_notes').value.trim();

  const ownerPayload = {
    client_email: clientEmail,
    owner_name: '',
    owner_email: clientEmail,
    owner_phone: '',
    property_address: '',
    property_city: '',
    property_state: 'SC',
    property_zip: '',
    effective_date: '',
    bank_name: '',
    routing_number: '',
    account_number: '',
    ach_amount: 'Suggested amount is $5000-$10000',
    ach_frequency: 'MONTHLY',
    ach_start_date: '',
    conditional_services: {
      pool: servicePool,
      pest: servicePest,
      landscaping: serviceLandscaping,
      notes: servicesNotes
    },
    owner_agreement_signature_data_url: '',
    w9: {
      name: '',
      business_name: '',
      classification: '',
      tax_id_type: '',
      tax_id: '',
      exemptions: '',
      address: '',
      city: '',
      state: 'SC',
      zip: '',
      signature_date: '',
      signature_data_url: ''
    },
    requester_name_address: window.OV_CONFIG.requesterNameAddress
  };

  const adminPayload = {
    pmc_percent: pmcPercent,
    owner_cleaning_fee: ownerCleaningFee,
    internal_notes: '',
    admin_signature_data_url: ''
  };

  const { error } = await adminClient.from('agreements').insert({
    agreement_token: token,
    client_email: clientEmail,
    owner_name: '',
    owner_email: clientEmail,
    property_address: '',
    property_city: '',
    property_state: 'SC',
    property_zip: '',
    status: 'pending_client',
    owner_payload: ownerPayload,
    admin_payload: adminPayload
  });

  if (error) {
    newAgreementStatus.textContent = error.message;
    return;
  }

  lastCreatedDraft = { owner_payload: ownerPayload, admin_payload: adminPayload };
  latestClientLink = ownerFormLinkForToken(token);
  clientLinkDisplay.value = latestClientLink;
  newAgreementStatus.textContent = 'Agreement created.';
  await loadRecords();
});

copyClientLinkBtn.addEventListener('click', async () => {
  const value = clientLinkDisplay.value || latestClientLink;
  if (!value) {
    newAgreementStatus.textContent = 'Create an agreement first.';
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    newAgreementStatus.textContent = 'Client link copied.';
  } catch {
    newAgreementStatus.textContent = value;
  }
});

emailClientBtn.addEventListener('click', () => {
  const value = clientLinkDisplay.value || latestClientLink;
  if (!value) {
    newAgreementStatus.textContent = 'Create an agreement first.';
    return;
  }
  const email = document.getElementById('new_client_email').value.trim();
  window.location.href =
    `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Ocean Vacations Service Agreement')}&body=${encodeURIComponent(`Please review and complete your service agreement using this secure link:\n\n${value}`)}`;
});

reviewNewAgreementBtn.addEventListener('click', async () => {
  const clientEmail = document.getElementById('new_client_email').value.trim();
  const pmcPercent = document.getElementById('new_pmc_percent').value;
  const ownerCleaningFee = document.getElementById('new_owner_cleaning_fee').value;

  if (!clientEmail || !pmcPercent || !ownerCleaningFee) {
    newAgreementStatus.textContent = 'Fill client email, PMC %, and cleaning fee first.';
    return;
  }

  const draft = {
    owner_payload: {
      client_email: clientEmail,
      owner_name: '',
      owner_email: clientEmail,
      owner_phone: '',
      property_address: '',
      property_city: '',
      property_state: 'SC',
      property_zip: '',
      effective_date: '',
      bank_name: '',
      routing_number: '',
      account_number: '',
      ach_amount: 'Suggested amount is $5000-$10000',
      ach_frequency: 'MONTHLY',
      ach_start_date: '',
      conditional_services: {
        pool: document.getElementById('new_service_pool').checked,
        pest: document.getElementById('new_service_pest').checked,
        landscaping: document.getElementById('new_service_landscaping').checked,
        notes: document.getElementById('new_services_notes').value.trim()
      },
      owner_agreement_signature_data_url: '',
      w9: {
        name: '',
        business_name: '',
        classification: '',
        tax_id_type: '',
        tax_id: '',
        exemptions: '',
        address: '',
        city: '',
        state: 'SC',
        zip: '',
        signature_date: '',
        signature_data_url: ''
      },
      requester_name_address: window.OV_CONFIG.requesterNameAddress
    },
    admin_payload: {
      pmc_percent: pmcPercent,
      owner_cleaning_fee: ownerCleaningFee,
      internal_notes: '',
      admin_signature_data_url: ''
    }
  };

  await reviewAgreementData(draft.owner_payload, draft.admin_payload, 'new');
});

async function loadRecords() {
  recordsList.innerHTML = 'Loading...';

  const { data, error } = await adminClient
    .from('agreements')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    recordsList.textContent = error.message;
    return;
  }

  if (!data.length) {
    recordsList.textContent = 'No agreements yet.';
    return;
  }

  recordsList.innerHTML = '';
  data.forEach(row => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'record-item';
    btn.innerHTML = `
      <strong>${escapeHtml(row.owner_name || 'Waiting for owner')}</strong>
      <small>${escapeHtml(row.client_email || '')}</small>
      <small>${escapeHtml(row.property_address || '')}</small>
      <small>Status: ${escapeHtml(row.status || '')}</small>
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
  const w9 = p.w9 || {};

  setValue('recordId', row.id);
  setValue('record_status', row.status || '');
  setValue('admin_client_email', row.client_email || p.client_email || '');
  setValue('admin_effective_date', p.effective_date || '');
  setValue('admin_owner_name', p.owner_name || row.owner_name || '');
  setValue('admin_owner_email', p.owner_email || row.owner_email || '');
  setValue('admin_owner_phone', p.owner_phone || '');
  setValue('admin_property_address', p.property_address || row.property_address || '');
  setValue('admin_property_city', p.property_city || row.property_city || '');
  setValue('admin_property_state', p.property_state || row.property_state || 'SC');
  setValue('admin_property_zip', p.property_zip || row.property_zip || '');

  setValue('admin_bank_name', p.bank_name || '');
  setValue('admin_routing_number', p.routing_number || '');
  setValue('admin_account_number', p.account_number || '');
  setValue('admin_ach_amount', p.ach_amount || '');
  setValue('admin_ach_frequency', p.ach_frequency || 'MONTHLY');
  setValue('admin_ach_start_date', p.ach_start_date || '');

  document.getElementById('admin_service_pool').checked = !!p.conditional_services?.pool;
  document.getElementById('admin_service_pest').checked = !!p.conditional_services?.pest;
  document.getElementById('admin_service_landscaping').checked = !!p.conditional_services?.landscaping;
  setValue('admin_services_notes', p.conditional_services?.notes || '');

  setValue('admin_w9_name', w9.name || '');
  setValue('admin_w9_business_name', w9.business_name || '');
  setValue('admin_w9_classification', w9.classification || '');
  setValue('admin_w9_tax_id_type', w9.tax_id_type || '');
  setValue('admin_w9_tax_id', w9.tax_id || '');
  setValue('admin_w9_city', w9.city || '');
  setValue('admin_w9_state', w9.state || '');
  setValue('admin_w9_zip', w9.zip || '');
  setValue('admin_w9_address', w9.address || '');
  setValue('admin_w9_exemptions', w9.exemptions || '');
  setValue('admin_w9_signature_date', w9.signature_date || '');

  setValue('pmc_percent', a.pmc_percent || '');
  setValue('owner_cleaning_fee', a.owner_cleaning_fee || '');
  setValue('internal_notes', a.internal_notes || '');

  adminSignatureCtx.clearRect(0, 0, adminSignatureCanvas.width, adminSignatureCanvas.height);

  adminForm.classList.remove('hidden');

  latestClientLink = ownerFormLinkForToken(row.agreement_token);
  clientLinkDisplay.value = latestClientLink;
}

function getAgreementPayloadFromForm() {
  return {
    client_email: document.getElementById('admin_client_email').value.trim(),
    effective_date: document.getElementById('admin_effective_date').value,
    owner_name: document.getElementById('admin_owner_name').value.trim(),
    owner_email: document.getElementById('admin_owner_email').value.trim(),
    owner_phone: document.getElementById('admin_owner_phone').value.trim(),
    property_address: document.getElementById('admin_property_address').value.trim(),
    property_city: document.getElementById('admin_property_city').value.trim(),
    property_state: document.getElementById('admin_property_state').value.trim(),
    property_zip: document.getElementById('admin_property_zip').value.trim(),
    bank_name: document.getElementById('admin_bank_name').value.trim(),
    routing_number: document.getElementById('admin_routing_number').value.trim(),
    account_number: document.getElementById('admin_account_number').value.trim(),
    ach_amount: document.getElementById('admin_ach_amount').value.trim(),
    ach_frequency: document.getElementById('admin_ach_frequency').value.trim() || 'MONTHLY',
    ach_start_date: document.getElementById('admin_ach_start_date').value,
    conditional_services: {
      pool: document.getElementById('admin_service_pool').checked,
      pest: document.getElementById('admin_service_pest').checked,
      landscaping: document.getElementById('admin_service_landscaping').checked,
      notes: document.getElementById('admin_services_notes').value.trim()
    },
    owner_agreement_signature_data_url: selectedRecord?.owner_payload?.owner_agreement_signature_data_url || '',
    w9: {
      name: document.getElementById('admin_w9_name').value.trim(),
      business_name: document.getElementById('admin_w9_business_name').value.trim(),
      classification: document.getElementById('admin_w9_classification').value.trim(),
      tax_id_type: document.getElementById('admin_w9_tax_id_type').value.trim(),
      tax_id: document.getElementById('admin_w9_tax_id').value.trim(),
      exemptions: document.getElementById('admin_w9_exemptions').value.trim(),
      address: document.getElementById('admin_w9_address').value.trim(),
      city: document.getElementById('admin_w9_city').value.trim(),
      state: document.getElementById('admin_w9_state').value.trim(),
      zip: document.getElementById('admin_w9_zip').value.trim(),
      signature_date: document.getElementById('admin_w9_signature_date').value,
      signature_data_url: selectedRecord?.owner_payload?.w9?.signature_data_url || ''
    },
    requester_name_address: window.OV_CONFIG.requesterNameAddress
  };
}

function getAdminPayloadFromForm() {
  return {
    pmc_percent: document.getElementById('pmc_percent').value,
    owner_cleaning_fee: document.getElementById('owner_cleaning_fee').value,
    internal_notes: document.getElementById('internal_notes').value,
    admin_signature_data_url: adminSignatureCanvas.toDataURL('image/png')
  };
}

saveBtn.addEventListener('click', saveAgreement);
reviewLoadedAgreementBtn.addEventListener('click', async () => {
  if (!selectedRecord) {
    adminStatus.textContent = 'Choose an agreement first.';
    return;
  }
  await reviewAgreementData(getAgreementPayloadFromForm(), getAdminPayloadFromForm(), 'loaded');
});
deleteBtn.addEventListener('click', deleteAgreement);
signDownloadBtn.addEventListener('click', signAndDownloadPdf);

async function saveAgreement() {
  if (!selectedRecord) {
    adminStatus.textContent = 'Choose an agreement first.';
    return;
  }

  adminStatus.textContent = 'Saving...';

  const ownerPayload = getAgreementPayloadFromForm();
  if (!ownerPayload.ach_start_date && ownerPayload.effective_date) {
    ownerPayload.ach_start_date = calculateAchStartDate(ownerPayload.effective_date);
  }

  const adminPayload = getAdminPayloadFromForm();

  const { error } = await adminClient.from('agreements').update({
    client_email: ownerPayload.client_email,
    owner_name: ownerPayload.owner_name,
    owner_email: ownerPayload.owner_email,
    property_address: ownerPayload.property_address,
    property_city: ownerPayload.property_city,
    property_state: ownerPayload.property_state,
    property_zip: ownerPayload.property_zip,
    owner_payload: ownerPayload,
    admin_payload: adminPayload
  }).eq('id', selectedRecord.id);

  if (error) {
    adminStatus.textContent = error.message;
    return;
  }

  selectedRecord.owner_payload = ownerPayload;
  selectedRecord.admin_payload = adminPayload;
  selectedRecord.client_email = ownerPayload.client_email;
  selectedRecord.owner_name = ownerPayload.owner_name;
  selectedRecord.owner_email = ownerPayload.owner_email;

  adminStatus.textContent = 'Saved.';
  await loadRecords();
}

async function deleteAgreement() {
  if (!selectedRecord) {
    adminStatus.textContent = 'Choose an agreement first.';
    return;
  }

  if (!window.confirm(`Delete agreement for ${selectedRecord.owner_name || 'this owner'}?`)) return;

  const { error } = await adminClient.from('agreements').delete().eq('id', selectedRecord.id);

  if (error) {
    adminStatus.textContent = error.message;
    return;
  }

  selectedRecord = null;
  adminForm.classList.add('hidden');
  clearPreview();
  adminStatus.textContent = 'Agreement deleted.';
  await loadRecords();
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

function serviceSummaryForPdf(services) {
  const lines = [];
  if (services?.pool) lines.push('Pool Cleaning');
  if (services?.pest) lines.push('Pest Control per unit');
  if (services?.landscaping) lines.push('Basic Landscaping');
  if (services?.notes) lines.push(services.notes);
  return lines.join('; ');
}

async function drawW9(pdfDoc, page, data, font) {
  const w9 = data.w9 || {};
  const requester = data.requester_name_address || window.OV_CONFIG.requesterNameAddress;

  drawFitText(page, w9.name, 92, 609, 300, { font, size: 11 });
  drawFitText(page, w9.business_name, 92, 582, 300, { font, size: 10.5 });

  const checks = {
    individual: [95, 548],
    c_corp: [166, 548],
    s_corp: [222, 548],
    partnership: [281, 548],
    trust_estate: [344, 548],
    llc_c: [95, 531],
    llc_s: [95, 531],
    llc_p: [95, 531],
    other: [95, 497]
  };

  const box = checks[w9.classification];
  if (box) drawText(page, 'X', box[0], box[1], { font, size: 11 });

  if (w9.classification?.startsWith('llc_')) {
    const taxLetter =
      w9.classification === 'llc_c' ? 'C' :
      w9.classification === 'llc_s' ? 'S' : 'P';
    drawText(page, taxLetter, 252, 531, { font, size: 10 });
  }

  drawFitText(page, w9.exemptions, 455, 532, 90, { font, size: 8.5 });
  drawFitText(page, w9.address, 92, 478, 285, { font, size: 10.5 });
  drawFitText(page, requester, 430, 478, 120, { font, size: 7.8 });
  drawFitText(page, `${w9.city}, ${w9.state} ${w9.zip}`, 92, 451, 285, { font, size: 10.5 });

  const raw = String(w9.tax_id || '').replace(/\D/g, '');
  const taxType = w9.tax_id_type || '';

  if (taxType === 'SSN') {
    [406, 426, 446, 479, 499, 532, 552, 572, 592].forEach((x, i) => {
      if (raw[i]) drawText(page, raw[i], x, 392, { font, size: 16 });
    });
  } else if (taxType === 'EIN') {
    [406, 439, 459, 479, 499, 519, 539, 559, 579].forEach((x, i) => {
      if (raw[i]) drawText(page, raw[i], x, 356, { font, size: 16 });
    });
  }

  if (w9.signature_data_url && w9.signature_data_url.startsWith('data:image/png')) {
    const png = await pdfDoc.embedPng(w9.signature_data_url);
    page.drawImage(png, { x: 82, y: 83, width: 120, height: 32 });
  }

  drawText(page, normalizeDateForPdf(w9.signature_date), 456, 86, { font, size: 10.5 });
}

async function buildPdfBytes(ownerPayload, adminPayload) {
  const p = ownerPayload;
  const a = adminPayload;

  const pdfDoc = await PDFLib.PDFDocument.load(await fetchTemplatePdf());
  const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  const page1 = pages[0];
  drawFitText(page1, p.property_address, 188, 686, 300, { font, size: 11.5 });
  drawFitText(page1, p.owner_name, 101, 655, 170, { font, size: 11.5 });
  drawFitText(page1, normalizeDateForPdf(p.effective_date), 214, 610, 175, { font, size: 11.5 });
  drawFitText(page1, a.pmc_percent || '', 438, 440, 45, { font, size: 11.5 });

  const page4 = pages[3];
  drawFitText(page4, a.owner_cleaning_fee || '', 425, 535, 120, { font, size: 11.5 });
  drawFitText(page4, serviceSummaryForPdf(p.conditional_services), 345, 440, 220, { font, size: 9.5 });

  const parts = monthDayYearParts(p.effective_date);
  drawFitText(page4, parts.day, 420, 292, 28, { font, size: 11 });
  drawFitText(page4, parts.month, 468, 292, 65, { font, size: 11 });
  drawFitText(page4, parts.year, 545, 292, 36, { font, size: 11 });

  if (p.owner_agreement_signature_data_url && p.owner_agreement_signature_data_url.startsWith('data:image/png')) {
    const ownerPng = await pdfDoc.embedPng(p.owner_agreement_signature_data_url);
    page4.drawImage(ownerPng, { x: 110, y: 252, width: 120, height: 32 });
  }

  if (a.admin_signature_data_url && a.admin_signature_data_url.startsWith('data:image/png')) {
    const adminPng = await pdfDoc.embedPng(a.admin_signature_data_url);
    page4.drawImage(adminPng, { x: 365, y: 252, width: 140, height: 32 });
  }

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

  await drawW9(pdfDoc, pages[5], p, font);

  return await pdfDoc.save();
}

async function reviewAgreementData(ownerPayload, adminPayload, target) {
  try {
    if (!ownerPayload.ach_start_date && ownerPayload.effective_date) {
      ownerPayload.ach_start_date = calculateAchStartDate(ownerPayload.effective_date);
    }

    const blob = new Blob([await buildPdfBytes(ownerPayload, adminPayload)], { type: 'application/pdf' });
    clearPreview();
    currentPreviewUrl = URL.createObjectURL(blob);
    pdfPreviewFrameLarge.src = currentPreviewUrl;
    openModal();

    if (target === 'new') {
      newAgreementStatus.textContent = 'Review loaded.';
    } else {
      adminStatus.textContent = 'Review loaded.';
    }
  } catch (err) {
    if (target === 'new') {
      newAgreementStatus.textContent = err.message || 'Could not load review.';
    } else {
      adminStatus.textContent = err.message || 'Could not load review.';
    }
  }
}

async function signAndDownloadPdf() {
  if (!selectedRecord) {
    adminStatus.textContent = 'Choose an agreement first.';
    return;
  }

  if (selectedRecord.status !== 'signed_by_owner' && selectedRecord.status !== 'completed') {
    adminStatus.textContent = 'Wait until the client signs first.';
    return;
  }

  const adminPayload = getAdminPayloadFromForm();
  if (!adminPayload.admin_signature_data_url || adminPayload.admin_signature_data_url === 'data:,') {
    adminStatus.textContent = 'Add your signature first.';
    return;
  }

  const ownerPayload = getAgreementPayloadFromForm();

  const update = await adminClient.from('agreements').update({
    client_email: ownerPayload.client_email,
    owner_name: ownerPayload.owner_name,
    owner_email: ownerPayload.owner_email,
    property_address: ownerPayload.property_address,
    property_city: ownerPayload.property_city,
    property_state: ownerPayload.property_state,
    property_zip: ownerPayload.property_zip,
    owner_payload: ownerPayload,
    admin_payload: adminPayload,
    status: 'completed',
    signed_by_admin_at: new Date().toISOString()
  }).eq('id', selectedRecord.id);

  if (update.error) {
    adminStatus.textContent = update.error.message;
    return;
  }

  selectedRecord.status = 'completed';
  selectedRecord.owner_payload = ownerPayload;
  selectedRecord.admin_payload = adminPayload;

  try {
    const blob = new Blob([await buildPdfBytes(ownerPayload, adminPayload)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'agreement.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    await loadRecords();
    setValue('record_status', 'completed');
    adminStatus.textContent = 'Signed and downloaded.';
  } catch (err) {
    adminStatus.textContent = err.message || 'Could not build final PDF.';
  }
}

setupPad(adminSignatureCanvas, adminSignatureCtx, 'clearAdminSignature');
loadRecords();
