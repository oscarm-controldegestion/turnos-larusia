// ===== CONFIGURACION DE USUARIOS =====
const USERS = {
  admin:    { password: 'admin123',    role: 'admin',    name: 'Administrador',  section: 'Administracion' },
  cocina:   { password: 'cocina123',   role: 'encargado', name: 'Encargado Cocina', section: 'Cocina' },
  servicio: { password: 'servicio123', role: 'encargado', name: 'Encargado Servicio', section: 'Servicio' },
  sushi:    { password: 'sushi123',    role: 'encargado', name: 'Encargado Sushi', section: 'Sushi' },
  barra:    { password: 'barra123',    role: 'encargado', name: 'Encargado Barra', section: 'Barra' }
};

// ===== EMPLEADOS POR SECCION =====
const EMPLEADOS = {
  cocina:   ['Chef Principal', 'Sous Chef', 'Cocinero 1', 'Cocinero 2', 'Cocinero 3', 'Ayudante 1', 'Ayudante 2'],
  servicio: ['Jefe de Sala', 'Mozo 1', 'Mozo 2', 'Mozo 3', 'Mozo 4', 'Runner 1', 'Runner 2'],
  sushi:    ['Sushiman Principal', 'Sushiman 2', 'Ayudante Sushi 1', 'Ayudante Sushi 2'],
  barra:    ['Bartender Principal', 'Bartender 2', 'Barback 1', 'Barback 2'],
  admin:    ['Admin 1', 'Admin 2']
};

const TURNOS = [
  { value: '', label: '-- Turno --' },
  { value: 'M', label: 'Manana (M)', css: 'shift-morning' },
  { value: 'T', label: 'Tarde (T)', css: 'shift-afternoon' },
  { value: 'N', label: 'Noche (N)', css: 'shift-night' },
  { value: 'MT', label: 'Partido (MT)', css: 'shift-morning' },
  { value: 'L', label: 'Libre (L)', css: 'shift-free' },
  { value: 'V', label: 'Vacaciones (V)', css: 'shift-vacation' },
  { value: 'F', label: 'Franco (F)', css: 'shift-free' }
];

const DIAS_ES = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

let currentUser = null;
let currentData = {};

// ===== INICIALIZACION =====
document.addEventListener('DOMContentLoaded', () => {
  const saved = sessionStorage.getItem('currentUser');
  if (saved) {
    currentUser = JSON.parse(saved);
    showApp();
  }

  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
});

// ===== LOGIN =====
function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const errEl = document.getElementById('login-error');

  if (USERS[username] && USERS[username].password === password) {
    currentUser = { username, ...USERS[username] };
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    errEl.classList.add('hidden');
    showApp();
  } else {
    errEl.classList.remove('hidden');
  }
}

function handleLogout() {
  sessionStorage.removeItem('currentUser');
  currentUser = null;
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('welcome-msg').textContent = 'Bienvenido, ' + currentUser.name;

  // Mostrar boton Excel solo para admin
  if (currentUser.role === 'admin') {
    document.getElementById('excel-semana').classList.remove('hidden');
    document.getElementById('excel-mes').classList.remove('hidden');
  }

  // Cargar grillas
  buildSemanaGrid();
  buildMesGrid();
  loadSavedTurnos();
}

// ===== TABS =====
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
  document.getElementById('tab-' + tab).classList.remove('hidden');

  if (tab === 'ver') loadSavedTurnos();
}

// ===== CALCULOS DE FECHAS =====
function getNextWeek() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  nextMonday.setHours(0,0,0,0);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(nextMonday);
    d.setDate(nextMonday.getDate() + i);
    days.push(d);
  }
  return days;
}

function getNextMonthDays() {
  const today = new Date();
  const nextMonth = today.getMonth() + 1;
  const year = nextMonth === 12 ? today.getFullYear() + 1 : today.getFullYear();
  const month = nextMonth === 12 ? 0 : nextMonth;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const days = [];
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }
  return { days, month, year };
}

function formatDate(d) {
  return DIAS_ES[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth()+1);
}

// ===== OBTENER EMPLEADOS SEGUN USUARIO =====
function getEmpleados() {
  if (currentUser.role === 'admin') {
    // Admin ve todas las secciones
    const all = [];
    for (const section in EMPLEADOS) {
      EMPLEADOS[section].forEach(e => all.push({ name: e, section }));
    }
    return all;
  }
  return (EMPLEADOS[currentUser.username] || []).map(e => ({ name: e, section: currentUser.username }));
}

