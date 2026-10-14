// CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyA28Fu-WSGTJ9MqAoN40y7_oA5FulfmEhY",
    authDomain: "notebooksofitecnica.firebaseapp.com",
    databaseURL: "https://notebooksofitecnica-default-rtdb.firebaseio.com",
    projectId: "notebooksofitecnica",
    storageBucket: "notebooksofitecnica.firebasestorage.app",
    messagingSenderId: "832805103138",
    appId: "1:832805103138:web:09abbec2d0674f59e54c7b"
};

// Inicializar Firebase Realtime Database
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// CONSTANTES
const CARTS = ['A', 'B', 'C'];
const PCS_PER_CART = 30;

// Tareas predefinidas de mantenimiento
const TASK_DEFINITIONS = [
    { id: 'limpieza', label: 'Limpieza física' },
    { id: 'so', label: 'Actualización S.O.' },
    { id: 'antivirus', label: 'Antivirus / Seguridad' },
    { id: 'bateria', label: 'Batería y Cargador' },
    { id: 'hardware', label: 'Teclado / Pantalla' }
];

// Estado Global de la Aplicación
let appData = {
    carts: {},
    lastUpdated: new Date().toISOString()
};

let currentTab = 'dashboard'; // 'dashboard', 'A', 'B', 'C'
let currentFilter = 'all'; // 'all', 'completed', 'pending', 'service'
let searchQuery = '';
let modalCallback = null;

// INICIALIZACIÓN Y SINCRONIZACIÓN EN TIEMPO REAL CON FIREBASE
window.addEventListener('DOMContentLoaded', () => {
    initFirebaseSync();
});

function initFirebaseSync() {
    const cartsRef = db.ref('notebook_carts');

    // Escuchar cambios en tiempo real desde cualquier PC conectada
    cartsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && data.carts) {
            appData = data;
            
            // Asegurar integridad de estructura por si falta algún carro o campo
            CARTS.forEach(cartKey => {
                if (!appData.carts[cartKey]) {
                    appData.carts[cartKey] = [];
                }
                appData.carts[cartKey].forEach(pc => {
                    if (!pc.status) {
                        pc.status = pc.completed ? 'completed' : 'pending';
                    }
                    if (!pc.tasks) {
                        pc.tasks = { limpieza: false, so: false, antivirus: false, bateria: false, hardware: false };
                    }
                });
            });
        } else {
            // Si la base de datos de Firebase está vacía, inicializar datos por defecto
            appData = generateDefaultData();
            saveToFirebase();
        }
        
        updateCloudStatus(true);
        updateUI();
    }, (error) => {
        console.error("Error de sincronización con Firebase:", error);
        updateCloudStatus(false);
        showToast("Error de conexión con la base de datos en la nube", "error");
    });
}

// Estructura limpia por defecto (3 Carros x 30 PCs = 90 PCs)
function generateDefaultData() {
    const carts = {};
    CARTS.forEach(cartKey => {
        carts[cartKey] = [];
        for (let i = 1; i <= PCS_PER_CART; i++) {
            const pcNum = i < 10 ? `0${i}` : `${i}`;
            carts[cartKey].push({
                id: i,
                code: `PC-${pcNum}`,
                status: 'pending', // 'completed', 'pending', 'service'
                date: '',
                tasks: {
                    limpieza: false,
                    so: false,
                    antivirus: false,
                    bateria: false,
                    hardware: false
                },
                notes: ''
            });
        }
    });
    return {
        carts: carts,
        lastUpdated: new Date().toISOString()
    };
}

// Guardar en la nube (Firebase)
function saveToFirebase() {
    appData.lastUpdated = new Date().toISOString();
    db.ref('notebook_carts').set(appData).catch((err) => {
        console.error("Error al guardar en Firebase:", err);
        showToast("No se pudo guardar la información en la nube", "error");
    });
}

function updateCloudStatus(isOnline) {
    const statusElem = document.getElementById('cloudStatusText');
    if (statusElem) {
        statusElem.innerText = isOnline ? "Nube Sincronizada" : "Sin Conexión";
    }
}

