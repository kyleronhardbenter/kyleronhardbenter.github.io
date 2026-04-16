import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getDatabase, ref, get, set, push } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyD-ET-NddOEtiNvSt7787wxVbGoDj8-kas",
    authDomain: "website-cc7ff.firebaseapp.com",
    databaseURL: "https://website-cc7ff-default-rtdb.firebaseio.com",
    projectId: "website-cc7ff",
    storageBucket: "website-cc7ff.firebasestorage.app",
    messagingSenderId: "755069923532",
    appId: "1:755069923532:web:62384a64fb880100ff1269"
};

const firebaseApp = initializeApp(firebaseConfig);
const rtdb = getDatabase(firebaseApp);

const DB_ROOT = "website/profile";

async function dbGet(path) {
    try {
        const snapshot = await get(ref(rtdb, `${DB_ROOT}/${path}`));
        return snapshot.exists() ? snapshot.val() : null;
    } catch {
        return null;
    }
}

async function dbSet(path, value) {
    try {
        await set(ref(rtdb, `${DB_ROOT}/${path}`), value);
        return true;
    } catch {
        return false;
    }
}

async function dbPush(path, value) {
    try {
        await push(ref(rtdb, `${DB_ROOT}/${path}`), value);
        return true;
    } catch {
        return false;
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    // Navigation
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const targetSection = this.getAttribute('data-section');

            if (targetSection === 'finanzas') {
                pendingSectionUnlock = 'finanzas';
                currentMetricToReveal = null;
                setPinMessage('', '');
                if (!pinModal || !pinInput) return;

                if (isPinLocked()) {
                    setPinMessage('error', `Bloqueado por seguridad. Intenta en ${getLockRemainingText()}.`);
                    pinModal.style.display = 'flex';
                    pinInput.value = '';
                    pinInput.disabled = true;
                    return;
                }

                pinInput.disabled = false;
                pinModal.style.display = 'flex';
                pinInput.value = '';
                pinInput.focus();
                return;
            }

            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');

            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === targetSection) section.classList.add('active');
            });
        });
    });

    const financeTabs = document.querySelectorAll('.finance-tab');
    const financePanels = document.querySelectorAll('.finance-panel');

    financeTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-finance-tab');

            financeTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            financePanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === `panel-${targetTab}`) panel.classList.add('active');
            });
        });
    });

    // Update age on load
    function updateAge() {
        const birthday = new Date('2001-03-27');
        const today = new Date();
        let age = today.getFullYear() - birthday.getFullYear();
        const monthDiff = today.getMonth() - birthday.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) age--;
        const ageEl = document.getElementById('edad');
        if (ageEl) ageEl.textContent = `${age} años`;
    }
    updateAge();

    // PIN logic
    let currentMetricToReveal = null;
    let pendingSectionUnlock = null;
    let pendingSecureAction = null;
    const pinModal = document.getElementById('passwordModal');
    const pinInput = document.getElementById('pinInput');
    const pinMessage = document.getElementById('pinMessage');
    const accessLockBanner = document.getElementById('accessLockBanner');
    const accessLockBannerText = document.getElementById('accessLockBannerText');
    let lockBannerInterval = null;

    const PIN_GUARD_NAMESPACE = 'pin_guard_v2';
    const MAX_PIN_ATTEMPTS = 5;
    const LOCK_STEPS_MS = [2 * 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000];

    const PIN_USER_SCOPE = (() => {
        try {
            const key = 'pin_scope_id_v1';
            let id = localStorage.getItem(key);
            if (!id) {
                id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
                localStorage.setItem(key, id);
            }
            return id;
        } catch {
            return 'anonymous_scope';
        }
    })();

    const PIN_GUARD_KEY = `${PIN_GUARD_NAMESPACE}_${PIN_USER_SCOPE}`;

    let pinGuard = {
        attempts: 0,
        lockedUntil: 0,
        lockLevel: 0
    };

    async function loadPinGuard() {
        try {
            const remote = await dbGet('pinGuard');
            if (remote) {
                pinGuard.attempts = Number(remote?.attempts || 0);
                pinGuard.lockedUntil = Number(remote?.lockedUntil || 0);
                pinGuard.lockLevel = Number(remote?.lockLevel || 0);
                localStorage.setItem(PIN_GUARD_KEY, JSON.stringify(pinGuard));
                return;
            }

            const raw = localStorage.getItem(PIN_GUARD_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            pinGuard.attempts = Number(parsed?.attempts || 0);
            pinGuard.lockedUntil = Number(parsed?.lockedUntil || 0);
            pinGuard.lockLevel = Number(parsed?.lockLevel || 0);
        } catch {}
    }

    async function savePinGuard() {
        localStorage.setItem(PIN_GUARD_KEY, JSON.stringify(pinGuard));
        await dbSet('pinGuard', pinGuard);
    }

    function isPinLocked() {
        const now = Date.now();
        if (pinGuard.lockedUntil && now < pinGuard.lockedUntil) return true;
        if (pinGuard.lockedUntil && now >= pinGuard.lockedUntil) {
            pinGuard.attempts = 0;
            pinGuard.lockedUntil = 0;
            pinGuard.lockLevel = 0;
            savePinGuard();
            hideLockBanner();
        }
        return false;
    }

    function getLockRemainingText() {
        const remainMs = Math.max(0, pinGuard.lockedUntil - Date.now());
        const sec = Math.ceil(remainMs / 1000);
        return `${sec}s`;
    }

    function hideLockBanner() {
        if (lockBannerInterval) {
            clearInterval(lockBannerInterval);
            lockBannerInterval = null;
        }
        if (accessLockBanner) accessLockBanner.classList.remove('show');
    }

    function showLockBanner() {
        if (!accessLockBanner || !accessLockBannerText) return;
        accessLockBanner.classList.add('show');
        accessLockBannerText.textContent = `Acceso restringido temporalmente. Intenta en ${getLockRemainingText()}.`;

        if (lockBannerInterval) clearInterval(lockBannerInterval);
        lockBannerInterval = setInterval(() => {
            if (!isPinLocked()) {
                hideLockBanner();
                return;
            }
            accessLockBannerText.textContent = `Acceso restringido temporalmente. Intenta en ${getLockRemainingText()}.`;
        }, 1000);
    }

    function setPinMessage(type, text) {
        if (!pinMessage) return;
        pinMessage.className = `pin-message ${type || ''}`.trim();
        pinMessage.textContent = text || '';
    }

    window.checkPassword = function(metricType) {
        currentMetricToReveal = metricType || null;
        setPinMessage('', '');
        if (!pinModal || !pinInput) return;

        if (isPinLocked()) {
            setPinMessage('error', `Bloqueado por seguridad. Intenta en ${getLockRemainingText()}.`);
            pinModal.style.display = 'flex';
            pinInput.value = '';
            pinInput.disabled = true;
            return;
        }

        pinInput.disabled = false;
        pinModal.style.display = 'flex';
        pinInput.value = '';
        pinInput.focus();
    };

    window.closeModal = function() {
        if (pinModal) pinModal.style.display = 'none';
        if (pinInput) pinInput.value = '';
        setPinMessage('', '');
        currentMetricToReveal = null;
    };

    window.verifyPin = async function() {
        if (!pinInput) return;
        const pin = pinInput.value;
        const saldoSmall = document.querySelector('.metric-saldo small');
        const gastosSmall = document.querySelector('.metric-gastos small');

        if (isPinLocked()) {
            pinInput.disabled = true;
            setPinMessage('error', `Bloqueado por seguridad. Intenta en ${getLockRemainingText()}.`);
            return;
        }

        if (pin !== '0230') {
            pinGuard.attempts += 1;

            if (pinGuard.attempts >= MAX_PIN_ATTEMPTS) {
                const level = pinGuard.lockLevel || 0;
                const lockMs = LOCK_STEPS_MS[Math.min(level, LOCK_STEPS_MS.length - 1)];
                pinGuard.lockLevel = level + 1;
                pinGuard.lockedUntil = Date.now() + lockMs;
                pinGuard.attempts = 0;
                savePinGuard();
                pinInput.value = '';
                pinInput.disabled = true;
                setPinMessage('error', `Demasiados intentos. Bloqueado ${Math.ceil(lockMs / 60000)} min (nivel ${pinGuard.lockLevel}).`);
                showLockBanner();
                return;
            }

            savePinGuard();
            const left = Math.max(0, MAX_PIN_ATTEMPTS - pinGuard.attempts);
            setPinMessage('error', `PIN incorrecto. Intentos restantes: ${left}.`);
            pinInput.value = '';
            pinInput.focus();
            return;
        }

        pinGuard.attempts = 0;
        pinGuard.lockedUntil = 0;
        savePinGuard();
        hideLockBanner();

        const monthData = getCurrentMonthData();
        const totalIncomeMonth = monthData
            .filter(item => (item.type || 'Ingreso') === 'Ingreso')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const totalExpenseMonth = monthData
            .filter(item => (item.type || 'Ingreso') === 'Gasto')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const balanceMonth = totalIncomeMonth - totalExpenseMonth;

        if (currentMetricToReveal === 'saldo' && saldoSmall) {
            saldoSmall.textContent = formatEUR(balanceMonth);
            saldoSmall.parentElement.classList.remove('censored');
            saldoSmall.parentElement.onclick = null;
            setPinMessage('success', 'Saldo revelado correctamente.');
        }

        if (currentMetricToReveal === 'gastos' && gastosSmall) {
            gastosSmall.textContent = formatEUR(totalExpenseMonth);
            gastosSmall.parentElement.classList.remove('censored');
            gastosSmall.parentElement.onclick = null;
            setPinMessage('success', 'Gastos del mes revelados.');
        }

        if (pendingSectionUnlock === 'finanzas') {
            pendingSectionUnlock = null;
            const finanzasNav = document.querySelector('.nav-item[data-section="finanzas"]');
            const finanzasSection = document.getElementById('finanzas');
            navItems.forEach(nav => nav.classList.remove('active'));
            finanzasNav?.classList.add('active');
            sections.forEach(section => section.classList.remove('active'));
            finanzasSection?.classList.add('active');
        }

        if (typeof pendingSecureAction === 'function') {
            const secureAction = pendingSecureAction;
            pendingSecureAction = null;
            secureAction();
        }

        setTimeout(() => closeModal(), 280);
    };

    pinInput?.addEventListener('input', () => {
        const digits = (pinInput.value || '').replace(/\D/g, '').slice(0, 4);
        pinInput.value = digits;
        if (digits.length === 4) verifyPin();
    });

    pinInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    pinModal?.addEventListener('click', (e) => {
        if (e.target === pinModal) closeModal();
    });

    // DOCUMENTOS LABORALES
    const DOC_STORAGE_KEY = 'laboral_docs_v1';
    const DOC_SECRET = 'kyle_secure_layer_v1';
    const DOC_TYPES = [
        'curriculum',
        'certificado_laboral',
        'numero_seguridad_social',
        'certificado_banco',
        'documento_identidad'
    ];

    let docsStore = {};

    function encodeSecureText(rawText) {
        try {
            const encoded = btoa(unescape(encodeURIComponent(rawText)));
            return encoded.split('').reverse().join('') + btoa(DOC_SECRET).slice(0, 6);
        } catch {
            return '';
        }
    }

    function decodeSecureText(encodedText) {
        try {
            const withoutSalt = encodedText.slice(0, -6);
            const restored = withoutSalt.split('').reverse().join('');
            return decodeURIComponent(escape(atob(restored)));
        } catch {
            return '';
        }
    }

    async function loadDocsStore() {
        try {
            const remote = await dbGet('docsStore');
            if (remote && typeof remote === 'object') {
                docsStore = remote;
                const serializedRemote = JSON.stringify(docsStore || {});
                const encryptedRemote = encodeSecureText(serializedRemote);
                localStorage.setItem(DOC_STORAGE_KEY, encryptedRemote);
                return;
            }

            const raw = localStorage.getItem(DOC_STORAGE_KEY);
            if (!raw) {
                docsStore = {};
                return;
            }
            const decrypted = decodeSecureText(raw);
            docsStore = decrypted ? JSON.parse(decrypted) : {};
        } catch {
            docsStore = {};
        }
    }

    async function saveDocsStore() {
        try {
            const serialized = JSON.stringify(docsStore || {});
            const encrypted = encodeSecureText(serialized);
            localStorage.setItem(DOC_STORAGE_KEY, encrypted);
            await dbSet('docsStore', docsStore || {});
        } catch {}
    }

    function updateDocumentStatus() {
        DOC_TYPES.forEach(type => {
            const statusEl = document.getElementById(`docStatus-${type}`);
            const record = docsStore[type];
            if (!statusEl) return;

            if (record && record.name) {
                statusEl.textContent = `Cargado: ${record.name}`;
                statusEl.classList.add('loaded');
            } else {
                statusEl.textContent = 'Sin archivo';
                statusEl.classList.remove('loaded');
            }
        });
    }

    function runProtectedAction(action) {
        pendingSecureAction = action;
        currentMetricToReveal = null;
        pendingSectionUnlock = null;
        setPinMessage('', '');

        if (!pinModal || !pinInput) return;

        if (isPinLocked()) {
            setPinMessage('error', `Bloqueado por seguridad. Intenta en ${getLockRemainingText()}.`);
            pinModal.style.display = 'flex';
            pinInput.value = '';
            pinInput.disabled = true;
            return;
        }

        pinInput.disabled = false;
        pinModal.style.display = 'flex';
        pinInput.value = '';
        pinInput.focus();
    }

    function downloadBlob(base64Data, mimeType, filename) {
        try {
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType || 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || 'archivo';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {}
    }

    function handleUpload(docType) {
        const fileInput = document.getElementById(`fileInput-${docType}`);
        if (!fileInput) return;

        fileInput.value = '';
        fileInput.click();
    }

    function handleDownload(docType) {
        const record = docsStore[docType];
        if (!record || !record.content) {
            setPinMessage('error', 'No hay archivo cargado para este documento.');
            return;
        }
        downloadBlob(record.content, record.mimeType, record.name);
    }

    document.querySelectorAll('.doc-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.getAttribute('data-doc-action');
            const docType = this.getAttribute('data-doc-type');
            if (!action || !docType) return;

            runProtectedAction(() => {
                if (action === 'upload') handleUpload(docType);
                if (action === 'download') handleDownload(docType);
            });
        });
    });

    DOC_TYPES.forEach(docType => {
        const input = document.getElementById(`fileInput-${docType}`);
        input?.addEventListener('change', function(e) {
            const file = e.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async function(ev) {
                const result = String(ev.target?.result || '');
                const base64 = result.includes(',') ? result.split(',')[1] : '';
                docsStore[docType] = {
                    name: file.name,
                    size: file.size,
                    mimeType: file.type || 'application/octet-stream',
                    uploadedAt: new Date().toISOString(),
                    content: base64
                };
                await saveDocsStore();
                updateDocumentStatus();
            };
            reader.readAsDataURL(file);
        });
    });

    // FINANZAS CRUD
    const STORAGE_KEY = 'finanzas_ingresos_v1';
    const PAGE_SIZE = 5;

    const incomeForm = document.getElementById('incomeForm');
    const incomeDate = document.getElementById('incomeDate');
    const incomeConcept = document.getElementById('incomeConcept');
    const incomeType = document.getElementById('incomeType');
    const incomeCategory = document.getElementById('incomeCategory');
    const incomeMethod = document.getElementById('incomeMethod');
    const incomeAmount = document.getElementById('incomeAmount');
    const incomeNotes = document.getElementById('incomeNotes');
    const searchIncome = document.getElementById('searchIncome');
    const incomeTableBody = document.getElementById('incomeTableBody');
    const incomePagination = document.getElementById('incomePagination');
    const saveIncomeBtn = document.getElementById('saveIncomeBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const summaryMonth = document.getElementById('summaryMonth');
    const totalIncomeValue = document.getElementById('totalIncomeValue');
    const totalExpenseValue = document.getElementById('totalExpenseValue');
    const balanceValue = document.getElementById('balanceValue');
    const recordsCountValue = document.getElementById('recordsCountValue');
    const historyList = document.getElementById('historyList');

    // DIVISAS
    const baseAmountInput = document.getElementById('baseAmount');
    const baseCurrencySelect = document.getElementById('baseCurrency');
    const refreshRatesBtn = document.getElementById('refreshRatesBtn');
    const currencyGrid = document.getElementById('currencyGrid');
    const currencyStatusBadge = document.getElementById('currencyStatusBadge');
    const ratesUpdatedAt = document.getElementById('ratesUpdatedAt');

    const CURRENCY_STORAGE_KEY = 'finanzas_currency_v1';
    const DEFAULT_RATES = {
        EUR: 1,
        USD: 1.09,
        GBP: 0.85,
        JPY: 163.5,
        PEN: 4.05,
        PHP: 62.5
    };
    const CURRENCY_META = {
        EUR: { symbol: '€', flag: '🇪🇺', name: 'Euro' },
        USD: { symbol: '$', flag: '🇺🇸', name: 'Dólar' },
        GBP: { symbol: '£', flag: '🇬🇧', name: 'Libra' },
        JPY: { symbol: '¥', flag: '🇯🇵', name: 'Yen' },
        PEN: { symbol: 'S/', flag: '🇵🇪', name: 'Sol' },
        PHP: { symbol: '₱', flag: '🇵🇭', name: 'Peso Filipino' }
    };

    let ratesState = {
        rates: { ...DEFAULT_RATES },
        updatedAt: null,
        source: 'fallback'
    };

    let incomes = [];
    let editingId = null;
    let currentPage = 1;

    function formatEUR(value) {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value || 0);
    }

    async function loadIncomes() {
        try {
            const remote = await dbGet('incomes');
            if (Array.isArray(remote)) {
                incomes = remote;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(incomes));
                return;
            }

            const raw = localStorage.getItem(STORAGE_KEY);
            incomes = raw ? JSON.parse(raw) : [];
        } catch {
            incomes = [];
        }
    }

    async function saveIncomes() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(incomes));
        await dbSet('incomes', incomes);
    }

    async function loadCurrencyState() {
        try {
            const remote = await dbGet('currency');
            if (remote && typeof remote === 'object') {
                const parsed = remote;
                if (parsed?.rates) ratesState.rates = { ...DEFAULT_RATES, ...parsed.rates };
                if (parsed?.updatedAt) ratesState.updatedAt = parsed.updatedAt;
                if (parsed?.source) ratesState.source = parsed.source;
                if (baseAmountInput && typeof parsed?.baseAmount === 'number') baseAmountInput.value = String(parsed.baseAmount);
                if (baseCurrencySelect && parsed?.baseCurrency && CURRENCY_META[parsed.baseCurrency]) {
                    baseCurrencySelect.value = parsed.baseCurrency;
                }
                localStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(parsed));
                return;
            }

            const raw = localStorage.getItem(CURRENCY_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed?.rates) ratesState.rates = { ...DEFAULT_RATES, ...parsed.rates };
            if (parsed?.updatedAt) ratesState.updatedAt = parsed.updatedAt;
            if (parsed?.source) ratesState.source = parsed.source;
            if (baseAmountInput && typeof parsed?.baseAmount === 'number') baseAmountInput.value = String(parsed.baseAmount);
            if (baseCurrencySelect && parsed?.baseCurrency && CURRENCY_META[parsed.baseCurrency]) {
                baseCurrencySelect.value = parsed.baseCurrency;
            }
        } catch {}
    }

    async function saveCurrencyState() {
        const payload = {
            rates: ratesState.rates,
            updatedAt: ratesState.updatedAt,
            source: ratesState.source,
            baseAmount: Number(baseAmountInput?.value || 0),
            baseCurrency: baseCurrencySelect?.value || 'EUR'
        };
        localStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(payload));
        await dbSet('currency', payload);
    }

    function formatCurrencyByCode(value, code) {
        const amount = Number(value || 0);
        const safeCode = CURRENCY_META[code] ? code : 'EUR';
        try {
            return new Intl.NumberFormat('es-ES', { style: 'currency', currency: safeCode }).format(amount);
        } catch {
            const symbol = CURRENCY_META[safeCode]?.symbol || '';
            return `${symbol}${amount.toFixed(2)}`;
        }
    }

    function updateCurrencyStatus() {
        if (!currencyStatusBadge || !ratesUpdatedAt) return;
        if (ratesState.source === 'api') {
            currencyStatusBadge.textContent = 'Tasas en vivo';
            currencyStatusBadge.classList.add('live');
            currencyStatusBadge.classList.remove('fallback');
        } else {
            currencyStatusBadge.textContent = 'Usando tasas locales';
            currencyStatusBadge.classList.add('fallback');
            currencyStatusBadge.classList.remove('live');
        }

        if (ratesState.updatedAt) {
            const d = new Date(ratesState.updatedAt);
            ratesUpdatedAt.textContent = `Actualizado: ${d.toLocaleString('es-ES')}`;
        } else {
            ratesUpdatedAt.textContent = 'Sin actualización reciente';
        }
    }

    function renderCurrencyGrid() {
        if (!currencyGrid) return;
        const baseCode = baseCurrencySelect?.value || 'EUR';
        const baseAmount = Number(baseAmountInput?.value || 0);
        const baseRate = Number(ratesState.rates[baseCode] || 1);

        const cards = Object.keys(CURRENCY_META).map(code => {
            const rate = Number(ratesState.rates[code] || 0);
            const converted = baseRate > 0 ? (baseAmount / baseRate) * rate : 0;
            const meta = CURRENCY_META[code];
            return `
                <div class="currency-item dynamic-item ${code === baseCode ? 'base-active' : ''}">
                    <span class="flag">${meta.flag}</span>
                    <div>
                        <strong>${code} · ${meta.name}</strong>
                        <p>${formatCurrencyByCode(converted, code)}</p>
                    </div>
                </div>
            `;
        }).join('');

        currencyGrid.innerHTML = cards;
        updateCurrencyStatus();
        saveCurrencyState();
    }

    async function refreshRatesFromApi() {
        try {
            if (refreshRatesBtn) {
                refreshRatesBtn.disabled = true;
                refreshRatesBtn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Actualizando...`;
            }

            const response = await fetch('https://api.exchangerate.host/latest?base=EUR&symbols=EUR,USD,GBP,JPY,PEN,PHP');
            const data = await response.json();

            if (!response.ok || !data || !data.rates) throw new Error('API no disponible');

            ratesState.rates = { ...DEFAULT_RATES, ...data.rates };
            ratesState.updatedAt = new Date().toISOString();
            ratesState.source = 'api';
            renderCurrencyGrid();
        } catch {
            ratesState.rates = { ...DEFAULT_RATES };
            ratesState.updatedAt = new Date().toISOString();
            ratesState.source = 'fallback';
            renderCurrencyGrid();
        } finally {
            if (refreshRatesBtn) {
                refreshRatesBtn.disabled = false;
                refreshRatesBtn.innerHTML = `<i class='bx bx-refresh'></i> Actualizar Tasas`;
            }
        }
    }

    function syncCurrencyBaseWithBalance(balance = 0) {
        if (!baseAmountInput) return;
        const current = Number(baseAmountInput.value || 0);
        if (!current || current === 0) {
            baseAmountInput.value = Math.max(0, Number(balance || 0)).toFixed(2);
            renderCurrencyGrid();
        }
    }

    function getFilteredIncomes() {
        const query = (searchIncome?.value || '').toLowerCase().trim();
        const monthFilter = summaryMonth?.value || '';

        return incomes.filter(item => {
            const byQuery = !query
                || item.concept.toLowerCase().includes(query)
                || item.category.toLowerCase().includes(query)
                || item.method.toLowerCase().includes(query);

            const byMonth = !monthFilter || (item.date && item.date.startsWith(monthFilter));
            return byQuery && byMonth;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    function renderTable() {
        if (!incomeTableBody) return;
        const data = getFilteredIncomes();
        const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;

        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = data.slice(start, start + PAGE_SIZE);

        if (!pageItems.length) {
            incomeTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No hay registros aún.</td></tr>`;
        } else {
            incomeTableBody.innerHTML = pageItems.map(item => `
                <tr>
                    <td>${item.date}</td>
                    <td><span class="type-badge ${item.type === 'Gasto' ? 'expense' : 'income'}">${item.type || 'Ingreso'}</span></td>
                    <td>${item.concept}</td>
                    <td>${item.category}</td>
                    <td>${item.method}</td>
                    <td class="fin-amount ${item.type === 'Gasto' ? 'amount-expense' : 'amount-income'}">${formatEUR(item.amount)}</td>
                    <td>
                        <div class="table-actions">
                            <button class="action-edit" data-action="edit" data-id="${item.id}">Editar</button>
                            <button class="action-delete" data-action="delete" data-id="${item.id}">Eliminar</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

        renderPagination(totalPages);
        renderSummary();
        renderHistory(data);
    }

    function renderPagination(totalPages) {
        if (!incomePagination) return;
        if (totalPages <= 1) {
            incomePagination.innerHTML = '';
            return;
        }

        let html = '';
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        incomePagination.innerHTML = html;
    }

    function getCurrentMonthData() {
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return incomes.filter(item => item.date && item.date.startsWith(monthKey));
    }

    function refreshDashboardFromFinance() {
        const monthData = getCurrentMonthData();
        const totalIncomeMonth = monthData
            .filter(item => (item.type || 'Ingreso') === 'Ingreso')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const totalExpenseMonth = monthData
            .filter(item => (item.type || 'Ingreso') === 'Gasto')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const balanceMonth = totalIncomeMonth - totalExpenseMonth;

        const dashIncomeMonth = document.getElementById('dashIncomeMonth');
        const dashExpenseMonth = document.getElementById('dashExpenseMonth');
        const dashBalanceLocked = document.getElementById('dashBalanceLocked');
        const dashExpenseLocked = document.getElementById('dashExpenseLocked');
        const barIncomeLabel = document.getElementById('barIncomeLabel');
        const barExpenseLabel = document.getElementById('barExpenseLabel');
        const barIncomeFill = document.getElementById('barIncomeFill');
        const barExpenseFill = document.getElementById('barExpenseFill');
        const savingsRing = document.getElementById('savingsRing');
        const savingsPercent = document.getElementById('savingsPercent');
        const savingsText = document.getElementById('savingsText');
        const trendText = document.getElementById('trendText');

        if (dashIncomeMonth) dashIncomeMonth.textContent = formatEUR(totalIncomeMonth);
        if (dashExpenseMonth) dashExpenseMonth.textContent = formatEUR(totalExpenseMonth);

        const saldoMetric = document.querySelector('.metric-saldo');
        const gastosMetric = document.querySelector('.metric-gastos');
        if (dashBalanceLocked && saldoMetric && saldoMetric.classList.contains('censored')) {
            dashBalanceLocked.textContent = '*****';
        } else if (dashBalanceLocked) {
            dashBalanceLocked.textContent = formatEUR(balanceMonth);
        }

        if (dashExpenseLocked && gastosMetric && gastosMetric.classList.contains('censored')) {
            dashExpenseLocked.textContent = '*****';
        } else if (dashExpenseLocked) {
            dashExpenseLocked.textContent = formatEUR(totalExpenseMonth);
        }

        if (barIncomeLabel) barIncomeLabel.textContent = formatEUR(totalIncomeMonth);
        if (barExpenseLabel) barExpenseLabel.textContent = formatEUR(totalExpenseMonth);

        const maxRef = Math.max(totalIncomeMonth, totalExpenseMonth, 1);
        const incomeWidth = Math.min(100, (totalIncomeMonth / maxRef) * 100);
        const expenseWidth = Math.min(100, (totalExpenseMonth / maxRef) * 100);
        if (barIncomeFill) barIncomeFill.style.width = `${incomeWidth}%`;
        if (barExpenseFill) barExpenseFill.style.width = `${expenseWidth}%`;

        const savingPercentValue = totalIncomeMonth > 0
            ? Math.max(0, Math.min(100, Math.round((balanceMonth / totalIncomeMonth) * 100)))
            : 0;

        if (savingsRing) savingsRing.style.setProperty('--percent', savingPercentValue);
        if (savingsPercent) savingsPercent.textContent = `${savingPercentValue}%`;
        if (savingsText) {
            savingsText.textContent = totalIncomeMonth > 0
                ? `${balanceMonth >= 0 ? 'Balance positivo' : 'Balance negativo'} del mes actual`
                : 'Sin datos de ahorro mensual.';
        }

        const last7 = [...monthData]
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(-7);
        const weeklyNet = last7.reduce((sum, item) => {
            return sum + ((item.type || 'Ingreso') === 'Gasto' ? -Number(item.amount || 0) : Number(item.amount || 0));
        }, 0);

        if (trendText) {
            if (!last7.length) trendText.textContent = 'Sin datos suficientes de tendencia.';
            else if (weeklyNet > 0) trendText.textContent = 'Tendencia positiva en la última semana.';
            else if (weeklyNet < 0) trendText.textContent = 'Tendencia negativa en la última semana.';
            else trendText.textContent = 'Tendencia estable en la última semana.';
        }

        const expenseByCategory = {};
        monthData
            .filter(item => (item.type || 'Ingreso') === 'Gasto')
            .forEach(item => {
                const cat = item.category || 'Otro';
                expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(item.amount || 0);
            });

        const sortedCats = Object.entries(expenseByCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4);

        const totalExpenseForCat = sortedCats.reduce((sum, [, v]) => sum + v, 0);

        for (let i = 1; i <= 4; i++) {
            const nameEl = document.getElementById(`catName${i}`);
            const fillEl = document.getElementById(`catFill${i}`);
            const pctEl = document.getElementById(`catPct${i}`);
            const data = sortedCats[i - 1];

            if (!data) {
                if (nameEl) nameEl.textContent = '-';
                if (fillEl) fillEl.style.width = '0%';
                if (pctEl) pctEl.textContent = '0%';
                continue;
            }

            const [name, amount] = data;
            const pct = totalExpenseForCat > 0 ? Math.round((amount / totalExpenseForCat) * 100) : 0;
            if (nameEl) nameEl.textContent = name;
            if (fillEl) fillEl.style.width = `${pct}%`;
            if (pctEl) pctEl.textContent = `${pct}%`;
        }
    }

    function renderSummary() {
        const data = getFilteredIncomes();
        const totalIncome = data
            .filter(item => (item.type || 'Ingreso') === 'Ingreso')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const totalExpense = data
            .filter(item => (item.type || 'Ingreso') === 'Gasto')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const balance = totalIncome - totalExpense;

        if (totalIncomeValue) totalIncomeValue.textContent = formatEUR(totalIncome);
        if (totalExpenseValue) totalExpenseValue.textContent = formatEUR(totalExpense);
        if (balanceValue) balanceValue.textContent = formatEUR(balance);
        if (recordsCountValue) recordsCountValue.textContent = String(data.length);

        syncCurrencyBaseWithBalance(balance);
        refreshDashboardFromFinance();
    }

    function renderHistory(data = getFilteredIncomes()) {
        if (!historyList) return;
        const latest = data.slice(0, 5);

        if (!latest.length) {
            historyList.innerHTML = `<li class="empty-state">Sin movimientos recientes.</li>`;
            return;
        }

        historyList.innerHTML = latest.map(item => `
            <li class="history-item">
                <div>
                    <div class="hist-main">${item.concept}</div>
                    <div class="hist-sub">${item.date} · ${item.category} · ${(item.type || 'Ingreso')}</div>
                </div>
                <div class="hist-amount ${item.type === 'Gasto' ? 'amount-expense' : 'amount-income'}">${formatEUR(item.amount)}</div>
            </li>
        `).join('');
    }

    const CATEGORY_MAP = {
        Ingreso: ['Salario', 'Freelance', 'Ventas', 'Inversión', 'Otro'],
        Gasto: ['Comida', 'Transporte', 'Vivienda', 'Ocio', 'Servicios', 'Salud', 'Educación', 'Otro']
    };

    function rebuildCategoryOptions(type = 'Ingreso', selectedValue = '') {
        if (!incomeCategory) return;
        const options = CATEGORY_MAP[type] || CATEGORY_MAP.Ingreso;

        incomeCategory.innerHTML = `
            <option value="">Seleccionar</option>
            ${options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
        `;

        if (selectedValue && options.includes(selectedValue)) {
            incomeCategory.value = selectedValue;
        } else {
            incomeCategory.value = '';
        }
    }

    function resetForm() {
        if (!incomeForm) return;
        incomeForm.reset();
        if (incomeType) incomeType.value = 'Ingreso';
        rebuildCategoryOptions('Ingreso');
        editingId = null;
        if (saveIncomeBtn) saveIncomeBtn.textContent = 'Guardar Movimiento';
        if (cancelEditBtn) cancelEditBtn.style.display = 'none';
    }

    function startEdit(id) {
        const record = incomes.find(x => x.id === id);
        if (!record) return;

        editingId = id;
        const recordType = record.type || 'Ingreso';
        incomeDate.value = record.date;
        if (incomeType) incomeType.value = recordType;
        rebuildCategoryOptions(recordType, record.category);
        incomeConcept.value = record.concept;
        incomeMethod.value = record.method;
        incomeAmount.value = record.amount;
        incomeNotes.value = record.notes || '';

        if (saveIncomeBtn) saveIncomeBtn.textContent = 'Actualizar Movimiento';
        if (cancelEditBtn) cancelEditBtn.style.display = 'inline-flex';
    }

    async function deleteRecord(id) {
        incomes = incomes.filter(x => x.id !== id);
        await saveIncomes();
        renderTable();
    }

    incomeForm?.addEventListener('submit', async function(e) {
        e.preventDefault();

        const payload = {
            id: editingId || Date.now().toString(),
            type: incomeType?.value || 'Ingreso',
            date: incomeDate.value,
            concept: incomeConcept.value.trim(),
            category: incomeCategory.value,
            method: incomeMethod.value,
            amount: Number(incomeAmount.value || 0),
            notes: incomeNotes.value.trim()
        };

        if (!payload.date || !payload.concept || !payload.category || !payload.method || payload.amount <= 0) return;

        if (editingId) {
            incomes = incomes.map(item => item.id === editingId ? payload : item);
        } else {
            incomes.push(payload);
        }

        await saveIncomes();
        resetForm();
        currentPage = 1;
        renderTable();
    });

    incomeType?.addEventListener('change', () => {
        const selectedType = incomeType.value || 'Ingreso';
        rebuildCategoryOptions(selectedType);
    });

    cancelEditBtn?.addEventListener('click', resetForm);

    baseAmountInput?.addEventListener('input', renderCurrencyGrid);
    baseCurrencySelect?.addEventListener('change', renderCurrencyGrid);
    refreshRatesBtn?.addEventListener('click', refreshRatesFromApi);

    searchIncome?.addEventListener('input', () => {
        currentPage = 1;
        renderTable();
    });

    summaryMonth?.addEventListener('change', () => {
        currentPage = 1;
        renderTable();
    });

    incomePagination?.addEventListener('click', (e) => {
        const btn = e.target.closest('.page-btn');
        if (!btn) return;
        const page = Number(btn.getAttribute('data-page') || 1);
        currentPage = page;
        renderTable();
    });

    incomeTableBody?.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        if (!id || !action) return;

        if (action === 'edit') startEdit(id);
        if (action === 'delete') deleteRecord(id);
    });

    // CONTACTO
    const contactForm = document.getElementById('contactForm');
    const contactFeedback = document.getElementById('contactFeedback');
    const contactPhoneText = document.getElementById('contactPhoneText');
    const contactEmailText = document.getElementById('contactEmailText');

    async function copyText(value, label) {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            if (contactFeedback) {
                contactFeedback.textContent = `${label} copiado correctamente.`;
                contactFeedback.className = 'contact-feedback success';
            }
        } catch {
            if (contactFeedback) {
                contactFeedback.textContent = `No se pudo copiar ${label.toLowerCase()}.`;
                contactFeedback.className = 'contact-feedback error';
            }
        }
    }

    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const target = this.getAttribute('data-copy-target');
            if (target === 'phone') copyText(contactPhoneText?.textContent?.trim(), 'Teléfono');
            if (target === 'email') copyText(contactEmailText?.textContent?.trim(), 'Correo');
        });
    });

    contactForm?.addEventListener('submit', async function(e) {
        e.preventDefault();
        const payload = {
            name: document.getElementById('contactName')?.value?.trim() || '',
            email: document.getElementById('contactEmail')?.value?.trim() || '',
            message: document.getElementById('contactMessage')?.value?.trim() || '',
            createdAt: new Date().toISOString()
        };

        if (!payload.name || !payload.email || !payload.message) {
            if (contactFeedback) {
                contactFeedback.textContent = 'Completa todos los campos del formulario.';
                contactFeedback.className = 'contact-feedback error';
            }
            return;
        }

        try {
            const key = 'contact_messages_v1';
            const current = JSON.parse(localStorage.getItem(key) || '[]');
            current.push(payload);
            localStorage.setItem(key, JSON.stringify(current));

            await dbPush('contactMessages', payload);

            contactForm.reset();
            if (contactFeedback) {
                contactFeedback.textContent = 'Mensaje enviado correctamente.';
                contactFeedback.className = 'contact-feedback success';
            }
        } catch {
            if (contactFeedback) {
                contactFeedback.textContent = 'Error al guardar el mensaje.';
                contactFeedback.className = 'contact-feedback error';
            }
        }
    });

    // Init defaults
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    if (summaryMonth) summaryMonth.value = `${yyyy}-${mm}`;
    if (incomeDate) incomeDate.value = `${yyyy}-${mm}-${String(now.getDate()).padStart(2, '0')}`;

    await loadPinGuard();
    if (isPinLocked()) showLockBanner();
    await loadDocsStore();
    updateDocumentStatus();
    await loadIncomes();
    await loadCurrencyState();
    rebuildCategoryOptions(incomeType?.value || 'Ingreso');
    renderTable();
    renderCurrencyGrid();
    if (!ratesState.updatedAt) refreshRatesFromApi();
});
