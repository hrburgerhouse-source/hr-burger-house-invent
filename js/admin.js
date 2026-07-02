let allRequests = [];
const DEFAULT_PIN = '1234';
const AUTH_KEY = 'adminAuth_v2';
let pinInput = '';

// ── PIN Login ────────────────────────────────────────────────────
function checkLogin() {
  sessionStorage.removeItem('adminAuth');
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
    setupTabs();
    initCatalogo();
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

  if (actual !== stored)    return showToast('El PIN actual es incorrecto.', 'error');
  if (nuevo.length < 4)     return showToast('El nuevo PIN debe tener al menos 4 digitos.', 'error');
  if (nuevo !== confirm)    return showToast('Los PINs no coinciden.', 'error');
  if (!/^\d+$/.test(nuevo)) return showToast('El PIN solo puede contener numeros.', 'error');

  localStorage.setItem('adminPin', nuevo);
  cerrarModalPin();
  showToast('PIN actualizado correctamente.', 'success');
}

document.addEventListener('DOMContentLoaded', () => {
  if (!checkLogin()) return;
  initRealtime();
  setupFilters();
  setupModal();
  setupPinModal();
  setupTabs();
  initCatalogo();
});

// ── Tabs ─────────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('tab-solicitudes').classList.toggle('hidden', tab !== 'solicitudes');
      document.getElementById('tab-catalogo').classList.toggle('hidden', tab !== 'catalogo');
    });
  });
}

// ── Catalogo CRUD ────────────────────────────────────────────────
function initCatalogo() {
  cargarCatalogoAdmin();
  document.getElementById('btnAgregarProducto').addEventListener('click', agregarProductoCatalogo);
  document.getElementById('btnImportarProductos').addEventListener('click', importarProductosPredeterminados);
}

function cargarCatalogoAdmin() {
  db.collection('productos')
    .onSnapshot(snap => {
      const productos = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.categoria.localeCompare(b.categoria));
      renderCatalogo(productos);
    }, err => {
      console.error('Firestore error:', err);
      const tbody = document.getElementById('catalogoBody');
      const msg = err.code === 'permission-denied'
        ? 'Sin permiso. Actualiza las reglas de Firestore en Firebase Console.'
        : 'Error al cargar: ' + err.message;
      tbody.innerHTML = '<tr><td colspan="5" class="loading-row" style="color:var(--danger)">' + msg + '</td></tr>';
    });
}

