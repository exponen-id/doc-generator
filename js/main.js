/**
 * main.js
 * Versi ini memperbaiki bug yang terjadi saat membuat proyek baru.
 */

import { auth } from './firebase-init.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import { getProjects, saveProject, deleteProject, deleteMultipleProjects, getProjectById, getClients, saveClient, deleteClient, getCompanyProfile, saveCompanyProfile, getDocumentCounters, incrementDocumentCounter } from './store.js';
import { switchView, renderProjectsTable, populateForm, addItemRow, switchDocument, updatePreview, updateWorkflowUI, showCompanyProfileModal, showClientsModal, renderClientsList, showEmailModal, setLoading, showPaymentModal, showAuthView, showAppView, setUserEmail } from './ui.js';
import { DOCUMENT_CODES } from './config.js';

// --- State Aplikasi ---
let currentUser = null;
let currentProject = null;
let currentDocType = 'penawaran';
let isNewProject = false;
let allClients = [];
let allProjects = [];

// --- Inisialisasi Aplikasi & Otentikasi ---
setupAuthEventListeners();

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        showAppView();
        setUserEmail(user.email);
        initializeApp();
    } else {
        currentUser = null;
        showAuthView();
    }
});

async function initializeApp() {
    setLoading(true, 'Inisialisasi...');
    setupGlobalEventListeners();
    setupDashboardEventListeners();
    setupEditorEventListeners();
    setupModalEventListeners();
    await loadDashboard();
    setLoading(false);
}

// --- Routing / View Management ---
async function loadDashboard() {
    if (!currentUser) return;
    setLoading(true, 'Memuat proyek...');
    allProjects = await getProjects(currentUser.uid);
    allClients = await getClients(currentUser.uid);
    renderProjectsTable(allProjects, allClients, loadEditor);
    switchView('dashboard-view');
    setLoading(false);
}

async function loadEditor(projectId) {
    if (!currentUser) return;
    setLoading(true, 'Memuat editor...');
    const projectIdInput = document.getElementById('projectId');
    
    if (projectId) {
        isNewProject = false;
        currentProject = await getProjectById(currentUser.uid, projectId);
        projectIdInput.disabled = true;
    } else {
        isNewProject = true;
        const companyProfile = await getCompanyProfile();
        currentProject = {
            id: `PROJ-${Date.now()}`,
            createdAt: new Date().toISOString(),
            subject: '',
            clientId: '',
            status: 'Draft',
            projectId: 'Nomor akan dibuat otomatis',
            docNumbers: {},
            items: [],
            payments: [],
            specificDetails: {
                paymentTerm: companyProfile.defaultPaymentTerm || '',
                hasDp: companyProfile.defaultHasDp || false,
                dpPercentage: 50,
                poNumber: '',
                isPPN: companyProfile.isPKP || false,
            },
            discount: 0,
        };
        projectIdInput.disabled = true;
    }

    const clientSelect = document.getElementById('clientId');
    clientSelect.innerHTML = '<option value="">-- Pilih Klien --</option>' + allClients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    document.getElementById('project-form').reset();
    document.getElementById('items-container').innerHTML = '';
    
    currentDocType = 'penawaran';
    await switchDocument(currentUser.uid, currentDocType, currentProject);
    
    if (isNewProject) {
        await generateDocumentNumber(currentUser.uid, currentDocType);
        currentProject.docNumbers.penawaran = currentProject.projectId;
    }
    updateWorkflowUI(currentProject);
    switchView('editor-view');
    setLoading(false);
}

// --- Event Listeners ---
function setupAuthEventListeners() {
    const authForm = document.getElementById('auth-form');
    const authSwitchBtn = document.getElementById('auth-switch-btn');
    let isLogin = true;

    authSwitchBtn.addEventListener('click', () => {
        isLogin = !isLogin;
        document.getElementById('auth-title').textContent = isLogin ? 'Login' : 'Daftar Akun Baru';
        document.getElementById('auth-submit-btn').textContent = isLogin ? 'Login' : 'Daftar';
        document.getElementById('auth-switch-text').textContent = isLogin ? 'Belum punya akun?' : 'Sudah punya akun?';
        document.getElementById('auth-switch-btn').textContent = isLogin ? 'Daftar di sini' : 'Login di sini';
        document.getElementById('auth-error').textContent = '';
        authForm.reset();
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorP = document.getElementById('auth-error');
        errorP.textContent = '';

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (error) {
            errorP.textContent = error.message;
        }
    });
}

