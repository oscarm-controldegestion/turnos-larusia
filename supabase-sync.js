// ============================================================
// SUPABASE SYNC - Adaptador Universal para localStorage
// Reemplaza firebase-sync.js | App: turnos_larusia
// ============================================================

const SUPABASE_URL  = 'https://pyuzgwvnvejlqnpnlosu.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5dXpnd3ZudmVqbHFucG5sb3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDg5ODQsImV4cCI6MjA5MjEyNDk4NH0.mBlwyca_iMbOsPUARWyd6_KJsYi6NnpqM9b7fXWU38E';
const APP_NAMESPACE = 'turnos_larusia';

// Claves que NO se sincronizan (solo sesión local)
const LOCAL_ONLY_KEYS = ['currentUser', 'rusia_user'];

// ============================================================
// INICIALIZAR SUPABASE
// ============================================================
const _supa = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// HELPERS DE CLAVE
// ============================================================
function encodeKey(key) {
  return encodeURIComponent(key).replace(/\./g, '%2E');
}
function decodeKey(encoded) {
  return decodeURIComponent(encoded);
}

// ============================================================
// SINCRONIZACIÓN CON SUPABASE
// ============================================================
const _setItem    = Storage.prototype.setItem.bind(localStorage);
const _getItem    = Storage.prototype.getItem.bind(localStorage);
const _removeItem = Storage.prototype.removeItem.bind(localStorage);

async function syncToSupabase(key, value) {
  if (LOCAL_ONLY_KEYS.includes(key)) return;
  const encodedKey = encodeKey(key);
  await _supa.from('kv_store').upsert({
    namespace: APP_NAMESPACE,
    key: encodedKey,
    value: { value: value, ts: Date.now() },
    ts: Date.now()
  });
}

async function removeFromSupabase(key) {
  if (LOCAL_ONLY_KEYS.includes(key)) return;
  const encodedKey = encodeKey(key);
  await _supa.from('kv_store')
    .delete()
    .eq('namespace', APP_NAMESPACE)
    .eq('key', encodedKey);
}

// Override localStorage.setItem
Storage.prototype.setItem = function(key, value) {
  _setItem(key, value);
  syncToSupabase(key, value).catch(e => console.warn('Supabase write error:', e));
};

// Override localStorage.removeItem
Storage.prototype.removeItem = function(key) {
  _removeItem(key);
  removeFromSupabase(key).catch(e => console.warn('Supabase remove error:', e));
};

// ============================================================
// CARGA INICIAL desde Supabase → localStorage
// ============================================================
window._supabaseSyncReady = false;

function showSyncOverlay() {
  const div = document.createElement('div');
  div.id = '_supabase_overlay';
  div.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
    'background:rgba(0,0,0,0.75)', 'z-index:99999',
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center',
    'color:white', 'font-family:sans-serif'
  ].join(';');
  div.innerHTML = `
    <div style="text-align:center">
      <div style="font-size:2.5rem;margin-bottom:12px">☁️</div>
      <div style="font-size:1.1rem;font-weight:600">Sincronizando datos...</div>
      <div style="font-size:0.85rem;opacity:0.7;margin-top:6px">Conectando con la nube</div>
    </div>
  `;
  const mount = () => document.body.appendChild(div);
  document.body ? mount() : document.addEventListener('DOMContentLoaded', mount);
  return div;
}

function removeSyncOverlay() {
  const el = document.getElementById('_supabase_overlay');
  if (el) el.remove();
}

async function loadAllFromSupabase() {
  const overlay = showSyncOverlay();
  try {
    const { data, error } = await _supa
      .from('kv_store')
      .select('key, value')
      .eq('namespace', APP_NAMESPACE);

    if (error) throw error;

    if (data && data.length > 0) {
      let loaded = 0;
      for (const row of data) {
        const key = decodeKey(row.key);
        const entry = row.value;
        if (entry && entry.value !== undefined) {
          _setItem(key, entry.value);
          loaded++;
        }
      }
      console.log(`✓ Supabase: ${loaded} claves cargadas desde la nube`);
    } else {
      console.log('ℹ️ Supabase: No hay datos en la nube todavía (primera vez)');
    }
  } catch(e) {
    console.warn('⚠️ Supabase: Error cargando datos, usando localStorage local:', e.message);
  } finally {
    window._supabaseSyncReady = true;
    removeSyncOverlay();
  }
}

// ============================================================
// ESCUCHA CAMBIOS EN TIEMPO REAL (multi-dispositivo)
// ============================================================
let _initialLoadDone = false;

_supa.channel('kv_store_changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'kv_store',
    filter: `namespace=eq.${APP_NAMESPACE}`
  }, (payload) => {
    if (!_initialLoadDone) return;
    const row = payload.new || payload.old;
    if (!row) return;
    const key = decodeKey(row.key);
    if (LOCAL_ONLY_KEYS.includes(key)) return;
    if (payload.eventType === 'DELETE') {
      _removeItem(key);
    } else if (row.value && row.value.value !== undefined) {
      const localVal = _getItem(key);
      if (localVal !== row.value.value) {
        _setItem(key, row.value.value);
        if (typeof window.refreshCurrentView === 'function') {
          console.log('🔄 Datos actualizados desde otro dispositivo');
          window.refreshCurrentView();
        }
      }
    }
  })
  .subscribe();

// ============================================================
// INTERCEPTAR DOMContentLoaded para que la app espere a Supabase
// ============================================================
const originalAddEventListener = document.addEventListener.bind(document);
const pendingListeners = [];

document.addEventListener = function(type, listener, options) {
  if (type === 'DOMContentLoaded' && !window._supabaseSyncReady) {
    pendingListeners.push({ listener, options });
  } else {
    originalAddEventListener(type, listener, options);
  }
};

originalAddEventListener('DOMContentLoaded', async () => {
  await loadAllFromSupabase();
  _initialLoadDone = true;
  document.addEventListener = originalAddEventListener;
  for (const { listener, options } of pendingListeners) {
    try { listener(); } catch(e) { console.error('Error en listener de app:', e); }
  }
});

console.log('✓ supabase-sync.js cargado | App:', APP_NAMESPACE);
