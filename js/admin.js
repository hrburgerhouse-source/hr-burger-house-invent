let allRequests = [];
const DEFAULT_PIN = '1234';
const AUTH_KEY = 'adminAuth_v2';
let pinInput = '';

// ── PIN Login ────────────────────────────────────────────────────
function checkLogin() {
  sessionStorage.removeItem('adminAuth'); // limpiar versión anterior
  if (sessionStorage.getItem(AUTH_KEY) === 'ok') {
    document.getElementById('loginScreen').classList.add('hidden');
    return true;
  }
  return false;
}

function pinPress(digit) {
  if (pinInput.length >= 8) return;
  pinInput += digit;
  updatePinDisplay();
  if (pinInput.length >= 4) setTimeout(validatePin, 200);
}

function pinDelete() {
  pinInput = pinInput.slice(0, -1);
  updatePinDisplay();
}

function pinClear() {
  pinInput = '';
  updatePinDisplay();
  document.getElementById('pinError').classList.add('hidden');
}

function updatePinDisplay() {
  const dots = document.querySelectorAll('#pinDisplay span');
  dots.forEach((dot, i) => dot.classList.toggle('filled', i < pinInput.length));
}

function validatePin() {
  const stored = localStorage.getItem('adminPin') || DEFAULT_PIN;
  if (pinInput === stored) {
    sessionStorage.setItem(AUTH_KEY, 'ok');
    document.getElementById('loginScreen').classList.add('hidden');
    initRealtime();
    setupFilters();
    setupModal();
    setupPinModal();
  } else {
    document.getElementById('pinError').classList.remove('hidden');
    pinInput = '';
    updatePinDisplay();
  }
}

// ── Cambiar PIN ──────────────────────────────────────────────────
function setupPinModal() {
  document.getElementById('btnCerrarSesion').addEventListener('click', () => {
    sessionStorage.removeItem(AUTH_KEY);
    pinInput = '';
    updatePinDisplay();
    document.getElementById('pinError').classList.add('hidden');
    const ls = document.getElementById('loginScreen');
    ls.classList.remove('hidden');
    ls.style.display = 'flex';
  });

  document.getElementById('btnCambiarPin').addEventListener('click', () => {
    document.getElementById('pinActual').value = '';
    document.getElementById('pinNuevo').value = '';
    document.getElementById('pinConfirm').value = '';
    document.getElementById('modalPin').classList.remove('hidden');
  });
  document.getElementById('modalPinClose').addEventListener('click', cerrarModalPin);
  document.getElementById('modalPinCancelar').addEventListener('click', cerrarModalPin);
  document.getElementById('modalPinBackdrop').addEventListener('click', cerrarModalPin);
  document.getElementById('guardarPin').addEventListener('click', guardarNuevoPin);
}

function cerrarModalPin() {
  document.getElementById('modalPin').classList.add('hidden');
}

function guardarNuevoPin() {
  const actual  = document.getElementById('pinActual').value;
  const nuevo   = document.getElementById('pinNuevo').value;
  const confirm = document.getElementById('pinConfirm').value;
  const stored  = localStorage.getItem('adminPin') || DEFAULT_PIN;

  if (actual !== stored)   return showToast('El PIN actual es incorrecto.', 'error');
  if (nuevo.length < 4)    return showToast('El nuevo PIN debe tener al menos 4 dígitos.', 'error');
  if (nuevo !== confirm)   return showToast('Los PINs no coinciden.', 'error');
  if (!/^\d+$/.test(nuevo)) return showToast('El PIN solo puede contener números.', 'error');

  localStorage.setItem('adminPin', nuevo);
  cerrarModalPin();
  showToast('✓ PIN actualizado correctamente.', 'success');
}

document.addEventListener('DOMContentLoaded', () => {
  if (!checkLogin()) return;
  initRealtime();
  setupFilters();
  setupModal();
  setupPinModal();
});

// ── Realtime ─────────────────────────────────────────────────────
function initRealtime() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Conectando...</td></tr>';

  db.collection('solicitudes')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      allRequests = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      applyFilters();
      updateStats(allRequests);
    }, err => {
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Error al conectar. Verifica la configuración de Firebase.</td></tr>';
    });
}

function renderTable(requests) {
  const tbody = document.getElementById('tableBody');
  if (requests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Sin resultados.</td></tr>';
    return;
  }
  tbody.innerHTML = requests.map(req => `
    <tr>
      <td class="td-date">${formatTs(req.createdAt)}</td>
      <td><strong>${req.solicitante}</strong><br><small class="text-muted">${req.area}</small></td>
      <td class="hide-sm">${req.area}</td>
      <td>${badgePriority(req.prioridad)}</td>
      <td class="hide-sm">${(req.productos || []).length} prod.</td>
      <td>${badgeStatus(req.estado)}</td>
      <td><button class="btn btn-sm btn-ghost" onclick="openDetail('${req.id}')">Ver</button></td>
    </tr>
  `).join('');
}

