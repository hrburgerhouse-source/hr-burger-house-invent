document.addEventListener('DOMContentLoaded', () => {
  renderProductSections();
  setMinDate();
  document.getElementById('requestForm').addEventListener('submit', handleSubmit);
  document.getElementById('clearBtn').addEventListener('click', handleClear);
});

// ── Render ──────────────────────────────────────────────────────
function renderProductSections() {
  const container = document.getElementById('productSections');

  PRODUCTS.forEach(cat => {
    const section = document.createElement('div');
    section.className = 'card';
    section.innerHTML = `
      <div class="card-header">
        <span class="card-icon">${cat.icon}</span>
        <h2>${cat.name}</h2>
      </div>
      <div class="product-grid">
        ${cat.items.map(item => `
          <div class="product-item" id="wrap-${item.id}">
            <span class="product-name">${item.name}</span>
            <div class="product-input">
              <input
                type="number"
                id="${item.id}"
                min="0" step="1" value="0"
                data-unit="${item.unit}"
                data-name="${item.name}"
                data-cat="${cat.name}"
                oninput="onQtyChange(this)"
              >
              <span class="product-unit">${item.unit}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(section);
  });
}

function onQtyChange(input) {
  const qty = parseFloat(input.value) || 0;
  if (qty < 0) input.value = 0;
  document.getElementById('wrap-' + input.id).classList.toggle('active', qty > 0);
  updateSummary();
}

function updateSummary() {
  const selected = getSelected();
  const card = document.getElementById('summaryCard');
  const list = document.getElementById('summaryList');

  if (selected.length === 0) { card.classList.add('hidden'); return; }

  card.classList.remove('hidden');
  list.innerHTML = `<div class="summary-tags">${
    selected.map(p => `
      <span class="summary-tag">${p.name}: <strong>${p.cantidad} ${p.unit}</strong></span>
    `).join('')
  }</div>`;
}

function getSelected() {
  const result = [];
  PRODUCTS.forEach(cat => {
    cat.items.forEach(item => {
      const input = document.getElementById(item.id);
      const qty = parseFloat(input?.value) || 0;
      if (qty > 0) result.push({ id: item.id, name: item.name, unit: item.unit, cantidad: qty, categoria: cat.name });
    });
  });
  return result;
}

// ── Form handling ────────────────────────────────────────────────
function setMinDate() {
  const today = new Date().toISOString().split('T')[0];
  const el = document.getElementById('fechaRequerida');
  el.min = today;
  el.value = today;
}

async function handleSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const productos = getSelected();
  if (productos.length === 0) {
    showToast('Agrega al menos un producto a la solicitud.', 'error');
    return;
  }

  showOverlay(true);

  const solicitud = {
    solicitante:    document.getElementById('solicitante').value.trim(),
    area:           document.getElementById('area').value,
    prioridad:      document.getElementById('prioridad').value,
    fechaRequerida: document.getElementById('fechaRequerida').value,
    notas:          document.getElementById('notas').value.trim(),
    correoDestino:  document.getElementById('correoDestino').value.trim(),
    productos,
    estado:    'pendiente',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT: Firebase no respondió en 10 segundos. Verifica las reglas de Firestore.')), 10000)
  );

  try {
    const docRef = await Promise.race([
      db.collection('solicitudes').add(solicitud),
      timeout
    ]);
    await enviarCorreo(solicitud, docRef.id);
    showOverlay(false);
    showToast('¡Solicitud enviada y correo notificado!', 'success');
    resetForm();
  } catch (err) {
    showOverlay(false);
    console.error('ERROR DETALLADO:', err);
    if (err.emailError) {
      showToast('Solicitud guardada, pero el correo no pudo enviarse.', 'info');
      resetForm();
    } else {
      showToast('Error: ' + err.message, 'error');
    }
  }
}

async function enviarCorreo(solicitud, docId) {
  const productosTexto = solicitud.productos
    .map(p => `• ${p.name}: ${p.cantidad} ${p.unit}`)
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
  } catch (err) {
    const e = new Error('email');
    e.emailError = true;
    throw e;
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
  if (!confirm('¿Limpiar todo el formulario?')) return;
  resetForm();
}

function resetForm() {
  document.getElementById('requestForm').reset();
  setMinDate();
  PRODUCTS.forEach(cat => {
    cat.items.forEach(item => {
      const input = document.getElementById(item.id);
      if (input) input.value = 0;
      const wrap = document.getElementById('wrap-' + item.id);
      if (wrap) wrap.classList.remove('active');
    });
  });
  document.getElementById('summaryCard').classList.add('hidden');
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
