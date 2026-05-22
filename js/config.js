// ================================================================
// PASO 1 — Firebase
// Crea tu proyecto en: https://console.firebase.google.com/
//   1. Nuevo proyecto > Agrega una app web
//   2. Habilita Firestore Database (modo de prueba)
//   3. Copia las credenciales aquí:
// ================================================================
const firebaseConfig = {
  apiKey:            "AIzaSyDXLhnKJ6AKPBw0z6cEEOHbvoJYbwBGP6g",
  authDomain:        "hr-burger-house-invent.firebaseapp.com",
  projectId:         "hr-burger-house-invent",
  storageBucket:     "hr-burger-house-invent.firebasestorage.app",
  messagingSenderId: "571449659906",
  appId:             "1:571449659906:web:88eeb364f01ee0b7cfcd1b"
};

// ================================================================
// PASO 2 — EmailJS  (gratis hasta 200 correos/mes)
// Regístrate en: https://www.emailjs.com/
//   1. Email Services > Conecta tu Gmail/Outlook
//   2. Email Templates > Nuevo template con estas variables:
//      {{to_email}}  {{from_name}}  {{solicitud_id}}
//      {{solicitante}}  {{area}}  {{prioridad}}
//      {{fecha_requerida}}  {{productos}}  {{notas}}
//   3. Account > Public Key
// ================================================================
const emailjsConfig = {
  publicKey:  "5vyyYW8nboAdFL7LG",
  serviceId:  "service_yvnco3q",
  templateId: "template_9nmy46c"
};

// ================================================================
// PASO 3 — Correo del encargado/administrador (receptor por defecto)
// ================================================================
const adminEmail = "encargado@tunegocio.com";

// --- Inicialización ---
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
emailjs.init(emailjsConfig.publicKey);

// --- Test de conexión (temporal) ---
db.collection('test').add({ ts: new Date().toISOString() })
  .then(() => alert('✅ Firebase conectado correctamente'))
  .catch(err => alert('❌ Error Firebase:\n' + err.code + '\n' + err.message));
