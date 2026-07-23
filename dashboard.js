import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

const firebaseConfig = { apiKey:"AIzaSyAapba1gadT0M7ZjnEOIcg4Gj2SPE0HoJU", authDomain:"chalito-collblanc.firebaseapp.com", projectId:"chalito-collblanc", storageBucket:"chalito-collblanc.firebasestorage.app", messagingSenderId:"654415271839", appId:"1:654415271839:web:3bbabebca91415e8d00faa" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const messaging = getMessaging(app);

let currentUser = null, userProfile = null, currentTab = 'vacaciones', editingId = null, editingType = null, uploadedFiles = [], unsubscribers = [], fcmToken = null;
let calendarYear = 2026;
let evidenceFilterMonth = '';
let evidenceFilterStartDate = '';
let evidenceFilterEndDate = '';
let selectedStart = null;
let selectedEnd = null;
let allVacations = [];
let expandedEvidenceId = null;

// ==================== FIX: Local date string helper ====================
function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ==================== AUTH & INIT ====================
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  currentUser = user;
  const userRef = doc(db, 'usuarios', user.uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    userProfile = userSnap.data();
    if (userProfile.rol === 'admin') { window.location.href = 'admin.html'; return; }
  } else { userProfile = { nombre: user.email.split('@')[0], rol: 'empleado' }; }
  document.getElementById('userName').textContent = userProfile.nombre || user.email.split('@')[0];
  document.getElementById('userAvatar').textContent = (userProfile.nombre || user.email)[0].toUpperCase();
  updateConnectionStatus(true);
  setupRealtimeListeners();
  setupPushNotifications();
  updateNotifCount();
});

async function setupPushNotifications() {
  if (!('Notification' in window) || !currentUser) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    // IMPORTANTE: Reemplaza esta clave con tu VAPID key real de Firebase Console
    // Proyecto Settings -> Cloud Messaging -> Web Push certificates -> Key pair
    const vapidKey = 'BKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

    // Validar que la clave no sea el placeholder
    if (!vapidKey || vapidKey.includes('xxxx') || vapidKey.length < 50) {
      console.log('⚠️ Notificaciones push no configuradas: VAPID key no válida. Obtén tu clave en Firebase Console → Project Settings → Cloud Messaging → Web Push certificates.');
      return;
    }
    const token = await getToken(messaging, { vapidKey });
    if (token) { fcmToken = token; await updateDoc(doc(db, 'usuarios', currentUser.uid), { fcmToken: token }); }
    onMessage(messaging, (payload) => { showToast(payload.notification?.body || 'Nueva notificacion', 'info'); updateNotifCount(); });
  } catch (err) { console.log('Push no disponible:', err); }
}

async function updateNotifCount() {
  if (!currentUser) return;
  try {
    const q = query(collection(db, 'notificaciones'), where('userId', '==', currentUser.uid), where('leida', '==', false));
    const snap = await getDocs(q);
    const count = snap.size;
    const badge = document.getElementById('notifCount');
    if (!badge) return;
    if (count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.style.display = 'flex'; }
    else { badge.style.display = 'none'; }
  } catch (err) {
    console.warn('Error actualizando contador de notificaciones:', err);
  }
}

window.showNotifications = async function() {
  if (!currentUser) { showToast('Debes iniciar sesión', 'error'); return; }

  // Reset modal state before showing notifications
  editingId = null; editingType = null; uploadedFiles = [];
  selectedStart = null; selectedEnd = null;

  showLoading(true);
  try {
    const q = query(collection(db, 'notificaciones'), where('userId', '==', currentUser.uid), orderBy('creado', 'desc'));
    const snap = await getDocs(q);
    const notifs = []; snap.forEach(d => notifs.push({ id: d.id, ...d.data() }));

    // Mark all as read
    const unread = notifs.filter(n => !n.leida);
    for (const n of unread) { 
      try { await updateDoc(doc(db, 'notificaciones', n.id), { leida: true }); } 
      catch (e) { console.warn('Error marcando notificación como leída:', e); }
    }
    updateNotifCount();

    // Build modal content
    document.getElementById('modalTitle').textContent = '🔔 Notificaciones';
    const modalBody = document.getElementById('modalBody');

    if (notifs.length === 0) {
      modalBody.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--text-light);">
          <div style="font-size:48px;margin-bottom:12px;">🔔</div>
          <div style="font-weight:600;font-size:16px;color:var(--secondary);margin-bottom:8px;">Sin notificaciones</div>
          <div style="font-size:13px;">No tienes notificaciones pendientes</div>
        </div>`;
    } else {
      modalBody.innerHTML = `
        <div style="max-height:60vh;overflow-y:auto;">
          ${notifs.map(n => {
            const evidenceId = n.data?.evidenceId || n.data?.incidenteId;
            const clickable = evidenceId ? `cursor:pointer;` : '';
            const onclick = evidenceId ? `onclick="closeModal(); switchTab('evidencias'); expandedEvidenceId='${evidenceId}'; renderEvidencias();"` : '';
            return `<div ${onclick} style="padding:16px;border-bottom:1px solid var(--border);${n.leida ? '' : 'background:#E3F2FD;'}border-radius:8px;margin-bottom:8px;transition:all .2s;${clickable}" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='${n.leida ? '' : '#E3F2FD'}'">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:600;font-size:14px;color:var(--secondary);">${n.title}</div>
                  <div style="font-size:13px;color:var(--text-light);margin-top:4px;line-height:1.5;">${n.body}</div>
                </div>
                ${!n.leida ? '<span style="width:8px;height:8px;background:var(--info);border-radius:50%;flex-shrink:0;margin-top:6px;"></span>' : ''}
              </div>
              <div style="font-size:11px;color:#999;margin-top:8px;display:flex;align-items:center;gap:6px;">
                <span>🕐 ${formatFirestoreDate(n.creado)}</span>
                ${evidenceId ? '<span style="color:var(--primary);font-weight:500;">👁️ Ver incidencia</span>' : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
        <div style="text-align:center;padding:12px;border-top:1px solid var(--border);margin-top:8px;">
          <span style="font-size:12px;color:var(--text-light);">${notifs.length} notificación${notifs.length !== 1 ? 'es' : ''}</span>
        </div>`;
    }

    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
  } catch (err) {
    console.error('Error cargando notificaciones:', err);
    showToast('Error cargando notificaciones', 'error');
  } finally {
    showLoading(false);
  }
};

window.logout = async function() {
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];
  await signOut(auth);
  window.location.href = 'index.html';
};

// ==================== REALTIME & STATS ====================
function setupRealtimeListeners() {
  if (!currentUser) return;
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];
  const uid = currentUser.uid;

  // Notificaciones en tiempo real
  const notifQuery = query(collection(db, 'notificaciones'), where('userId', '==', uid), where('leida', '==', false));
  unsubscribers.push(onSnapshot(notifQuery, (snapshot) => {
    const count = snapshot.size;
    const badge = document.getElementById('notifCount');
    if (!badge) return;
    if (count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.style.display = 'flex'; }
    else { badge.style.display = 'none'; }
  }, (err) => { console.warn('Error notificaciones realtime:', err); }));

  const vacQuery = query(collection(db, 'vacaciones'), orderBy('creado', 'desc'));
  unsubscribers.push(onSnapshot(vacQuery, (snapshot) => { 
    const items = []; snapshot.forEach(d => items.push({ id: d.id, ...d.data() })); 
    window._vacaciones = items; 
    allVacations = items;
    if (currentTab === 'vacaciones') renderVacaciones(); 
    updateStats(); 
  }, () => updateConnectionStatus(false)));
  const matQuery = query(collection(db, 'materiales'), where('uid', '==', uid), orderBy('creado', 'desc'));
  unsubscribers.push(onSnapshot(matQuery, (snapshot) => { const items = []; snapshot.forEach(d => items.push({ id: d.id, ...d.data() })); window._materiales = items; if (currentTab === 'materiales') renderMateriales(); updateStats(); }, () => updateConnectionStatus(false)));
  const evQuery = query(collection(db, 'evidencias'), orderBy('creado', 'desc'));
  unsubscribers.push(onSnapshot(evQuery, (snapshot) => { const items = []; snapshot.forEach(d => items.push({ id: d.id, ...d.data() })); window._evidencias = items; if (currentTab === 'evidencias') renderEvidencias(); updateStats(); }, () => updateConnectionStatus(false)));
}