// ===== CONSTRUIR GRILLA SEMANA =====
function buildSemanaGrid() {
  const days = getNextWeek();
  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  document.getElementById('semana-title').textContent =
    'Turno Semana: ' + firstDay.getDate() + '/' + (firstDay.getMonth()+1) + ' - ' +
    lastDay.getDate() + '/' + (lastDay.getMonth()+1) + '/' + lastDay.getFullYear();
  document.getElementById('semana-info').textContent =
    'Semana del ' + formatDate(firstDay) + ' al ' + formatDate(lastDay) + ' de ' + lastDay.getFullYear();

  const savedKey = 'turno_semana_' + firstDay.toISOString().split('T')[0];
  const savedData = JSON.parse(localStorage.getItem(savedKey) || '{}');

  buildGrid('semana-grid', days, savedData, 'semana', firstDay.toISOString().split('T')[0]);
}

// ===== CONSTRUIR GRILLA MES =====
function buildMesGrid() {
  const { days, month, year } = getNextMonthDays();
  const mesNombre = MESES_ES[month];

  document.getElementById('mes-title').textContent = 'Turno Mes: ' + mesNombre + ' ' + year;
  document.getElementById('mes-info').textContent =
    'Mes de ' + mesNombre + ' ' + year + ' - ' + days.length + ' dias';

  const savedKey = 'turno_mes_' + year + '_' + month;
  const savedData = JSON.parse(localStorage.getItem(savedKey) || '{}');

  buildGrid('mes-grid', days, savedData, 'mes', year + '_' + month);
}