function updateStats(reqs) {
  document.getElementById('statTotal').textContent    = reqs.length;
  document.getElementById('statPending').textContent  = reqs.filter(r => r.estado === 'pendiente').length;
  document.getElementById('statApproved').textContent = reqs.filter(r => r.estado === 'aprobado').length;
  document.getElementById('statRejected').textContent = reqs.filter(r => r.estado === 'rechazado').length;
}

// ── Filters ──────────────────────────────────────────────────────
function setupFilters() {
  ['filterStatus', 'filterPriority', 'filterSearch'].forEach(id => {
    document.getElementById(id).addEventListener('input', applyFilters);
  });
}

function applyFilters() {
  const status   = document.getElementById('filterStatus').value;
  const priority = document.getElementById('filterPriority').value;
  const search   = document.getElementById('filterSearch').value.toLowerCase();

  const filtered = allRequests.filter(req => {
    if (status   && req.estado    !== status)   return false;
    if (priority && req.prioridad !== priority) return false;
    if (search) {
      const hay = `${req.solicitante} ${req.area} ${req.notas || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  renderTable(filtered);
}

// ── Modal ────────────────────────────────────────────────────────
function setupModal() {
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalBackdrop').addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

function openDetail(id) {
  const req = allRequests.find(r => r.id === id);
  if (!req) return;

  document.getElementById('modalTitle').textContent = `Solicitud #${req.id.slice(0, 8).toUpperCase()}`;

  document.getElementById('modalBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-row"><span class="detail-label">Solicitante</span><span class="detail-value"><strong>${req.solicitante}</strong></span></div>
      <div class="detail-row"><span class="detail-label">Área</span><span class="detail-value">${req.area}</span></div>
      <div class="detail-row"><span class="detail-label">Prioridad</span><span class="detail-value">${badgePriority(req.prioridad)}</span></div>
      <div class="detail-row"><span class="detail-label">Fecha requerida</span><span class="detail-value">${formatDate(req.fechaRequerida)}</span></div>
      <div class="detail-row"><span class="detail-label">Estado</span><span class="detail-value">${badgeStatus(req.estado)}</span></div>
      <div class="detail-row"><span class="detail-label">Enviada el</span><span class="detail-value">${formatTs(req.createdAt)}</span></div>
      ${req.notas ? `<div class="detail-row full"><span class="detail-label">Notas</span><span class="detail-value">${req.notas}</span></div>` : ''}
    </div>
    <div class="modal-section-title">Productos solicitados</div>
    <ul class="product-list">
      ${(req.productos || []).map(p => `
        <li><span>${p.name}</span><span class="product-qty">${p.cantidad} ${p.unit}</span></li>
      `).join('')}
    </ul>
  `;

  const isOpen = req.estado === 'pendiente';
  document.getElementById('modalFooter').innerHTML = isOpen ? `
    <button class="btn btn-ghost btn-sm" onclick="updateStatus('${req.id}','rechazado')">✗ Rechazar</button>
    <button class="btn btn-primary btn-sm" onclick="updateStatus('${req.id}','aprobado')">✓ Aprobar solicitud</button>
  ` : `<button class="btn btn-ghost btn-sm" onclick="updateStatus('${req.id}','pendiente')">↩ Restablecer a pendiente</button>`;

  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

async function updateStatus(id, newStatus) {
  try {
    await db.collection('solicitudes').doc(id).update({ estado: newStatus });
    closeModal();
    const msgs = { aprobado: '✓ Solicitud aprobada', rechazado: '✗ Solicitud rechazada', pendiente: '↩ Restablecida a pendiente' };
    const types = { aprobado: 'success', rechazado: 'error', pendiente: 'info' };
    showToast(msgs[newStatus], types[newStatus]);
  } catch (err) {
    console.error(err);
    showToast('Error al actualizar. Intenta de nuevo.', 'error');
  }
}

// ── Formatters ───────────────────────────────────────────────────
function formatTs(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}


function formatDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function badgeStatus(s) {
  const map = { pendiente: ['badge-pending', '⏳ Pendiente'], aprobado: ['badge-approved', '✓ Aprobado'], rechazado: ['badge-rejected', '✗ Rechazado'] };
  const [cls, label] = map[s] || ['badge-pending', s];
  return `<span class="badge ${cls}">${label}</span>`;
}

function badgePriority(p) {
  const map = { urgente: ['badge-urgent', '🔴 Urgente'], normal: ['badge-normal', 'Normal'], programado: ['badge-scheduled', '🗓️ Programado'] };
  const [cls, label] = map[p] || ['badge-normal', p];
  return `<span class="badge ${cls}">${label}</span>`;
}

let toastTimer;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4500);
}