function renderCatalogo(productos) {
  const tbody = document.getElementById('catalogoBody');
  if (productos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Sin productos. Agrega el primero.</td></tr>';
    return;
  }
  tbody.innerHTML = productos.map(p => `
    <tr>
      <td><strong>${p.nombre || p.name || ''}</strong></td>
      <td>${p.categoria || ''}</td>
      <td>${p.unidad || p.unit || ''}</td>
      <td>
        <label class="toggle">
          <input type="checkbox" ${p.activo ? 'checked' : ''} onchange="toggleActivo('${p.id}', this.checked)">
          <span class="toggle-label">${p.activo ? 'Activo' : 'Inactivo'}</span>
        </label>
      </td>
      <td>
        <button class="btn btn-sm btn-ghost" style="color:var(--danger)" onclick="eliminarProducto('${p.id}', '${p.nombre || p.name || ''}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

async function agregarProductoCatalogo() {
  const nombre    = document.getElementById('newNombre').value.trim();
  const categoria = document.getElementById('newCategoria').value;
  const unidad    = document.getElementById('newUnidad').value;

  if (!nombre)    return showToast('Escribe el nombre del producto.', 'error');
  if (!categoria) return showToast('Selecciona una categoria.', 'error');
  if (!unidad)    return showToast('Selecciona una unidad de medida.', 'error');

  try {
    await db.collection('productos').add({ nombre, categoria, unidad, activo: true });
    document.getElementById('newNombre').value = '';
    document.getElementById('newCategoria').value = '';
    document.getElementById('newUnidad').value = '';
    showToast('Producto agregado al catalogo.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Error al agregar el producto.', 'error');
  }
}

async function importarProductosPredeterminados() {
  if (!confirm('Importar los 26 productos predeterminados? No se eliminaran los que ya existen.')) return;

  const btn = document.getElementById('btnImportarProductos');
  btn.disabled = true;
  btn.textContent = 'Importando...';

  let count = 0;
  try {
    for (const categoria of PRODUCTS) {
      for (const item of categoria.items) {
        await db.collection('productos').add({
          nombre:    item.name,
          categoria: categoria.name,
          unidad:    item.unit,
          activo:    true
        });
        count++;
      }
    }
    showToast(count + ' productos importados al catalogo.', 'success');
  } catch (err) {
    console.error(err);
    const msg = err.code === 'permission-denied'
      ? 'Error de permisos. Actualiza las reglas de Firestore.'
      : 'Error al importar: ' + err.message;
    showToast(msg, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Importar predeterminados';
  }
}

async function toggleActivo(id, activo) {
  try {
    await db.collection('productos').doc(id).update({ activo });
    showToast(activo ? 'Producto activado.' : 'Producto desactivado.', 'info');
  } catch (err) {
    showToast('Error al actualizar.', 'error');
  }
}

async function eliminarProducto(id, nombre) {
  if (!confirm('Eliminar "' + nombre + '" del catalogo?')) return;
  try {
    await db.collection('productos').doc(id).delete();
    showToast('Producto eliminado.', 'success');
  } catch (err) {
    showToast('Error al eliminar.', 'error');
  }
}

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
      console.error('Firestore solicitudes error:', err);
      const msg = err.code === 'permission-denied'
        ? 'Sin permisos. En Firebase Console, asegurate de que la regla cubra todas las colecciones.'
        : 'Error al conectar: ' + err.message;
      tbody.innerHTML = '<tr><td colspan="7" class="loading-row" style="color:var(--danger)">' + msg + '</td></tr>';
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
      <td class="td-date">${formatTsTabla(req.createdAt)}</td>
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
      const hay = ((req.solicitante || '') + ' ' + (req.area || '') + ' ' + (req.notas || '')).toLowerCase();
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

function pVal(v) {
  return (v && v !== 'undefined' && v !== 'null') ? v : null;
}

function openDetail(id) {
  const req = allRequests.find(r => r.id === id);
  if (!req) return;

  document.getElementById('modalTitle').textContent = 'Solicitud #' + req.id.slice(0, 8).toUpperCase();

  const productos = req.productos || [];
  const productosHtml = productos.length === 0
    ? '<li style="color:var(--text-muted)">Sin productos registrados</li>'
    : productos.map(p => {
        const nombre   = pVal(p.nombre) || pVal(p.name)  || '(sin nombre)';
        const cantidad = p.cantidad != null ? p.cantidad : '?';
        const unidad   = pVal(p.unidad) || pVal(p.unit)  || '';
        return '<li><span>' + nombre + '</span><span class="product-qty">' + cantidad + ' ' + unidad + '</span></li>';
      }).join('');

  document.getElementById('modalBody').innerHTML =
    '<div class="detail-grid">' +
      '<div class="detail-row"><span class="detail-label">Solicitante</span><span class="detail-value"><strong>' + req.solicitante + '</strong></span></div>' +
      '<div class="detail-row"><span class="detail-label">Area</span><span class="detail-value">' + req.area + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">Prioridad</span><span class="detail-value">' + badgePriority(req.prioridad) + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">Fecha requerida</span><span class="detail-value">' + formatDate(req.fechaRequerida) + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">Estado</span><span class="detail-value">' + badgeStatus(req.estado) + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">Enviada el</span><span class="detail-value">' + formatTs(req.createdAt) + '</span></div>' +
      (req.notas ? '<div class="detail-row full"><span class="detail-label">Notas</span><span class="detail-value">' + req.notas + '</span></div>' : '') +
    '</div>' +
    '<div class="modal-section-title">Productos solicitados</div>' +
    '<ul class="product-list">' + productosHtml + '</ul>';

  const isOpen = req.estado === 'pendiente';
  document.getElementById('modalFooter').innerHTML =
    '<button class="btn btn-ghost btn-sm" style="color:var(--danger);margin-right:auto" onclick="eliminarSolicitud(\'' + req.id + '\')">Eliminar</button>' +
    (isOpen
      ? '<button class="btn btn-ghost btn-sm" onclick="updateStatus(\'' + req.id + '\',\'rechazado\')">Rechazar</button>' +
        '<button class="btn btn-primary btn-sm" onclick="updateStatus(\'' + req.id + '\',\'aprobado\')">Aprobar</button>'
      : '<button class="btn btn-ghost btn-sm" onclick="updateStatus(\'' + req.id + '\',\'pendiente\')">Restablecer</button>');

  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

async function eliminarSolicitud(id) {
  if (!confirm('Eliminar esta solicitud permanentemente?')) return;
  try {
    await db.collection('solicitudes').doc(id).delete();
    closeModal();
    showToast('Solicitud eliminada.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Error al eliminar.', 'error');
  }
}

async function updateStatus(id, newStatus) {
  try {
    await db.collection('solicitudes').doc(id).update({ estado: newStatus });
    closeModal();
    const msgs  = { aprobado: 'Solicitud aprobada', rechazado: 'Solicitud rechazada', pendiente: 'Restablecida a pendiente' };
    const types = { aprobado: 'success', rechazado: 'error', pendiente: 'info' };
    showToast(msgs[newStatus], types[newStatus]);
  } catch (err) {
    console.error(err);
    showToast('Error al actualizar. Intenta de nuevo.', 'error');
  }
}

// ── Formatters ───────────────────────────────────────────────────
function formatTsTabla(ts) {
  if (!ts) return '-';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const fecha = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  const hora  = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  return '<span style="font-weight:600">' + fecha + '</span><br><small style="color:var(--text-muted)">' + hora + '</small>';
}

function formatTs(ts) {
  if (!ts) return '-';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const fecha = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  const hora  = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  return fecha + ' - ' + hora;
}

function formatDate(str) {
  if (!str) return '-';
  const [y, m, d] = str.split('-');
  return d + '/' + m + '/' + y;
}

function badgeStatus(s) {
  const map = {
    pendiente: ['badge-pending',  'Pendiente'],
    aprobado:  ['badge-approved', 'Aprobado'],
    rechazado: ['badge-rejected', 'Rechazado']
  };
  const [cls, label] = map[s] || ['badge-pending', s];
  return '<span class="badge ' + cls + '">' + label + '</span>';
}

function badgePriority(p) {
  const map = {
    urgente:   ['badge-urgent',    'Urgente'],
    normal:    ['badge-normal',    'Normal'],
    programado:['badge-scheduled', 'Programado']
  };
  const [cls, label] = map[p] || ['badge-normal', p];
  return '<span class="badge ' + cls + '">' + label + '</span>';
}

let toastTimer;
function showToast(msg, type) {
  type = type || 'info';
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + type + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4500);
}
