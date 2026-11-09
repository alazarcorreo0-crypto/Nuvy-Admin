/**
 * Configuración principal de Nuvy Admin.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  PARA ACTIVAR LA SINCRONIZACIÓN ENTRE TELÉFONOS                      │
 * │                                                                      │
 * │  1. Crea un proyecto gratuito en https://console.firebase.google.com │
 * │  2. Activa Firestore Database.                                       │
 * │  3. Registra una app web y copia el objeto "firebaseConfig".          │
 * │  4. Reemplaza el valor null de abajo por ese objeto.                 │
 * │                                                                      │
 * │  El README.md explica todo paso a paso, sin conocimientos técnicos.  │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Ejemplo:
 *
 * firebase: {
 *   apiKey: "AIza...",
 *   authDomain: "mi-nuvy.firebaseapp.com",
 *   projectId: "mi-nuvy",
 *   storageBucket: "mi-nuvy.appspot.com",
 *   messagingSenderId: "1234567890",
 *   appId: "1:1234567890:web:abcdef123456"
 * }
 */
export const APP_CONFIG = {
  firebase: {
    apiKey: "AIzaSyD8Ch0KwqGv_QCTzyPBQ-rwxn5cp0OniRM",
    authDomain: "nuvy-admin.firebaseapp.com",
    projectId: "nuvy-admin",
    storageBucket: "nuvy-admin.firebasestorage.app",
    messagingSenderId: "7881586255",
    appId: "1:7881586255:web:bac8650744263c54be5c3a",
    measurementId: "G-13J7TZ447K"
  },

  /**
   * Zona horaria del negocio. Se usa para saber qué día es "hoy" y para
   * calcular la semana sábado-viernes aunque el teléfono esté en otro país.
   */
  businessTimeZone: 'America/Mexico_City',

  /**
   * Opcional: si quieres que todos los dispositivos entren directo con el
   * mismo código sin escribirlo, ponlo aquí. Si lo dejas vacío, la app pide
   * el código una sola vez y lo guarda en el teléfono.
   */
  defaultFamilyCode: '',

  appVersion: '1.0.2'
};