function updateConnectionStatus(online) {
  const status = document.getElementById('connStatus');
  const dot = document.getElementById('connDot');
  const text = document.getElementById('connText');
  if (online) { status.className = 'conn-status conn-online'; dot.textContent = '🟢'; text.textContent = 'Online'; }
  else { status.className = 'conn-status conn-offline'; dot.textContent = '🔴'; text.textContent = 'Offline'; }
}

function updateStats() {
  const vac = window._vacaciones || [];
  const ev = window._evidencias || [];
  const mat = window._materiales || [];
  document.getElementById('statVacaciones').textContent = vac.filter(v => v.uid === currentUser?.uid).length;
  document.getElementById('statEvidencias').textContent = ev.filter(e => e.uid === currentUser?.uid).length;
  document.getElementById('statMateriales').textContent = mat.length;
  const pendientes = vac.filter(v => v.uid === currentUser?.uid && v.estado === 'pendiente').length + ev.filter(e => e.uid === currentUser?.uid && e.estado === 'pendiente').length + mat.filter(m => m.estado === 'pendiente').length;
  document.getElementById('statPendientes').textContent = pendientes;
  document.getElementById('badgeVacaciones').textContent = vac.filter(v => v.uid === currentUser?.uid && v.estado === 'pendiente').length;
  document.getElementById('badgeEvidencias').textContent = ev.filter(e => e.uid === currentUser?.uid && (e.estado === 'pendiente' || e.estado === 'revisado')).length;
  document.getElementById('badgeMateriales').textContent = mat.filter(m => m.estado === 'pendiente').length;
}

window.switchTab = function(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.content-area').forEach(c => c.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  renderCurrentTab();
};

function renderCurrentTab() {
  if (currentTab === 'vacaciones') renderVacaciones();
  else if (currentTab === 'evidencias') renderEvidencias();
  else if (currentTab === 'materiales') renderMateriales();
}

// ==================== HELPERS ====================
function getStatusClass(estado) {
  const map = { pendiente: 'status-pendiente', aprobado: 'status-aprobado', rechazado: 'status-rechazado', enviado: 'status-enviado', entregado: 'status-entregado', revisado: 'status-revisado', cerrado: 'status-cerrado' };
  return map[estado] || 'status-pendiente';
}

function getStatusIcon(estado) {
  const map = { pendiente: '⏳', aprobado: '✅', rechazado: '❌', enviado: '📤', entregado: '📦', revisado: '👁️', cerrado: '🔒' };
  return map[estado] || '⏳';
}

function formatDate(dateVal) {
  if (!dateVal) return '-';
  let date;
  if (dateVal instanceof Timestamp) date = dateVal.toDate();
  else if (typeof dateVal === 'string') date = new Date(dateVal + 'T00:00:00');
  else date = new Date(dateVal);
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatFirestoreDate(dateVal) {
  if (!dateVal) return '-';
  if (dateVal instanceof Timestamp) return dateVal.toDate().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return '-';
}

function calcularDias(inicio, fin) {
  if (!inicio || !fin) return 1;
  const d1 = new Date(inicio + 'T00:00:00');
  const d2 = new Date(fin + 'T00:00:00');
  const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 1;
}

function compareDates(a, b) {
  return new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime();
}

// ==================== CALENDAR HELPERS ====================
function getDaysOfMonth(year, month) {
  const days = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();

  let padBefore = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  for (let i = 0; i < padBefore; i++) {
    days.push({ date: null, dayNum: null, inMonth: false, isToday: false });
  }

  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month, d);
    days.push({
      date: date,
      dayNum: d,
      inMonth: true,
      isToday: isSameDay(date, new Date())
    });
  }

  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 0; i < remaining; i++) {
    days.push({ date: null, dayNum: null, inMonth: false, isToday: false });
  }

  return days;
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function dateInRange(dateStr, startStr, endStr) {
  if (!startStr || !endStr) return false;
  const d = new Date(dateStr + 'T00:00:00').getTime();
  const s = new Date(startStr + 'T00:00:00').getTime();
  const e = new Date(endStr + 'T00:00:00').getTime();
  return d >= s && d <= e;
}

function getWeekStart(date) {
  const d = new Date(date);
  while (d.getDay() !== 1) {
    d.setDate(d.getDate() - 1);
  }
  return toLocalDateStr(d);
}

function getWeekEnd(date) {
  const d = new Date(date);
  while (d.getDay() !== 0) {
    d.setDate(d.getDate() + 1);
  }
  return toLocalDateStr(d);
}

function getBlockedWeeks() {
  const blocked = [];
  const vacs = allVacations || [];
  vacs.forEach(v => {
    if (v.estado === 'rechazado') return;
    if (v.semanaBloqueadaInicio && v.semanaBloqueadaFin) {
      blocked.push({ start: v.semanaBloqueadaInicio, end: v.semanaBloqueadaFin, ownerId: v.uid, ownerName: v.userName || 'Otro empleado' });
    }
  });
  return blocked;
}