// ===== CONSTRUIR GRILLA GENERICA =====
function buildGrid(containerId, days, savedData, type, keyId) {
  const container = document.getElementById(containerId);
  const empleados = getEmpleados();

  let html = '<table class="shift-table"><thead><tr>';
  html += '<th>Empleado</th>';
  days.forEach(d => {
    html += '<th class="day-header">' + formatDate(d) + '</th>';
  });
  html += '</tr></thead><tbody>';

  empleados.forEach(emp => {
    const rowKey = emp.section + '_' + emp.name;
    html += '<tr>';
    html += '<td class="employee-cell">' + emp.name + '<br><small style="color:#888;font-size:0.7rem;">' + emp.section + '</small></td>';

    days.forEach((d, idx) => {
      const cellKey = rowKey + '_' + idx;
      const savedVal = savedData[cellKey] || '';
      const savedTurno = TURNOS.find(t => t.value === savedVal);
      const cssClass = savedTurno ? savedTurno.css : '';

      html += '<td class="' + cssClass + '" id="cell_' + type + '_' + rowKey.replace(/[^a-zA-Z0-9]/g,'_') + '_' + idx + '">';
      html += '<select class="shift-select" data-type="' + type + '" data-key="' + cellKey + '" data-row="' + rowKey + '" data-col="' + idx + '" onchange="onShiftChange(this)">';
      TURNOS.forEach(t => {
        html += '<option value="' + t.value + '"' + (savedVal === t.value ? ' selected' : '') + '>' + t.label + '</option>';
      });
      html += '</select></td>';
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;
  currentData[type] = { days, keyId, savedData: { ...savedData } };
}

// ===== CAMBIO DE TURNO =====
function onShiftChange(select) {
  const val = select.value;
  const turno = TURNOS.find(t => t.value === val);
  const td = select.parentElement;

  // Limpiar clases de color
  TURNOS.forEach(t => { if (t.css) td.classList.remove(t.css); });
  if (turno && turno.css) td.classList.add(turno.css);

  // Guardar en currentData
  const type = select.dataset.type;
  const key = select.dataset.key;
  if (!currentData[type]) currentData[type] = { savedData: {} };
  if (!currentData[type].savedData) currentData[type].savedData = {};
  currentData[type].savedData[key] = val;
}

// ===== GUARDAR TURNO =====
function saveTurno(type) {
  const data = currentData[type];
  if (!data) return;

  const selectsInGrid = document.querySelectorAll('[data-type="' + type + '"]');
  const toSave = {};
  selectsInGrid.forEach(sel => {
    toSave[sel.dataset.key] = sel.value;
  });

  const savedKey = 'turno_' + type + '_' + data.keyId;
  // Merge con datos existentes
  const existing = JSON.parse(localStorage.getItem(savedKey) || '{}');
  const merged = { ...existing, ...toSave };
  localStorage.setItem(savedKey, JSON.stringify(merged));

  // Guardar metadatos
  const metaKey = 'turno_meta_' + type + '_' + data.keyId;
  const meta = {
    type,
    keyId: data.keyId,
    savedBy: currentUser.name,
    savedAt: new Date().toISOString(),
    section: currentUser.section
  };
  localStorage.setItem(metaKey, JSON.stringify(meta));

  showToast('Turno guardado correctamente', 'success');
  loadSavedTurnos();
}

// ===== VER TURNOS GUARDADOS =====
function loadSavedTurnos() {
  const container = document.getElementById('saved-turnos-list');
  const items = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('turno_meta_')) {
      const meta = JSON.parse(localStorage.getItem(key) || '{}');
      items.push(meta);
    }
  }

  if (items.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:2rem;color:#888;background:white;border-radius:10px;">No hay turnos guardados aun.</div>';
    return;
  }

  items.sort((a,b) => new Date(b.savedAt) - new Date(a.savedAt));

  let html = '<div class="saved-list">';
  items.forEach(item => {
    const label = item.type === 'semana' ?
      'Semana ' + item.keyId :
      'Mes ' + MESES_ES[parseInt(item.keyId.split('_')[1])] + ' ' + item.keyId.split('_')[0];

    const dt = new Date(item.savedAt);
    const dtStr = dt.toLocaleDateString('es-AR') + ' ' + dt.toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit'});

    html += '<div class="saved-item">';
    html += '<div class="saved-item-header">';
    html += '<div>';
    html += '<div class="saved-item-title">' + (item.type === 'semana' ? 'Semana' : 'Mes') + ': ' + label + '</div>';
    html += '<div class="saved-item-meta">Guardado por: ' + item.savedBy + ' | ' + item.section + ' | ' + dtStr + '</div>';
    html += '</div>';
    html += '<div class="saved-item-actions">';
    html += '<button class="btn-secondary" onclick="exportPDFSaved(\'' + item.type + '\',\'' + item.keyId + '\')">PDF</button>';
    if (currentUser && currentUser.role === 'admin') {
      html += '<button class="btn-excel" onclick="exportExcelSaved(\'' + item.type + '\',\'' + item.keyId + '\')">Excel</button>';
    }
    html += '</div></div></div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

// ===== OBTENER DATOS PARA EXPORTAR =====
function getExportData(type, keyId) {
  let days, label;
  if (type === 'semana') {
    days = getNextWeek();
    label = 'Semana ' + keyId;
    const k = keyId || (days[0].toISOString().split('T')[0]);
    const savedData = JSON.parse(localStorage.getItem('turno_semana_' + k) || '{}');
    return { days, label, savedData };
  } else {
    const parts = keyId.split('_');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    days = [];
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    label = 'Mes de ' + MESES_ES[month] + ' ' + year;
    const savedData = JSON.parse(localStorage.getItem('turno_mes_' + keyId) || '{}');
    return { days, label, savedData };
  }
}

// ===== EXPORTAR PDF =====
function exportPDF(type) {
  const data = currentData[type];
  if (!data) { showToast('No hay datos para exportar', 'error'); return; }
  exportPDFSaved(type, data.keyId);
}

function exportPDFSaved(type, keyId) {
  const { days, label, savedData } = getExportData(type, keyId);
  const empleados = getEmpleados();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: days.length > 10 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(16);
  doc.setTextColor(26, 26, 46);
  doc.text('Gestion de Turnos - Restaurante', 14, 16);
  doc.setFontSize(11);
  doc.text(label, 14, 24);
  doc.text('Seccion: ' + (currentUser ? currentUser.section : 'Todas'), 14, 31);
  doc.setFontSize(9);
  doc.text('Exportado: ' + new Date().toLocaleDateString('es-AR'), 14, 38);

  const head = [['Empleado', ...days.map(d => formatDate(d))]];
  const body = empleados.map(emp => {
    const rowKey = emp.section + '_' + emp.name;
    const row = [emp.name + '\n(' + emp.section + ')'];
    days.forEach((d, idx) => {
      const cellKey = rowKey + '_' + idx;
      row.push(savedData[cellKey] || '-');
    });
    return row;
  });

  doc.autoTable({
    head,
    body,
    startY: 44,
    styles: { fontSize: days.length > 15 ? 6 : 8, cellPadding: 2, halign: 'center' },
    headStyles: { fillColor: [26, 26, 46], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left', cellWidth: 32 } },
    alternateRowStyles: { fillColor: [245, 247, 255] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index > 0) {
        const val = data.cell.raw;
        if (val === 'M') data.cell.styles.fillColor = [255, 249, 196];
        else if (val === 'T') data.cell.styles.fillColor = [227, 242, 253];
        else if (val === 'N') data.cell.styles.fillColor = [243, 229, 245];
        else if (val === 'L' || val === 'F') data.cell.styles.fillColor = [241, 248, 233];
        else if (val === 'V') data.cell.styles.fillColor = [252, 228, 236];
        else if (val === 'MT') data.cell.styles.fillColor = [255, 243, 224];
      }
    }
  });

  // Leyenda
  const finalY = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(7);
  doc.text('Leyenda: M=Manana | T=Tarde | N=Noche | MT=Partido | L=Libre | F=Franco | V=Vacaciones', 14, finalY);

  doc.save('turno_' + type + '_' + keyId + '.pdf');
  showToast('PDF generado correctamente', 'success');
}

// ===== EXPORTAR EXCEL =====
function exportExcel(type) {
  if (!currentUser || currentUser.role !== 'admin') { showToast('Solo el admin puede exportar Excel', 'error'); return; }
  const data = currentData[type];
  if (!data) { showToast('No hay datos para exportar', 'error'); return; }
  exportExcelSaved(type, data.keyId);
}

function exportExcelSaved(type, keyId) {
  if (!currentUser || currentUser.role !== 'admin') { showToast('Solo el admin puede exportar Excel', 'error'); return; }
  const { days, label, savedData } = getExportData(type, keyId);
  const empleados = getEmpleados();

  const wb = XLSX.utils.book_new();

  // Hoja de turnos
  const wsData = [];
  wsData.push(['Gestion de Turnos - Restaurante']);
  wsData.push([label]);
  wsData.push(['Exportado:', new Date().toLocaleDateString('es-AR')]);
  wsData.push([]);
  wsData.push(['Empleado', 'Seccion', ...days.map(d => formatDate(d))]);

  empleados.forEach(emp => {
    const rowKey = emp.section + '_' + emp.name;
    const row = [emp.name, emp.section];
    days.forEach((d, idx) => {
      const cellKey = rowKey + '_' + idx;
      row.push(savedData[cellKey] || '');
    });
    wsData.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Anchos de columna
  const cols = [{ wch: 25 }, { wch: 15 }];
  days.forEach(() => cols.push({ wch: 8 }));
  ws['!cols'] = cols;

  XLSX.utils.book_append_sheet(wb, ws, 'Turnos');

  // Hoja de resumen
  const resData = [['Resumen de Turnos']];
  resData.push(['Empleado', 'Seccion', 'M (Man)', 'T (Tarde)', 'N (Noche)', 'MT', 'L (Libre)', 'F (Franco)', 'V (Vac)', 'Total Dias']);

  empleados.forEach(emp => {
    const rowKey = emp.section + '_' + emp.name;
    const counts = { M:0, T:0, N:0, MT:0, L:0, F:0, V:0 };
    days.forEach((d, idx) => {
      const cellKey = rowKey + '_' + idx;
      const val = savedData[cellKey] || '';
      if (counts[val] !== undefined) counts[val]++;
    });
    resData.push([emp.name, emp.section, counts.M, counts.T, counts.N, counts.MT, counts.L, counts.F, counts.V, days.length]);
  });

  const ws2 = XLSX.utils.aoa_to_sheet(resData);
  ws2['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');

  XLSX.writeFile(wb, 'turnos_' + type + '_' + keyId + '.xlsx');
  showToast('Excel generado correctamente', 'success');
}

// ===== TOAST =====
function showToast(msg, type) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast ' + (type || '');
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}
