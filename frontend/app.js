const API_BASE = "http://127.0.0.1:8000";
let allPackages = { apt: [], snap: [], pip: [] };
let selections = []; 
let currentOpenPackage = null;
let SESSION_KEY = localStorage.getItem('nixray_session_key') || "";

/**
 * SECURITY HANDSHAKE
 * Authenticates the UI against the Backend.
 */
async function authenticateSession() {
    const input = document.getElementById('sessionKeyInput');
    const key = input.value.trim();
    
    if (!key) return;

    try {
        // Attempt a test fetch to verify the key
        const res = await fetch(`${API_BASE}/packages/all`, {
            headers: { 'X-NIXRAY-KEY': key }
        });

        if (res.status === 200) {
            SESSION_KEY = key;
            localStorage.setItem('nixray_session_key', key);
            document.getElementById('securityOverlay').classList.add('opacity-0', 'pointer-events-none');
            fetchPackages();
        } else {
            input.classList.add('border-red-500');
            alert("Handshake Failed: Invalid Security Key.");
        }
    } catch (err) {
        alert("Backend Offline: Ensure uvicorn is running on port 8000.");
    }
}

/**
 * SECURE FETCH WRAPPER
 * Automatically injects the X-NIXRAY-KEY header.
 */
async function secureFetch(endpoint, options = {}) {
    const defaultHeaders = { 'X-NIXRAY-KEY': SESSION_KEY };
    options.headers = options.headers ? { ...options.headers, ...defaultHeaders } : defaultHeaders;
    
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    
    if (response.status === 403) {
        localStorage.removeItem('nixray_session_key');
        location.reload(); // Force re-authentication
    }
    return response;
}

async function fetchPackages() {
    const res = await secureFetch('/packages/all');
    allPackages = await res.json();
    renderAll();
}

function renderAll(filter = "") {
    const term = filter.toLowerCase();
    const filterFn = (list) => list.filter(p => p.name.toLowerCase().includes(term));
    
    renderList('apt-list', filterFn(allPackages.apt), 'apt');
    renderList('snap-list', filterFn(allPackages.snap), 'snap');
    renderList('pip-list', filterFn(allPackages.pip), 'pip');

    // Update Header Stats
    document.querySelector('#stats-apt span').innerText = allPackages.apt.length;
    document.querySelector('#stats-snap span').innerText = allPackages.snap.length;
    document.querySelector('#stats-pip span').innerText = allPackages.pip.length;
}

function renderList(id, list, manager) {
    const el = document.getElementById(id);
    el.innerHTML = list.map(pkg => {
        const isSelected = selections.some(s => s.name === pkg.name && s.manager === manager);
        return `
            <div onclick="handleCardClick('${manager}', '${pkg.name}', event)" 
                 class="package-card group flex flex-col p-4 rounded-xl border transition-all duration-300 relative select-none
                 ${isSelected ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20'} cursor-pointer">
                <div class="text-[14px] font-bold ${isSelected ? 'text-emerald-400' : 'text-slate-100'} truncate">${pkg.name}</div>
                <div class="text-[10px] text-slate-600 font-bold truncate uppercase mt-1 tracking-wider">${pkg.version}</div>
                
                <div class="absolute top-4 right-4 transition-opacity duration-300 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}">
                    <i data-lucide="${isSelected ? 'shield-check' : 'plus-circle'}" class="w-4 h-4 ${isSelected ? 'text-emerald-500' : 'text-slate-700'}"></i>
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

function handleCardClick(manager, name, event) {
    // MILITARY GRADE TOGGLE: Must hold ALT to select/deselect
    if (event.altKey) {
        toggleSelection(manager, name);
    } else {
        // Toggle Sidebar details
        if (currentOpenPackage === name) {
            toggleSidebar(null);
        } else {
            showDetails(manager, name);
        }
    }
}

function toggleSelection(manager, name) {
    const idx = selections.findIndex(s => s.name === name && s.manager === manager);
    if (idx > -1) selections.splice(idx, 1);
    else selections.push({manager, name});
    
    const trigger = document.getElementById('actionTrigger');
    trigger.classList.toggle('hidden', selections.length === 0);
    document.getElementById('selectionCount').innerText = selections.length;
    renderAll(document.getElementById('globalSearch').value);
}

async function showDetails(manager, name) {
    currentOpenPackage = name;
    const sidebar = document.getElementById('infoSidebar');
    document.getElementById('sideTitle').innerText = name;
    document.getElementById('sideContent').innerText = "Querying system metadata...";
    sidebar.classList.remove('translate-x-full');

    const res = await secureFetch(`/details/${manager}/${name}`);
    const data = await res.json();
    document.getElementById('sideContent').innerText = data.details;
}

function toggleSidebar(val) {
    const sidebar = document.getElementById('infoSidebar');
    if (val === null) {
        sidebar.classList.add('translate-x-full');
        currentOpenPackage = null;
    }
}

async function startCleanup() {
    const password = document.getElementById('rootPass').value;
    const logBox = document.getElementById('actionLogs');
    if (!password) return;

    document.getElementById('authBox').classList.add('hidden');
    logBox.classList.remove('hidden');
    logBox.innerHTML = `[SYSTEM] Initiating extraction sequence...<br>`;

    for (const pkg of selections) {
        logBox.innerHTML += `<div class="mt-4 text-white font-bold uppercase tracking-tighter">>>> Purging: ${pkg.name}</div>`;
        
        try {
            const res = await secureFetch(`/packages/${pkg.manager}/${pkg.name}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ password })
            });
            const data = await res.json();
            
            if (data.status === 'success') {
                logBox.innerHTML += `<span class="text-emerald-500">Unit successfully removed.</span><br>`;
                // Remove from local memory so it disappears from the list
                allPackages[pkg.manager] = allPackages[pkg.manager].filter(p => p.name !== pkg.name);
            } else {
                logBox.innerHTML += `<span class="text-red-500">Critical Error: Removal failed. Check logs.</span><br>`;
                logBox.innerHTML += `<pre class="text-[10px] text-slate-600">${data.output}</pre>`;
            }
        } catch (e) {
            logBox.innerHTML += `<span class="text-red-600">Network connection interrupted.</span><br>`;
        }
        logBox.scrollTop = logBox.scrollHeight;
    }

    logBox.innerHTML += `<div class="mt-10 text-emerald-400 font-bold text-center border-t border-white/5 pt-4">SYSTEM RESTORED</div>`;
    
    const doneBtn = document.createElement('button');
    doneBtn.className = "w-full mt-6 bg-emerald-500 p-4 rounded-xl font-bold text-black uppercase tracking-widest hover:bg-white transition-all";
    doneBtn.innerText = "Finalize";
    doneBtn.onclick = () => {
        closeActionModal();
        selections = [];
        document.getElementById('actionTrigger').classList.add('hidden');
        renderAll();
    };
    logBox.appendChild(doneBtn);
}

function openActionModal() { document.getElementById('actionModal').classList.remove('hidden'); }
function closeActionModal() { document.getElementById('actionModal').classList.add('hidden'); }
document.getElementById('globalSearch').addEventListener('input', (e) => renderAll(e.target.value));

// AUTO-AUTH: If key exists in local storage, try to bypass overlay
if (SESSION_KEY) {
    authenticateSession(); // This will auto-fetch if key is valid
} else {
    lucide.createIcons();
}