function setupGlobalEventListeners() {
    window.onbeforeprint = () => document.getElementById('print-area-container').style.transform = 'scale(1)';
    window.onafterprint = () => {
        const scaleValue = document.getElementById('preview-scale').value;
        document.getElementById('print-area-container').style.transform = `scale(${scaleValue})`;
    };

    document.getElementById('print-area').addEventListener('click', async (e) => {
        if (e.target.id === 'mark-proforma-paid-btn') {
                if (confirm('Apakah Anda yakin ingin menandai Proforma ini sudah dibayar? Aksi ini akan mencatat pembayaran DP.')) {
                    setLoading(true, 'Mencatat pembayaran DP...');
                    
                    const company = await getCompanyProfile();
                    const { grandTotal, dpAmount } = calculateFinancials(currentProject, company);

                    if (!currentProject.payments) currentProject.payments = [];
                    
                    currentProject.payments.push({
                        amount: dpAmount,
                        date: new Date().toISOString().split('T')[0],
                        notes: `Pembayaran DP (${currentProject.specificDetails.dpPercentage}%) via Proforma No. ${currentProject.docNumbers.proforma}`,
                        id: `PAY-DP-${Date.now()}`
                    });

                    currentProject.specificDetails.isProformaPaid = true;
                    currentProject.status = 'Dibayar Sebagian';

                    await saveProject(currentUser.uid, currentProject);
                    await updatePreview(currentUser.uid, currentDocType, currentProject);
                    updateWorkflowUI(currentProject);
                    
                    setLoading(false);
                    alert('Pembayaran DP berhasil dicatat.');
                }
            }
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await signOut(auth);
    });
}

function setupDashboardEventListeners() {
    document.getElementById('new-project-btn').addEventListener('click', () => loadEditor(null));
    document.getElementById('manage-company-btn').addEventListener('click', showCompanyProfileModal);
    document.getElementById('manage-clients-btn').addEventListener('click', () => {
        if (currentUser) {
            showClientsModal(currentUser.uid);
        }
    });
    
    document.getElementById('search-input').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const clientMap = new Map(allClients.map(c => [c.id, c.name.toLowerCase()]));
        const filteredProjects = allProjects.filter(project => {
            const projectName = project.subject.toLowerCase();
            const clientName = clientMap.get(project.clientId) || '';
            return projectName.includes(searchTerm) || clientName.includes(searchTerm);
        });
        renderProjectsTable(filteredProjects, allClients, loadEditor);
    });
    
    document.getElementById('delete-selected-btn').addEventListener('click', async () => {
        if (!currentUser) return;
        const selectedCheckboxes = document.querySelectorAll('.project-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            alert('Tidak ada proyek yang dipilih.');
            return;
        }
        if (confirm(`Apakah Anda yakin ingin menghapus ${selectedCheckboxes.length} proyek terpilih?`)) {
            setLoading(true, `Menghapus ${selectedCheckboxes.length} proyek...`);
            const projectIdsToDelete = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);
            await deleteMultipleProjects(currentUser.uid, projectIdsToDelete);
            setLoading(false);
            alert('Proyek terpilih berhasil dihapus.');
            await loadDashboard();
        }
    });
    
    document.getElementById('select-all-checkbox').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.project-checkbox');
        checkboxes.forEach(checkbox => checkbox.checked = e.target.checked);
    });
}

