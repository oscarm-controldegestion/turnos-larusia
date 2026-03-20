// ============================================================
// FIREBASE SYNC - Adaptador Universal para localStorage
// VersiÃ³n: 1.0 | App: turnos-larusia
//
// INSTRUCCIONES:
// 1. Agrega esto en tu index.html ANTES de app.js:
//    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
//    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
//    <script src="firebase-sync.js"></script>
// 2. Rellena TU configuraciÃ³n de Firebase abajo
// ============================================================

// ===== CONFIGURACION FIREBASE - RELLENA ESTO =====
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBs2LUVSVSWBwuzet8hqAhM4PUOatmDjIo",
  authDomain: "larusia-apps.firebaseapp.com",
  databaseURL: "https://larusia-apps-default-rtdb.firebaseio.com/",
  projectId: "larusia-apps",
  storageBucket: "larusia-apps.firebasestorage.app",
  messagingSenderId: "196879088302",
  appId: "1:196879088302:web:8d20d5a8cb1ea46737cb3f"
};

// Identificador Ãºnico de esta app en Firebase (no cambiar)
const APP_NAMESPACE = 'turnos_larusia';

// ============================================================
// INICIALIZAR FIREBASE
// ============================================================
try {
  firebase.initializeApp(FIREBASE_CONFIG);
} catch(e) {
  if (!e.message.includes('already exists')) {
    console.error('Error iniciando Firebase:', e);
  }
}
const _db = firebase.database();

// ============================================================
// ADAPTADOR: intercepts localStorage para sincronizar con Firebase
// ============================================================
(function() {
  const _setItem   = Storage.prototype.setItem.bind(localStorage);
  const _getItem   = Storage.prototype.getItem.bind(localStorage);
  const _removeItem = Storage.prototype.removeItem.bind(localStorage);

  // Claves que NO se sincronizan (solo sesiÃ³n local)
  const LOCAL_ONLY_KEYS = ['currentUser', 'rusia_user'];

  // Codifica claves para Firebase (no permite . # $ [ ] /)
  function encodeKey(key) {
    return encodeURIComponent(key).replace(/\./g, '%2E');
  }

  // Decodifica claves de Firebase
  function decodeKey(encoded) {
    return decodeURIComponent(encoded);
  }

  // Escribe en Firebase
  function syncToFirebase(key, value) {
    if (LOCAL_ONLY_KEYS.includes(key)) return;
    _db.ref(`apps/${APP_NAMESPACE}/${encodeKey(key)}`).set({
      value: value,
      ts: Date.now()
    }).catch(err => console.warn('Firebase write error:', err));
  }

  // Elimina de Firebase
  function removeFromFirebase(key) {
    if (LOCAL_ONLY_KEYS.includes(key)) return;
    _db.ref(`apps/${APP_NAMESPACE}/${encodeKey(key)}`).remove()
      .catch(err => console.warn('Firebase remove error:', err));
  }

  // Override localStorage.setItem
  Storage.prototype.setItem = function(key, value) {
    _setItem(key, value);
    syncToFirebase(key, value);
  };

  // Override localStorage.removeItem
  Storage.prototype.removeItem = function(key) {
    _removeItem(key);
    removeFromFirebase(key);
  };

  // ============================================================
  // CARGA INICIAL desde Firebase â localStorage
  // ============================================================
  window._firebaseSyncReady = false;

  // Mostrar loading mientras sincroniza
  function showSyncOverlay() {
    const div = document.createElement('div');
    div.id = '_firebase_overlay';
    div.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'background:rgba(0,0,0,0.75)', 'z-index:99999',
      'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'color:white', 'font-family:sans-serif'
    ].join(';');
    div.innerHTML = `
      <div style="text-align:center">
        <div style="font-size:2.5rem;margin-bottom:12px">ð</div>
        <div style="font-size:1.1rem;font-weight:600">Sincronizando datos...</div>
        <div style="font-size:0.85rem;opacity:0.7;margin-top:6px">Conectando con la nube</div>
      </div>
    `;
    document.body ? document.body.appendChild(div) : document.addEventListener('DOMContentLoaded', () => document.body.appendChild(div));
    return div;
  }

  function removeSyncOverlay() {
    const el = document.getElementById('_firebase_overlay');
    if (el) el.remove();
  }

  // Carga todos los datos de Firebase en localStorage
  async function loadAllFromFirebase() {
    const overlay = showSyncOverlay();
    try {
      const snap = await _db.ref(`apps/${APP_NAMESPACE}`).get();
      if (snap.exists()) {
        const data = snap.val();
        let loaded = 0;
        for (const [encodedKey, entry] of Object.entries(data)) {
          const key = decodeKey(encodedKey);
          if (entry && entry.value !== undefined) {
            _setItem(key, entry.value);
            loaded++;
          }
        }
        console.log(`â Firebase: ${loaded} claves cargadas desde la nube`);
      } else {
        console.log('â¹ï¸ Firebase: No hay datos en la nube todavÃ­a (primera vey)');
      }
    } catch(e) {
      console.warn('â ï¸ Firebase: Error cargando datos, usando localStorage local:', e.message);
    } finally {
      window._firebaseSyncReady = true;
      removeSyncOverlay();
    }
  }

  // ============================================================
  // ESCUCHA CAMBIOS EN TIEMPO REAL (multi-dispositivo)
  // ============================================================
  let initialLoadDone = false;

  _db.ref(`apps/${APP_NAMESPACE}`).on('value', (snap) => {
    if (!initialLoadDone) return; // Primera carga la maneja loadAllFromFirebase
    if (!snap.exists()) return;

    const data = snap.val();
    let changed = false;

    for (const [encodedKey, entry] of Object.entries(data)) {
      const key = decodeKey(encodedKey);
      if (LOCAL_ONLY_KEYS.includes(key)) continue;
      if (entry && entry.value !== undefined) {
        const localVal = _getItem(key);
        if (localVal !== entry.value) {
          _setItem(key, entry.value);
          changed = true;
        }
      }
    }

    // Si hubo cambios de otro dispositivo, refrescar la UI
    if (changed && typeof window.refreshCurrentView === 'function') {
      console.log('ð Datos actualizados desde otro dispositivo');
      window.refreshCurrentView();
    }
  });

  // Esperar a que el DOM estÃ© listo, cargar datos y LUEGO dejar que la app arranque
  const originalAddEventListener = document.addEventListener.bind(document);

  // Parche: interceptar DOMContentLoaded para que la app espere a Firebase
  const pendingListeners = [];
  document.addEventListener = function(type, listener, options) {
    if (type === 'DOMContentLoaded' && !window._firebaseSyncReady) {
      pendingListeners.push({ listener, options });
    } else {
      originalAddEventListener(type, listener, options);
    }
  };

  // Cuando el DOM estÃ© listo: primero sync Firebase, luego ejecutar listeners de la app
  originalAddEventListener('DOMContentLoaded', async () => {
    await loadAllFromFirebase();
    initialLoadDone = true;

    // Restaurar addEventListener original
    document.addEventListener = originalAddEventListener;

    // Ejecutar todos los listeners que la app habÃ­a registrado
    for (const { listener, options } of pendingListeners) {
      try {
        listener();
      } catch(e) {
        console.error('Error en listener de app:', e);
      }
    }
  });

})();

console.log('â firebase-sync.js cargado | App:', 'turnos_larusia');