function getTakenWeeks() {
  const taken = [];
  const vacs = allVacations || [];
  vacs.forEach(v => {
    if (v.estado === 'rechazado') return;
    if (v.inicio && v.fin) {
      taken.push({ start: v.inicio, end: v.fin, ownerId: v.uid, ownerName: v.userName || 'Otro empleado' });
    }
  });
  return taken;
}

function isWeekBlocked(weekStart, weekEnd) {
  const blocked = getBlockedWeeks();
  for (const b of blocked) {
    const ws = new Date(weekStart); ws.setHours(0,0,0,0);
    const we = new Date(weekEnd); we.setHours(23,59,59,999);
    const bs = new Date(b.start); bs.setHours(0,0,0,0);
    const be = new Date(b.end); be.setHours(23,59,59,999);
    if (ws <= be && we >= bs) return b;
  }
  return null;
}

function isWeekTaken(weekStart, weekEnd) {
  const taken = getTakenWeeks();
  for (const t of taken) {
    const ws = new Date(weekStart); ws.setHours(0,0,0,0);
    const we = new Date(weekEnd); we.setHours(23,59,59,999);
    const ts = new Date(t.start); ts.setHours(0,0,0,0);
    const te = new Date(t.end); te.setHours(23,59,59,999);
    if (ws <= te && we >= ts) return t;
  }
  return null;
}

function isWeekPast(weekStart) {
  const today = new Date(); today.setHours(0,0,0,0);
  const ws = new Date(weekStart); ws.setHours(0,0,0,0);
  return ws < today;
}

function isDatePast(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr + 'T00:00:00');
  return d < today;
}

function isDateInTakenRange(dateStr) {
  const taken = getTakenWeeks();
  for (const t of taken) {
    const d = new Date(dateStr + 'T00:00:00').getTime();
    const ts = new Date(t.start + 'T00:00:00').getTime();
    const te = new Date(t.end + 'T00:00:00').getTime();
    if (d >= ts && d <= te) return t;
  }
  return null;
}

function isDateInBlockedRange(dateStr) {
  const blocked = getBlockedWeeks();
  for (const b of blocked) {
    const d = new Date(dateStr + 'T00:00:00').getTime();
    const bs = new Date(b.start + 'T00:00:00').getTime();
    const be = new Date(b.end + 'T00:00:00').getTime();
    if (d >= bs && d <= be) return b;
  }
  return null;
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function getBlockedDays(afterDate) {
  const start = new Date(afterDate + 'T00:00:00');
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: toLocalDateStr(start), end: toLocalDateStr(end) };
}

// ==================== RENDER FUNCTIONS ====================
function renderVacaciones() {
  const grid = document.getElementById('gridVacaciones');
  const allItems = window._vacaciones || [];
  const myItems = allItems.filter(v => v.uid === currentUser?.uid);
  const otherItems = allItems.filter(v => v.uid !== currentUser?.uid && v.estado !== 'rechazado');
  let html = '';
  if (myItems.length > 0) {
    html += `<div class="vacation-section-title">🏖️ Mis Solicitudes (${myItems.length})</div>`;
    html += myItems.map(v => {
      const dias = v.dias || calcularDias(v.inicio, v.fin);
      const bloqueoText = v.semanaBloqueadaInicio ? `<br><span style="color:#C62828;font-size:11px;">🚫 Bloquea: ${formatShortDate(v.semanaBloqueadaInicio)} - ${formatShortDate(v.semanaBloqueadaFin)}</span>` : '';
      return `<div class="card vacation-mine"><div class="card-header"><div class="card-icon" style="background:#E3F2FD;">🏖️</div><span class="card-status ${getStatusClass(v.estado)}">${v.estado}</span></div><div class="card-title">${v.tipo}</div><div class="card-desc">${v.notas || 'Sin notas adicionales'}</div><div class="card-meta"><span>📅 ${formatDate(v.inicio)} → ${formatDate(v.fin)}</span><span>📆 ${dias} día${dias !== 1 ? 's' : ''}</span></div><div class="card-meta" style="margin-top:8px;"><span style="font-size:11px;color:#999;">Solicitado: ${formatFirestoreDate(v.creado)}${bloqueoText}</span></div><div class="card-actions"><button class="btn btn-secondary" onclick="editItem('vacaciones','${v.id}')">✏️ Editar</button><button class="btn btn-danger" onclick="deleteItem('vacaciones','${v.id}')">🗑️ Eliminar</button></div></div>`;
    }).join('');
  }
  if (otherItems.length > 0) {
    html += `<div class="vacation-section-title">👥 Vacaciones de Compañeros (${otherItems.length})</div>`;
    html += otherItems.map(v => {
      const dias = v.dias || calcularDias(v.inicio, v.fin);
      const bloqueoText = v.semanaBloqueadaInicio ? `<br><span style="color:#C62828;font-size:11px;">🚫 Bloquea: ${formatShortDate(v.semanaBloqueadaInicio)} - ${formatShortDate(v.semanaBloqueadaFin)}</span>` : '';
      return `<div class="card vacation-other"><div class="card-header"><div class="card-icon" style="background:#FFF3E0;">👤</div><span class="card-status ${getStatusClass(v.estado)}">${v.estado}</span></div><div class="card-title">${v.tipo}<span class="employee-name-badge">${v.userName || 'Empleado'}</span></div><div class="card-desc">${v.notas || 'Sin notas adicionales'}</div><div class="card-meta"><span>📅 ${formatDate(v.inicio)} → ${formatDate(v.fin)}</span><span>📆 ${dias} día${dias !== 1 ? 's' : ''}</span></div><div class="card-meta" style="margin-top:8px;"><span style="font-size:11px;color:#999;">Solicitado: ${formatFirestoreDate(v.creado)}${bloqueoText}</span></div></div>`;
    }).join('');
  }
  if (myItems.length === 0 && otherItems.length === 0) {
    html = emptyState('🏖️', 'Sin solicitudes de vacaciones', 'Crea tu primera solicitud seleccionando un rango de fechas en el calendario');
  }
  grid.innerHTML = html;
}

// ==================== EVIDENCIAS: LISTA EXPANDIBLE ====================
const TIPOS_INCIDENTE = [
  'Incidente en reparto',
  'Daño en producto',
  'Cliente no disponible',
  'Retraso en restaurante',
  'Pedido incorrecto',
  'Accidente de tráfico',
  'Problema con la app',
  'Robo o hurto',
  'Condiciones climáticas',
  'Problema de dirección',
  'Cliente agresivo',
  'Vehículo averiado',
  'Otro'
];

