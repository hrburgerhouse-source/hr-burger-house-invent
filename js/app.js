let cart = [];
let catalogoProductos = [];

document.addEventListener('DOMContentLoaded', () => {
  cargarCatalogo();
  setMinDate();
  document.getElementById('requestForm').addEventListener('submit', handleSubmit);
  document.getElementById('clearBtn').addEventListener('click', handleClear);
});

// ── Cargar catálogo desde Firestore ─────────────────────────────
function cargarCatalogo() {
  db.collection('productos')
    .where('activo', '==', true)
    .orderBy('categoria')
    .onSnapshot(snap => {
      catalogoProductos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderSelector();
    }, () => {
      // Si no hay datos en Firestore, usar products.js como respaldo
      catalogoProductos = [];
      PRODUCTS.forEach(cat => {
        cat.items.forEach(item => {
          catalogoProductos.push({ id: item.id, nombre: item.name, categoria: cat.name, unidad: item.unit, activo: true });
        });
      });
      renderSelector();
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
    correoDestino:  document.getElementById('correoDestino').value.trim(),
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
  const ids = ['solicitante', 'area', 'prioridad', 'fechaRequerida', 'correoDestino'];
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
