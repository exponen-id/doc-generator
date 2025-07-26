/**
 * ui.js
 * Versi ini menambahkan template dan logika untuk render Faktur Pajak.
 */

import { getCompanyProfile, getClientById, getClients } from './store.js';
import { DOCUMENT_TEMPLATES, SPECIFIC_DETAILS_TEMPLATES, COMPANY_MODAL_TEMPLATE, CLIENTS_MODAL_TEMPLATE, EMAIL_MODAL_TEMPLATE, PROJECT_STATUS_TEMPLATE, PAYMENT_MODAL_TEMPLATE } from './config.js';

// --- Elemen UI ---
const authView = document.getElementById('auth-view');
const appContainer = document.getElementById('app-container');
const userEmailEl = document.getElementById('user-email');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');

// --- Kontrol Tampilan Otentikasi ---
export function showAuthView() {
    authView.style.display = 'flex';
    appContainer.style.display = 'none';
}

export function showAppView() {
    authView.style.display = 'none';
    appContainer.style.display = 'block';
}

export function setUserEmail(email) {
    if (userEmailEl) {
        userEmailEl.textContent = email;
    }
}

// --- Loading State ---
export function setLoading(isLoading, message = 'Memuat...') {
    loadingOverlay.style.display = isLoading ? 'flex' : 'none';
    loadingText.textContent = message;
}

// --- View Management ---
export function switchView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(viewId).classList.add('active');
}