function renderEvidencias() {
  const grid = document.getElementById('gridEvidencias');
  let items = window._evidencias || [];

  // Apply date filters
  if (evidenceFilterMonth) {
    items = items.filter(e => e.fecha && e.fecha.startsWith(evidenceFilterMonth));
  }
  if (evidenceFilterStartDate && evidenceFilterEndDate) {
    items = items.filter(e => e.fecha >= evidenceFilterStartDate && e.fecha <= evidenceFilterEndDate);
  } else if (evidenceFilterStartDate) {
    items = items.filter(e => e.fecha >= evidenceFilterStartDate);
  } else if (evidenceFilterEndDate) {
    items = items.filter(e => e.fecha <= evidenceFilterEndDate);
  }

  // Build filter bar HTML
  const months = [
    { value: '', label: '📅 Todos los meses' },
    { value: '2026-01', label: 'Enero 2026' }, { value: '2026-02', label: 'Febrero 2026' },
    { value: '2026-03', label: 'Marzo 2026' }, { value: '2026-04', label: 'Abril 2026' },
    { value: '2026-05', label: 'Mayo 2026' }, { value: '2026-06', label: 'Junio 2026' },
    { value: '2026-07', label: 'Julio 2026' }, { value: '2026-08', label: 'Agosto 2026' },
    { value: '2026-09', label: 'Septiembre 2026' }, { value: '2026-10', label: 'Octubre 2026' },
    { value: '2026-11', label: 'Noviembre 2026' }, { value: '2026-12', label: 'Diciembre 2026' },
    { value: '2025-01', label: 'Enero 2025' }, { value: '2025-02', label: 'Febrero 2025' },
    { value: '2025-03', label: 'Marzo 2025' }, { value: '2025-04', label: 'Abril 2025' },
    { value: '2025-05', label: 'Mayo 2025' }, { value: '2025-06', label: 'Junio 2025' },
    { value: '2025-07', label: 'Julio 2025' }, { value: '2025-08', label: 'Agosto 2025' },
    { value: '2025-09', label: 'Septiembre 2025' }, { value: '2025-10', label: 'Octubre 2025' },
    { value: '2025-11', label: 'Noviembre 2025' }, { value: '2025-12', label: 'Diciembre 2025' }
  ];

  const monthOptions = months.map(m => `<option value="${m.value}" ${evidenceFilterMonth === m.value ? 'selected' : ''}>${m.label}</option>`).join('');
  const hasFilters = evidenceFilterMonth || evidenceFilterStartDate || evidenceFilterEndDate;
  const filterCount = items.length;

  let filterBarHtml = `
    <div style="background:var(--card);border-radius:var(--radius);padding:16px 20px;margin-bottom:20px;box-shadow:var(--shadow);">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:200px;">
          <span style="font-size:13px;font-weight:600;color:var(--secondary);white-space:nowrap;">📅 Mes:</span>
          <select id="evidenceMonthFilter" onchange="filterEvidenceByMonth(this.value)" 
            style="flex:1;padding:10px 14px;border:2px solid var(--border);border-radius:var(--radius-sm);font-family:inherit;font-size:13px;background:var(--bg);cursor:pointer;min-width:160px;">
            ${monthOptions}
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:280px;">
          <span style="font-size:13px;font-weight:600;color:var(--secondary);white-space:nowrap;">📆 Rango:</span>
          <input type="date" id="evidenceDateStart" value="${evidenceFilterStartDate}" onchange="filterEvidenceByDateRange()"
            style="flex:1;padding:10px 14px;border:2px solid var(--border);border-radius:var(--radius-sm);font-family:inherit;font-size:13px;background:var(--bg);min-width:120px;">
          <span style="color:var(--text-light);font-size:13px;">→</span>
          <input type="date" id="evidenceDateEnd" value="${evidenceFilterEndDate}" onchange="filterEvidenceByDateRange()"
            style="flex:1;padding:10px 14px;border:2px solid var(--border);border-radius:var(--radius-sm);font-family:inherit;font-size:13px;background:var(--bg);min-width:120px;">
        </div>
        ${hasFilters ? `<button onclick="resetEvidenceFilters()" class="btn btn-danger" style="font-size:12px;padding:8px 14px;">🗑️ Limpiar filtros</button>` : ''}
      </div>
      ${hasFilters ? `<div style="margin-top:10px;font-size:12px;color:var(--primary);font-weight:500;">📊 Mostrando ${filterCount} de ${(window._evidencias || []).length} incidencias</div>` : ''}
    </div>
  `;

  if (items.length === 0) { 
    grid.innerHTML = filterBarHtml + emptyState('📸', 'Sin incidencias en este período', 'Prueba con otros filtros o fechas'); 
    return; 
  }

  // Build compact list
  let html = filterBarHtml + '<div class="evidence-list-container">';

  items.forEach(e => {
    const isOwner = e.uid === currentUser?.uid;
    const hasLink = !!(e.videoUrl || e.videoLink);
    const isCerrado = e.estado === 'cerrado';
    const isExpanded = expandedEvidenceId === e.id;

    // Compact row (always visible)
    const pedidoDisplay = e.numeroPedido ? `#${e.numeroPedido}` : (e.numeroRecogida ? `Recogida #${e.numeroRecogida}` : 'Sin número');
    const linkIndicator = hasLink ? ' 🎥' : '';
    const statusDot = isCerrado ? '🔒' : (e.estado === 'revisado' ? '👁️' : '⏳');
    const statusColor = isCerrado ? '#546E7A' : (e.estado === 'revisado' ? '#00838F' : '#E65100');

    // Build detail HTML inline (avoid function call in template literal)
    let detailHtml = '';
    if (isExpanded) {
      let detailsHtml = '';
      if (e.numeroPedido || e.numeroRecogida) {
        detailsHtml += `<div class="evidence-detail-box"><div class="evidence-detail-row">`;
        if (e.numeroPedido) detailsHtml += `<span>🛒 Pedido: <strong>#${e.numeroPedido}</strong></span>`;
        if (e.numeroRecogida) detailsHtml += `<span>📋 Recogida: <strong>#${e.numeroRecogida}</strong></span>`;
        detailsHtml += `</div></div>`;
      }

      let commentHtml = '';
      if (e.comentario) {
        commentHtml = `<div class="comment-box">
          <div class="comment-box-title">💬 Comentario</div>
          <div class="comment-box-text">${e.comentario}</div>
        </div>`;
      }

      let videoHtml = '';
      if (hasLink) {
        const videoUrl = e.videoUrl || e.videoLink;
        videoHtml = `<div style="margin-top:16px;padding:12px;background:#E8F5E9;border-radius:var(--radius-sm);">
          <div style="font-size:13px;font-weight:600;color:#2E7D32;margin-bottom:8px;">🎥 Video de respuesta disponible</div>
          <a href="${videoUrl}" target="_blank" class="btn download-btn" style="width:100%;justify-content:center;">🔗 Ver video de respuesta</a>
        </div>`;
      } else if (isOwner && !isCerrado) {
        videoHtml = `<div style="margin-top:12px;padding:10px;background:#FFF3E0;border-radius:var(--radius-sm);font-size:12px;color:#E65100;">⏳ Esperando video de respuesta del administrador...</div>`;
      }

      let actionsHtml = '';
      if (isOwner) {
        actionsHtml = `<div class="card-actions">`;
        if (!isCerrado) {
          actionsHtml += `<button class="btn btn-secondary" onclick="event.stopPropagation(); editItem('evidencias','${e.id}')">✏️ Editar</button>`;
        }
        if (e.estado === 'revisado') {
          actionsHtml += `<button class="btn btn-secondary" onclick="event.stopPropagation(); toggleIncidenteCerrado('${e.id}', true)">🔒 Cerrar</button>`;
        } else if (isCerrado) {
          actionsHtml += `<button class="btn btn-info" onclick="event.stopPropagation(); toggleIncidenteCerrado('${e.id}', false)">🔓 Reabrir</button>`;
        }
        actionsHtml += `<button class="btn btn-danger" onclick="event.stopPropagation(); deleteItem('evidencias','${e.id}')">🗑️ Eliminar</button></div>`;
      }

      const imagenesHtml = e.imagenes && Array.isArray(e.imagenes) && e.imagenes.length > 0
        ? `<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">${e.imagenes.map(img => `<img src="${img}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer;" onclick="event.stopPropagation(); window.open('${img}')">`).join('')}</div>`
        : '';

      detailHtml = `
        <div class="evidence-detail" onclick="event.stopPropagation()">
          <div class="card-desc" style="margin-top:12px;">${e.descripcion}</div>
          ${detailsHtml}
          ${commentHtml}
          <div class="card-meta" style="margin-top:12px;">
            <span>📅 ${formatDate(e.fecha)} ${e.hora || ''}</span>
            <span>👤 ${e.userName || 'Empleado'}</span>
          </div>
          ${imagenesHtml}
          ${videoHtml}
          <div class="card-meta" style="margin-top:8px;">
            <span style="font-size:11px;color:#999;">Registrado: ${formatFirestoreDate(e.creado)}</span>
          </div>
          ${actionsHtml}
        </div>
      `;
    }

    html += `
      <div class="evidence-list-item ${isExpanded ? 'expanded' : ''} ${isCerrado ? 'closed' : ''}" onclick="toggleEvidenceDetail('${e.id}')">
        <div class="evidence-list-row">
          <div class="evidence-list-main">
            <span class="evidence-list-pedido">🛒 ${pedidoDisplay}${linkIndicator}</span>
            <span class="evidence-list-tipo">${e.tipo}</span>
          </div>
          <div class="evidence-list-meta">
            <span class="evidence-list-status" style="color:${statusColor}">${statusDot} ${e.estado}</span>
            <span class="evidence-list-date">${formatDate(e.fecha)}</span>
            <span class="evidence-list-arrow">${isExpanded ? '▲' : '▼'}</span>
          </div>
        </div>
        ${detailHtml}
      </div>
    `;
  });

  html += '</div>';
  grid.innerHTML = html;
}