function setupEditorEventListeners() {
    document.getElementById('back-to-dashboard-btn').addEventListener('click', loadDashboard);

    document.getElementById('doc-nav').addEventListener('click', async (e) => {
        if (e.target.matches('.doc-nav-btn:not(:disabled)')) {
            currentDocType = e.target.dataset.doc;
            await collectFormData(); 
            await switchDocument(currentUser.uid, currentDocType, currentProject);
            if (!currentProject.docNumbers || !currentProject.docNumbers[currentDocType]) {
                 await generateDocumentNumber(currentUser.uid, currentDocType);
            } else {
                currentProject.projectId = currentProject.docNumbers[currentDocType];
                document.getElementById('projectId').value = currentProject.projectId;
                await updatePreview(currentUser.uid, currentDocType, currentProject);
            }
        }
    });

    document.getElementById('project-form').addEventListener('input', async (e) => {
        await collectFormData();
        await updatePreview(currentUser.uid, currentDocType, currentProject);
        updateWorkflowUI(currentProject);
    });

    document.getElementById('project-form').addEventListener('change', async (e) => {
        if (e.target.id === 'projectStatus') {
            currentProject.status = e.target.value;
            updateWorkflowUI(currentProject);
            await updatePreview(currentUser.uid, currentDocType, currentProject);
        }
        if (e.target.id === 'hasDp') {
            document.getElementById('dp-percentage-wrapper').classList.toggle('hidden', !e.target.checked);
        }
    });
    
    document.getElementById('generate-email-btn').addEventListener('click', async () => {
        await collectFormData();
        showEmailModal(currentUser.uid, currentProject);
    });

    document.getElementById('add-item-btn').addEventListener('click', () => addItemRow());
    
    document.getElementById('items-container').addEventListener('click', async (e) => {
        if (e.target.matches('.remove-item-btn')) {
            e.target.closest('.item-row').remove();
            await collectFormData();
            await updatePreview(currentUser.uid, currentDocType, currentProject);
        }
    });

    document.getElementById('save-project-btn').addEventListener('click', async () => {
        if (!currentUser) return;
        setLoading(true, 'Menyimpan proyek...');
        await collectFormData();
        if (!currentProject.clientId || !currentProject.subject) {
            alert('Nama Proyek dan Klien tidak boleh kosong.');
            setLoading(false);
            return;
        }
        if (isNewProject) {
            for (const docType of Object.keys(currentProject.docNumbers || {})) {
                 await incrementDocumentCounter(docType);
            }
        }
        isNewProject = false;
        document.getElementById('projectId').disabled = true;

        await saveProject(currentUser.uid, currentProject);
        setLoading(false);
        alert('Proyek berhasil disimpan!');
        await loadDashboard();
    });
    
    document.getElementById('delete-project-btn').addEventListener('click', async () => {
        if (!currentUser) return;
        if (confirm('Apakah Anda yakin ingin menghapus proyek ini?')) {
            setLoading(true, 'Menghapus proyek...');
            await deleteProject(currentUser.uid, currentProject.id);
            setLoading(false);
            alert('Proyek berhasil dihapus.');
            await loadDashboard();
        }
    });

    document.getElementById('print-btn').addEventListener('click', () => window.print());
    
    document.getElementById('preview-scale').addEventListener('input', e => {
        document.getElementById('print-area-container').style.transform = `scale(${e.target.value})`;
    });
}

function setupModalEventListeners() {
    document.body.addEventListener('click', async (e) => {
        if (e.target.matches('#close-company-modal, #close-clients-modal, #close-email-modal, #close-payment-modal')) {
            e.target.closest('.fixed').style.display = 'none';
        }
        if (e.target.id === 'add-payment-btn') {
            showPaymentModal(currentProject);
        }
        if (e.target.matches('.edit-client-btn')) {
            const client = allClients.find(c => c.id === e.target.dataset.id);
            if (client) {
                document.getElementById('editClientId').value = client.id;
                document.getElementById('clientName').value = client.name;
                document.getElementById('clientDepartment').value = client.clientDepartment || '';
                document.getElementById('clientPic').value = client.pic;
                document.getElementById('clientEmail').value = client.clientEmail || '';
                document.getElementById('clientAddress').value = client.address;
            }
        }
        if (e.target.matches('.delete-client-btn')) {
            if (!currentUser) return;
            if (confirm('Yakin ingin menghapus klien ini?')) {
                await deleteClient(currentUser.uid, e.target.dataset.id);
                allClients = await getClients(currentUser.uid);
                renderClientsList(allClients);
            }
        }
        if (e.target.matches('#clear-client-form')) {
            document.getElementById('client-form').reset();
            document.getElementById('editClientId').value = '';
        }
    });

    document.body.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (e.target.matches('#company-profile-form')) {
            const profile = {
                    companyName: document.getElementById('companyName').value,
                    companyInitials: document.getElementById('companyInitials').value,
                    companyPhone: document.getElementById('companyPhone').value,
                    companyAddress: document.getElementById('companyAddress').value,
                    companyEmail: document.getElementById('companyEmail').value,
                    companyWebsite: document.getElementById('companyWebsite').value,
                    companyNpwp: document.getElementById('companyNpwp').value,
                    companyLogo: document.getElementById('companyLogo').value,
                    companyStamp: document.getElementById('companyStamp').value,
                    directorName: document.getElementById('directorName').value,
                    defaultPaymentTerm: document.getElementById('defaultPaymentTerm').value,
                    defaultHasDp: document.getElementById('defaultHasDp').checked,
                    companyTerms: document.getElementById('companyTerms').value,
                    companyPaymentInfo: document.getElementById('companyPaymentInfo').value,
                    isPKP: document.getElementById('isPKP').checked,
                    ppnRate: parseFloat(document.getElementById('ppnRate').value) || 11,
                };
                await saveCompanyProfile(profile);
                alert('Profil perusahaan disimpan.');
                document.getElementById('company-profile-modal').style.display = 'none';
        }
        if (e.target.matches('#client-form')) {
            if (!currentUser) return;
            const client = {
                id: document.getElementById('editClientId').value || `CLIENT-${Date.now()}`,
                name: document.getElementById('clientName').value,
                clientDepartment: document.getElementById('clientDepartment').value,
                pic: document.getElementById('clientPic').value,
                clientEmail: document.getElementById('clientEmail').value,
                address: document.getElementById('clientAddress').value,
            };
            await saveClient(currentUser.uid, client);
            allClients = await getClients(currentUser.uid);
            renderClientsList(allClients);
            e.target.reset();
            document.getElementById('editClientId').value = '';
        }
        if (e.target.matches('#payment-form')) {
            const paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
            const paymentDate = document.getElementById('paymentDate').value;
            const paymentNotes = document.getElementById('paymentNotes').value;

            if (!paymentAmount || !paymentDate) {
                alert('Jumlah dan Tanggal Pembayaran harus diisi.');
                return;
            }

            if (!currentProject.payments) currentProject.payments = [];
            currentProject.payments.push({
                amount: paymentAmount,
                date: paymentDate,
                notes: paymentNotes,
                id: `PAY-${Date.now()}`
            });

            const company = await getCompanyProfile();
            const { finalTotal } = calculateFinancials(currentProject, company);
            const totalPaid = currentProject.payments.reduce((sum, p) => sum + p.amount, 0);

            if (totalPaid >= finalTotal) {
                currentProject.status = 'Lunas';
            } else {
                currentProject.status = 'Dibayar Sebagian';
            }

            document.getElementById('payment-modal').style.display = 'none';
            // **PERBAIKAN**: Menambahkan `currentUser.uid` saat memanggil `updatePreview`.
            await updatePreview(currentUser.uid, currentDocType, currentProject);
            updateWorkflowUI(currentProject);
        }
    });
}

