let cart = [];
let catalogoProductos = [];

document.addEventListener('DOMContentLoaded', () => {
  cargarCatalogo();
  setMinDate();
  document.getElementById('requestForm').addEventListener('submit', handleSubmit);
  document.getElementById('clearBtn').addEventListener('click', handleClear);
  setupTabsEmpleado();
});

// ── Tabs empleado ────────────────────────────────────────────────
function setupTabsEmpleado() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('tab-nueva').classList.toggle('hidden', tab !== 'nueva');
      document.getElementById('tab-mis').classList.toggle('hidden', tab !== 'mis');
    });
  });
}

// ── Mis Solicitudes ──────────────────────────────────────────────
async function buscarSolicitudes() {
  const nombre = document.getElementById('buscarNombre').value.trim();
  if (!nombre) { showToast('Escribe tu nombre para buscar.', 'error'); return; }

  const lista = document.getElementById('misSolicitudesLista');
  lista.innerHTML = '<p class="cart-empty">Buscando...</p>';

  try {
    const snap = await db.collection('solicitudes').get();
    const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const resultados = todos
      .filter(s => (s.solicitante || '').toLowerCase().includes(nombre.toLowerCase()))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (todos.length === 0) {
      lista.innerHTML = '<p class="cart-empty">Aún no hay solicitudes registradas.</p>';
      return;
    }

    if (resultados.length === 0) {
      lista.innerHTML = `<p class="cart-empty">No se encontraron solicitudes para "<strong>${nombre}</strong>".<br>Verifica que el nombre coincida exactamente con el que usaste al enviar.</p>`;
      return;
    }

    lista.innerHTML = resultados.map(s => `
      <div class="solicitud-card">
        <div class="solicitud-header">
          <div>
            <span class="solicitud-id">#${s.id.slice(0,8).toUpperCase()}</span>
            <span class="solicitud-fecha">${formatTsEmpleado(s.createdAt)}</span>
          </div>
          ${badgeEstado(s.estado)}
        </div>
        <div class="solicitud-body">
          <div class="solicitud-info">
            <span>👤 ${s.solicitante}</span>
            <span>🏪 ${s.area}</span>
            <span>${badgePrioridad(s.prioridad)}</span>
            <span>📅 Requerido: ${formatFecha(s.fechaRequerida)}</span>
          </div>
          <div class="solicitud-productos">
            ${(s.productos || []).map(p => `
              <span class="summary-tag">${p.nombre}: <strong>${p.cantidad} ${p.unidad}</strong></span>
            `).join('')}
          </div>
          ${s.notas ? `<p class="solicitud-notas">📝 ${s.notas}</p>` : ''}
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Error Firestore:', err);
    lista.innerHTML = `<p class="cart-empty">Error: ${err.message}</p>`;
  }
}

function badgeEstado(estado) {
  const map = {
    pendiente:  ['badge-pending',  '⏳ Pendiente'],
    aprobado:   ['badge-approved', '✓ Aprobado'],
    rechazado:  ['badge-rejected', '✗ Rechazado']
  };
  const [cls, label] = map[estado] || ['badge-pending', estado];
  return `<span class="badge ${cls}">${label}</span>`;
}

function badgePrioridad(p) {
  const map = { urgente: ['badge-urgent','🔴 Urgente'], normal: ['badge-normal','Normal'], programado: ['badge-scheduled','🗓️ Programado'] };
  const [cls, label] = map[p] || ['badge-normal', p];
  return `<span class="badge ${cls}">${label}</span>`;
}

function formatTsEmpleado(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatFecha(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

// ── Cargar catálogo desde Firestore ─────────────────────────────
function cargarCatalogo() {
  db.collection('productos')
    .onSnapshot(snap => {
      catalogoProductos = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.activo !== false)
        .sort((a, b) => a.categoria.localeCompare(b.categoria));
      renderSelector();
    }, err => {
      console.error(err);
      showToast('Error al cargar productos. Verifica tu conexión.', 'error');
    });
}

function renderSelector() {
  const sel = document.getElementById('selectProducto');
  const val = sel.value;

  // Agrupar por categoría
  const grupos = {};
  catalogoProductos.forEach(p => {
    if (!grupos[p.categoria]) grupos[p.categoria] = [];
    grupos[p.categoria].push(p);
  });

  sel.innerHTML = '<option value="">Seleccionar producto...</option>';

  if (catalogoProductos.length === 0) {
    const op = document.createElement('option');
    op.disabled = true;
    op.textContent = '— Sin productos disponibles —';
    sel.appendChild(op);
    return;
  }

  Object.entries(grupos).forEach(([cat, items]) => {
    const og = document.createElement('optgroup');
    og.label = cat;
    items.forEach(p => {
      const op = document.createElement('option');
      op.value = p.id;
      op.textContent = p.nombre;
      op.dataset.unidad = p.unidad;
      op.dataset.nombre = p.nombre;
      op.dataset.categoria = p.categoria;
      og.appendChild(op);
    });
    sel.appendChild(og);
  });

  sel.value = val;
}

function onProductoChange(sel) {
  const opt = sel.options[sel.selectedIndex];
  document.getElementById('unidadLabel').textContent = opt?.dataset?.unidad || '—';
  document.getElementById('inputCantidad').value = 1;
}

// ── Carrito ──────────────────────────────────────────────────────
function agregarProducto() {
  const sel = document.getElementById('selectProducto');
  const opt = sel.options[sel.selectedIndex];
  const cantidad = parseFloat(document.getElementById('inputCantidad').value) || 0;

  if (!sel.value) { showToast('Selecciona un producto.', 'error'); return; }
  if (cantidad <= 0) { showToast('Ingresa una cantidad válida.', 'error'); return; }

  const yaExiste = cart.find(c => c.id === sel.value);
  if (yaExiste) {
    yaExiste.cantidad += cantidad;
  } else {
    cart.push({
      id:        sel.value,
      nombre:    opt.dataset.nombre,
      categoria: opt.dataset.categoria,
      unidad:    opt.dataset.unidad,
      cantidad
    });
  }

  sel.value = '';
  document.getElementById('inputCantidad').value = 1;
  document.getElementById('unidadLabel').textContent = '—';
  renderCart();
}

function removerProducto(id) {
  cart = cart.filter(c => c.id !== id);
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cartList');
  if (cart.length === 0) {
    container.innerHTML = '<p class="cart-empty">Aún no has agregado productos a la solicitud.</p>';
    return;
  }
  container.innerHTML = `
    <table class="cart-table">
      <thead>
        <tr><th>Producto</th><th>Categoría</th><th>Cantidad</th><th></th></tr>
      </thead>
      <tbody>
        ${cart.map(p => `
          <tr>
            <td><strong>${p.nombre}</strong></td>
            <td class="text-muted">${p.categoria}</td>
            <td><span class="cart-qty">${p.cantidad} ${p.unidad}</span></td>
            <td><button type="button" class="btn-remove" onclick="removerProducto('${p.id}')">✕</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p class="cart-count">${cart.length} producto(s) en la solicitud</p>
  `;
}

// ── Formulario ───────────────────────────────────────────────────
function setMinDate() {
  const today = new Date().toISOString().split('T')[0];
  const el = document.getElementById('fechaRequerida');
  el.min = today;
  el.value = today;
}

async function handleSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;
  if (cart.length === 0) { showToast('Agrega al menos un producto.', 'error'); return; }

  showOverlay(true);

  const solicitud = {
    solicitante:    document.getElementById('solicitante').value.trim(),
    area:           document.getElementById('area').value,
    prioridad:      document.getElementById('prioridad').value,
    fechaRequerida: document.getElementById('fechaRequerida').value,
    notas:          document.getElementById('notas').value.trim(),
    correoDestino:  adminEmail,
    productos:      cart,
    estado:         'pendiente',
    createdAt:      new Date().toISOString()
  };

  try {
    const docRef = await db.collection('solicitudes').add(solicitud);
    await enviarCorreo(solicitud, docRef.id);
    showOverlay(false);
    showToast('¡Solicitud enviada y correo notificado!', 'success');
    resetForm();
  } catch (err) {
    showOverlay(false);
    if (err.emailError) {
      showToast('Solicitud guardada, pero el correo no pudo enviarse.', 'info');
      resetForm();
    } else {
      console.error(err);
      showToast('Error al guardar. Verifica tu conexión.', 'error');
    }
  }
}

async function enviarCorreo(solicitud, docId) {
  const productosTexto = solicitud.productos
    .map(p => `• ${p.nombre}: ${p.cantidad} ${p.unidad}`)
    .join('\n');
  const prioridadLabel = { normal: 'Normal', urgente: '🔴 URGENTE', programado: '🗓️ Programado' };
  try {
    await emailjs.send(emailjsConfig.serviceId, emailjsConfig.templateId, {
      to_email:        solicitud.correoDestino,
      from_name:       solicitud.solicitante,
      solicitud_id:    docId.slice(0, 8).toUpperCase(),
      solicitante:     solicitud.solicitante,
      area:            solicitud.area,
      prioridad:       prioridadLabel[solicitud.prioridad] || solicitud.prioridad,
      fecha_requerida: formatDate(solicitud.fechaRequerida),
      productos:       productosTexto,
      notas:           solicitud.notas || 'Sin observaciones adicionales'
    });
  } catch {
    const e = new Error('email'); e.emailError = true; throw e;
  }
}

function validateForm() {
  const ids = ['solicitante', 'area', 'prioridad', 'fechaRequerida'];
  let ok = true;
  ids.forEach(id => {
    const el = document.getElementById(id);
    const empty = !el.value.trim();
    el.classList.toggle('error', empty);
    if (empty) ok = false;
    el.addEventListener('input', () => el.classList.remove('error'), { once: true });
  });
  if (!ok) showToast('Completa todos los campos requeridos.', 'error');
  return ok;
}

function handleClear() {
  if (!confirm('¿Limpiar el formulario?')) return;
  resetForm();
}

function resetForm() {
  document.getElementById('requestForm').reset();
  setMinDate();
  cart = [];
  renderCart();
  document.getElementById('unidadLabel').textContent = '—';
}

// ── Helpers ──────────────────────────────────────────────────────
function showOverlay(show) {
  document.getElementById('overlay').classList.toggle('hidden', !show);
}

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

let toastTimer;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4500);
}
