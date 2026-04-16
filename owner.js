const ownerClient = getSupabaseClient();

const form = document.getElementById('ownerForm');
const statusEl = document.getElementById('status');
const clearBtn = document.getElementById('clearSignature');
const classificationEl = document.getElementById('w9_classification');
const taxIdTypeEl = document.getElementById('w9_tax_id_type');
const taxIdLabel = document.getElementById('taxIdLabel');
const sigCanvas = document.getElementById('signaturePad');
const ctx = sigCanvas.getContext('2d');

function resizeSignatureCanvas() {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = sigCanvas.getBoundingClientRect();
  const displayWidth = Math.max(300, Math.floor(rect.width || 700));
  const displayHeight = 190;

  sigCanvas.width = Math.floor(displayWidth * ratio);
  sigCanvas.height = Math.floor(displayHeight * ratio);

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.2;
}

function setupSignaturePad() {
  resizeSignatureCanvas();

  let drawing = false;
  let lastX = 0;
  let lastY = 0;

  function getPos(e) {
    const r = sigCanvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return {
      x: point.clientX - r.left,
      y: point.clientY - r.top
    };
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

  sigCanvas.addEventListener('mousedown', start);
  sigCanvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);

  sigCanvas.addEventListener('touchstart', start, { passive: false });
  sigCanvas.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('touchend', end, { passive: false });

  clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
  });

  window.addEventListener('resize', () => {
    const imageData = sigCanvas.toDataURL('image/png');
    resizeSignatureCanvas();
    if (imageData && imageData !== 'data:,') {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, sigCanvas.width / (window.devicePixelRatio || 1), 190);
      };
      img.src = imageData;
    }
  });
}

function updateTaxIdLabel() {
  const classification = classificationEl.value;
  const taxType = taxIdTypeEl.value;
  const input = document.getElementById('w9_tax_id');

  if (taxType === 'SSN') {
    taxIdLabel.firstChild.textContent = 'SSN';
    input.placeholder = 'Social Security Number';
  } else if (taxType === 'EIN') {
    taxIdLabel.firstChild.textContent = 'EIN';
    input.placeholder = 'Employer Identification Number';
  } else if (classification === 'individual') {
    taxIdLabel.firstChild.textContent = 'SSN';
    input.placeholder = 'Social Security Number';
  } else {
    taxIdLabel.firstChild.textContent = 'Tax ID';
    input.placeholder = 'SSN or EIN';
  }
}

function collectFormData(formEl) {
  const fd = new FormData(formEl);

  return {
    owner_name: fd.get('owner_name')?.trim() || '',
    owner_email: fd.get('owner_email')?.trim() || '',
    owner_phone: fd.get('owner_phone')?.trim() || '',
    property_address: fd.get('property_address')?.trim() || '',
    property_city: fd.get('property_city')?.trim() || '',
    property_state: fd.get('property_state')?.trim() || 'SC',
    property_zip: fd.get('property_zip')?.trim() || '',
    effective_date: fd.get('effective_date') || '',

    bank_name: fd.get('bank_name')?.trim() || '',
    routing_number: fd.get('routing_number')?.trim() || '',
    account_number: fd.get('account_number')?.trim() || '',
    ach_amount: fd.get('ach_amount')?.trim() || '1000-10000',
    ach_frequency: fd.get('ach_frequency')?.trim() || 'MONTHLY',
    ach_start_date: fd.get('ach_start_date') || '',

    conditional_services: {
      pool: fd.get('service_pool') === 'on',
      pest: fd.get('service_pest') === 'on',
      landscaping: fd.get('service_landscaping') === 'on',
      notes: fd.get('conditional_notes')?.trim() || ''
    },

    w9: {
      name: fd.get('w9_name')?.trim() || '',
      business_name: fd.get('w9_business_name')?.trim() || '',
      classification: fd.get('w9_classification')?.trim() || '',
      exemptions: fd.get('w9_exemptions')?.trim() || '',
      address: fd.get('w9_address')?.trim() || '',
      city: fd.get('w9_city')?.trim() || '',
      state: fd.get('w9_state')?.trim() || 'SC',
      zip: fd.get('w9_zip')?.trim() || '',
      tax_id_type: fd.get('w9_tax_id_type')?.trim() || '',
      tax_id: fd.get('w9_tax_id')?.trim() || '',
      signature_date: fd.get('w9_signature_date') || '',
      signature_data_url: sigCanvas.toDataURL('image/png')
    },

    requester_name_address: window.OV_CONFIG.requesterNameAddress
  };
}

async function submitOwnerForm(e) {
  e.preventDefault();
  statusEl.textContent = 'Sending...';

  try {
    const payload = collectFormData(form);

    const { error } = await ownerClient
      .from('agreements')
      .insert({
        owner_name: payload.owner_name,
        owner_email: payload.owner_email,
        property_address: payload.property_address,
        property_city: payload.property_city,
        property_state: payload.property_state,
        property_zip: payload.property_zip,
        status: 'submitted',
        owner_payload: payload
      });

    if (error) throw error;

    form.reset();
    document.getElementById('property_state').value = 'SC';
    document.getElementById('w9_state').value = 'SC';
    document.getElementById('ach_amount').value = '1000-10000';
    document.getElementById('ach_frequency').value = 'MONTHLY';
    ctx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    updateTaxIdLabel();

    statusEl.textContent = 'Sent. Thank you.';
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message || 'Could not send the form.';
  }
}

classificationEl.addEventListener('change', updateTaxIdLabel);
taxIdTypeEl.addEventListener('change', updateTaxIdLabel);
form.addEventListener('submit', submitOwnerForm);

setupSignaturePad();
updateTaxIdLabel();