// NAVEGACIÓN Y PESTAÑAS
function switchTab(tab) {
    currentTab = tab;
    
    // Actualizar estilo de botones de pestañas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.className = "tab-btn px-4 py-2 text-xs sm:text-sm font-medium rounded-xl text-slate-300 hover:bg-slate-700/70 hover:text-white flex items-center space-x-2 whitespace-nowrap transition-all";
    });

    const activeBtn = document.getElementById(`tab-${tab}`);
    if (activeBtn) {
        activeBtn.className = "tab-btn px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl flex items-center space-x-2 whitespace-nowrap transition-all bg-sky-600 text-white shadow-sm";
    }

    // Alternar vistas
    if (tab === 'dashboard') {
        document.getElementById('view-dashboard').classList.remove('hidden');
        document.getElementById('view-cart').classList.add('hidden');
    } else {
        document.getElementById('view-dashboard').classList.add('hidden');
        document.getElementById('view-cart').classList.remove('hidden');
    }

    updateUI();
}

// ACTUALIZACIÓN GENERAL DE LA INTERFAZ
function updateUI() {
    updateTabBadges();
    
    if (currentTab === 'dashboard') {
        renderDashboard();
    } else {
        renderCartView(currentTab);
    }
}

// Actualizar contadores en insignias de pestañas
function updateTabBadges() {
    CARTS.forEach(cartKey => {
        const pcs = appData.carts[cartKey] || [];
        const completedCount = pcs.filter(pc => pc.status === 'completed').length;
        const serviceCount = pcs.filter(pc => pc.status === 'service').length;
        const badge = document.getElementById(`tab-badge-${cartKey}`);

        if (badge) {
            badge.innerText = `${completedCount}/30`;
            if (serviceCount > 0) {
                badge.className = "ml-1 px-2 py-0.5 text-[10px] bg-purple-500 text-white font-bold rounded-full";
            } else if (completedCount === 30) {
                badge.className = "ml-1 px-2 py-0.5 text-[10px] bg-emerald-500 text-white font-bold rounded-full";
            } else if (completedCount > 0) {
                badge.className = "ml-1 px-2 py-0.5 text-[10px] bg-sky-500 text-white font-bold rounded-full";
            } else {
                badge.className = "ml-1 px-2 py-0.5 text-[10px] bg-slate-700 text-slate-300 rounded-full font-bold";
            }
        }
    });
}

