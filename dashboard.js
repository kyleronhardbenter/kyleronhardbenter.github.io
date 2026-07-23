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
let selectedWeekStart = null;
let selectedWeekEnd = null;
let allVacations = [];

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
    const vapidKey = 'BKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    const token = await getToken(messaging, { vapidKey });
    if (token) { fcmToken = token; await updateDoc(doc(db, 'usuarios', currentUser.uid), { fcmToken: token }); }
    onMessage(messaging, (payload) => { showToast(payload.notification?.body || 'Nueva notificacion', 'info'); updateNotifCount(); });
  } catch (err) { console.log('Push no disponible:', err); }
}

async function updateNotifCount() {
  if (!currentUser) return;
  const q = query(collection(db, 'notificaciones'), where('userId', '==', currentUser.uid), where('leida', '==', false));
  const snap = await getDocs(q);
  const count = snap.size;
  const badge = document.getElementById('notifCount');
  if (count > 0) { badge.textContent = count; badge.style.display = 'flex'; }
  else { badge.style.display = 'none'; }
}

window.showNotifications = async function() {
  const q = query(collection(db, 'notificaciones'), where('userId', '==', currentUser.uid), orderBy('creado', 'desc'));
  const snap = await getDocs(q);
  const notifs = []; snap.forEach(d => notifs.push({ id: d.id, ...d.data() }));
  const unread = notifs.filter(n => !n.leida);
  for (const n of unread) { await updateDoc(doc(db, 'notificaciones', n.id), { leida: true }); }
  updateNotifCount();
  document.getElementById('modalTitle').textContent = '🔔 Notificaciones';
  document.getElementById('modalBody').innerHTML = notifs.length === 0 ? '<div style="text-align:center;padding:40px;color:var(--text-light);">Sin notificaciones</div>' : notifs.map(n => `<div style="padding:16px;border-bottom:1px solid var(--border);${n.leida ? '' : 'background:#E3F2FD;'}"><div style="font-weight:600;font-size:14px;">${n.title}</div><div style="font-size:13px;color:var(--text-light);margin-top:4px;">${n.body}</div><div style="font-size:11px;color:#999;margin-top:8px;">${formatFirestoreDate(n.creado)}</div></div>`).join('');
  document.getElementById('modalOverlay').classList.add('active');
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
  document.getElementById('badgeEvidencias').textContent = ev.filter(e => e.uid === currentUser?.uid && e.estado === 'pendiente').length;
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
  const map = { pendiente: 'status-pendiente', aprobado: 'status-aprobado', rechazado: 'status-rechazado', enviado: 'status-enviado', entregado: 'status-entregado', revisado: 'status-revisado' };
  return map[estado] || 'status-pendiente';
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

// ==================== CALENDAR HELPERS (Day Grid) ====================
function getDaysOfMonth(year, month) {
  const days = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let current = new Date(firstDay);
  while (current.getDay() !== 1) {
    current.setDate(current.getDate() - 1);
  }
  const endCheck = new Date(lastDay);
  endCheck.setDate(endCheck.getDate() + 7);
  while (current <= endCheck) {
    days.push({
      date: new Date(current),
      dayNum: current.getDate(),
      inMonth: current.getMonth() === month,
      isToday: isSameDay(current, new Date()),
      weekStart: getWeekStart(current)
    });
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function getWeekStart(date) {
  const d = new Date(date);
  while (d.getDay() !== 1) {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().split('T')[0];
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function dateInRange(dateStr, startStr, endStr) {
  const d = new Date(dateStr + 'T00:00:00').getTime();
  const s = new Date(startStr + 'T00:00:00').getTime();
  const e = new Date(endStr + 'T00:00:00').getTime();
  return d >= s && d <= e;
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

function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function getNextWeek(startDate) {
  const nextMonday = new Date(startDate);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextSunday.getDate() + 6);
  return { start: nextMonday.toISOString().split('T')[0], end: nextSunday.toISOString().split('T')[0] };
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
      const bloqueoText = v.semanaBloqueadaInicio ? `<br><span style="color:#C62828;font-size:11px;">🚫 Bloquea: ${formatShortDate(v.semanaBloqueadaInicio)} - ${formatShortDate(v.semanaBloqueadaFin)}</span>` : '';
      return `<div class="card vacation-mine"><div class="card-header"><div class="card-icon" style="background:#E3F2FD;">🏖️</div><span class="card-status ${getStatusClass(v.estado)}">${v.estado}</span></div><div class="card-title">${v.tipo}</div><div class="card-desc">${v.notas || 'Sin notas adicionales'}</div><div class="card-meta"><span>📅 ${formatDate(v.inicio)} → ${formatDate(v.fin)}</span><span>📆 7 dias (1 semana)</span></div><div class="card-meta" style="margin-top:8px;"><span style="font-size:11px;color:#999;">Solicitado: ${formatFirestoreDate(v.creado)}${bloqueoText}</span></div><div class="card-actions"><button class="btn btn-secondary" onclick="editItem('vacaciones','${v.id}')">✏️ Editar</button><button class="btn btn-danger" onclick="deleteItem('vacaciones','${v.id}')">🗑️ Eliminar</button></div></div>`;
    }).join('');
  }
  if (otherItems.length > 0) {
    html += `<div class="vacation-section-title">👥 Vacaciones de Companeros (${otherItems.length})</div>`;
    html += otherItems.map(v => {
      const bloqueoText = v.semanaBloqueadaInicio ? `<br><span style="color:#C62828;font-size:11px;">🚫 Bloquea: ${formatShortDate(v.semanaBloqueadaInicio)} - ${formatShortDate(v.semanaBloqueadaFin)}</span>` : '';
      return `<div class="card vacation-other"><div class="card-header"><div class="card-icon" style="background:#FFF3E0;">👤</div><span class="card-status ${getStatusClass(v.estado)}">${v.estado}</span></div><div class="card-title">${v.tipo}<span class="employee-name-badge">${v.userName || 'Empleado'}</span></div><div class="card-desc">${v.notas || 'Sin notas adicionales'}</div><div class="card-meta"><span>📅 ${formatDate(v.inicio)} → ${formatDate(v.fin)}</span><span>📆 7 dias</span></div><div class="card-meta" style="margin-top:8px;"><span style="font-size:11px;color:#999;">Solicitado: ${formatFirestoreDate(v.creado)}${bloqueoText}</span></div></div>`;
    }).join('');
  }
  if (myItems.length === 0 && otherItems.length === 0) {
    html = emptyState('🏖️', 'Sin solicitudes de vacaciones', 'Crea tu primera solicitud de vacaciones seleccionando una semana en el calendario');
  }
  grid.innerHTML = html;
}

function renderEvidencias() {
  const grid = document.getElementById('gridEvidencias');
  const items = window._evidencias || [];
  if (items.length === 0) { grid.innerHTML = emptyState('📸', 'Sin evidencias registradas', 'Se el primero en subir una evidencia de incidencia Glovo'); return; }
  grid.innerHTML = items.map(e => {
    const isOwner = e.uid === currentUser?.uid;
    const hasVideo = !!e.videoUrl;
    return `<div class="card ${!isOwner ? 'evidence-shared' : ''}"><div class="card-header"><div class="card-icon" style="background:${isOwner ? '#FFF3E0' : '#E3F2FD'};">📸</div><span class="card-status ${getStatusClass(e.estado)}">${e.estado}</span></div><div class="card-title">${e.tipo}</div><div class="card-desc">${e.descripcion}</div><div class="card-meta"><span>📅 ${formatDate(e.fecha)} ${e.hora || ''}</span><span>👤 ${e.userName || 'Empleado'}</span></div>${e.imagenes && Array.isArray(e.imagenes) && e.imagenes.length > 0 ? `<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">${e.imagenes.map(img => `<img src="${img}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;cursor:pointer;" onclick="window.open('${img}')">`).join('')}</div>` : ''}${hasVideo ? `<div style="margin-top:16px;padding:12px;background:#E8F5E9;border-radius:var(--radius-sm);"><div style="font-size:13px;font-weight:600;color:#2E7D32;margin-bottom:8px;">🎥 Video de respuesta disponible</div><video class="video-preview" controls><source src="${e.videoUrl}" type="video/mp4"></video><a href="${e.videoUrl}" download class="btn download-btn" style="width:100%;margin-top:10px;justify-content:center;">⬇️ Descargar video</a></div>` : isOwner ? `<div style="margin-top:12px;padding:10px;background:#FFF3E0;border-radius:var(--radius-sm);font-size:12px;color:#E65100;">⏳ Esperando video de respuesta del administrador...</div>` : ''}<div class="card-meta" style="margin-top:8px;"><span style="font-size:11px;color:#999;">Enviado: ${formatFirestoreDate(e.creado)}</span></div>${isOwner ? `<div class="card-actions"><button class="btn btn-secondary" onclick="editItem('evidencias','${e.id}')">✏️ Editar</button><button class="btn btn-danger" onclick="deleteItem('evidencias','${e.id}')">🗑️ Eliminar</button></div>` : ''}</div>`;
  }).join('');
}

function renderMateriales() {
  const grid = document.getElementById('gridMateriales');
  const items = window._materiales || [];
  if (items.length === 0) { grid.innerHTML = emptyState('📦', 'Sin solicitudes de materiales', 'Solicita el material que necesites para tus repartos'); return; }
  const urgenciaEmoji = { alta: '🔴', media: '🟡', baja: '🟢' };
  grid.innerHTML = items.map(m => `<div class="card"><div class="card-header"><div class="card-icon" style="background:#F3E5F5;">📦</div><span class="card-status ${getStatusClass(m.estado)}">${m.estado}</span></div><div class="card-title">${m.item}</div><div class="card-desc">Cantidad solicitada: <strong>${m.cantidad}</strong> unidad${m.cantidad > 1 ? 'es' : ''}</div><div class="card-meta"><span>${urgenciaEmoji[m.urgencia] || '⚪'} Urgencia ${m.urgencia}</span></div><div class="card-meta" style="margin-top:8px;"><span style="font-size:11px;color:#999;">Solicitado: ${formatFirestoreDate(m.creado)}</span></div><div class="card-actions"><button class="btn btn-secondary" onclick="editItem('materiales','${m.id}')">✏️ Editar</button><button class="btn btn-danger" onclick="deleteItem('materiales','${m.id}')">🗑️ Eliminar</button></div></div>`).join('');
}

function emptyState(icon, title, desc) {
  return `<div class="empty-state"><div class="empty-state-icon">${icon}</div><div class="empty-state-title">${title}</div><div class="empty-state-desc">${desc}</div></div>`;
}

// ==================== CALENDAR RENDER (Day Grid) ====================
function renderCalendar() {
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dayNames = ['Lun','Mar','Mie','Jue','Vie','Sab','Dom'];
  let html = '';
  html += `<div class="week-legend">
    <div class="week-legend-item"><div class="legend-dot legend-available"></div> Disponible</div>
    <div class="week-legend-item"><div class="legend-dot legend-selected"></div> Seleccionada</div>
    <div class="week-legend-item"><div class="legend-dot legend-own"></div> Tu semana</div>
    <div class="week-legend-item"><div class="legend-dot legend-taken-other"></div> De companero</div>
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
      const dateStr = d.date.toISOString().split('T')[0];
      const weekStartStr = d.weekStart;
      const weekEndStr = new Date(weekStartStr);
      weekEndStr.setDate(weekEndStr.getDate() + 6);
      const weekEndStrFormatted = weekEndStr.toISOString().split('T')[0];
      const blockedInfo = isWeekBlocked(weekStartStr, weekEndStrFormatted);
      const takenInfo = isWeekTaken(weekStartStr, weekEndStrFormatted);
      const isPast = isWeekPast(weekStartStr);
      const isSelected = selectedWeekStart && dateInRange(dateStr, selectedWeekStart, selectedWeekEnd);
      const isOwnWeek = takenInfo && takenInfo.ownerId === currentUser?.uid;
      const isOtherWeek = takenInfo && takenInfo.ownerId !== currentUser?.uid;
      let dayClass = 'day-cell';
      let clickable = false;
      let ownerLabel = '';
      if (isSelected) {
        if (dateStr === selectedWeekStart) dayClass += ' selected-start';
        else if (dateStr === selectedWeekEnd) dayClass += ' selected-end';
        else dayClass += ' selected-mid';
      } else if (isOwnWeek) {
        dayClass += ' own-week';
        ownerLabel = '<span class="week-owner-label">YO</span>';
      } else if (isOtherWeek) {
        dayClass += ' taken-other';
        const shortName = (takenInfo.ownerName || 'Otro').split(' ')[0];
        ownerLabel = `<span class="week-owner-label">${shortName.substring(0,6)}</span>`;
      } else if (blockedInfo) {
        dayClass += ' blocked';
        const shortName = (blockedInfo.ownerName || 'Otro').split(' ')[0];
        ownerLabel = `<span class="week-owner-label">${shortName.substring(0,6)}</span>`;
      } else if (isPast) {
        dayClass += ' past';
      } else if (d.inMonth) {
        dayClass += ' available';
        clickable = true;
      } else {
        dayClass += ' out-month';
      }
      const onclickAttr = clickable ? `onclick="selectWeek('${weekStartStr}','${weekEndStrFormatted}')"` : '';
      const titleAttr = blockedInfo ? `title="Bloqueada por ${blockedInfo.ownerName}"` : takenInfo ? `title="Reservada por ${takenInfo.ownerName}"` : '';
      html += `<div class="${dayClass}" ${onclickAttr} ${titleAttr}>${d.inMonth || d.dayNum ? d.dayNum + ownerLabel : ''}</div>`;
    });
    html += `</div></div>`;
  }
  html += `</div></div>`;
  if (selectedWeekStart) {
    const nextWeek = getNextWeek(selectedWeekStart);
    html += `<div class="vacation-summary">
      <div class="vacation-summary-title">📋 Resumen de tu seleccion</div>
      <div class="vacation-summary-text">
        <strong>Semana seleccionada:</strong> ${formatShortDate(selectedWeekStart)} - ${formatShortDate(selectedWeekEnd)}<br>
        <strong>Semana bloqueada automaticamente:</strong> ${formatShortDate(nextWeek.start)} - ${formatShortDate(nextWeek.end)}<br>
        <span style="color:var(--danger);">⚠️ Esta semana bloqueada quedara no disponible para todos los empleados.</span>
      </div>
    </div>`;
  }
  return html;
}

window.changeYear = function(delta) {
  calendarYear += delta;
  selectedWeekStart = null;
  selectedWeekEnd = null;
  refreshVacationModal();
};

window.selectWeek = function(start, end) {
  const blockedInfo = isWeekBlocked(start, end);
  const takenInfo = isWeekTaken(start, end);
  if (blockedInfo) { showToast(`Semana bloqueada por ${blockedInfo.ownerName}`, 'error'); return; }
  if (takenInfo) { showToast(`Semana reservada por ${takenInfo.ownerName}`, 'error'); return; }
  selectedWeekStart = start;
  selectedWeekEnd = end;
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
    if (item && !selectedWeekStart) { selectedWeekStart = item.inicio; selectedWeekEnd = item.fin; }
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
  selectedWeekStart = null; selectedWeekEnd = null;
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  let item = null;
  if (id) { const arr = type === 'vacaciones' ? window._vacaciones : type === 'evidencias' ? window._evidencias : window._materiales; item = arr.find(x => x.id === id); }
  if (type === 'vacaciones') {
    calendarYear = 2026;
    if (item) { selectedWeekStart = item.inicio; selectedWeekEnd = item.fin; }
    refreshVacationModal();
  } else if (type === 'evidencias') {
    title.textContent = id ? 'Editar Evidencia' : 'Nueva Evidencia Glovo';
    body.innerHTML = `<div class="form-group"><label class="form-label">Tipo de incidente</label><select class="form-select" id="eTipo"><option ${item?.tipo === 'Incidente en reparto' ? 'selected' : ''}>Incidente en reparto</option><option ${item?.tipo === 'Dano en producto' ? 'selected' : ''}>Dano en producto</option><option ${item?.tipo === 'Cliente no disponible' ? 'selected' : ''}>Cliente no disponible</option><option ${item?.tipo === 'Retraso en restaurante' ? 'selected' : ''}>Retraso en restaurante</option><option ${item?.tipo === 'Otro' ? 'selected' : ''}>Otro</option></select></div><div class="form-row"><div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" id="eFecha" value="${item?.fecha || new Date().toISOString().split('T')[0]}"></div><div class="form-group"><label class="form-label">Hora</label><input type="time" class="form-input" id="eHora" value="${item?.hora || new Date().toTimeString().slice(0, 5)}"></div></div><div class="form-group"><label class="form-label">Descripcion detallada</label><textarea class="form-textarea" id="eDesc" placeholder="Describe lo ocurrido con el maximo detalle posible...">${item?.descripcion || ''}</textarea></div><div class="form-group"><label class="form-label">Adjuntar fotos</label><div class="file-upload" onclick="document.getElementById('fileInput').click()"><div class="file-upload-icon">📁</div><div class="file-upload-text">Toca para seleccionar imagenes</div><input type="file" id="fileInput" multiple accept="image/*" style="display:none" onchange="handleFileSelect(this)"></div><div id="fileList" style="margin-top:8px;font-size:12px;color:var(--text-light);"></div></div><button class="btn btn-primary" style="width:100%;padding:14px;justify-content:center;" onclick="saveEvidencia()">${id ? '💾 Guardar cambios' : '📤 Enviar evidencia'}</button>`;
  } else if (type === 'materiales') {
    title.textContent = id ? 'Editar Material' : 'Nueva Solicitud de Material';
    body.innerHTML = `<div class="form-group"><label class="form-label">Material solicitado</label><input type="text" class="form-input" id="mItem" placeholder="Ej: Mochila termica, cargador..." value="${item?.item || ''}"></div><div class="form-row"><div class="form-group"><label class="form-label">Cantidad</label><input type="number" class="form-input" id="mCantidad" min="1" value="${item?.cantidad || 1}"></div><div class="form-group"><label class="form-label">Urgencia</label><select class="form-select" id="mUrgencia"><option value="baja" ${item?.urgencia === 'baja' ? 'selected' : ''}>🟢 Baja</option><option value="media" ${item?.urgencia === 'media' ? 'selected' : ''}>🟡 Media</option><option value="alta" ${item?.urgencia === 'alta' ? 'selected' : ''}>🔴 Alta</option></select></div></div><button class="btn btn-primary" style="width:100%;padding:14px;justify-content:center;" onclick="saveMaterial()">${id ? '💾 Guardar cambios' : '📦 Solicitar material'}</button>`;
  }
  document.getElementById('modalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeModal = function() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
  editingId = null; editingType = null; uploadedFiles = [];
  selectedWeekStart = null; selectedWeekEnd = null;
};
window.closeModalOnOverlay = function(e) { if (e.target === e.currentTarget) closeModal(); };

// ==================== SAVE FUNCTIONS ====================
window.saveVacaciones = async function() {
  if (!currentUser) { showToast('Debes iniciar sesion', 'error'); return; }
  if (!selectedWeekStart || !selectedWeekEnd) { showToast('Selecciona una semana en el calendario', 'error'); return; }
  const tipo = document.getElementById('vTipo').value;
  const notas = document.getElementById('vNotas').value;
  const inicio = selectedWeekStart;
  const fin = selectedWeekEnd;
  const nextWeek = getNextWeek(inicio);
  const takenCheck = isWeekTaken(inicio, fin);
  if (takenCheck && (!editingId || takenCheck.ownerId !== currentUser.uid)) {
    showToast('La semana seleccionada ya esta reservada por ' + takenCheck.ownerName, 'error');
    return;
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
        tipo, inicio, fin, dias: 7, notas,
        semanaBloqueadaInicio: nextWeek.start,
        semanaBloqueadaFin: nextWeek.end,
        actualizado: serverTimestamp()
      });
      showToast('Vacaciones actualizadas', 'success');
    } else {
      await addDoc(collection(db, 'vacaciones'), {
        tipo, inicio, fin, dias: 7, notas,
        estado: 'pendiente',
        uid: currentUser.uid,
        userName: userProfile?.nombre || currentUser.email.split('@')[0],
        semanaBloqueadaInicio: nextWeek.start,
        semanaBloqueadaFin: nextWeek.end,
        creado: serverTimestamp()
      });
      showToast('Solicitud creada. La siguiente semana ha sido bloqueada para todos.', 'success');
    }
    closeModal();
  } catch (err) { showToast('Error: ' + err.message, 'error'); } finally { showLoading(false); }
};

window.saveEvidencia = async function() {
  if (!currentUser) { showToast('Debes iniciar sesion', 'error'); return; }
  const tipo = document.getElementById('eTipo').value;
  const fecha = document.getElementById('eFecha').value;
  const hora = document.getElementById('eHora').value;
  const descripcion = document.getElementById('eDesc').value;
  if (!descripcion) { showToast('Describe el incidente', 'error'); return; }
  showLoading(true);
  try {
    let imageUrls = [];
    if (uploadedFiles.length > 0) { for (const file of uploadedFiles) { const storageRef = ref(storage, `evidencias/${currentUser.uid}/${Date.now()}_${file.name}`); await uploadBytes(storageRef, file); const url = await getDownloadURL(storageRef); imageUrls.push(url); } }
    if (editingId) { const updateData = { tipo, fecha, hora, descripcion, actualizado: serverTimestamp() }; if (imageUrls.length > 0) updateData.imagenes = imageUrls; await updateDoc(doc(db, 'evidencias', editingId), updateData); showToast('Evidencia actualizada', 'success'); }
    else { await addDoc(collection(db, 'evidencias'), { tipo, fecha, hora, descripcion, estado: 'pendiente', imagenes: imageUrls, uid: currentUser.uid, userName: userProfile?.nombre || currentUser.email.split('@')[0], userEmail: currentUser.email, creado: serverTimestamp() }); showToast('Evidencia enviada correctamente', 'success'); }
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