// --- Helper Functions ---
async function collectFormData() {
    if (!currentProject) return;

        currentProject.subject = document.getElementById('subject').value;
        currentProject.clientId = document.getElementById('clientId').value;
        currentProject.projectId = document.getElementById('projectId').value;
        currentProject.status = document.getElementById('projectStatus')?.value || currentProject.status;
        
        if (!currentProject.specificDetails) currentProject.specificDetails = {};

        document.querySelectorAll('#specific-details-form input, #specific-details-form select, #specific-details-form textarea').forEach(input => {
            const key = input.id || input.name;
            if (input.type === 'checkbox') {
                currentProject.specificDetails[key] = input.checked;
            } else {
                currentProject.specificDetails[key] = input.value;
            }
        });

        currentProject.items = [];
        document.querySelectorAll('.item-row').forEach(row => {
            const desc = row.querySelector('.item-desc').value;
            const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
            const price = parseFloat(row.querySelector('.item-price').value) || 0;
            if (desc) {
                currentProject.items.push({ description: desc, quantity: qty, price: price });
            }
        });
}

async function generateDocumentNumber(userId, docType) {
    const companyProfile = await getCompanyProfile();
    if (!companyProfile.companyInitials) {
        alert('Harap atur "Inisial Perusahaan" di menu Profil Perusahaan terlebih dahulu.');
        return;
    }

    const counters = await getDocumentCounters();
    const nextNumber = (counters[docType] || 0) + 1;
    const paddedNumber = String(nextNumber).padStart(3, '0');

    const date = new Date();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const romanMonth = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][month - 1];
    
    const docCode = DOCUMENT_CODES[docType] || 'DOC';
    const companyInitials = companyProfile.companyInitials.toUpperCase();

    const newDocId = `${paddedNumber}/${companyInitials}/${docCode}/${romanMonth}/${year}`;

    currentProject.projectId = newDocId;
    
    if (!currentProject.docNumbers) currentProject.docNumbers = {};
    currentProject.docNumbers[docType] = newDocId;

    document.getElementById('projectId').value = newDocId;
    await updatePreview(userId, docType, currentProject);
}

function calculateFinancials(projectData, company) {
    const subtotal = (projectData.items || []).reduce((sum, item) => sum + (item.quantity * item.price), 0);
        const discountAmount = subtotal * ((projectData.discount || 0) / 100);
        const dpp = subtotal - discountAmount;
        const ppnRate = company.ppnRate || 11;
        const isPPNApplicable = projectData.specificDetails?.isPPN ?? (company.isPKP || false);
        const ppnAmount = isPPNApplicable ? dpp * (ppnRate / 100) : 0;
        const grandTotal = dpp + ppnAmount;
        
        const isMeteraiApplicable = projectData.specificDetails.applyMeterai;
        const meteraiAmount = isMeteraiApplicable ? 10000 : 0;
        const finalTotal = grandTotal + meteraiAmount;

        const dpPercentage = projectData.specificDetails.hasDp ? (parseFloat(projectData.specificDetails.dpPercentage) || 0) : 0;
        const dpAmount = grandTotal * (dpPercentage / 100);

        return { grandTotal, finalTotal, dpAmount };
}