// RENDERIZAR VISTA GENERAL (DASHBOARD)
function renderDashboard() {
    let totalCompleted = 0;
    let totalPending = 0;
    let totalService = 0;
    let totalEquipos = CARTS.length * PCS_PER_CART;

    CARTS.forEach(cartKey => {
        const pcs = appData.carts[cartKey] || [];
        pcs.forEach(pc => {
            if (pc.status === 'completed') totalCompleted++;
            else if (pc.status === 'service') totalService++;
            else totalPending++;
        });
    });

    // Actualizar KPIs Globales
    document.getElementById('kpi-completed').innerText = `${totalCompleted} / ${totalEquipos}`;
    document.getElementById('kpi-pending').innerText = `${totalPending}`;
    document.getElementById('kpi-service').innerText = `${totalService}`;

    // Renderizar tarjetas para CARRO A, CARRO B y CARRO C
    const cartContainer = document.getElementById('dashboard-carts-container');
    cartContainer.innerHTML = '';

    CARTS.forEach(cartKey => {
        const pcs = appData.carts[cartKey] || [];
        const completed = pcs.filter(pc => pc.status === 'completed').length;
        const service = pcs.filter(pc => pc.status === 'service').length;
        const pending = pcs.filter(pc => pc.status === 'pending').length;
        const cartPct = Math.round((completed / PCS_PER_CART) * 100);

        const cardHtml = `
            <div class="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-sky-300 hover:shadow-md transition cursor-pointer flex flex-col justify-between" onclick="switchTab('${cartKey}')">
                <div>
                    <div class="flex justify-between items-center mb-3">
                        <span class="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                            <i class="fa-solid fa-truck-ramp-box text-sky-600"></i> CARRO ${cartKey}
                        </span>
                        <span class="px-2.5 py-1 text-xs font-extrabold rounded-full ${cartPct === 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}">
                            ${cartPct}% OK
                        </span>
                    </div>

                    <p class="text-xs text-slate-500 mb-4">30 Notebooks numeradas (#01 al #30)</p>

                    <div class="w-full bg-slate-200 rounded-full h-3 overflow-hidden mb-4">
                        <div class="h-3 rounded-full transition-all duration-500 ${cartPct === 100 ? 'bg-emerald-500' : 'bg-sky-600'}" style="width: ${cartPct}%"></div>
                    </div>

                    <div class="grid grid-cols-3 gap-2 text-center text-xs mb-2">
                        <div class="bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                            <span class="block font-bold text-emerald-700">${completed}</span>
                            <span class="text-[10px] text-emerald-600 font-medium">OK</span>
                        </div>
                        <div class="bg-amber-50 p-2 rounded-xl border border-amber-100">
                            <span class="block font-bold text-amber-700">${pending}</span>
                            <span class="text-[10px] text-amber-600 font-medium">Pendiente</span>
                        </div>
                        <div class="bg-purple-50 p-2 rounded-xl border border-purple-100">
                            <span class="block font-bold text-purple-700">${service}</span>
                            <span class="text-[10px] text-purple-600 font-medium">En Service</span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-200 mt-2">
                    <span>Mantenimiento: <strong class="${cartPct === 100 ? 'text-emerald-600' : 'text-slate-700'}">${completed}/30 completadas</strong></span>
                    <span class="text-sky-600 font-semibold flex items-center gap-1">
                        Ver Detalle <i class="fa-solid fa-chevron-right text-[10px]"></i>
                    </span>
                </div>
            </div>
        `;
        cartContainer.insertAdjacentHTML('beforeend', cardHtml);
    });

    renderTaskSummary();
}

// Resumen de Cobertura por Tarea Preventiva
function renderTaskSummary() {
    const summaryContainer = document.getElementById('tasks-summary-container');
    summaryContainer.innerHTML = '';

    TASK_DEFINITIONS.forEach(task => {
        let taskCompletedCount = 0;
        let totalPCs = CARTS.length * PCS_PER_CART;

        CARTS.forEach(cartKey => {
            (appData.carts[cartKey] || []).forEach(pc => {
                if (pc.tasks && pc.tasks[task.id]) taskCompletedCount++;
            });
        });

        const taskPct = Math.round((taskCompletedCount / totalPCs) * 100);

        const itemHtml = `
            <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div class="flex items-center gap-2 mb-2 text-slate-700">
                    <i class="fa-solid fa-check text-sky-600 text-xs"></i>
                    <span class="text-xs font-semibold leading-tight">${task.label}</span>
                </div>
                <div>
                    <div class="flex justify-between text-[11px] text-slate-500 font-medium mb-1">
                        <span>${taskCompletedCount} PCs</span>
                        <span>${taskPct}%</span>
                    </div>
                    <div class="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-sky-500 h-1.5 rounded-full" style="width: ${taskPct}%"></div>
                    </div>
                </div>
            </div>
        `;
        summaryContainer.insertAdjacentHTML('beforeend', itemHtml);
    });
}