// Expose to window for inline onclick handlers
window.renderEvidencias = renderEvidencias;

window.toggleEvidenceDetail = function(id) {
  const items = window._evidencias || [];
  const e = items.find(item => item.id === id);
  if (!e) return;

  if (expandedEvidenceId === id) {
    expandedEvidenceId = null;
  } else {
    expandedEvidenceId = id;
  }
  renderEvidencias();
};

// ==================== EVIDENCE FILTERS ====================
window.filterEvidenceByMonth = function(monthValue) {
  evidenceFilterMonth = monthValue;
  evidenceFilterStartDate = '';
  evidenceFilterEndDate = '';
  expandedEvidenceId = null;
  renderEvidencias();
};

window.filterEvidenceByDateRange = function() {
  evidenceFilterMonth = '';
  evidenceFilterStartDate = document.getElementById('evidenceDateStart').value;
  evidenceFilterEndDate = document.getElementById('evidenceDateEnd').value;
  expandedEvidenceId = null;
  renderEvidencias();
};

window.resetEvidenceFilters = function() {
  evidenceFilterMonth = '';
  evidenceFilterStartDate = '';
  evidenceFilterEndDate = '';
  expandedEvidenceId = null;
  renderEvidencias();
};
function renderMateriales() {
  const grid = document.getElementById('gridMateriales');
  const items = window._materiales || [];
  if (items.length === 0) { grid.innerHTML = emptyState('📦', 'Sin solicitudes de materiales', 'Solicita el material que necesites para tus repartos'); return; }
  const urgenciaEmoji = { alta: '🔴', media: '🟡', baja: '🟢' };
  grid.innerHTML = items.map(m => `<div class="card"><div class="card-header"><div class="card-icon" style="background:#F3E5F5;">📦</div><span class="card-status ${getStatusClass(m.estado)}">${m.estado}</span></div><div class="card-title">${m.item}</div><div class="card-desc">Cantidad solicitada: <strong>${m.cantidad}</strong> unidad${m.cantidad > 1 ? 'es' : ''}</div><div class="card-meta"><span>${urgenciaEmoji[m.urgencia] || '⚪'} Urgencia ${m.urgencia}</span></div><div class="card-meta" style="margin-top:8px;"><span style="font-size:11px;color:#999;">Solicitado: ${formatFirestoreDate(m.creado)}</span></div><div class="card-actions"><button class="btn btn-secondary" onclick="editItem('materiales','${m.id}')">✏️ Editar</button><button class="btn btn-danger" onclick="deleteItem('materiales','${m.id}')">🗑️ Eliminar</button></div></div>`).join('');
}

// Expose render functions to window for inline handlers
window.renderVacaciones = renderVacaciones;
window.renderMateriales = renderMateriales;

function emptyState(icon, title, desc) {
  return `<div class="empty-state"><div class="empty-state-icon">${icon}</div><div class="empty-state-title">${title}</div><div class="empty-state-desc">${desc}</div></div>`;
}

