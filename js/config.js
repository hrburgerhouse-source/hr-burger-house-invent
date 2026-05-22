// ================================================================
// PASO 1 — Firebase
// Crea tu proyecto en: https://console.firebase.google.com/
//   1. Nuevo proyecto > Agrega una app web
//   2. Habilita Firestore Database (modo de prueba)
//   3. Copia las credenciales aquí:
// ================================================================
const firebaseConfig = {
  apiKey:            "PEGA_TU_API_KEY",
  authDomain:        "PEGA_TU_AUTH_DOMAIN",
  projectId:         "PEGA_TU_PROJECT_ID",
  storageBucket:     "PEGA_TU_STORAGE_BUCKET",
  messagingSenderId: "PEGA_TU_MESSAGING_SENDER_ID",
  appId:             "PEGA_TU_APP_ID"
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
  publicKey:  "PEGA_TU_PUBLIC_KEY",
  serviceId:  "PEGA_TU_SERVICE_ID",
  templateId: "PEGA_TU_TEMPLATE_ID"
};

// ================================================================
// PASO 3 — Correo del encargado/administrador (receptor por defecto)
// ================================================================
const adminEmail = "encargado@tunegocio.com";

// --- Inicialización (no modificar) ---
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
emailjs.init(emailjsConfig.publicKey);