// RENDERIZAR VISTA DE DETALLE DE CARRO
function renderCartView(cartKey) {
    const pcs = appData.carts[cartKey] || [];
    
    // Título y Progreso del Carro
    document.getElementById('cart-title').innerText = `CARRO ${cartKey}`;
    const completedCount = pcs.filter(pc => pc.status === 'completed').length;
    const pendingCount = pcs.filter(pc => pc.status === 'pending').length;
    const serviceCount = pcs.filter(pc => pc.status === 'service').length;
    const pct = Math.round((completedCount / PCS_PER_CART) * 100);

    document.getElementById('cart-progress-text').innerText = `${completedCount} / 30 (${pct}%)`;
    document.getElementById('cart-progress-bar').style.width = `${pct}%`;
    document.getElementById('cart-progress-bar').className = `h-2.5 rounded-full transition-all duration-300 ${pct === 100 ? 'bg-emerald-500' : 'bg-sky-600'}`;

    // Actualizar contadores de filtros
    document.getElementById('count-all').innerText = pcs.length;
    document.getElementById('count-completed').innerText = completedCount;
    document.getElementById('count-pending').innerText = pendingCount;
    document.getElementById('count-service').innerText = serviceCount;

    // Filtrar PCs
    let filtered = pcs.filter(pc => {
        if (currentFilter === 'completed' && pc.status !== 'completed') return false;
        if (currentFilter === 'pending' && pc.status !== 'pending') return false;
        if (currentFilter === 'service' && pc.status !== 'service') return false;

        if (searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase();
            const matchCode = pc.code.toLowerCase().includes(q);
            const matchNotes = (pc.notes || '').toLowerCase().includes(q);
            return matchCode || matchNotes;
        }

        return true;
    });

    const pcsGrid = document.getElementById('pcs-grid');
    pcsGrid.innerHTML = '';

    if (filtered.length === 0) {
        pcsGrid.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                <i class="fa-solid fa-laptop-medical text-4xl mb-2 text-slate-300"></i>
                <p class="text-sm font-medium">No se encontraron equipos con los filtros seleccionados.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(pc => {
        const card = createPCCard(cartKey, pc);
        pcsGrid.appendChild(card);
    });
}

// Crear tarjeta individual de PC
function createPCCard(cartKey, pc) {
    const div = document.createElement('div');
    
    let borderClass = 'border-slate-200';
    let statusBadge = '';

    if (pc.status === 'completed') {
        borderClass = 'border-emerald-300 bg-emerald-50/10 shadow-sm';
        statusBadge = `
            <span class="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                Mantenimiento OK
            </span>
        `;
    } else if (pc.status === 'service') {
        borderClass = 'border-purple-300 bg-purple-50/20 shadow-sm';
        statusBadge = `
            <span class="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
                <i class="fa-solid fa-screwdriver-wrench text-[10px]"></i>
                En Service
            </span>
        `;
    } else {
        statusBadge = `
            <span class="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                Pendiente
            </span>
        `;
    }

    let tasksHtml = '';
    TASK_DEFINITIONS.forEach(t => {
        const isChecked = pc.tasks && pc.tasks[t.id];
        tasksHtml += `
            <label class="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer hover:text-slate-900 select-none">
                <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="togglePCTask('${cartKey}', ${pc.id}, '${t.id}', this.checked)" class="rounded text-sky-600 focus:ring-sky-500 h-3.5 w-3.5 border-slate-300">
                <span>${t.label}</span>
            </label>
        `;
    });

    const dateValue = pc.date || '';

    div.className = `bg-white rounded-2xl border ${borderClass} p-4 transition-all duration-200 hover:shadow-md flex flex-col justify-between`;

    div.innerHTML = `
        <div>
            <!-- Header Card -->
            <div class="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
                <div class="flex items-center space-x-2.5">
                    <span class="p-2.5 ${pc.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : (pc.status === 'service' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600')} rounded-xl font-extrabold text-xs">
                        <i class="fa-solid fa-laptop"></i>
                    </span>
                    <span class="font-extrabold text-slate-800 text-base">${pc.code}</span>
                </div>

                <button onclick="toggleServiceStatus('${cartKey}', ${pc.id})" title="Marcar/Desmarcar En Service" class="px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all flex items-center space-x-1.5 ${pc.status === 'service' ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-slate-100 hover:bg-purple-50 text-slate-600 hover:text-purple-700 border-slate-200'}">
                    <i class="fa-solid fa-screwdriver-wrench text-[11px]"></i>
                    <span>${pc.status === 'service' ? 'En Service' : 'Service'}</span>
                </button>
            </div>

            <div class="mb-3 flex items-center justify-between gap-2 flex-wrap">
                ${statusBadge}

                <label class="inline-flex items-center cursor-pointer space-x-2 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 hover:bg-slate-100 transition">
                    <input type="checkbox" ${pc.status === 'completed' ? 'checked' : ''} onchange="togglePCCompleted('${cartKey}', ${pc.id}, this.checked)" class="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 border-slate-300">
                    <span class="text-xs font-bold text-slate-700 select-none">Mantenimiento OK</span>
                </label>
            </div>

            <div class="mb-3 flex items-center justify-between bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                <span class="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                    <i class="fa-regular fa-calendar-check text-slate-400"></i> Fecha:
                </span>
                <input type="date" value="${dateValue}" onchange="updatePCDate('${cartKey}', ${pc.id}, this.value)" class="text-xs text-slate-700 font-medium bg-white border border-slate-200 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-sky-500">
            </div>

            <div class="bg-slate-50/70 rounded-xl p-3 mb-3 border border-slate-100 space-y-2">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Checklist Preventivo</p>
                <div class="grid grid-cols-1 gap-1.5">
                    ${tasksHtml}
                </div>
            </div>
        </div>

        <div>
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Observaciones / Novedades</p>
            <textarea placeholder="Ej: Cambio de disco SSD, teclado OK, falla de batería..." onchange="updatePCNotes('${cartKey}', ${pc.id}, this.value)" rows="2" class="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all resize-none">${pc.notes || ''}</textarea>
        </div>
    `;

    return div;
}

// CAMBIOS DE ESTADO DE ACCIONES INDIVIDUALES
function togglePCCompleted(cartKey, pcId, isChecked) {
    const pc = appData.carts[cartKey].find(p => p.id === pcId);
    if (!pc) return;

    if (isChecked) {
        pc.status = 'completed';
        if (!pc.date) {
            pc.date = new Date().toISOString().split('T')[0];
        }
        TASK_DEFINITIONS.forEach(t => pc.tasks[t.id] = true);
    } else {
        pc.status = 'pending';
    }

    saveToFirebase();
    showToast(`${pc.code} (${cartKey}) marcado como ${isChecked ? 'Mantenimiento OK' : 'Pendiente'}`, isChecked ? 'success' : 'info');
}

function toggleServiceStatus(cartKey, pcId) {
    const pc = appData.carts[cartKey].find(p => p.id === pcId);
    if (!pc) return;

    if (pc.status === 'service') {
        pc.status = 'pending';
        showToast(`${pc.code} reingresado a Pendiente`, 'info');
    } else {
        pc.status = 'service';
        showToast(`${pc.code} derivado a Servicio Técnico (En Service)`, 'info');
    }

    saveToFirebase();
}

function togglePCTask(cartKey, pcId, taskId, isChecked) {
    const pc = appData.carts[cartKey].find(p => p.id === pcId);
    if (!pc) return;

    if (!pc.tasks) pc.tasks = {};
    pc.tasks[taskId] = isChecked;

    const allChecked = TASK_DEFINITIONS.every(t => pc.tasks[t.id]);
    if (allChecked && pc.status !== 'completed') {
        pc.status = 'completed';
        if (!pc.date) pc.date = new Date().toISOString().split('T')[0];
    }

    saveToFirebase();
}

function updatePCDate(cartKey, pcId, dateStr) {
    const pc = appData.carts[cartKey].find(p => p.id === pcId);
    if (!pc) return;

    pc.date = dateStr;
    saveToFirebase();
}

function updatePCNotes(cartKey, pcId, notesStr) {
    const pc = appData.carts[cartKey].find(p => p.id === pcId);
    if (!pc) return;

    pc.notes = notesStr;
    saveToFirebase();
}

// FILTROS Y BÚSQUEDA
function setFilter(filterType) {
    currentFilter = filterType;

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.className = "filter-btn flex-1 md:flex-none px-3.5 py-1.5 text-xs font-medium rounded-xl transition text-slate-600 hover:text-slate-900";
    });

    const activeBtn = document.getElementById(`filter-${filterType}`);
    if (activeBtn) {
        activeBtn.className = "filter-btn flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-xl transition text-slate-700 bg-white shadow-sm";
    }

    renderCartView(currentTab);
}

