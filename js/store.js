    /**
     * store.js
     * Berfungsi untuk mengelola semua data yang disimpan di Cloud Firestore.
     * Versi ini menggunakan struktur data yang aman per pengguna.
     */
    import { db } from './firebase-init.js';
    import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, runTransaction, writeBatch } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

    // --- Projects ---
    export async function getProjects(userId) {
        if (!userId) return [];
        const querySnapshot = await getDocs(collection(db, 'users', userId, 'projects'));
        const projects = [];
        querySnapshot.forEach((doc) => {
            projects.push({ id: doc.id, ...doc.data() });
        });
        return projects;
    }

    export async function getProjectById(userId, id) {
        if (!userId || !id) return null;
        const docRef = doc(db, 'users', userId, 'projects', id);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    }

    export async function saveProject(userId, projectData) {
        if (!userId) return;
        const docRef = doc(db, 'users', userId, 'projects', projectData.id);
        await setDoc(docRef, projectData, { merge: true });
    }

    export async function deleteProject(userId, id) {
        if (!userId) return;
        const docRef = doc(db, 'users', userId, 'projects', id);
        await deleteDoc(docRef);
    }

    export async function deleteMultipleProjects(userId, projectIds) {
        if (!userId || projectIds.length === 0) return;
        const batch = writeBatch(db);
        projectIds.forEach(id => {
            const docRef = doc(db, 'users', userId, 'projects', id);
            batch.delete(docRef);
        });
        await batch.commit();
    }

    // --- Clients ---
    export async function getClients(userId) {
        if (!userId) return [];
        const querySnapshot = await getDocs(collection(db, 'users', userId, 'clients'));
        const clients = [];
        querySnapshot.forEach((doc) => {
            clients.push({ id: doc.id, ...doc.data() });
        });
        return clients;
    }

    export async function getClientById(userId, id) {
        if (!userId || !id) return null;
        const docRef = doc(db, 'users', userId, 'clients', id);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    }

    export async function saveClient(userId, clientData) {
        if (!userId) return;
        const docRef = doc(db, 'users', userId, 'clients', clientData.id);
        await setDoc(docRef, clientData, { merge: true });
    }

    export async function deleteClient(userId, id) {
        if (!userId) return;
        const docRef = doc(db, 'users', userId, 'clients', id);
        await deleteDoc(docRef);
    }

    // --- Company Profile & Counters (Shared Data) ---
    export async function getCompanyProfile() {
        const docRef = doc(db, 'companyProfile', 'main');
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() : {};
    }

    export async function saveCompanyProfile(profileData) {
        const docRef = doc(db, 'companyProfile', 'main');
        await setDoc(docRef, profileData, { merge: true });
    }

    export async function getDocumentCounters() {
        const docRef = doc(db, 'counters', 'yearlyCounters');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const year = new Date().getFullYear();
            const allCounters = docSnap.data();
            const yearCounters = {};
            for (const key in allCounters) {
                if (key.endsWith(`_${year}`)) {
                    yearCounters[key.split('_')[0]] = allCounters[key];
                }
            }
            return yearCounters;
        }
        return {};
    }

    export async function incrementDocumentCounter(docType) {
        const counterRef = doc(db, 'counters', 'yearlyCounters');
        const year = new Date().getFullYear();
        const fieldName = `${docType}_${year}`;

        try {
            await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                if (!counterDoc.exists()) {
                    transaction.set(counterRef, { [fieldName]: 1 });
                    return 1;
                }
                const currentCount = counterDoc.data()[fieldName] || 0;
                transaction.update(counterRef, { [fieldName]: currentCount + 1 });
            });
        } catch (e) {
            console.error("Transaction failed: ", e);
        }
    }
    