// ==================== CALENDAR RENDER ====================
function renderCalendar() {
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dayNames = ['Lun','Mar','Mie','Jue','Vie','Sab','Dom'];

  let guideText = '';
  if (!selectedStart && !selectedEnd) {
    guideText = '👉 <strong>Paso 1:</strong> Selecciona la <strong>fecha de inicio</strong> de tus vacaciones.';
  } else if (selectedStart && !selectedEnd) {
    guideText = `✅ Inicio: <strong>${formatShortDate(selectedStart)}</strong> &nbsp;|&nbsp; 👉 <strong>Paso 2:</strong> Selecciona la <strong>fecha de fin</strong>.`;
  } else {
    const dias = calcularDias(selectedStart, selectedEnd);
    guideText = `✅ Rango: <strong>${formatShortDate(selectedStart)} → ${formatShortDate(selectedEnd)}</strong> (${dias} día${dias !== 1 ? 's' : ''})`;
  }

  let html = '';
  html += `<div style="background:#E3F2FD;padding:12px 16px;border-radius:10px;margin-bottom:16px;font-size:13px;color:#1565C0;">${guideText}</div>`;

  html += `<div class="week-legend">
    <div class="week-legend-item"><div class="legend-dot legend-available"></div> Disponible</div>
    <div class="week-legend-item"><div class="legend-dot legend-selected"></div> Seleccionado</div>
    <div class="week-legend-item"><div class="legend-dot legend-own"></div> Tu reserva</div>
    <div class="week-legend-item"><div class="legend-dot legend-taken-other"></div> De compañero</div>
    <div class="week-legend-item"><div class="legend-dot legend-blocked"></div> Bloqueada</div>
    <div class="week-legend-item"><div class="legend-dot legend-past"></div> Pasada</div>
  </div>`;

  html += `<div class="calendar-container">
    <div class="calendar-header">
      <button class="calendar-nav-btn" onclick="changeYear(-1)">◀ ${calendarYear - 1}</button>
      <div class="calendar-year">📅 ${calendarYear}</div>
      <button class="calendar-nav-btn" onclick="changeYear(1)">${calendarYear + 1} ▶</button>
    </div>
    <div class="months-grid">`;

  for (let m = 0; m < 12; m++) {
    const days = getDaysOfMonth(calendarYear, m);
    html += `<div class="month-card">
      <div class="month-name">${months[m]}</div>
      <div class="days-grid">
        ${dayNames.map(d => `<div class="day-header">${d}</div>`).join('')}`;

    days.forEach(d => {
      if (!d.date) {
        html += `<div class="day-cell" style="visibility:hidden;"></div>`;
        return;
      }

      const dateStr = toLocalDateStr(d.date);
      const weekStartStr = getWeekStart(d.date);
      const weekEndStr = getWeekEnd(d.date);

      const takenInfo = isDateInTakenRange(dateStr);
      const blockedInfo = isDateInBlockedRange(dateStr);
      const isPast = isDatePast(dateStr);

      const isSelectedStart = selectedStart === dateStr;
      const isSelectedEnd = selectedEnd === dateStr;
      const isInSelectedRange = selectedStart && selectedEnd && dateInRange(dateStr, selectedStart, selectedEnd);
      const isSelectedMid = isInSelectedRange && !isSelectedStart && !isSelectedEnd;

      let dayClass = 'day-cell';
      let clickable = false;
      let ownerLabel = '';

      if (isSelectedStart) {
        dayClass += ' selected-start';
      } else if (isSelectedEnd) {
        dayClass += ' selected-end';
      } else if (isSelectedMid) {
        dayClass += ' selected-mid';
      } else if (takenInfo && takenInfo.ownerId === currentUser?.uid) {
        dayClass += ' own-week';
        ownerLabel = '<span class="week-owner-label">YO</span>';
      } else if (takenInfo) {
        dayClass += ' taken-other';
        const shortName = (takenInfo.ownerName || 'Otro').split(' ')[0];
        ownerLabel = `<span class="week-owner-label">${shortName.substring(0,6)}</span>`;
      } else if (blockedInfo) {
        dayClass += ' blocked';
        const shortName = (blockedInfo.ownerName || 'Otro').split(' ')[0];
        ownerLabel = `<span class="week-owner-label">${shortName.substring(0,6)}</span>`;
      } else if (isPast) {
        dayClass += ' past';
      } else {
        dayClass += ' available';
        clickable = true;
      }

      const onclickAttr = clickable ? `onclick="selectDate('${dateStr}')"` : '';
      const titleAttr = blockedInfo ? `title="Bloqueada por ${blockedInfo.ownerName}"` : takenInfo ? `title="Reservada por ${takenInfo.ownerName}"` : '';

      html += `<div class="${dayClass}" ${onclickAttr} ${titleAttr}>${d.dayNum}${ownerLabel}</div>`;
    });

    html += `</div></div>`;
  }

  html += `</div></div>`;

  if (selectedStart && selectedEnd) {
    const dias = calcularDias(selectedStart, selectedEnd);
    const nextWeek = getBlockedDays(selectedEnd);
    html += `<div class="vacation-summary">
      <div class="vacation-summary-title">📋 Resumen de tu selección</div>
      <div class="vacation-summary-text">
        <strong>Fecha inicio:</strong> ${formatShortDate(selectedStart)}<br>
        <strong>Fecha fin:</strong> ${formatShortDate(selectedEnd)}<br>
        <strong>Total días:</strong> ${dias} día${dias !== 1 ? 's' : ''}<br>
        <strong>Semana bloqueada automáticamente:</strong> ${formatShortDate(nextWeek.start)} - ${formatShortDate(nextWeek.end)}<br>
        <span style="color:var(--danger);">⚠️ La semana siguiente a tu rango quedará no disponible para todos.</span>
      </div>
    </div>`;
  } else if (selectedStart && !selectedEnd) {
    html += `<div class="vacation-summary">
      <div class="vacation-summary-title">📋 Selección en curso</div>
      <div class="vacation-summary-text">
        <strong>Inicio seleccionado:</strong> ${formatShortDate(selectedStart)}<br>
        <span style="color:var(--info);">ℹ️ Ahora selecciona la fecha de fin.</span>
      </div>
    </div>`;
  }

  return html;
}

window.changeYear = function(delta) {
  calendarYear += delta;
  selectedStart = null;
  selectedEnd = null;
  refreshVacationModal();
};

window.selectDate = function(dateStr) {
  if (!selectedStart) {
    const blockedInfo = isDateInBlockedRange(dateStr);
    const takenInfo = isDateInTakenRange(dateStr);
    if (blockedInfo) { showToast(`Fecha bloqueada por ${blockedInfo.ownerName}`, 'error'); return; }
    if (takenInfo) { showToast(`Fecha reservada por ${takenInfo.ownerName}`, 'error'); return; }
    if (isDatePast(dateStr)) { showToast('No puedes seleccionar una fecha pasada', 'error'); return; }
    selectedStart = dateStr;
    refreshVacationModal();
    return;
  }

  if (selectedStart && !selectedEnd) {
    if (compareDates(dateStr, selectedStart) < 0) {
      showToast('La fecha de fin debe ser igual o posterior a la de inicio', 'error');
      return;
    }

    let current = new Date(selectedStart);
    const end = new Date(dateStr);
    while (current <= end) {
      const checkStr = toLocalDateStr(current);
      const blockedInfo = isDateInBlockedRange(checkStr);
      const takenInfo = isDateInTakenRange(checkStr);
      if (blockedInfo && blockedInfo.ownerId !== currentUser?.uid) {
        showToast(`El rango incluye fecha bloqueada por ${blockedInfo.ownerName}`, 'error');
        return;
      }
      if (takenInfo && takenInfo.ownerId !== currentUser?.uid) {
        showToast(`El rango incluye fecha reservada por ${takenInfo.ownerName}`, 'error');
        return;
      }
      current.setDate(current.getDate() + 1);
    }

    selectedEnd = dateStr;
    refreshVacationModal();
    return;
  }

  selectedStart = dateStr;
  selectedEnd = null;
  refreshVacationModal();
};