function handleSearch() {
    searchQuery = document.getElementById('searchInput').value;
    renderCartView(currentTab);
}

// ACCIONES MASIVAS
function markAllCurrentCart(completed) {
    if (currentTab === 'dashboard') return;
    
    const cartKey = currentTab;
    const today = new Date().toISOString().split('T')[0];

    appData.carts[cartKey].forEach(pc => {
        if (completed) {
            pc.status = 'completed';
            if (!pc.date) pc.date = today;
            TASK_DEFINITIONS.forEach(t => pc.tasks[t.id] = true);
        } else {
            pc.status = 'pending';
        }
    });

    saveToFirebase();
    showToast(`Todas las PCs del Carro ${cartKey} marcadas como ${completed ? 'Completadas' : 'Pendientes'}`, 'success');
}

function confirmResetCart() {
    if (currentTab === 'dashboard') return;
    const cartKey = currentTab;

    openConfirmModal(
        `Resetear CARRO ${cartKey}`,
        `¿Estás seguro de que deseas reiniciar el CARRO ${cartKey}? Se borrarán las fechas, notas y estados de mantenimiento.`,
        function() {
            appData.carts[cartKey].forEach(pc => {
                pc.status = 'pending';
                pc.date = '';
                pc.notes = '';
                TASK_DEFINITIONS.forEach(t => pc.tasks[t.id] = false);
            });
            saveToFirebase();
            showToast(`CARRO ${cartKey} restablecido correctamente`, 'info');
        }
    );
}