// --- Dashboard UI ---
export function renderProjectsTable(projects, clients, onEdit) {
    const tableBody = document.getElementById('projects-table-body');
    
    tableBody.innerHTML = '';
    if (projects.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-gray-500">Tidak ada proyek yang cocok dengan pencarian.</td></tr>`;
        return;
    }

    const clientMap = new Map(clients.map(c => [c.id, c.name]));

    projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    projects.forEach(project => {
        const clientName = clientMap.get(project.clientId) || 'N/A';
        const status = project.status || 'Draft';
        const statusColor = getStatusColor(status);
        const quotationNumber = project.docNumbers?.penawaran || '-';

        const row = `
            <tr class="bg-white border-b hover:bg-[--calm-gray]">
                <td class="p-4"><input type="checkbox" class="project-checkbox" data-id="${project.id}"></td>
                <td class="px-6 py-4 font-medium text-[--deep-charcoal]">${project.subject || 'Tanpa Judul'}</td>
                <td class="px-6 py-4">${quotationNumber}</td>
                <td class="px-6 py-4">${clientName}</td>
                <td class="px-6 py-4"><span class="text-xs font-medium mr-2 px-2.5 py-0.5 rounded ${statusColor}">${status}</span></td>
                <td class="px-6 py-4">${new Date(project.createdAt).toLocaleDateString('id-ID')}</td>
                <td class="px-6 py-4 flex gap-2">
                    <button data-id="${project.id}" class="edit-btn font-medium text-[--limitless-sky] hover:underline">Edit</button>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', row);
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => onEdit(e.target.dataset.id));
    });
}

function getStatusColor(status) {
    switch (status) {
        case 'Draft': return 'bg-gray-100 text-gray-800';
        case 'Disetujui': return 'bg-blue-100 text-blue-800';
        case 'Lunas': return 'bg-green-100 text-green-800';
        case 'Dibayar Sebagian': return 'bg-yellow-100 text-yellow-800';
        case 'Dibatalkan': return 'bg-red-100 text-red-800';
        default: return 'bg-yellow-100 text-yellow-800';
    }
}

// --- Editor UI ---
export function populateForm(project) {
    if (!project) return;
    document.getElementById('subject').value = project.subject || '';
    document.getElementById('clientId').value = project.clientId || '';
    document.getElementById('projectId').value = project.projectId || '';
    
    // Hapus dan buat ulang elemen status agar event listener tidak menumpuk
    const oldStatusContainer = document.getElementById('project-status-container');
    if(oldStatusContainer) oldStatusContainer.remove();

    const specificDetailsForm = document.getElementById('specific-details-form');
    const statusContainer = document.createElement('div');
    statusContainer.id = 'project-status-container';
    statusContainer.innerHTML = PROJECT_STATUS_TEMPLATE;
    specificDetailsForm.insertAdjacentElement('afterend', statusContainer);
    document.getElementById('projectStatus').value = project.status || 'Draft';
    
    document.querySelectorAll('#specific-details-form input, #specific-details-form select, #specific-details-form textarea').forEach(input => {
        const key = input.id || input.name;
        if (project.specificDetails && project.specificDetails[key] !== undefined) {
             if (input.type === 'checkbox') {
                input.checked = project.specificDetails[key];
            } else {
                input.value = project.specificDetails[key];
            }
        }
    });
    
    const hasDpCheckbox = document.getElementById('hasDp');
    if (hasDpCheckbox) {
        const dpWrapper = document.getElementById('dp-percentage-wrapper');
        dpWrapper.classList.toggle('hidden', !hasDpCheckbox.checked);
    }

    const paymentTermEl = document.getElementById('paymentTerm');
    if (paymentTermEl) {
        paymentTermEl.value = project.specificDetails?.paymentTerm || '';
    }

    const itemsContainer = document.getElementById('items-container');
    itemsContainer.innerHTML = '';
    if (project.items && project.items.length > 0) {
        project.items.forEach(item => addItemRow(item.description, item.quantity, item.price));
    } else {
        addItemRow();
    }
}

export function addItemRow(desc = '', qty = 1, price = 0) {
    const container = document.getElementById('items-container');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'grid grid-cols-12 gap-2 mb-2 item-row';
    itemDiv.innerHTML = `
        <textarea placeholder="Deskripsi...&#10;- Sub item 1&#10;- Sub item 2" class="col-span-6 p-2 border rounded item-desc text-sm">${desc}</textarea>
        <input type="number" value="${qty}" min="0" placeholder="Qty" class="col-span-2 p-2 border rounded item-qty">
        <input type="number" value="${price}" min="0" placeholder="Harga" class="col-span-3 p-2 border rounded item-price">
        <button type="button" class="col-span-1 bg-red-500 text-white rounded remove-item-btn">&times;</button>
    `;
    container.appendChild(itemDiv);
}

export async function switchDocument(userId, docType, projectData) {
    document.querySelectorAll('.doc-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.doc === docType);
    });

    const formContainer = document.getElementById('specific-details-form');
    let template = '';
    // Template 'common' tidak berlaku untuk faktur pajak karena field-nya sangat berbeda
    if (docType !== 'fakturpajak') {
        template += SPECIFIC_DETAILS_TEMPLATES.common;
    }
    if (SPECIFIC_DETAILS_TEMPLATES[docType]) {
        template += SPECIFIC_DETAILS_TEMPLATES[docType];
    }
    formContainer.innerHTML = template;

    populateForm(projectData);
    
    const docDateEl = document.getElementById('docDate');
    if (docDateEl && !docDateEl.value) {
        docDateEl.valueAsDate = new Date();
    }

    const invoicePoWrapper = document.getElementById('invoice-po-number-wrapper');
    if (invoicePoWrapper) {
        const proformaBtn = document.querySelector('[data-doc="proforma"]');
        invoicePoWrapper.classList.toggle('hidden', !proformaBtn.disabled);
    }

    await updatePreview(userId, docType, projectData);
}

// --- Preview UI ---
export async function updatePreview(userId, docType, projectData) {
    const printArea = document.getElementById('print-area');
    if (!projectData) {
        printArea.innerHTML = '<p class="text-center text-gray-500">Data proyek tidak ditemukan.</p>';
        return;
    }

    const company = await getCompanyProfile();
    const client = projectData.clientId ? await getClientById(userId, projectData.clientId) : null;
    const docInfo = DOCUMENT_TEMPLATES[docType];

    const { subtotal, discountAmount, dpp, ppnAmount, grandTotal, meteraiAmount, finalTotal, isPPNApplicable, isMeteraiApplicable, ppnRate, totalPaid, amountDue, dpAmount, isProformaPaid } = calculateAllFinancials(projectData, company);
    
    const docDate = projectData.specificDetails.docDate ? new Date(projectData.specificDetails.docDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Belum diatur';

    let mainContent = '';

    const financials = { subtotal, discountAmount, dpp, ppnAmount, grandTotal, meteraiAmount, finalTotal, isPPNApplicable, isMeteraiApplicable, ppnRate, totalPaid, amountDue, dpAmount, isProformaPaid };

    switch (docType) {
        case 'penawaran':
        case 'invoice':
            mainContent = generateInvoiceOrQuotationTemplate(docType, projectData, company, client, docDate, financials);
            break;
        case 'proforma':
            mainContent = generateProformaTemplate(projectData, company, client, docDate, financials);
            break;
        // **PENAMBAHAN**: Case baru untuk memanggil template Faktur Pajak
        case 'fakturpajak':
            mainContent = generateFakturPajakTemplate(projectData, company, client, docDate, financials);
            break;
        case 'suratjalan':
            mainContent = generateSuratJalanTemplate(projectData, company, client, docDate);
            break;
        case 'bast':
             mainContent = generateBastTemplate(projectData, company, client, docDate);
            break;
        case 'kwitansi':
            mainContent = generateKwitansiTemplate(projectData, company, client, docDate, financials);
            break;
        default:
            mainContent = '<p>Template tidak ditemukan.</p>';
    }

    const headerHtml = docType !== 'fakturpajak' ? `
        <header class="document-header">
            <div class="company-info">
                ${company.companyLogo ? `<img src="${company.companyLogo}" alt="Logo Perusahaan" class="company-logo">` : ''}
                <div class="company-details">
                    <h2 class="font-montserrat font-bold text-base text-[--deep-ocean]">${company.companyName || 'Nama Perusahaan'}</h2>
                    <p>${company.companyAddress || 'Alamat Perusahaan'}</p>
                    <p>Email: ${company.companyEmail || ''} | Telp: ${company.companyPhone || ''}</p>
                </div>
            </div>
            <div class="document-title">
                <h1 class="font-montserrat font-bold text-xl text-[--deep-ocean]">${docInfo.title}</h1>
                <p class="font-montserrat text-sm text-[--limitless-sky]">${docInfo.subtitle || ''}</p>
            </div>
        </header>` : '';

    const footerHtml = docType !== 'fakturpajak' ? `
        <footer class="document-footer">
            <p><strong>${company.companyName || ''}</strong></p>
            <p>NPWP: ${company.companyNpwp || ''}</p>
            <p>${company.companyWebsite || ''}</p>
        </footer>` : '';

    printArea.innerHTML = `
        <div class="document-wrapper">
            ${headerHtml}
            <main class="document-body">
                ${mainContent}
            </main>
            ${footerHtml}
        </div>
    `;
}

function generateInvoiceOrQuotationTemplate(docType, projectData, company, client, docDate, financials) {
    const { subtotal, discountAmount, dpp, ppnAmount, grandTotal, meteraiAmount, finalTotal, isPPNApplicable, isMeteraiApplicable, ppnRate, totalPaid, amountDue, dpAmount, isProformaPaid } = financials;
    
    const itemsHtml = (projectData.items || []).map((item, index) => `
        <tr class="border-b border-gray-200">
            <td class="py-2 px-1 text-center align-top">${index + 1}</td>
            <td class="py-2 px-2 align-top">${(item.description || '').replace(/\n/g, '<br class="ml-4">')}</td>
            <td class="py-2 px-1 text-center align-top">${item.quantity || ''}</td>
            <td class="py-2 px-2 text-right align-top">${item.price > 0 ? formatCurrency(item.price) : ''}</td>
            <td class="py-2 px-2 text-right align-top">${(item.quantity * item.price) > 0 ? formatCurrency(item.quantity * item.price) : ''}</td>
        </tr>`).join('');

    let totalsHtml = `
        <div class="total-row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
        ${discountAmount > 0 ? `<div class="total-row text-red-600"><span>Diskon (${projectData.discount}%)</span><span>- ${formatCurrency(discountAmount)}</span></div>` : ''}
        ${isPPNApplicable ? `<div class="total-row"><span>DPP</span><span>${formatCurrency(dpp)}</span></div><div class="total-row"><span>PPN (${ppnRate}%)</span><span>${formatCurrency(ppnAmount)}</span></div>` : ''}
        <div class="total-row grand-total"><span class="font-montserrat">GRAND TOTAL</span><span>${formatCurrency(grandTotal)}</span></div>
        ${isMeteraiApplicable ? `<div class="total-row"><span>Bea Materai</span><span>${formatCurrency(meteraiAmount)}</span></div>` : ''}
        ${isProformaPaid && docType === 'invoice' ? `<div class="total-row text-green-600"><span>Uang Muka (DP)</span><span>- ${formatCurrency(dpAmount)}</span></div>` : ''}
        <div class="total-row final-total"><span class="font-montserrat">TOTAL TAGIHAN</span><span>${formatCurrency(finalTotal - (isProformaPaid && docType === 'invoice' ? dpAmount : 0))}</span></div>
    `;

    if (docType === 'invoice' && totalPaid > 0) {
        const currentTotalTagihan = finalTotal - (isProformaPaid ? dpAmount : 0);
        const sisaTagihan = currentTotalTagihan - (totalPaid - (isProformaPaid ? dpAmount : 0));
        totalsHtml += `
            <div class="total-row text-green-600 mt-2"><span>Telah Dibayar (non-DP)</span><span>- ${formatCurrency(totalPaid - (isProformaPaid ? dpAmount : 0))}</span></div>
            <div class="total-row final-total"><span class="font-montserrat">SISA TAGIHAN</span><span>${formatCurrency(sisaTagihan)}</span></div>
        `;
    }
    
    const paymentTermText = (projectData.specificDetails?.paymentTerm || '').replace(/\n/g, '<br>');

    const paymentSection = docType === 'invoice' ? `
        <div class="payment-section">
            <h4 class="font-bold mb-2 font-montserrat">Riwayat Pembayaran</h4>
            ${(projectData.payments && projectData.payments.length > 0) ? `
            <table class="w-full text-xs border">
                <thead class="bg-gray-50"><tr><th class="p-1 text-left">Tanggal</th><th class="p-1 text-left">Catatan</th><th class="p-1 text-right">Jumlah</th></tr></thead>
                <tbody>
                    ${projectData.payments.map(p => `<tr><td class="p-1 border-t">${new Date(p.date).toLocaleDateString('id-ID')}</td><td class="p-1 border-t">${p.notes}</td><td class="p-1 border-t text-right">${formatCurrency(p.amount)}</td></tr>`).join('')}
                </tbody>
            </table>` : '<p class="text-xs text-gray-500">Belum ada pembayaran.</p>'}
            <button id="add-payment-btn" class="no-print bg-[--sunrise-gold] text-xs text-[--deep-ocean] font-bold py-1 px-3 rounded-md mt-2">Catat Pembayaran</button>
        </div>
    ` : `
        <div>
            <h4 class="font-bold mb-1 font-montserrat">Informasi Pembayaran</h4>
            <div class="prose prose-xs whitespace-pre-wrap">${company.companyPaymentInfo || ''}</div>
        </div>
    `;

    const invoiceRefs = docType === 'invoice' ? `
        ${projectData.docNumbers?.penawaran ? `<p><strong>Ref. Penawaran:</strong> ${projectData.docNumbers.penawaran}</p>`: ''}
        ${projectData.specificDetails?.poNumber ? `<p><strong>Ref. PO:</strong> ${projectData.specificDetails.poNumber}</p>`: ''}
        ${projectData.docNumbers?.proforma ? `<p><strong>Ref. Proforma:</strong> ${projectData.docNumbers.proforma}</p>`: ''}
    ` : '';

    return `
        <div class="document-meta">
            <div class="client-info">
                <p class="meta-title">Ditujukan Kepada:</p>
                <p class="font-bold">${client?.name || ''}</p>
                <p>${client?.clientDepartment || ''}</p>
                <p>${client?.address || ''}</p>
                <p class="mt-1"><strong>Up.</strong> ${client?.pic || ''}</p>
            </div>
            <div class="doc-details">
                <p><strong>Nomor:</strong> ${projectData.projectId || ''}</p>
                <p><strong>Tanggal:</strong> ${docDate}</p>
                ${docType === 'invoice' && projectData.specificDetails.dueDate ? `<p><strong>Jatuh Tempo:</strong> ${new Date(projectData.specificDetails.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>` : ''}
                ${invoiceRefs}
            </div>
        </div>
        <div class="mt-4"><p><strong>Perihal:</strong> ${projectData.subject || ''}</p></div>
        <table class="items-table">
            <thead><tr><th class="w-[5%]">No.</th><th class="w-[45%] text-left">Deskripsi</th><th class="w-[10%]">Kuantitas</th><th class="w-[20%]">Harga (IDR)</th><th class="w-[20%]">Jumlah (IDR)</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
        </table>
        <div class="summary-section">
            <div class="terbilang-section">
                <p class="font-bold font-montserrat">Terbilang:</p>
                <p class="terbilang-text">${terbilang(isMeteraiApplicable ? finalTotal : grandTotal)} Rupiah</p>
            </div>
            <div class="totals-section">${totalsHtml}</div>
        </div>
        <div class="terms-section">
             <div><h4 class="font-bold mb-1 font-montserrat">Termin Pembayaran</h4><p>${paymentTermText}</p></div>
            ${paymentSection}
        </div>
         ${docType !== 'invoice' ? `<div class="terms-full"><h4 class="font-bold mb-1 font-montserrat">Syarat dan Ketentuan</h4><div class="prose prose-xs whitespace-pre-wrap">${company.companyTerms || ''}</div></div>` : ''}
        <div class="signature-area">
            <div class="signature-box"><p>Hormat kami,</p><p class="font-bold">${company.companyName || ''}</p><div class="signature-space">${company.companyStamp ? `<img src="${company.companyStamp}" alt="Stempel Perusahaan" class="stamp">` : ''}${isMeteraiApplicable ? `<span class="meterai-label">E-METERAI<br>10000</span>` : ''}</div><p class="signature-name">${company.directorName || '( NAMA DIREKTUR )'}</p><p class="font-montserrat">Direktur/CEO</p></div>
             <div class="signature-box"><p>Disetujui oleh,</p><p class="font-bold">${client?.name || ''}</p><div class="signature-space"></div><p class="signature-name">( ${client?.pic || 'NAMA KLIEN'} )</p><p class="font-montserrat">Customer</p></div>
        </div>
    `;
}

function generateProformaTemplate(projectData, company, client, docDate, financials) {
    const { grandTotal, dpPercentage, dpAmount, isProformaPaid } = financials;

    const paymentButton = !isProformaPaid ? `
        <div class="no-print mt-4 text-right">
            <button id="mark-proforma-paid-btn" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg">Tandai Sudah Dibayar</button>
        </div>
    ` : `
        <div class="mt-4 text-right text-green-600 font-bold">
            <p>UANG MUKA SUDAH DIBAYAR</p>
        </div>
    `;

    return `
        <div class="document-meta">
            <div class="client-info"><p class="meta-title">Ditujukan Kepada:</p><p class="font-bold">${client?.name || ''}</p><p>${client?.address || ''}</p></div>
            <div class="doc-details"><p><strong>Nomor Proforma:</strong> ${projectData.projectId}</p><p><strong>Tanggal:</strong> ${docDate}</p><p><strong>Ref. Penawaran:</strong> ${projectData.docNumbers?.penawaran || 'N/A'}</p><p><strong>Ref. PO:</strong> ${projectData.specificDetails.poNumber || ''}</p></div>
        </div>
        <div class="mt-8"><p><strong>Perihal: Pembayaran Uang Muka (Down Payment) untuk ${projectData.subject || ''}</strong></p></div>
        <table class="items-table mt-4">
            <thead class="bg-white"><tr><th class="w-[70%] text-left font-bold">Deskripsi</th><th class="w-[30%] text-right font-bold">Jumlah</th></tr></thead>
            <tbody>
                <tr class="border-b border-gray-200"><td class="py-2 px-2">Total Nilai Proyek (termasuk PPN jika berlaku)</td><td class="py-2 px-2 text-right">${formatCurrency(grandTotal)}</td></tr>
                <tr class="border-b border-gray-200"><td class="py-2 px-2">Uang Muka (${dpPercentage}%)</td><td class="py-2 px-2 text-right">${formatCurrency(dpAmount)}</td></tr>
            </tbody>
            <tfoot><tr class="font-bold bg-[--calm-gray]"><td class="py-2 px-2 text-right">TOTAL TAGIHAN</td><td class="py-2 px-2 text-right">${formatCurrency(dpAmount)}</td></tr></tfoot>
        </table>
        <div class="summary-section mt-4"><div class="terbilang-section"><p class="font-bold font-montserrat">Terbilang:</p><p class="terbilang-text">${terbilang(dpAmount)} Rupiah</p></div></div>
        <div class="terms-section"><div><h4 class="font-bold mb-1 font-montserrat">Informasi Pembayaran</h4><div class="prose prose-xs whitespace-pre-wrap">${company.companyPaymentInfo || ''}</div></div></div>
        <div class="signature-area" style="grid-template-columns: 1fr;"><div class="signature-box" style="margin-left: auto; margin-right: 0; text-align: center;"><p>Hormat kami,</p><p class="font-bold">${company.companyName || ''}</p><div class="signature-space">${company.companyStamp ? `<img src="${company.companyStamp}" alt="Stempel Perusahaan" class="stamp">` : ''}</div><p class="signature-name">${company.directorName || '( NAMA DIREKTUR )'}</p><p class="font-montserrat">Direktur/CEO</p></div></div>
        ${paymentButton}
    `;
}

// **PENAMBAHAN**: Template baru untuk Faktur Pajak
function generateFakturPajakTemplate(projectData, company, client, docDate, financials) {
    const { subtotal, discountAmount, dpp, ppnAmount, ppnRate } = financials;
    const nsfp = projectData.specificDetails?.nsfp || 'NOMOR SERI FAKTUR PAJAK BELUM DIISI';

    return `
        <div class="faktur-pajak-wrapper">
            <div class="fp-header">
                <div class="fp-code-title">
                    <p>Kode dan Nomor Seri Faktur Pajak:</p>
                    <p class="fp-nsfp">${nsfp}</p>
                </div>
                <h3 class="fp-main-title">FAKTUR PAJAK</h3>
            </div>
            <div class="fp-section">
                <h4 class="fp-section-title">Pengusaha Kena Pajak</h4>
                <table class="fp-table-meta">
                    <tr><td class="w-1/4">Nama</td><td>: ${company.companyName || ''}</td></tr>
                    <tr><td class="align-top">Alamat</td><td class="align-top">: ${company.companyAddress || ''}</td></tr>
                    <tr><td>NPWP</td><td>: ${company.companyNpwp || ''}</td></tr>
                </table>
            </div>
            <div class="fp-section">
                <h4 class="fp-section-title">Pembeli Barang Kena Pajak / Penerima Jasa Kena Pajak</h4>
                <table class="fp-table-meta">
                    <tr><td class="w-1/4">Nama</td><td>: ${client?.name || ''}</td></tr>
                    <tr><td class="align-top">Alamat</td><td class="align-top">: ${client?.address || ''}</td></tr>
                    <tr><td>NPWP</td><td>: ${client?.npwp || '00.000.000.0-000.000'}</td></tr>
                </table>
            </div>
            <table class="items-table fp-items-table mt-4">
                <thead>
                    <tr>
                        <th class="w-[5%]">No.</th>
                        <th class="w-[55%] text-left">Nama Barang Kena Pajak / Jasa Kena Pajak</th>
                        <th class="w-[40%] text-right">Harga Jual/Penggantian/Uang Muka/Termin (Rp)</th>
                    </tr>
                </thead>
                <tbody>
                    ${(projectData.items || []).map((item, index) => `
                        <tr class="border-b border-gray-200">
                            <td class="py-2 px-1 text-center align-top">${index + 1}</td>
                            <td class="py-2 px-2 align-top">${(item.description || '').replace(/\n/g, '<br>')}</td>
                            <td class="py-2 px-2 text-right align-top">${formatCurrency((item.quantity || 0) * (item.price || 0))}</td>
                        </tr>`).join('')}
                    <tr><td colspan="3" style="padding: 1rem;"></td></tr>
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="2" class="text-right px-2 py-1 font-bold">Harga Jual/Penggantian</td>
                        <td class="text-right px-2 py-1">${formatCurrency(subtotal)}</td>
                    </tr>
                    <tr>
                        <td colspan="2" class="text-right px-2 py-1 font-bold">Dikurangi Potongan Harga</td>
                        <td class="text-right px-2 py-1">${formatCurrency(discountAmount)}</td>
                    </tr>
                     <tr>
                        <td colspan="2" class="text-right px-2 py-1 font-bold">Dikurangi Uang Muka yang telah diterima</td>
                        <td class="text-right px-2 py-1">0</td>
                    </tr>
                    <tr>
                        <td colspan="2" class="text-right px-2 py-1 font-bold">Dasar Pengenaan Pajak</td>
                        <td class="text-right px-2 py-1 font-bold">${formatCurrency(dpp)}</td>
                    </tr>
                    <tr>
                        <td colspan="2" class="text-right px-2 py-1 font-bold">PPN = ${ppnRate}% x Dasar Pengenaan Pajak</td>
                        <td class="text-right px-2 py-1 font-bold">${formatCurrency(ppnAmount)}</td>
                    </tr>
                </tfoot>
            </table>
             <div class="terbilang-section mt-4">
                <p class="font-bold font-montserrat text-sm">Jumlah PPN Terutang Terbilang:</p>
                <p class="terbilang-text">${terbilang(ppnAmount)} Rupiah</p>
            </div>
            <div class="signature-area mt-8">
                <div class="signature-box" style="margin-left: auto; margin-right: 0; text-align: center;">
                    <p>${(company.companyAddress || 'Jakarta').split(',').slice(-2, -1)[0]?.trim()}, ${docDate}</p>
                    <p class="mt-2">Sesuai dengan ketentuan yang berlaku, Direktorat Jenderal Pajak mengatur bahwa Faktur Pajak ini telah ditandatangani secara elektronik sehingga tidak diperlukan tanda tangan basah pada Faktur Pajak ini.</p>
                    <p class="signature-name mt-4">${company.directorName || '( NAMA DIREKTUR )'}</p>
                    <p class="font-montserrat text-xs">Nama Jelas Pejabat yang Berwenang</p>
                </div>
            </div>
        </div>
    `;
}


function generateKwitansiTemplate(projectData, company, client, docDate, financials) {
    const { finalTotal, totalPaid } = financials;
    const paymentToAcknowledge = totalPaid > 0 ? totalPaid : finalTotal;
    const showMeteraiBox = projectData.specificDetails.applyMeteraiKwitansi;
    const city = (company.companyAddress || '').split(',').slice(-2, -1)[0]?.trim() || '';

    return `
        <div class="kwitansi-box">
            <div class="kwitansi-row"><span class="kwitansi-label">No.</span><span class="kwitansi-value">: ${projectData.projectId}</span></div>
            <div class="kwitansi-row mt-4"><span class="kwitansi-label">Telah Diterima Dari</span><span class="kwitansi-value">: ${client?.name || ''}</span></div>
            <div class="kwitansi-row"><span class="kwitansi-label">Uang Sejumlah</span><span class="kwitansi-value terbilang-kwitansi">: ${terbilang(paymentToAcknowledge)} Rupiah</span></div>
            <div class="kwitansi-row"><span class="kwitansi-label">Untuk Pembayaran</span><span class="kwitansi-value">: ${projectData.status === 'Lunas' ? 'Pelunasan' : 'Pembayaran'} Proyek ${projectData.subject} (Invoice No. ${projectData.docNumbers?.invoice || 'N/A'})</span></div>
            <div class="kwitansi-footer">
                <div class="kwitansi-total">${formatCurrency(paymentToAcknowledge)}</div>
                <div class="signature-box" style="text-align: center;">
                    <p>${city}, ${docDate}</p>
                    <div class="signature-space">
                        ${company.companyStamp ? `<img src="${company.companyStamp}" alt="Stempel Perusahaan" class="stamp">` : ''}
                        ${showMeteraiBox ? `<div class="meterai-box">MATERAI<br>TEMPEL</div>` : ''}
                    </div>
                    <p class="signature-name">${company.directorName || '( NAMA DIREKTUR )'}</p>
                </div>
            </div>
        </div>
    `;
}

function generateSuratJalanTemplate(projectData, company, client, docDate) {
    const itemsHtml = (projectData.items || []).map((item, index) => `
        <tr class="border-b border-gray-200"><td class="py-2 px-1 text-center align-top">${index + 1}</td><td class="py-2 px-2 align-top">${(item.description || '').replace(/\n/g, '<br class="ml-4">')}</td><td class="py-2 px-1 text-center align-top">${item.quantity || ''}</td><td class="py-2 px-1 text-center align-top">Unit</td></tr>`).join('');
return `
    <div class="document-meta">
        <div class="client-info"><p class="meta-title">Dikirim Kepada:</p><p class="font-bold">${client?.name || ''}</p><p>${client?.address || ''}</p><p class="mt-1"><strong>Up.</strong> ${client?.pic || ''}</p></div>
        <div class="doc-details"><p><strong>Nomor:</strong> ${projectData.projectId || ''}</p><p><strong>Tanggal Kirim:</strong> ${docDate}</p><p><strong>Ref. Invoice:</strong> ${projectData.docNumbers?.invoice || 'N/A'}</p></div>
    </div>
    <table class="items-table mt-8"><thead><tr><th class="w-[5%]">No.</th><th class="w-[65%] text-left">Deskripsi Barang</th><th class="w-[15%]">Kuantitas</th><th class="w-[15%]">Satuan</th></tr></thead><tbody>${itemsHtml}</tbody></table>
    <div class="mt-4 text-xs"><p>Catatan: ${projectData.specificDetails.deliveryNotes || 'Barang telah diterima dalam kondisi baik dan jumlah yang cukup.'}</p></div>
    <div class="signature-area grid-cols-3 mt-8">
        <div class="signature-box"><p>Disiapkan oleh,</p><div class="signature-space"></div><p class="signature-name">( .......................... )</p><p class="font-montserrat">${company.companyName}</p></div>
        <div class="signature-box"><p>Dikirim oleh,</p><div class="signature-space"></div><p class="signature-name">( .......................... )</p><p class="font-montserrat">Kurir</p></div>
        <div class="signature-box"><p>Diterima oleh,</p><div class="signature-space"></div><p class="signature-name">( .......................... )</p><p class="font-montserrat">${client?.name}</p></div>
    </div>
`;
}

function generateBastTemplate(projectData, company, client, docDate) {
    const pihak1Name = projectData.specificDetails.bastPihak1Name || company.directorName;
    const pihak1Jabatan = projectData.specificDetails.bastPihak1Jabatan || 'Direktur';
    const pihak2Name = projectData.specificDetails.bastPihak2Name || client?.pic;
    const pihak2Jabatan = projectData.specificDetails.bastPihak2Jabatan || 'Perwakilan Klien';

    return `
        <div class="text-center mb-8"><p class="font-bold underline">BERITA ACARA SERAH TERIMA</p><p>Nomor: ${projectData.projectId}</p></div>
        <div class="text-sm leading-relaxed">
            <p>Pada hari ini, ${new Date(projectData.specificDetails.docDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, yang bertanda tangan di bawah ini:</p>
            <table class="w-full my-4 text-sm">
                <tr><td class="w-[20%] align-top">Nama</td><td class="w-[5%] align-top">:</td><td class="w-[75%] font-bold">${pihak1Name}</td></tr>
                <tr><td class="align-top">Jabatan</td><td class="align-top">:</td><td>${pihak1Jabatan}, ${company.companyName}</td></tr>
                <tr><td class="align-top">Alamat</td><td class="align-top">:</td><td>${company.companyAddress || ''}</td></tr>
            </table>
            <p>Selanjutnya disebut sebagai <strong>PIHAK PERTAMA</strong>.</p>
             <table class="w-full my-4 text-sm">
                <tr><td class="w-[20%] align-top">Nama</td><td class="w-[5%] align-top">:</td><td class="w-[75%] font-bold">${pihak2Name}</td></tr>
                <tr><td class="align-top">Jabatan</td><td class="align-top">:</td><td>${pihak2Jabatan}, ${client?.name || ''}</td></tr>
                <tr><td class="align-top">Alamat</td><td class="align-top">:</td><td>${client?.address || ''}</td></tr>
            </table>
            <p>Selanjutnya disebut sebagai <strong>PIHAK KEDUA</strong>.</p>
            <p class="mt-4">Dengan ini menyatakan bahwa <strong>PIHAK PERTAMA</strong> telah menyelesaikan dan menyerahkan hasil pekerjaan kepada <strong>PIHAK KEDUA</strong>, dan <strong>PIHAK KEDUA</strong> telah menerima hasil pekerjaan tersebut dalam keadaan baik dan lengkap. Pekerjaan yang diserahterimakan adalah sebagai berikut:</p>
            <p class="my-2"><strong>Nama Proyek: ${projectData.subject}</strong></p>
            <p>Demikian Berita Acara Serah Terima ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.</p>
        </div>
         <div class="signature-area mt-8">
            <div class="signature-box"><p><strong>PIHAK KEDUA</strong></p><p>Yang Menerima,</p><div class="signature-space"></div><p class="signature-name">( ${pihak2Name} )</p></div>
            <div class="signature-box"><p><strong>PIHAK PERTAMA</strong></p><p>Yang Menyerahkan,</p><div class="signature-space">${company.companyStamp ? `<img src="${company.companyStamp}" alt="Stempel Perusahaan" class="stamp">` : ''}</div><p class="signature-name">( ${pihak1Name} )</p></div>
        </div>
    `;
}

// --- Modals UI ---
export async function showCompanyProfileModal() {
    const modal = document.getElementById('company-profile-modal');
    modal.innerHTML = COMPANY_MODAL_TEMPLATE;
    modal.style.display = 'block';
    const profile = await getCompanyProfile();
    Object.keys(profile).forEach(key => {
        const el = modal.querySelector(`#${key}`);
        if (el) {
            if (el.type === 'checkbox') el.checked = profile[key];
            else el.value = profile[key];
        }
    });
}

export async function showClientsModal(userId) {
    const modal = document.getElementById('clients-modal');
    modal.innerHTML = CLIENTS_MODAL_TEMPLATE;
    modal.style.display = 'block';
    setLoading(true, 'Memuat daftar klien...');
    const clientList = await getClients(userId);
    renderClientsList(clientList);
    setLoading(false);
}
export function renderClientsList(clients) {
    const listContainer = document.getElementById('clients-list');
    if (!listContainer) return;
    if (clients.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500 p-4">Belum ada klien.</p>`;
        return;
    }
    listContainer.innerHTML = clients.map(client => `
        <div class="p-3 border-b flex justify-between items-center hover:bg-white">
            <div>
                <p class="font-semibold">${client.name}</p>
                <p class="text-xs text-gray-500">${client.clientEmail || 'No Email'}</p>
                <p class="text-xs text-gray-500">NPWP: ${client.npwp || 'N/A'}</p>
            </div>
            <div class="flex gap-3"><button data-id="${client.id}" class="edit-client-btn text-[--limitless-sky] text-xs font-bold">EDIT</button><button data-id="${client.id}" class="delete-client-btn text-red-500 text-xs font-bold">HAPUS</button></div>
        </div>`).join('');
}
export async function showEmailModal(userId, projectData) {
    const modal = document.getElementById('email-modal');
    const company = await getCompanyProfile();
    const client = projectData.clientId ? await getClientById(userId, projectData.clientId) : null;

    if (!client || !client.clientEmail) {
        alert('Email klien belum diatur. Harap lengkapi data klien terlebih dahulu.');
        return;
    }
    
    const { grandTotal } = calculateAllFinancials(projectData, company);

    const emailSubject = `Penawaran: ${projectData.subject} dari ${company.companyName}`;
    const defaultBody = `Kepada Yth. ${client.pic || client.name},\n\nDengan hormat,\n\nMenindaklanjuti pembicaraan kita sebelumnya, bersama ini kami dari ${company.companyName} mengajukan penawaran harga untuk pekerjaan "${projectData.subject}".\nTotal nilai penawaran adalah ${formatCurrency(grandTotal)}.\n\nDetail lengkap penawaran terlampir dalam dokumen PDF.\n\nApabila ada pertanyaan lebih lanjut, jangan ragu untuk menghubungi kami. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.\n\nHormat kami,\n\n${company.directorName || ''}\n${company.companyName}\n${company.companyPhone || ''}\n${company.companyEmail || ''}`;
    
    const mailtoLink = `mailto:${client.clientEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(defaultBody)}`;

    modal.innerHTML = EMAIL_MODAL_TEMPLATE
        .replace('{clientEmail}', client.clientEmail)
        .replace('{subject}', emailSubject)
        .replace('{body}', defaultBody.trim().replace(/^\s+/gm, ''))
        .replace('{mailtoLink}', mailtoLink);

    modal.style.display = 'block';

    document.getElementById('generate-email-ai-btn').onclick = async () => {
        const button = document.getElementById('generate-email-ai-btn');
        const buttonText = document.getElementById('ai-button-text');
        const spinner = document.getElementById('ai-spinner');
        const emailBodyEl = document.getElementById('email-body');

        button.disabled = true;
        buttonText.textContent = 'Membuat...';
        spinner.classList.remove('hidden');
        emailBodyEl.value = 'Menghubungi AI, mohon tunggu...';

        try {
            const prompt = `Buatkan draf email penawaran yang profesional, ramah, dan persuasif dalam Bahasa Indonesia.
            - Nama saya: ${company.directorName} dari ${company.companyName}.
            - Email untuk: ${client.pic || client.name} dari ${client.name}.
            - Nama proyek/pekerjaan: "${projectData.subject}".
            - Total nilai penawaran: ${formatCurrency(grandTotal)}.
            - Sampaikan bahwa detail terlampir dalam PDF.
            - Gunakan gaya bahasa yang sopan dan bisnis.
            - Akhiri dengan salam, nama, jabatan, perusahaan, dan kontak saya.`;

            let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiKey = ""; // API key is handled by the environment
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const result = await response.json();
            
            if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
                const aiText = result.candidates[0].content.parts[0].text;
                emailBodyEl.value = aiText;
                document.getElementById('mailto-link').href = `mailto:${client.clientEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(aiText)}`;
            } else {
                throw new Error('Invalid response structure from AI.');
            }
        } catch (error) {
            console.error("AI email generation failed:", error);
            emailBodyEl.value = `Gagal membuat email dengan AI. Silakan gunakan template standar.\n\nError: ${error.message}`;
        } finally {
            button.disabled = false;
            buttonText.textContent = 'Buat dengan AI';
            spinner.classList.add('hidden');
        }
    };
}

export function showPaymentModal(projectData) {
    const modalContainer = document.getElementById('payment-modal');
    modalContainer.innerHTML = PAYMENT_MODAL_TEMPLATE;
    modalContainer.style.display = 'block';
    document.getElementById('paymentDate').valueAsDate = new Date();
}

// **PEMBARUAN**: Mengganti nama fungsi menjadi lebih deskriptif
function calculateAllFinancials(projectData, company) {
    const subtotal = (projectData.items || []).reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const discountAmount = subtotal * ((projectData.specificDetails?.discount || 0) / 100);
    const dpp = subtotal - discountAmount;
    const ppnRate = company.ppnRate || 11;
    const isPPNApplicable = projectData.specificDetails?.isPPN ?? (company.isPKP || false);
    const ppnAmount = isPPNApplicable ? dpp * (ppnRate / 100) : 0;
    const grandTotal = dpp + ppnAmount;
    
    const isMeteraiApplicable = projectData.specificDetails?.applyMeterai;
    const meteraiAmount = isMeteraiApplicable ? 10000 : 0;
    const finalTotal = grandTotal + meteraiAmount;

    const totalPaid = (projectData.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const amountDue = finalTotal - totalPaid;

    const dpPercentage = projectData.specificDetails?.hasDp ? (parseFloat(projectData.specificDetails.dpPercentage) || 0) : 0;
    const dpAmount = grandTotal * (dpPercentage / 100);
    
    const isProformaPaid = (projectData.payments || []).some(p => p.notes.includes('via Proforma'));

    return { subtotal, discountAmount, dpp, ppnAmount, grandTotal, meteraiAmount, finalTotal, isPPNApplicable, isMeteraiApplicable, ppnRate, totalPaid, amountDue, dpAmount, isProformaPaid };
}

function formatCurrency(amount) {
    return "Rp " + new Intl.NumberFormat('id-ID').format(amount || 0);
}

function terbilang(n) {
    if (n === 0) return "Nol";
    const satuan = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
    let result = "";
    const toWords = (num) => {
        if (num < 12) return satuan[num];
        if (num < 20) return toWords(num - 10) + " Belas";
        if (num < 100) return satuan[Math.floor(num / 10)] + " Puluh " + toWords(num % 10);
        if (num < 200) return "Seratus " + toWords(num - 100);
        if (num < 1000) return toWords(Math.floor(num / 100)) + " Ratus " + toWords(num % 100);
        if (num < 2000) return "Seribu " + toWords(num - 1000);
        if (num < 1000000) return toWords(Math.floor(num / 1000)) + " Ribu " + toWords(num % 1000);
        if (num < 1000000000) return toWords(Math.floor(num / 1000000)) + " Juta " + toWords(num % 1000000);
        return "";
    };
    result = toWords(n);
    return result.replace(/\s+/g, ' ').trim();
}