function refreshVacationModal() {
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  title.textContent = editingId ? 'Editar Vacaciones' : 'Nueva Solicitud de Vacaciones';
  let item = null;
  if (editingId) {
    const arr = window._vacaciones || [];
    item = arr.find(x => x.id === editingId);
    if (item && !selectedStart) { selectedStart = item.inicio; selectedEnd = item.fin; }
  }
  body.innerHTML = `
    <div class="form-group">
      <label class="form-label">Tipo de ausencia</label>
      <select class="form-select" id="vTipo">
        <option ${item?.tipo === 'Vacaciones anuales' ? 'selected' : ''}>Vacaciones anuales</option>
        <option ${item?.tipo === 'Dia personal' ? 'selected' : ''}>Dia personal</option>
        <option ${item?.tipo === 'Baja medica' ? 'selected' : ''}>Baja medica</option>
        <option ${item?.tipo === 'Permiso especial' ? 'selected' : ''}>Permiso especial</option>
      </select>
    </div>
    ${renderCalendar()}
    <div class="form-group">
      <label class="form-label">Notas / Motivo</label>
      <textarea class="form-textarea" id="vNotas" placeholder="Describe el motivo de tu ausencia...">${item?.notas || ''}</textarea>
    </div>
    <button class="btn btn-primary" style="width:100%;padding:14px;justify-content:center;" onclick="saveVacaciones()">${editingId ? '💾 Guardar cambios' : '✅ Crear solicitud'}</button>
  `;
}

// ==================== MODAL ====================
window.openModal = function(type = currentTab, id = null) {
  editingId = id; editingType = type; uploadedFiles = [];
  selectedStart = null; selectedEnd = null;
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  let item = null;
  if (id) { const arr = type === 'vacaciones' ? window._vacaciones : type === 'evidencias' ? window._evidencias : window._materiales; item = arr.find(x => x.id === id); }
  if (type === 'vacaciones') {
    calendarYear = 2026;
    if (item) { selectedStart = item.inicio; selectedEnd = item.fin; }
    refreshVacationModal();
  } else if (type === 'evidencias') {
    title.textContent = id ? 'Editar Incidencia' : 'Nueva Incidencia';
    body.innerHTML = renderEvidenciaForm(item);
  } else if (type === 'materiales') {
    title.textContent = id ? 'Editar Material' : 'Nueva Solicitud de Material';
    body.innerHTML = `<div class="form-group"><label class="form-label">Material solicitado</label><input type="text" class="form-input" id="mItem" placeholder="Ej: Mochila termica, cargador..." value="${item?.item || ''}"></div><div class="form-row"><div class="form-group"><label class="form-label">Cantidad</label><input type="number" class="form-input" id="mCantidad" min="1" value="${item?.cantidad || 1}"></div><div class="form-group"><label class="form-label">Urgencia</label><select class="form-select" id="mUrgencia"><option value="baja" ${item?.urgencia === 'baja' ? 'selected' : ''}>🟢 Baja</option><option value="media" ${item?.urgencia === 'media' ? 'selected' : ''}>🟡 Media</option><option value="alta" ${item?.urgencia === 'alta' ? 'selected' : ''}>🔴 Alta</option></select></div></div><button class="btn btn-primary" style="width:100%;padding:14px;justify-content:center;" onclick="saveMaterial()">${id ? '💾 Guardar cambios' : '📦 Solicitar material'}</button>`;
  }
  document.getElementById('modalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
};

function renderEvidenciaForm(item) {
  const tipoOptions = TIPOS_INCIDENTE.map(t => `<option ${item?.tipo === t ? 'selected' : ''}>${t}</option>`).join('');
  return `<div class="form-group">
      <label class="form-label">Tipo de incidencia</label>
      <select class="form-select" id="eTipo">${tipoOptions}</select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Nº de pedido</label>
        <input type="text" class="form-input" id="eNumeroPedido" placeholder="Ej: 12345" value="${item?.numeroPedido || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Nº de recogida</label>
        <input type="text" class="form-input" id="eNumeroRecogida" placeholder="Ej: 678" value="${item?.numeroRecogida || ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Fecha del incidente</label>
        <input type="date" class="form-input" id="eFecha" value="${item?.fecha || toLocalDateStr(new Date())}">
      </div>
      <div class="form-group">
        <label class="form-label">Hora del incidente</label>
        <input type="time" class="form-input" id="eHora" value="${item?.hora || new Date().toTimeString().slice(0, 5)}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Descripción detallada</label>
      <textarea class="form-textarea" id="eDesc" placeholder="Describe lo ocurrido con el máximo detalle posible...">${item?.descripcion || ''}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Comentario adicional (opcional)</label>
      <textarea class="form-textarea" id="eComentario" placeholder="Añade cualquier información extra relevante..." style="min-height:60px;">${item?.comentario || ''}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Adjuntar fotos</label>
      <div class="file-upload" onclick="document.getElementById('fileInput').click()">
        <div class="file-upload-icon">📁</div>
        <div class="file-upload-text">Toca para seleccionar imagenes</div>
        <input type="file" id="fileInput" multiple accept="image/*" style="display:none" onchange="handleFileSelect(this)">
      </div>
      <div id="fileList" style="margin-top:8px;font-size:12px;color:var(--text-light);"></div>
    </div>
    <button class="btn btn-primary" style="width:100%;padding:14px;justify-content:center;" onclick="saveEvidencia()">${item ? '💾 Guardar cambios' : '📤 Registrar incidencia'}</button>`;
}

window.closeModal = function() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
  editingId = null; editingType = null; uploadedFiles = [];
  selectedStart = null; selectedEnd = null;
};
window.closeModalOnOverlay = function(e) { if (e.target === e.currentTarget) closeModal(); };