function confirmResetAll() {
    openConfirmModal(
        `Restablecer Todos los Carros`,
        `¿Deseas reiniciar completamente el estado de los Carros A, B y C en la nube?`,
        function() {
            appData = generateDefaultData();
            saveToFirebase();
            showToast(`Todos los carros han sido reiniciados`, 'info');
        }
    );
}

function loadSampleData() {
    openConfirmModal(
        `Cargar Datos de Prueba`,
        `Se cargarán datos de demostración con diferentes estados (OK, Pendiente, En Service) en los Carros A, B y C.`,
        function() {
            const sampleNotes = [
                'Mantenimiento regular OK.',
                'Pantalla limpia, SO actualizado.',
                'Derivado por teclado que no responde.',
                'Cambio de batería solicitado.',
                'Cargador nuevo provisto.',
                'En revisión técnica por falla en disco.',
                ''
            ];

            const today = new Date().toISOString().split('T')[0];

            CARTS.forEach((cartKey, cIdx) => {
                appData.carts[cartKey].forEach((pc, idx) => {
                    if ((idx + cIdx) % 7 === 0) {
                        pc.status = 'service';
                        pc.date = '';
                        pc.notes = sampleNotes[2];
                    } else if ((idx + cIdx) % 3 !== 0) {
                        pc.status = 'completed';
                        pc.date = today;
                        pc.notes = sampleNotes[idx % sampleNotes.length];
                        TASK_DEFINITIONS.forEach(t => pc.tasks[t.id] = true);
                    } else {
                        pc.status = 'pending';
                        pc.date = '';
                        pc.notes = '';
                        TASK_DEFINITIONS.forEach(t => pc.tasks[t.id] = false);
                    }
                });
            });

            saveToFirebase();
            showToast(`Datos de prueba cargados correctamente`, 'success');
        }
    );
}

