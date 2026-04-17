// == Admin.js ==
// Main admin panel logic for agreements. Handles form, preview, save, fields placement in PDF.

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

// ... [All your functions from earlier: 
//    ownerFormLinkForToken, resizeCanvas, setupPad, clearPreview, openModal, closeModal, setValue, 
//    calculateAchStartDate, escapeHtml, refreshBtn.addEventListener, newAgreementForm.addEventListener, 
//    copyClientLinkBtn.addEventListener, emailClientBtn.addEventListener, reviewNewAgreementBtn.addEventListener,
//    loadRecords, selectRecord, getAgreementPayloadFromForm, getAdminPayloadFromForm,
//    saveBtn.addEventListener, reviewLoadedAgreementBtn.addEventListener, deleteBtn.addEventListener,
//    signDownloadBtn.addEventListener, saveAgreement, deleteAgreement, normalizeDateForPdf, monthDayYearParts,
//    fetchTemplatePdf, drawText, drawFitText, serviceSummaryForPdf, drawW9 ] ...

// ---- PDF Field Placement Accuracy (Major Fix) ----
async function buildPdfBytes(ownerPayload, adminPayload) {
  const p = ownerPayload;
  const a = adminPayload;

  const pdfDoc = await PDFLib.PDFDocument.load(await fetchTemplatePdf());
  const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  // -- PAGE 1: General Info --
  const page1 = pages[0];
  drawFitText(page1, p.property_address, 200, 665, 330, { font, size: 12 });
  drawFitText(page1, p.owner_name, 105, 638, 170, { font, size: 12 });
  drawFitText(page1, normalizeDateForPdf(p.effective_date), 225, 592, 120, { font, size: 12 });
  drawFitText(page1, a.pmc_percent || '', 445, 438, 45, { font, size: 12 }); // PMC %

  // -- PAGE 4: Cleaning Fee, Service Notes --
  const page4 = pages[3];
  drawFitText(page4, a.owner_cleaning_fee || '', 440, 537, 120, { font, size: 12 }); // Owner Cleaning Fee
  drawFitText(page4, serviceSummaryForPdf(p.conditional_services), 350, 445, 200, { font, size: 10 });

  const parts = monthDayYearParts(p.effective_date);
  drawFitText(page4, parts.day, 422, 293, 28, { font, size: 11 });
  drawFitText(page4, parts.month, 470, 293, 65, { font, size: 11 });
  drawFitText(page4, parts.year, 547, 293, 36, { font, size: 11 });

  if (p.owner_agreement_signature_data_url && p.owner_agreement_signature_data_url.startsWith('data:image/png')) {
    const ownerPng = await pdfDoc.embedPng(p.owner_agreement_signature_data_url);
    page4.drawImage(ownerPng, { x: 110, y: 252, width: 120, height: 32 });
  }
  if (a.admin_signature_data_url && a.admin_signature_data_url.startsWith('data:image/png')) {
    const adminPng = await pdfDoc.embedPng(a.admin_signature_data_url);
    page4.drawImage(adminPng, { x: 365, y: 252, width: 140, height: 32 });
  }

  // -- PAGE 5: Banking Info and More --
  const page5 = pages[4];
  drawFitText(page5, p.owner_name, 108, 705, 210, { font, size: 12 });
  drawFitText(page5, p.bank_name, 165, 650, 210, { font, size: 12 });
  drawFitText(page5, p.routing_number, 155, 628, 125, { font, size: 12 });
  drawFitText(page5, p.account_number, 386, 628, 140, { font, size: 12 });
  drawFitText(page5, p.ach_amount, 255, 603, 190, { font, size: 12 });
  drawFitText(page5, p.ach_frequency, 140, 578, 100, { font, size: 12 });
  drawFitText(page5, normalizeDateForPdf(p.ach_start_date), 362, 578, 90, { font, size: 12 });
  drawFitText(page5, p.owner_name, 134, 434, 180, { font, size: 12 });
  drawFitText(page5, normalizeDateForPdf(p.effective_date), 140, 411, 90, { font, size: 12 });

  await drawW9(pdfDoc, pages[5], p, font);
  return await pdfDoc.save();
}

// ---- End Placement Block ----

setupPad(adminSignatureCanvas, adminSignatureCtx, 'clearAdminSignature');
loadRecords();