// ==================== SAVE FUNCTIONS ====================
window.saveVacaciones = async function() {
  if (!currentUser) { showToast('Debes iniciar sesion', 'error'); return; }
  if (!selectedStart || !selectedEnd) { showToast('Selecciona un rango de fechas completo', 'error'); return; }
  const tipo = document.getElementById('vTipo').value;
  const notas = document.getElementById('vNotas').value;
  const inicio = selectedStart;
  const fin = selectedEnd;
  const dias = calcularDias(inicio, fin);
  const nextWeek = getBlockedDays(fin);

  let current = new Date(inicio);
  const end = new Date(fin);
  while (current <= end) {
    const checkStr = toLocalDateStr(current);
    const takenInfo = isDateInTakenRange(checkStr);
    if (takenInfo && (!editingId || takenInfo.ownerId !== currentUser.uid)) {
      showToast('El rango incluye fecha reservada por ' + takenInfo.ownerName, 'error');
      return;
    }
    current.setDate(current.getDate() + 1);
  }

  const blockedCheck = isWeekBlocked(nextWeek.start, nextWeek.end);
  if (blockedCheck && (!editingId || blockedCheck.ownerId !== currentUser.uid)) {
    showToast('La semana siguiente ya esta bloqueada por ' + blockedCheck.ownerName, 'error');
    return;
  }

  showLoading(true);
  try {
    if (editingId) {
      await updateDoc(doc(db, 'vacaciones', editingId), {
        tipo, inicio, fin, dias, notas,
        semanaBloqueadaInicio: nextWeek.start,
        semanaBloqueadaFin: nextWeek.end,
        actualizado: serverTimestamp()
      });
      showToast('Vacaciones actualizadas', 'success');
    } else {
      await addDoc(collection(db, 'vacaciones'), {
        tipo, inicio, fin, dias, notas,
        estado: 'pendiente',
        uid: currentUser.uid,
        userName: userProfile?.nombre || currentUser.email.split('@')[0],
        semanaBloqueadaInicio: nextWeek.start,
        semanaBloqueadaFin: nextWeek.end,
        creado: serverTimestamp()
      });
      showToast(`Solicitud creada: ${dias} días. La siguiente semana ha sido bloqueada.`, 'success');
    }
    closeModal();
  } catch (err) { showToast('Error: ' + err.message, 'error'); } finally { showLoading(false); }
};

window.saveEvidencia = async function() {
  if (!currentUser) { showToast('Debes iniciar sesion', 'error'); return; }
  const tipo = document.getElementById('eTipo').value;
  const numeroPedido = document.getElementById('eNumeroPedido').value.trim();
  const numeroRecogida = document.getElementById('eNumeroRecogida').value.trim();
  const fecha = document.getElementById('eFecha').value;
  const hora = document.getElementById('eHora').value;
  const descripcion = document.getElementById('eDesc').value.trim();
  const comentario = document.getElementById('eComentario').value.trim();

  if (!descripcion) { showToast('Describe el incidente', 'error'); return; }
  if (!fecha) { showToast('Indica la fecha del incidente', 'error'); return; }

  showLoading(true);
  try {
    let imageUrls = [];
    if (uploadedFiles.length > 0) { 
      for (const file of uploadedFiles) { 
        const storageRef = ref(storage, `evidencias/${currentUser.uid}/${Date.now()}_${file.name}`); 
        await uploadBytes(storageRef, file); 
        const url = await getDownloadURL(storageRef); 
        imageUrls.push(url); 
      } 
    }

    const data = {
      tipo,
      numeroPedido: numeroPedido || null,
      numeroRecogida: numeroRecogida || null,
      fecha,
      hora,
      descripcion,
      comentario: comentario || null,
      estado: 'pendiente',
      uid: currentUser.uid,
      userName: userProfile?.nombre || currentUser.email.split('@')[0],
      userEmail: currentUser.email,
      actualizado: serverTimestamp()
    };

    if (editingId) {
      if (imageUrls.length > 0) data.imagenes = imageUrls;
      await updateDoc(doc(db, 'evidencias', editingId), data);
      showToast('Incidencia actualizada', 'success');
    } else {
      data.imagenes = imageUrls;
      data.creado = serverTimestamp();
      await addDoc(collection(db, 'evidencias'), data);
      showToast('Incidencia registrada correctamente', 'success');
    }
    closeModal();
  } catch (err) { showToast('Error: ' + err.message, 'error'); } finally { showLoading(false); }
};

window.saveMaterial = async function() {
  if (!currentUser) { showToast('Debes iniciar sesion', 'error'); return; }
  const item = document.getElementById('mItem').value.trim();
  const cantidad = parseInt(document.getElementById('mCantidad').value) || 1;
  const urgencia = document.getElementById('mUrgencia').value;
  if (!item) { showToast('Indica el material', 'error'); return; }
  showLoading(true);
  try {
    if (editingId) { await updateDoc(doc(db, 'materiales', editingId), { item, cantidad, urgencia, actualizado: serverTimestamp() }); showToast('Material actualizado', 'success'); }
    else { await addDoc(collection(db, 'materiales'), { item, cantidad, urgencia, estado: 'pendiente', uid: currentUser.uid, creado: serverTimestamp() }); showToast('Material solicitado', 'success'); }
    closeModal();
  } catch (err) { showToast('Error: ' + err.message, 'error'); } finally { showLoading(false); }
};

// ==================== CLOSE/REOPEN INCIDENT ====================
window.toggleIncidenteCerrado = async function(id, cerrar) {
  if (!currentUser) return;
  showLoading(true);
  try {
    await updateDoc(doc(db, 'evidencias', id), {
      estado: cerrar ? 'cerrado' : 'revisado',
      cerradoPor: currentUser.uid,
      cerradoEn: serverTimestamp(),
      actualizado: serverTimestamp()
    });
    showToast(cerrar ? '🔒 Incidente cerrado' : '🔓 Incidente reabierto', 'success');
  } catch (err) { 
    showToast('Error: ' + err.message, 'error'); 
  } finally { 
    showLoading(false); 
  }
};

window.editItem = function(type, id) { openModal(type, id); };
window.deleteItem = async function(type, id) {
  if (!confirm('¿Eliminar este registro permanentemente?')) return;
  showLoading(true);
  try { await deleteDoc(doc(db, type, id)); showToast('Eliminado correctamente', 'success'); }
  catch (err) { showToast('Error al eliminar: ' + err.message, 'error'); } finally { showLoading(false); }
};
window.handleFileSelect = function(input) { uploadedFiles = Array.from(input.files); const list = document.getElementById('fileList'); if (uploadedFiles.length > 0) { list.innerHTML = uploadedFiles.map(f => `📎 ${f.name} (${(f.size / 1024).toFixed(1)} KB)`).join('<br>'); } };

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  toast.innerHTML = `${icons[type] || '✅'} ${message}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100px)'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function showLoading(show) { document.getElementById('loadingOverlay').classList.toggle('active', show); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