// EXPORTACIÓN A EXCEL (.XLSX)
function exportConsolidatedToExcel() {
    try {
        const rows = [];

        CARTS.forEach(cartKey => {
            (appData.carts[cartKey] || []).forEach(pc => {
                const completedTasks = TASK_DEFINITIONS
                    .filter(t => pc.tasks && pc.tasks[t.id])
                    .map(t => t.label)
                    .join(', ');

                let statusLabel = 'PENDIENTE';
                if (pc.status === 'completed') statusLabel = 'COMPLETADO (OK)';
                else if (pc.status === 'service') statusLabel = 'EN SERVICE';

                rows.push({
                    'Carro': `Carro ${cartKey}`,
                    'N° de PC': pc.code,
                    'Estado': statusLabel,
                    'Fecha Mantenimiento': pc.date || '-',
                    'Tareas Preventivas': completedTasks || 'Ninguna',
                    'Observaciones': pc.notes || '-'
                });
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);

        worksheet['!cols'] = [
            { wch: 12 },
            { wch: 12 },
            { wch: 18 },
            { wch: 22 },
            { wch: 45 },
            { wch: 35 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Mantenimiento General");

        const fechaStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `Reporte_Mantenimiento_Carros_A_B_C_${fechaStr}.xlsx`);

        showToast("Reporte Excel consolidado exportado", "success");
    } catch (e) {
        console.error("Error al exportar a Excel:", e);
        showToast("Error al generar el archivo Excel", "error");
    }
}

function exportCurrentCartToExcel() {
    if (currentTab === 'dashboard') return;
    const cartKey = currentTab;

    try {
        const rows = (appData.carts[cartKey] || []).map(pc => {
            const completedTasks = TASK_DEFINITIONS
                .filter(t => pc.tasks && pc.tasks[t.id])
                .map(t => t.label)
                .join(', ');

            let statusLabel = 'PENDIENTE';
            if (pc.status === 'completed') statusLabel = 'COMPLETADO (OK)';
            else if (pc.status === 'service') statusLabel = 'EN SERVICE';

            return {
                'Carro': `Carro ${cartKey}`,
                'N° de PC': pc.code,
                'Estado': statusLabel,
                'Fecha Mantenimiento': pc.date || '-',
                'Tareas Preventivas': completedTasks || 'Ninguna',
                'Observaciones': pc.notes || '-'
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        worksheet['!cols'] = [
            { wch: 12 },
            { wch: 12 },
            { wch: 18 },
            { wch: 22 },
            { wch: 45 },
            { wch: 35 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `CARRO ${cartKey}`);

        const fechaStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `Reporte_Carro_${cartKey}_${fechaStr}.xlsx`);

        showToast(`Reporte de CARRO ${cartKey} exportado`, "success");
    } catch (e) {
        console.error("Error al exportar a Excel:", e);
        showToast("Error al generar el archivo Excel", "error");
    }
}

// MENÚ DESPLEGABLE DE AJUSTES
function toggleSettingsMenu() {
    const dropdown = document.getElementById('settingsDropdown');
    dropdown.classList.toggle('hidden');
}

window.addEventListener('click', function(e) {
    const btn = document.getElementById('settingsBtn');
    const dropdown = document.getElementById('settingsDropdown');
    if (btn && dropdown && !btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// MODAL DE CONFIRMACIÓN
function openConfirmModal(title, message, callback) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMessage').innerText = message;
    modalCallback = callback;
    document.getElementById('confirmModal').classList.remove('hidden');
}

function closeConfirmModal(confirmed) {
    document.getElementById('confirmModal').classList.add('hidden');
    if (confirmed && typeof modalCallback === 'function') {
        modalCallback();
    }
    modalCallback = null;
}

// NOTIFICACIONES TOAST
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    let bgClass = 'bg-slate-800 text-white';
    let iconClass = 'fa-info-circle text-sky-400';

    if (type === 'success') {
        bgClass = 'bg-emerald-800 text-white';
        iconClass = 'fa-circle-check text-emerald-300';
    } else if (type === 'error') {
        bgClass = 'bg-rose-800 text-white';
        iconClass = 'fa-circle-xmark text-rose-300';
    }

    toast.className = `pointer-events-auto flex items-center space-x-3 px-4 py-3 rounded-2xl shadow-xl ${bgClass} text-xs font-semibold transform transition-all duration-300 translate-y-2 opacity-0`;
    toast.innerHTML = `
        <i class="fa-solid ${iconClass} text-base"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
