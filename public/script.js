document.addEventListener('DOMContentLoaded', () => {
    // --- UX TOAST NOTIFICATION SYSTEM ---
    const toastContainer = document.getElementById('toast-container');

    function showToast(message, type = 'info', duration = 3500) {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast-pill toast-${type}`;

        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-check-circle';
        if (type === 'danger') icon = 'fa-exclamation-circle';
        if (type === 'warning') icon = 'fa-triangle-exclamation';

        // Message is set as text, not markup: half the callers interpolate a
        // track title or a Discord tag straight from the API, and an innerHTML
        // here turns any of those into executable HTML on the dashboard.
        toast.innerHTML = `<i class="fas ${icon}" aria-hidden="true"></i> <span></span>`;
        toast.querySelector('span').textContent = message;
        toastContainer.appendChild(toast);

        // A failure that scrolls away in 3.5s is a failure the operator misses.
        // Errors get twice the dwell, and clicking any pill dismisses it early.
        const dwell = (type === 'danger' || type === 'warning') ? duration * 2 : duration;
        let done = false;
        const dismiss = () => {
            if (done) return;
            done = true;
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        };
        toast.addEventListener('click', dismiss);
        setTimeout(dismiss, dwell);
    }

    // --- THEME SWITCHING (car-brand liveries) ---
    // Each entry maps a data-theme value to its display name + swatch colors.
    // 'default' clears data-theme (BMW M, defined in :root).
    const themes = [
        { id: 'default',      name: 'BMW M',         swatch: ['#2E8FE0', '#1B4FA0', '#E7222E'] },
        { id: 'mercedes',     name: 'Mercedes-AMG',  swatch: ['#00A19C', '#4A5561', '#C6CDD4'] },
        { id: 'ferrari',      name: 'Ferrari',       swatch: ['#FFE500', '#D40000', '#7A0000'] },
        { id: 'lamborghini',  name: 'Lamborghini',   swatch: ['#F5C518', '#3A3320', '#1A1A1A'] },
        { id: 'porsche',      name: 'Porsche',       swatch: ['#C8102E', '#D0A85C', '#9CA3AB'] },
        { id: 'audi',         name: 'Audi',          swatch: ['#BB0A30', '#D0D3D6', '#8A9096'] },
        { id: 'mclaren',      name: 'McLaren',       swatch: ['#FF6A13', '#0090D0', '#C24A08'] },
        { id: 'bugatti',      name: 'Bugatti',       swatch: ['#6FA8FF', '#0A3D91', '#7A1420'] },
        { id: 'rolls-royce',  name: 'Rolls-Royce',   swatch: ['#6B2FB5', '#D9B45A', '#3A1A66'] },
        { id: 'aston-martin', name: 'Aston Martin',  swatch: ['#00594F', '#C6E84F', '#05302B'] },
        { id: 'bentley',      name: 'Bentley',       swatch: ['#1E5233', '#E6DCC0', '#4A3A1E'] },
        { id: 'maserati',     name: 'Maserati',      swatch: ['#1C3F94', '#E9EDF2', '#10224F'] },
        { id: 'tesla',        name: 'Tesla',         swatch: ['#E31937', '#5A6068', '#E9EDF2'] }
    ];

    const THEME_KEY = 'shravan-bot-theme';

    function applyTheme(id, persist = true) {
        if (id === 'default') {
            document.documentElement.removeAttribute('data-theme');
            if (persist) localStorage.removeItem(THEME_KEY);
        } else {
            document.documentElement.setAttribute('data-theme', id);
            if (persist) localStorage.setItem(THEME_KEY, id);
        }
    }

    function currentThemeId() {
        return localStorage.getItem(THEME_KEY) || 'default';
    }

    // Apply saved theme on load
    applyTheme(currentThemeId(), false);

    // Theme picker modal
    const themeModal = document.getElementById('theme-picker-modal');
    const themeGrid = document.getElementById('theme-grid');
    const themeBtn = document.getElementById('theme-toggle');

    function renderThemeGrid() {
        if (!themeGrid) return;
        const active = currentThemeId();
        themeGrid.innerHTML = '';
        themes.forEach(t => {
            const card = document.createElement('div');
            card.className = `theme-card ${t.id === active ? 'selected' : ''}`;
            // A div with an onclick is unreachable by keyboard and announced as
            // nothing, so the whole livery picker used to be mouse-only. These
            // three attributes make it a real control without changing the paint.
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-pressed', String(t.id === active));
            card.innerHTML = `
                <div class="theme-swatch">
                    <span style="background:${t.swatch[0]}"></span>
                    <span style="background:${t.swatch[1]}"></span>
                    <span style="background:${t.swatch[2]}"></span>
                </div>
                <span class="theme-name">${t.name}</span>
                <i class="fas fa-check theme-check"></i>
            `;
            card.onclick = () => {
                applyTheme(t.id);
                renderThemeGrid();
                showToast(`Livery set to ${t.name}`, 'success');
            };
            // Space scrolls the modal by default; Enter does nothing at all on a
            // div. Both have to be wired by hand to match what the role promises.
            card.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.onclick();
                }
            };
            themeGrid.appendChild(card);
        });
    }

    // Where focus was before the modal opened, so closing puts it back instead
    // of dumping the user at the top of the document.
    let themeReturnFocus = null;

    function openThemePicker() {
        if (!themeModal) return;
        themeReturnFocus = document.activeElement;
        renderThemeGrid();
        themeModal.classList.add('active');
        themeModal.setAttribute('aria-hidden', 'false');
        // Land on the current livery, so the first arrow/tab press moves from
        // where the user actually is rather than from nowhere.
        const start = themeGrid && (themeGrid.querySelector('.theme-card.selected') || themeGrid.firstElementChild);
        if (start) start.focus();
    }

    function closeThemePicker() {
        if (!themeModal) return;
        themeModal.classList.remove('active');
        themeModal.setAttribute('aria-hidden', 'true');
        if (themeReturnFocus && document.contains(themeReturnFocus)) themeReturnFocus.focus();
        themeReturnFocus = null;
    }

    if (themeBtn) themeBtn.onclick = openThemePicker;

    if (themeModal) {
        themeModal.addEventListener('click', (e) => {
            if (e.target === themeModal) closeThemePicker();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && themeModal.classList.contains('active')) closeThemePicker();
        });
    }

    // --- TAB SWITCHING ---
    const navItems = document.querySelectorAll('.nav-links li');
    const tabs = document.querySelectorAll('.tab-content');
    const navTabs = document.querySelectorAll('.nav-links li[data-tab]');

    function switchTab(tabName) {
        const targetNav = document.querySelector(`.nav-links li[data-tab="${tabName}"]`);
        const targetTab = document.getElementById(tabName);
        if (!targetNav || !targetTab) return;

        navItems.forEach(n => n.classList.remove('active'));
        tabs.forEach(t => t.classList.remove('active'));

        targetNav.classList.add('active');
        targetTab.classList.add('active');

        // Roving tabindex: only the selected tab is in the tab order, so Tab
        // leaves the sidebar in one press and the arrow keys move between tabs.
        // That is the pattern every OS tab strip uses, and it is why a keyboard
        // user does not have to walk past ten items to reach the panel.
        navTabs.forEach(n => {
            const on = n === targetNav;
            n.setAttribute('aria-selected', String(on));
            n.tabIndex = on ? 0 : -1;
        });
    }

    // The sidebar is a tab strip, so say so — an <li> with a click handler is
    // announced as a list item and is not reachable by keyboard at all.
    const navList = document.querySelector('.nav-links');
    if (navList) navList.setAttribute('role', 'tablist');
    // The group headings share the <ul> with the tabs but are not tabs, and a
    // tablist containing non-tab children is announced as broken.
    document.querySelectorAll('.nav-links li.nav-group-label')
        .forEach(l => l.setAttribute('role', 'presentation'));
    navTabs.forEach((item, i) => {
        const name = item.getAttribute('data-tab');
        const panel = document.getElementById(name);
        item.setAttribute('role', 'tab');
        item.setAttribute('aria-selected', String(item.classList.contains('active')));
        item.tabIndex = item.classList.contains('active') ? 0 : -1;
        if (panel) {
            const id = `nav-tab-${name}`;
            item.id = id;
            item.setAttribute('aria-controls', name);
            panel.setAttribute('role', 'tabpanel');
            panel.setAttribute('aria-labelledby', id);
        }
        item.addEventListener('keydown', (e) => {
            const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                switchTab(name);
                return;
            }
            let next = null;
            if (keys[e.key]) next = (i + keys[e.key] + navTabs.length) % navTabs.length;
            else if (e.key === 'Home') next = 0;
            else if (e.key === 'End') next = navTabs.length - 1;
            if (next === null) return;
            e.preventDefault();
            const el = navTabs[next];
            switchTab(el.getAttribute('data-tab'));
            el.focus();
        });
    });

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabName = item.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // Interactive Stat Cards UX
    document.querySelectorAll('.stat-card[data-open-tab]').forEach(card => {
        // Same problem as the livery cards: a clickable div nobody can tab to.
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                card.click();
            }
        });
        card.addEventListener('click', () => {
            const tabName = card.getAttribute('data-open-tab');
            switchTab(tabName);
        });
    });

    // --- COMMAND PALETTE (CTRL + K) UX ---
    const paletteModal = document.getElementById('command-palette-modal');
    const paletteInput = document.getElementById('palette-search-input');
    const paletteResults = document.getElementById('palette-results-list');
    const openCmdBtn = document.getElementById('open-cmd-palette-btn');

    // Which result is highlighted, and where to hand focus back on close.
    let paletteItems = [];
    let paletteIndex = 0;
    let paletteReturnFocus = null;

    const commandsList = [
        { name: 'Dashboard Overview', icon: 'fa-grip', action: () => switchTab('dashboard') },
        { name: 'Start All Bots', icon: 'fa-play', action: () => document.getElementById('start-all')?.click() },
        { name: 'Stop All Bots', icon: 'fa-stop', action: () => document.getElementById('stop-all')?.click() },
        { name: 'Refresh Stats', icon: 'fa-rotate', action: () => updateStats() },
        { name: 'Token Selection', icon: 'fa-square-check', action: () => switchTab('token-selection') },
        { name: 'Voice Controls', icon: 'fa-headset', action: () => switchTab('voice-controls') },
        { name: 'Join Owner VC', icon: 'fa-user-shield', action: () => document.getElementById('join-owner')?.click() },
        { name: 'Leave VC', icon: 'fa-arrow-right-from-bracket', action: () => document.getElementById('leave-vc')?.click() },
        { name: 'Music Player', icon: 'fa-compact-disc', action: () => switchTab('music') },
        { name: 'Spammer', icon: 'fa-comment-dots', action: () => switchTab('spammer') },
        { name: 'Token Manager', icon: 'fa-key', action: () => switchTab('tokens') },
        { name: 'Check Token Validity', icon: 'fa-magnifying-glass', action: () => document.getElementById('check-validity')?.click() },
        { name: 'Mass Reaction', icon: 'fa-face-smile', action: () => switchTab('reactions') },
        { name: 'Settings & RPC', icon: 'fa-sliders', action: () => switchTab('settings') },
        { name: 'Live Terminal', icon: 'fa-terminal', action: () => switchTab('terminal') },
        { name: 'Force Disconnect All', icon: 'fa-power-off', action: () => document.getElementById('force-disconnect')?.click() }
    ];

    function renderPaletteResults(query = '') {
        if (!paletteResults) return;
        paletteResults.innerHTML = '';
        const q = query.trim().toLowerCase();
        // Subsequence match, so "sta" finds "Start All Bots" and "fda" finds
        // "Force Disconnect All" — a palette you have to spell exactly is just a
        // menu with extra steps. Ranked so a prefix hit beats a scattered one.
        const scored = commandsList.map(c => ({ c, score: paletteScore(c.name.toLowerCase(), q) }))
            .filter(x => x.score >= 0)
            .sort((a, b) => b.score - a.score);
        const filtered = scored.map(x => x.c);

        if (filtered.length === 0) {
            paletteResults.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No commands found.</div>';
            paletteItems = [];
            paletteIndex = 0;
            return;
        }

        filtered.forEach((cmd, idx) => {
            const item = document.createElement('div');
            item.className = `palette-item ${idx === 0 ? 'selected' : ''}`;
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(idx === 0));
            item.id = `palette-opt-${idx}`;
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <i class="fas ${cmd.icon}"></i>
                    <span style="font-weight: 700;">${cmd.name}</span>
                </div>
                <i class="fas fa-chevron-right" style="font-size: 0.8rem; opacity: 0.5;"></i>
            `;
            item.onclick = () => {
                cmd.action();
                closePalette();
            };
            item.onmouseenter = () => movePalette(idx, false);
            paletteResults.appendChild(item);
        });

        paletteItems = filtered;
        paletteIndex = 0;
        if (paletteInput) paletteInput.setAttribute('aria-activedescendant', 'palette-opt-0');
    }

    // -1 means "no match". Otherwise: consecutive characters and a match at the
    // start of a word are worth more, so the command you meant floats up.
    function paletteScore(name, q) {
        if (!q) return 0;
        let score = 0, i = 0, run = 0;
        for (const ch of q) {
            const at = name.indexOf(ch, i);
            if (at === -1) return -1;
            if (at === i && i > 0) run += 1; else run = 0;
            score += 1 + run * 2 + (at === 0 || name[at - 1] === ' ' ? 3 : 0);
            i = at + 1;
        }
        return score;
    }

    function movePalette(idx, scroll = true) {
        if (!paletteItems.length) return;
        const nodes = paletteResults.querySelectorAll('.palette-item');
        paletteIndex = (idx + nodes.length) % nodes.length;
        nodes.forEach((n, i) => {
            const on = i === paletteIndex;
            n.classList.toggle('selected', on);
            n.setAttribute('aria-selected', String(on));
        });
        if (paletteInput) paletteInput.setAttribute('aria-activedescendant', `palette-opt-${paletteIndex}`);
        if (scroll) nodes[paletteIndex].scrollIntoView({ block: 'nearest' });
    }

    function openPalette() {
        if (!paletteModal) return;
        paletteReturnFocus = document.activeElement;
        paletteModal.classList.add('active');
        paletteModal.setAttribute('aria-hidden', 'false');
        paletteInput.value = '';
        renderPaletteResults('');
        paletteInput.focus();
    }

    function closePalette() {
        if (!paletteModal) return;
        paletteModal.classList.remove('active');
        paletteModal.setAttribute('aria-hidden', 'true');
        if (paletteReturnFocus && document.contains(paletteReturnFocus)) paletteReturnFocus.focus();
        paletteReturnFocus = null;
    }

    if (openCmdBtn) openCmdBtn.onclick = openPalette;

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (paletteModal?.classList.contains('active')) closePalette();
            else openPalette();
        }
        if (e.key === 'Escape' && paletteModal?.classList.contains('active')) {
            closePalette();
        }
    });

    paletteInput?.addEventListener('input', (e) => renderPaletteResults(e.target.value));

    // The palette highlighted a row but had no way to move the highlight or act
    // on it, so the only way to run anything was to reach for the mouse — which
    // defeats the point of a Ctrl+K palette. Arrows move, Enter fires, Tab moves.
    paletteInput?.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
            e.preventDefault();
            movePalette(paletteIndex + 1);
        } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
            e.preventDefault();
            movePalette(paletteIndex - 1);
        } else if (e.key === 'Home') {
            e.preventDefault();
            movePalette(0);
        } else if (e.key === 'End') {
            e.preventDefault();
            movePalette(paletteItems.length - 1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const cmd = paletteItems[paletteIndex];
            if (!cmd) return;
            cmd.action();
            closePalette();
        }
    });

    // Clicking the backdrop closes it, matching the livery picker.
    paletteModal?.addEventListener('click', (e) => {
        if (e.target === paletteModal) closePalette();
    });

    // --- API HANDLERS ---
    const DEFAULT_CLOUD_HOST = 'https://moonlord-3.onrender.com';
    const LIFETIME_FALLBACK_HOST = 'https://moonlord-3.onrender.com';
    const isAndroidDevice = /Android/i.test(navigator.userAgent) || 
        (typeof window !== 'undefined' && (window.location.protocol === 'file:' || window.location.host.includes('androidplatform.net')));

    function getCurrentLicenseKey() {
        if (window._currentLicenseKey) return window._currentLicenseKey;
        try {
            const storage = (typeof safeStorage !== 'undefined' ? safeStorage : (typeof localStorage !== 'undefined' ? localStorage : null));
            const directKey = storage ? storage.getItem('keyauth_license_key') : null;
            if (directKey) return directKey.trim();
            const raw = storage ? storage.getItem('keyauth_session_data') : null;
            if (raw) {
                const sess = JSON.parse(raw);
                return (sess.key || sess.user || '').trim();
            }
        } catch (e) {}
        return '';
    }

    function getApiBase() {
        try {
            const storage = (typeof safeStorage !== 'undefined' ? safeStorage : (typeof localStorage !== 'undefined' ? localStorage : null));
            let saved = storage ? storage.getItem('moonlord_api_host') : null;
            if (saved) {
                saved = saved.trim().replace(/\/+$/, '');
                if (!saved.startsWith('http://') && !saved.startsWith('https://')) saved = 'https://' + saved;
                return saved + '/api';
            }
        } catch (e) {}
        if (!isAndroidDevice && typeof window !== 'undefined' && window.location.protocol.startsWith('http') && !window.location.host.includes('appassets.androidplatform.net')) {
            return '/api';
        }
        if (window._activeDetectedHost) return window._activeDetectedHost + '/api';
        return 'https://moonlord-3.onrender.com/api';
    }

    function setBackendOnline(isOnline) {
        const dot = document.getElementById('pc-status-dot');
        const text = document.getElementById('pc-host-text');
        if (dot) {
            dot.style.background = isOnline ? '#10B981' : '#EF4444';
            dot.style.boxShadow = isOnline ? '0 0 6px #10B981' : '0 0 6px #EF4444';
        }
        if (text) {
            const host = getApiBase().replace('/api', '').replace(/^https?:\/\//, '');
            text.textContent = (isOnline ? 'Online: ' : 'Offline: ') + host;
        }
    }

    // Manual server host config on tap
    window.editServerHost = function() {
        const storage = (typeof safeStorage !== 'undefined' ? safeStorage : (typeof localStorage !== 'undefined' ? localStorage : null));
        const cur = (storage ? storage.getItem('moonlord_api_host') : null) || 'https://moonlord-2.onrender.com';
        const input = prompt(
            "Configure Server Host / IP Address:\n\n" +
            "• 24/7 Cloud Host: https://moonlord-2.onrender.com\n" +
            "• PC on Same Wi-Fi: http://192.168.1.3:5000\n" +
            "• Termux on Phone: http://127.0.0.1:5000\n\nEnter server address:",
            cur
        );
        if (input && input.trim()) {
            let clean = input.trim().replace(/\/+$/, '');
            if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
                clean = 'https://' + clean;
            }
            if (storage) storage.setItem('moonlord_api_host', clean);
            window._activeDetectedHost = clean;
            setBackendOnline(false);
            if (typeof showToast === 'function') showToast('Connecting to ' + clean + '...', 'info');
            fetch(clean + '/api/stats', { headers: { 'bypass-tunnel-reminder': 'true' } })
                .then(r => r.json())
                .then(() => {
                    setBackendOnline(true);
                    if (typeof showToast === 'function') showToast('Connected to ' + clean + '!', 'success');
                    if (typeof updateStats === 'function') updateStats();
                    if (typeof loadTokenManager === 'function') loadTokenManager();
                })
                .catch(() => {
                    if (typeof showToast === 'function') showToast('Could not reach ' + clean + '. Check server!', 'danger');
                });
        }
    };

    async function autoDetectBackendHost() {
        const storage = (typeof safeStorage !== 'undefined' ? safeStorage : (typeof localStorage !== 'undefined' ? localStorage : null));
        // 1. Dynamic Lifetime Gateway Discovery via Cloud Rendezvous
        try {
            const discCtrl = new AbortController();
            const discTimer = setTimeout(() => discCtrl.abort(), 2000);
            const discRes = await fetch('https://ntfy.sh/moonlord_fleet_gateway_pub_999/json?poll=1', { signal: discCtrl.signal });
            clearTimeout(discTimer);
            if (discRes.ok) {
                const text = await discRes.text();
                const lines = text.trim().split(/\r?\n/);
                for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
                    try {
                        const obj = JSON.parse(lines[i]);
                        if (obj.message && obj.message.startsWith('http')) {
                            const candidate = obj.message.trim().replace(/\/+$/, '');
                            const testCtrl = new AbortController();
                            const testTimer = setTimeout(() => testCtrl.abort(), 1500);
                            const tRes = await fetch(`${candidate}/api/stats`, {
                                signal: testCtrl.signal,
                                headers: { 'bypass-tunnel-reminder': 'true' }
                            });
                            clearTimeout(testTimer);
                            if (tRes.ok) {
                                window._activeDetectedHost = candidate;
                                if (storage) storage.setItem('moonlord_api_host', candidate);
                                setBackendOnline(true);
                                return candidate;
                            }
                        }
                    } catch(e) {}
                }
            }
        } catch (e) {}

        // 2. Candidate Fallback List (24/7 Render cloud host first!)
        const saved = storage ? storage.getItem('moonlord_api_host') : null;
        const candidates = [
            saved,
            'https://moonlord-3.onrender.com',
            'https://moonlord-2.onrender.com',
            'https://moonlord.onrender.com',
            'http://192.168.1.3:5000',
            'http://127.0.0.1:5000',
            'http://10.0.2.2:5000'
        ].filter(Boolean);

        for (const host of candidates) {
            try {
                const cleaned = host.replace(/\/+$/, '');
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 1500);
                const res = await fetch(`${cleaned}/api/stats`, {
                    signal: controller.signal,
                    headers: { 'bypass-tunnel-reminder': 'true' }
                });
                clearTimeout(timer);
                if (res.ok) {
                    window._activeDetectedHost = cleaned;
                    if (storage) storage.setItem('moonlord_api_host', cleaned);
                    setBackendOnline(true);
                    return cleaned;
                }
            } catch (e) {}
        }
        setBackendOnline(false);
    }

    autoDetectBackendHost();

    async function callApi(endpoint, method = 'GET', data = null) {
        try {
            const lic = getCurrentLicenseKey();
            const headers = { 
                'Content-Type': 'application/json',
                'bypass-tunnel-reminder': 'true'
            };
            if (lic) {
                headers['x-license-key'] = lic;
            } else if (typeof getHWID === 'function') {
                headers['x-device-id'] = getHWID();
            }

            const options = {
                method,
                headers
            };
            if (data) options.body = JSON.stringify(data);

            const base = getApiBase();
            const sep = endpoint.includes('?') ? '&' : '?';
            const url = lic 
                ? `${base}${endpoint}${sep}license_key=${encodeURIComponent(lic)}` 
                : `${base}${endpoint}${sep}device_id=${encodeURIComponent(headers['x-device-id'] || 'mobile')}`;
            const response = await fetch(url, options);
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                return { status: 'error', message: `Server returned non-JSON (${response.status})` };
            }
            const json = await response.json();
            if (json && json.status === 'success') {
                setBackendOnline(true);
            }
            return json;
        } catch (error) {
            console.warn(`[callApi] ${endpoint}:`, error.message);
            setBackendOnline(false);
            if (error && error.message && error.message.toLowerCase().includes('fetch')) {
                return { 
                    status: 'error', 
                    message: 'Cannot reach Server. Make sure Start_Selfbot.bat is running on PC (or Termux on phone). Tap the top server chip to set IP.' 
                };
            }
            return { status: 'error', message: error.message };
        }
    }

    window.refreshLicenseSession = function(key) {
        if (key !== undefined) window._currentLicenseKey = key || '';
        const tmList = document.getElementById('tm-tokens-list');
        if (tmList) tmList.innerHTML = '<div class="empty-state">Loading registry...</div>';
        const globalContainer = document.getElementById('global-tokens-container');
        if (globalContainer) globalContainer.innerHTML = '';
        setTimeout(() => {
            if (typeof loadTokenManager === 'function') loadTokenManager();
            if (typeof updateStats === 'function') updateStats();
        }, 100);
    };

    // Refresh Stats
    async function updateStats() {
        const stats = await callApi('/stats');
        if (stats) {
            document.getElementById('stat-total').textContent = stats.total_tokens || 0;
            document.getElementById('stat-online').textContent = stats.online_bots || 0;
            document.getElementById('stat-guilds').textContent = stats.guilds || 0;

            if (stats.bots) {
                const newStateStr = stats.bots.map(b => `${b.index}:${b.tag}:${b.online}`).join('|');

                const globalContainer = document.getElementById('global-tokens-container');
                if (globalContainer && globalContainer.getAttribute('data-state') !== newStateStr) {
                    const savedChecked = Array.from(globalContainer.querySelectorAll('input:checked')).map(cb => cb.value);
                    globalContainer.innerHTML = '';
                    stats.bots.forEach(bot => {
                        const label = document.createElement('label');
                        label.className = 'token-checkbox-item checkbox-container';

                        const cb = document.createElement('input');
                        cb.type = 'checkbox';
                        cb.value = bot.index;
                        cb.checked = savedChecked.length > 0 ? savedChecked.includes(bot.index.toString()) : true;

                        const checkmark = document.createElement('span');
                        checkmark.className = 'checkmark';

                        const text = document.createElement('span');
                        text.textContent = bot.tag;
                        text.style.marginLeft = '30px';

                        label.appendChild(cb);
                        label.appendChild(checkmark);
                        label.appendChild(text);
                        globalContainer.appendChild(label);

                        cb.addEventListener('change', () => {
                            const count = document.querySelectorAll('#global-tokens-container input[type="checkbox"]:checked').length;
                            document.getElementById('selected-tokens-count').textContent = count;
                        });
                    });
                    globalContainer.setAttribute('data-state', newStateStr);
                }
            }
        }
    }

    // Refresh Logs
    async function updateLogs() {
        const data = await callApi('/logs');
        if (data && data.logs) {
            const logContainer = document.getElementById('terminal-logs');
            if (logContainer) {
                const shouldScroll = logContainer.scrollTop + logContainer.clientHeight === logContainer.scrollHeight;
                logContainer.innerHTML = data.logs.join('');
                if (shouldScroll) logContainer.scrollTop = logContainer.scrollHeight;
            }
        }
    }

    // Live Terminal Utilities
    document.getElementById('clear-terminal-btn')?.addEventListener('click', () => {
        const logContainer = document.getElementById('terminal-logs');
        if (logContainer) logContainer.innerHTML = '<div class="log-entry system">[SYSTEM] Terminal logs cleared.</div>';
        showToast('Terminal logs cleared', 'info');
    });

    document.getElementById('copy-terminal-btn')?.addEventListener('click', () => {
        const logContainer = document.getElementById('terminal-logs');
        if (logContainer) {
            navigator.clipboard.writeText(logContainer.innerText);
            showToast('Terminal logs copied to clipboard!', 'success');
        }
    });

    // Initial load and intervals
    updateStats();
    updateLogs();
    setInterval(updateStats, 3000);
    setInterval(updateLogs, 2000);

    // --- GLOBAL TOKEN SELECTOR UI HANDLERS ---
    document.getElementById('select-all-tokens-btn')?.addEventListener('click', () => {
        const cbs = document.querySelectorAll('#global-tokens-container input[type="checkbox"]');
        cbs.forEach(cb => cb.checked = true);
        const count = Array.from(cbs).filter(cb => cb.checked).length;
        document.getElementById('selected-tokens-count').textContent = count;
        showToast(`Selected all ${count} tokens`, 'success');
    });

    document.getElementById('clear-selected-tokens-btn')?.addEventListener('click', () => {
        const cbs = document.querySelectorAll('#global-tokens-container input[type="checkbox"]');
        cbs.forEach(cb => cb.checked = false);
        document.getElementById('selected-tokens-count').textContent = '0';
        showToast('Cleared token selection', 'info');
    });

    document.getElementById('select-random-tokens-btn')?.addEventListener('click', () => {
        const cbs = Array.from(document.querySelectorAll('#global-tokens-container input[type="checkbox"]'));
        cbs.forEach(cb => cb.checked = false);
        const count = parseInt(document.getElementById('random-count-input').value) || 0;
        const shuffled = cbs.sort(() => 0.5 - Math.random());
        shuffled.slice(0, count).forEach(cb => cb.checked = true);
        const totalSelected = document.querySelectorAll('#global-tokens-container input[type="checkbox"]:checked').length;
        document.getElementById('selected-tokens-count').textContent = totalSelected;
        showToast(`Selected ${totalSelected} random tokens`, 'info');
    });

    document.getElementById('select-first-n-btn')?.addEventListener('click', () => {
        const cbs = Array.from(document.querySelectorAll('#global-tokens-container input[type="checkbox"]'));
        cbs.forEach(cb => cb.checked = false);
        const count = parseInt(document.getElementById('random-count-input').value) || 0;
        cbs.slice(0, count).forEach(cb => cb.checked = true);
        const totalSelected = document.querySelectorAll('#global-tokens-container input[type="checkbox"]:checked').length;
        document.getElementById('selected-tokens-count').textContent = totalSelected;
        showToast(`Selected first ${totalSelected} tokens`, 'info');
    });

    // VC Speed Selector
    document.querySelectorAll('#vc-speed-selector .speed-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('#vc-speed-selector .speed-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
        });
    });

    function getVCSpeed() {
        return document.querySelector('#vc-speed-selector .speed-option.active')?.dataset.speed || 'safe';
    }

    function getTargets(defaultToAll = true) {
        const checked = Array.from(document.querySelectorAll('#global-tokens-container input[type="checkbox"]:checked'));
        if (checked.length > 0) {
            return { targetBot: null, targetBots: checked.map(cb => cb.value) };
        }
        return { targetBot: 'all', targetBots: null };
    }

    // --- BUTTON CLICKS ---

    // Master Controls
    document.getElementById('start-all').onclick = () => {
        callApi('/start', 'POST', { targetBot: 'all', targetBots: null });
        showToast('Initiating START command for all bots...', 'success');
    };
    document.getElementById('stop-all').onclick = () => {
        callApi('/stop', 'POST', { targetBot: 'all', targetBots: null });
        showToast('Initiating STOP command for all bots...', 'danger');
    };
    document.getElementById('refresh-stats').onclick = () => {
        updateStats();
        showToast('Stats refreshed!', 'info');
    };
    document.getElementById('force-disconnect').onclick = () => {
        callApi('/music/disconnect', 'POST', { targetBot: 'all' });
        showToast('Force disconnecting all voice sessions...', 'warning');
    };

    // Voice Controls
    document.getElementById('join-owner').onclick = async () => {
        const deaf = document.getElementById('join-deafen')?.checked || false;
        const mute = document.getElementById('join-mute')?.checked || false;
        const targetsData = getTargets(true);
        const speed = typeof getVCSpeed === 'function' ? getVCSpeed() : 'instant';
        showToast('Searching for owner voice channel...', 'info');
        const res = await callApi('/music/join', 'POST', { type: 'owner', deaf, mute, speed, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        if (res && res.status === 'success') {
            showToast(res.message || 'Joined Owner Voice Channel!', 'success');
        } else {
            showToast((res && res.message) || 'Failed to join owner voice channel', 'danger');
        }
    };
    document.getElementById('join-id').onclick = async () => {
        const idInput = document.getElementById('voice-channel-id');
        const id = idInput ? idInput.value.trim() : '';
        const deaf = document.getElementById('join-deafen')?.checked || false;
        const mute = document.getElementById('join-mute')?.checked || false;
        const targetsData = getTargets(true);
        const speed = typeof getVCSpeed === 'function' ? getVCSpeed() : 'instant';
        if (!id) return showToast('Please enter a Voice Channel ID', 'warning');
        showToast(`Connecting to Voice Channel ${id}...`, 'info');
        const res = await callApi('/music/join', 'POST', { type: 'id', channel_id: id, deaf, mute, speed, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        if (res && res.status === 'success') {
            showToast(res.message || `Joined Voice Channel ${id}!`, 'success');
        } else {
            showToast((res && res.message) || 'Failed to join voice channel', 'danger');
        }
    };
    document.getElementById('follow-owner').onclick = async () => {
        const targetsData = getTargets(true);
        const res = await callApi('/follow/toggle', 'POST', { targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        const btn = document.getElementById('follow-owner');
        if (res.enabled) {
            btn.classList.add('active-btn');
            btn.innerHTML = '<i class="fas fa-pause"></i> Stop Following';
            showToast('Follow Owner ENABLED', 'success');
        } else {
            btn.classList.remove('active-btn');
            btn.innerHTML = '<i class="fas fa-person-walking"></i> Follow Owner';
            showToast('Follow Owner DISABLED', 'info');
        }
    };
    document.getElementById('leave-vc').onclick = async () => {
        const targetsData = getTargets(true);
        const speed = typeof getVCSpeed === 'function' ? getVCSpeed() : 'instant';
        const res = await callApi('/music/disconnect', 'POST', { speed, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        if (res && res.status === 'success') {
            showToast(res.message || 'Disconnected from Voice Channels', 'success');
        } else {
            showToast('Disconnect command sent', 'warning');
        }
    };
    document.getElementById('fix-playback').onclick = () => {
        callApi('/music/fix', 'POST');
        showToast('Fix Playback command triggered', 'info');
    };

    // Voice Channel List Joiner
    async function fetchServerChannels() {
        const btn = document.getElementById('refresh-vc-list');
        const guildIdInput = document.getElementById('vc-guild-id');
        const guildId = guildIdInput ? guildIdInput.value.trim() : '';
        const targetsData = getTargets(true);

        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';

        const res = await callApi('/voice/channels', 'POST', { guildId, targetBots: targetsData.targetBots });
        if (btn) btn.innerHTML = '<i class="fas fa-rotate"></i> Refresh';

        const container = document.getElementById('vc-list-container');
        if (!container) return;

        container.innerHTML = '';
        if (res && res.status === 'success') {
            const channels = Array.isArray(res.channels) ? res.channels : [];
            if (channels.length === 0) {
                container.innerHTML = `<div style="text-align: center; color: var(--text-2, #A7AEB8); padding: 18px; font-size: 0.85rem;"><i class="fas fa-circle-info" style="margin-right: 6px; color: var(--warn, #E8A33D);"></i>${res.message || 'No Voice Channels found. Ensure bot is in the server.'}</div>`;
                return;
            }
            channels.forEach(ch => {
                const item = document.createElement('div');
                item.className = 'vc-list-item';
                item.style = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--line);';

                const canJoinText = ch.canJoinCount !== undefined ? `<span style="font-size: 0.75rem; color: var(--accent, #2E8FE0); display: block;">${ch.canJoinCount} bot(s) can join</span>` : '';

                item.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <i class="fas fa-volume-high" style="color: var(--accent, #2E8FE0);" aria-hidden="true"></i>
                        <div>
                            <span style="font-weight: 700; display: block; color: var(--text, #EDEFF2);">${escapeHtml(ch.name)}</span>
                            ${canJoinText}
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm join-vc-btn" data-id="${escapeAttr(ch.id)}">
                        <i class="fas fa-right-to-bracket" aria-hidden="true"></i> Join
                    </button>
                `;
                container.appendChild(item);

                item.querySelector('.join-vc-btn').onclick = async () => {
                    const deaf = document.getElementById('join-deafen')?.checked || false;
                    const mute = document.getElementById('join-mute')?.checked || false;
                    const tData = getTargets(true);
                    const speed = typeof getVCSpeed === 'function' ? getVCSpeed() : 'instant';
                    showToast(`Connecting to ${ch.name}...`, 'info');
                    const joinRes = await callApi('/music/join', 'POST', { type: 'id', channel_id: ch.id, deaf, mute, speed, targetBot: tData.targetBot, targetBots: tData.targetBots });
                    if (joinRes && joinRes.status === 'success') {
                        showToast(joinRes.message || `Connected to ${ch.name}!`, 'success');
                    } else {
                        showToast((joinRes && joinRes.message) || 'Failed to join voice channel', 'danger');
                    }
                };
            });
        } else {
            container.innerHTML = `<div style="text-align: center; color: var(--alert, #E7222E); padding: 18px; font-size: 0.85rem;"><i class="fas fa-triangle-exclamation" style="margin-right: 6px;"></i>${(res && res.message) || 'Failed to scan voice channels.'}</div>`;
            showToast((res && res.message) || 'Failed to fetch channels', 'danger');
        }
    }

    if (document.getElementById('refresh-vc-list')) {
        document.getElementById('refresh-vc-list').onclick = fetchServerChannels;
    }

    // Music Player
    document.getElementById('play-music').onclick = async () => {
        const queryInput = document.getElementById('music-query');
        const query = queryInput ? queryInput.value.trim() : '';
        const channelInput = document.getElementById('music-channel-id') || document.getElementById('voice-channel-id');
        const channel_id = channelInput ? channelInput.value.trim() : '';
        const deaf = document.getElementById('music-deafen')?.checked ?? false;
        const mute = document.getElementById('music-mute')?.checked ?? false;
        const targetsData = getTargets(true);
        if (!query) return showToast('Enter a song name or YouTube URL', 'warning');
        
        const btn = document.getElementById('play-music');
        const oldHtml = btn ? btn.innerHTML : '';
        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        showToast(`Loading: ${query}...`, 'info');

        try {
            const res = await callApi('/music/play', 'POST', { query, channel_id, deaf, mute, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
            if (res && res.status === 'success') {
                showToast(res.message || `Now Playing: ${res.track?.title || query}`, 'success');
            } else {
                showToast((res && res.message) || 'Failed to play track. Ensure bot is in voice channel.', 'danger');
            }
        } finally {
            if (btn) btn.innerHTML = oldHtml;
        }
    };

    document.getElementById('skip-music').onclick = () => {
        const targetsData = getTargets();
        callApi('/music/skip', 'POST', { targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        showToast('Skipped current song', 'info');
    };

    document.getElementById('seek-back').onclick = () => {
        const targetsData = getTargets();
        callApi('/music/seek', 'POST', { offset: -10000, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        showToast('Seek -10s', 'info');
    };

    document.getElementById('seek-forward').onclick = () => {
        const targetsData = getTargets();
        callApi('/music/seek', 'POST', { offset: 10000, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        showToast('Seek +10s', 'info');
    };

    /* Fleet sync — one track, one position, one loudness across every
       selected unit. The button holds a busy state for the duration because
       the server pauses the whole fleet mid-operation; a second click landing
       in that window would measure positions that the first call has already
       frozen and re-seek everyone to a stale target. */
    document.getElementById('sync-music').onclick = async (e) => {
        const btn = e.currentTarget;
        if (btn.disabled) return;

        const targetsData = getTargets();
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-arrows-rotate fa-spin"></i> Syncing…';

        try {
            const res = await callApi('/music/sync', 'POST', {
                targetBot: targetsData.targetBot,
                targetBots: targetsData.targetBots,
                syncTrack: true
            });

            if (res.status === 'success') {
                showToast(res.message, 'success');
                // Failures are per-unit and non-fatal — the rest of the fleet
                // still synced, so surface them without burying the result.
                if (res.failed && res.failed.length) {
                    showToast(`${res.failed.length} unit(s) could not sync: ${res.failed[0]}`, 'warning');
                }
            } else {
                showToast(res.message || 'Sync failed', 'danger');
            }
        } finally {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    };

    document.getElementById('loop-music').onclick = (e) => {
        const btn = e.currentTarget;
        const currentLoop = btn.getAttribute('data-loop') === 'true';
        const newLoop = !currentLoop;

        btn.setAttribute('data-loop', newLoop.toString());
        btn.innerHTML = `<i class="fas fa-rotate-right"></i> Loop: ${newLoop ? 'On' : 'Off'}`;
        btn.className = newLoop ? 'btn btn-success' : 'btn btn-secondary';

        const targetsData = getTargets();
        callApi('/music/loop', 'POST', { loop: newLoop, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        showToast(`Music Loop set to ${newLoop ? 'ON' : 'OFF'}`, 'info');
    };

    document.getElementById('stop-music').onclick = () => {
        const targetsData = getTargets();
        callApi('/music/stop', 'POST', { targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        showToast('Stopped Music Player', 'danger');
    };

    document.getElementById('pause-music').onclick = async (e) => {
        const btn = e.currentTarget;
        const currentPaused = btn.getAttribute('data-paused') === 'true';
        const newPaused = !currentPaused;
        const targetsData = getTargets();

        const endpoint = newPaused ? '/music/pause' : '/music/resume';
        const res = await callApi(endpoint, 'POST', { targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });

        if (res.status === 'success') {
            btn.setAttribute('data-paused', newPaused.toString());
            btn.innerHTML = newPaused ? '<i class="fas fa-play"></i> Resume' : '<i class="fas fa-pause"></i> Pause';
            btn.className = newPaused ? 'btn btn-success' : 'btn btn-secondary';
            showToast(newPaused ? 'Music Paused' : 'Music Resumed', 'info');
        }
    };

    /* ================= AMPLIFIER RACK =================
       Knob 1 (Output) : 10..10000, log travel, clean stage.
       Knob 2 (Gain)   : -12..+12 dB, bipolar, fills from 12 o'clock.
       Drag / wheel / arrows adjust; double-click resets to default.

       The instrument stack mirrors WebServer.computeStage() in
       utils/webServer.js so the meters respond instantly to a drag
       without a network round-trip per pixel. Both are deterministic
       and must stay in step — if you change the curve on the server,
       change ampStage() below to match. On load we reconcile against
       the server's own `stage` object, so any drift shows up
       immediately rather than silently.
       ==================================================== */
    const SWEEP_START = 215;   // deg, matches the .gauge conic-gradient origin
    const SWEEP_ARC = 250;     // deg of usable travel

    // What the Lavalink node actually loaded, resolved from the server on load.
    // Until we know, assume neither: the meters must never promise protection
    // or density gain that is not there.
    let ampLimiter = false;    // LavaDSPX normalization — peak clamp only
    let ampLoudness = false;   // selfbot-loudness — real compressor + brickwall

    // Mirrors WebServer.PEAK_TARGET. Not 1.0: a signal sitting exactly at full
    // scale can reconstruct ABOVE it after Opus decode, and that overshoot is
    // the crackle people hear on "maxed" bots.
    const AMP_PEAK_TARGET = 0.97;

    // Mirrors the 0.55 clamp in WebServer.buildLimiterChain(). Below that the
    // limiter is doing so much reduction that it audibly squashes, so the server
    // stops lowering the ceiling and accepts the headroom loss instead. The deck
    // has to stop at the same place or its meter describes a chain nobody runs.
    const AMP_PEAK_FLOOR = 0.55;

    // Mirrors WebServer.playerVolumeGain(). lavaplayer's volume curve is a
    // TANGENT below 150 and linear above it, so player volume is emphatically
    // not a percentage — 1000 is 16.4x, not 10x. Every headroom number on this
    // deck depends on getting that right.
    function ampVolumeGain(v) {
        const x = Math.max(0, Math.min(Math.round(Number(v) || 0), 1000));
        const mult = x <= 150 ? Math.tan(x * 0.0079) * 10000 : 24621 * x / 150;
        return mult / 10000;
    }

    // Mirrors WebServer.maxPlayerVolume(). Two separate walls:
    //   clip     — peak * gain must stay <= 1.0
    //   overflow — lavaplayer evaluates `sample * integerMultiplier` as INT
    //              arithmetic before its clamp, so past ~490 a near-full-scale
    //              sample wraps sign. That is not distortion, it is corruption.
    function ampMaxVolume(peak, allowClipping) {
        const p = Math.max(1e-4, Math.min(Number(peak) || 1, 1));
        const peakSample = Math.round(p * 32767);
        const INT_MAX = 2147483647;
        let v = 1000;
        while (v > 0) {
            const mult = v <= 150 ? Math.tan(v * 0.0079) * 10000 : 24621 * v / 150;
            const okOverflow = peakSample * mult <= INT_MAX;
            const okClip = allowClipping || p * (mult / 10000) <= 1.0;
            if (okOverflow && okClip) break;
            v--;
        }
        return v;
    }

    // Local transcription of WebServer.computeStage(). Keep in sync — the drift
    // check on load will shout in the console if it stops matching.
    function ampStage(volume, gainDb, limiter, loudness, bassDb) {
        const r = Math.max(10, Math.min(Math.round(Number(volume) || 0), 10000));
        const g = Math.max(-12, Math.min(Number(gainDb) || 0, 12));
        const bass = Math.max(AMP_BASS_MIN, Math.min(Number(bassDb) || 0, AMP_BASS_MAX));
        const comp = loudness === undefined ? ampLoudness : !!loudness;

        const clarity = Math.max(0, Math.min(Math.log10(r / 100) / 2, 1));
        const push = Math.max(0, g) / 12;
        const trimDb = Math.min(0, g);
        const intensity = Math.max(0, Math.min(clarity + push, 1));

        // Automatic bass duck — mirrors WebServer.autoDuckDb().
        // Bass eats the most peak amplitude, so ducking it as level climbs
        // buys back headroom. It SUMS with the user's fader (bass) instead
        // of overwriting it — the fader stays the user's offset.
        const duckDb = ampAutoDuckDb(r, g);
        const shelfDb = Math.max(AMP_SHELF_MIN_DB, Math.min(bass + duckDb, AMP_BASS_MAX));

        // The DSPX path — the one this node actually runs. These lines mirror
        // WebServer.computeStage() line for line: the log volume curve, the
        // gain multiplier, the clarity scale-down and the CEIL clamp. This
        // mirror is checked against the server on every load, so the deck
        // never draws a curve the players are not on. (The loudness path is
        // the plugin chain — different maths entirely, see below.)
        if (!comp) {
            const CEIL = limiter ? 1000 : 700;
            let pv;
            if (r <= 100) {
                pv = r;
            } else if (r <= 1000) {
                pv = 100 + Math.log10(r / 100) * 150;
            } else {
                pv = 250 + Math.log10(r / 1000) * (CEIL - 250);
            }
            pv = Math.round(pv);
            if (g !== 0) {
                pv = Math.round(pv * Math.pow(10, g / 20));
            }
            if (clarity > 0) {
                pv = Math.round(pv * (1 - (limiter ? 0.04 : 0.12) * clarity));
            }
            const demanded = pv;
            pv = Math.max(0, Math.min(pv, CEIL));

            // The ceiling the DSPX limiter really enforces, derived from the
            // exact summed curve that is sent — mirrors resolveLimiterChain().
            const bands = ampSummedEq({ clarity, gainDb: g, shelfDb, loudness: false });
            const maxAmp = limiter ? ampMaxAmplitude({ loudness: false, playerVolume: pv }, bands) : null;
            const predictedPeak = maxAmp !== null ? maxAmp : pv / CEIL;

            return {
                requested: r,
                gainDb: g,
                bassDb: bass,
                duckDb,
                shelfDb,
                clarity,
                intensity,
                loudness: false,
                ceiling: CEIL,
                playerVolume: pv,
                demanded,
                atCeiling: demanded > CEIL,
                overDb: demanded > CEIL ? Math.round(20 * Math.log10(demanded / CEIL) * 10) / 10 : 0,
                // Neutral compressor values — a DSPX-only node has no
                // compressor, so nothing on the deck may light up or claim a
                // density gain that is not there.
                driveDb: 0,
                ratio: 1,
                thresholdDb: 0,
                grDb: 0,
                makeupRelDb: trimDb,
                mbThresholdDb: 0,
                mbRatio: 1,
                mbLowGain: 1,
                mbMidGain: 1,
                mbHighGain: 1,
                clipDrive: 1,
                clipKnee: 1,
                densityDb: 0,
                predictedPeak: Math.round(predictedPeak * 1000) / 1000,
                headroom: Math.max(0, Math.round((1 - predictedPeak) * 1000) / 10)
            };
        }

        // Compressor gain structure, solved from the reduction we WANT at a
        // full-scale input rather than picked and measured afterwards:
        //   GR = (P - T)(1 - 1/R)  =>  T = P - GR/(1 - 1/R)
        const driveDb = comp ? 8 * intensity : 0;
        const ratio = comp ? 1 + 3 * intensity : 1;
        const grDb = comp ? 12 * intensity : 0;
        const thresholdDb = ratio > 1 ? driveDb - grDb / (1 - 1 / ratio) : 0;
        const makeupRelDb = comp ? -(driveDb - grDb) + trimDb : trimDb;

        // Multiband stage. Gentler than the glue compressor because per-band
        // reduction is easy to overdo — at high ratios the bands stop tracking
        // each other — but it is where most of the loudness comes from: a
        // wideband compressor is steered by whatever is loudest, so every bass
        // note ducks the vocal and the cymbals too.
        //
        // Each band gets back exactly the reduction it applies at 0 dBFS, which
        // keeps the stage unity-gain at peak and pure density below it. The glue
        // threshold above was solved assuming a full-scale input arrives full
        // scale, so a multiband stage that moved the peak would invalidate it.
        // The -2/+2 offsets are MultibandStage's own.
        const mbThresholdDb = comp ? -(6 + 10 * intensity) : 0;
        const mbRatio = comp ? 1 + 1.5 * intensity : 1;
        const mbGr = (off) => (mbRatio > 1
            ? Math.max(0, -(mbThresholdDb + off)) * (1 - 1 / mbRatio)
            : 0);
        const mbGain = (off) => Math.max(1, Math.min(Math.pow(10, mbGr(off) / 20), 4));
        const mbGrDb = mbGr(0);

        // Clipper. Driving into a curve asymptotic to the ceiling turns gain
        // into density with a strict bound, so it can be pushed hard without any
        // of it reaching the encoder as clipping. Counted at half its dB value
        // because material already above the knee gets bent back rather than
        // gained — deliberately the conservative read.
        const clipDrive = comp ? 1 + 0.8 * intensity : 1;
        const clipKnee = comp ? 0.92 - 0.12 * intensity : 1;
        const clipDb = comp ? 20 * Math.log10(clipDrive) * 0.5 : 0;

        // With the compressor present the volume stage is no longer an
        // amplifier — all loudness happens in the plugin's float domain, where
        // there is no int32 multiply to overflow. Volume only attenuates.
        //
        // Without it there is no honest way to make this knob mean "louder"
        // past unity: the stage is a multiply on a signal already at the
        // ceiling, so everything above CEIL is distortion. The surplus is
        // reported as overdrive instead of being spent.
        const chainPeak = comp || limiter ? AMP_PEAK_TARGET : 1.0;
        const CEIL = comp ? 100 : ampMaxVolume(chainPeak, false);
        let pv = r <= 100 ? r : 100;
        let demanded = pv;

        if (!comp) {
            demanded = Math.round(CEIL * (r / 100) * Math.pow(10, g / 20));
            pv = Math.max(0, Math.min(demanded, CEIL));
        }

        const volGain = ampVolumeGain(pv);
        const predictedPeak = comp
            ? AMP_PEAK_TARGET * Math.min(1, volGain)
            : chainPeak * volGain;

        return {
            requested: r,
            gainDb: g,
            bassDb: bass,
            duckDb,
            shelfDb,
            clarity,
            intensity,
            loudness: comp,
            ceiling: CEIL,
            playerVolume: pv,
            demanded,
            atCeiling: demanded > CEIL,
            overDb: demanded > CEIL ? Math.round(20 * Math.log10(demanded / CEIL) * 10) / 10 : 0,
            driveDb: Math.round(driveDb * 100) / 100,
            ratio: Math.round(ratio * 100) / 100,
            thresholdDb: Math.round(thresholdDb * 100) / 100,
            grDb: Math.round(grDb * 100) / 100,
            makeupRelDb: Math.round(makeupRelDb * 100) / 100,
            mbThresholdDb: Math.round(mbThresholdDb * 100) / 100,
            mbRatio: Math.round(mbRatio * 100) / 100,
            mbLowGain: Math.round(mbGain(-2) * 10000) / 10000,
            mbMidGain: Math.round(mbGain(0) * 10000) / 10000,
            mbHighGain: Math.round(mbGain(2) * 10000) / 10000,
            clipDrive: Math.round(clipDrive * 10000) / 10000,
            clipKnee: Math.round(clipKnee * 10000) / 10000,
            // The honest "how much louder": density, not level. All three
            // stages that produce it are counted — the glue compressor, the
            // multiband's mid band and the clipper drive. Counting only the
            // first read about 6 dB low and made the multiband look inert.
            densityDb: Math.round((driveDb + makeupRelDb - trimDb + mbGrDb + clipDb) * 10) / 10,
            predictedPeak: Math.round(predictedPeak * 1000) / 1000,
            headroom: Math.max(0, Math.round((1 - predictedPeak) * 1000) / 10)
        };
    }

    // Mirrors WebServer.buildClarityEqualizer()'s CRYSTAL_TARGET. Keep in sync.
    // These are copied verbatim from the server, NOT approximated: the deck
    // predicts the peak so ampVerify can prove the prediction band by band, and
    // a curve that is merely the right shape fails that test. The previous
    // values here peaked at +0.22 against the server's +0.15 and cut deeper in
    // the low mids, which made the headroom meter read pessimistically — it
    // showed less room than the players actually had.
    const AMP_CRYSTAL_TARGET = [
        -0.25, -0.18, -0.14, -0.10, -0.06,
        -0.10, -0.05, 0.00, 0.04, 0.09,
        0.15, 0.15, 0.11, 0.09, 0.05
    ];

    // Mirrors WebServer.BAND_LABELS — Lavalink EQ band centre frequencies.
    const AMP_BAND_LABELS = [
        '25', '40', '63', '100', '160',
        '250', '400', '630', '1k', '1.6k',
        '2.5k', '4k', '6.3k', '10k', '16k'
    ];

    // Mirrors WebServer.BAND_ENERGY_WEIGHTS. Relative energy per band for real
    // music, normalised to sum to 1 — the reason the limiter ceiling can sit so
    // much higher than the loudest band alone would allow.
    const AMP_BAND_ENERGY = [
        0.01, 0.04, 0.09, 0.13, 0.13,
        0.12, 0.10, 0.08, 0.07, 0.06,
        0.05, 0.04, 0.03, 0.03, 0.02
    ];

    // Mirrors WebServer.EQ_PEAK_SHARE — how much of the loudest band's
    // multiplier the ceiling reserves on top of the energy-weighted mean.
    const AMP_EQ_PEAK_SHARE = 0.35;

    // EQ deltas from WebServer.FILTER_PRESETS. Every non-zero band a preset
    // moves is listed, not just the lifts: the ceiling is sized from the peak,
    // but ampVerify compares this curve to the server's band by band, so a
    // missing cut is a parity failure as surely as a missing boost.
    const AMP_PRESET_EQ = {
        vocal: {
            0: -0.20, 1: -0.15, 2: -0.10, 3: -0.05,
            8: 0.10, 9: 0.15, 10: 0.15, 11: 0.10
        },
        bassboost: { 0: 0.20, 1: 0.15, 2: 0.10, 3: 0.05 },
        vaporwave: { 0: 0.30, 1: 0.30 },
        clearhigh: {
            0: 0.15, 1: 0.10, 2: 0.05, 3: -0.05, 4: -0.25, 5: -0.05,
            6: 0.05, 7: 0.10, 8: 0.15, 9: 0.20, 10: 0.25, 11: 0.30,
            12: 0.35, 13: 0.40
        }
    };

    // The music preset currently lit, so the ceiling accounts for the EQ it adds.
    function ampActiveFilter() {
        const on = document.querySelector('.filter-btn.is-on');
        return on ? on.getAttribute('data-filter') : null;
    }

    // Mirrors WebServer.EQ_PEAK_CEILING — the boost side is scaled to fit under
    // this, because on Lavalink's own equalizer anything above it costs more
    // limiter cut than it is worth.
    //
    // This is 0.15 because the SERVER is 0.15. It sat at 0.22 here, which is a
    // 47% looser cap than the one the players are actually held to, so every
    // curve the deck drew was hotter than the curve Lavalink received. Nothing
    // in the browser reaches the audio path — this constant only decides what
    // the meters claim — so the fix is to follow the server, never to raise the
    // server to meet it. The server's 0.15 is what keeps the limiter out of
    // audible gain reduction.
    const AMP_EQ_PEAK_CEILING = 0.15;

    // Mirrors WebServer.EQ_PLUGIN_PEAK_CEILING — 4x, about +12 dB. Far looser,
    // because the plugin's EQ bank runs BEFORE its compressor and limiter, where
    // a boost is just a louder input the limiter catches rather than a
    // multiplier applied after everything that guards the peak. Still capped, so
    // one band cannot spend the whole compressor range on a single frequency.
    const AMP_EQ_PLUGIN_PEAK_CEILING = 0.75;

    // The 15-band trim deck is gone — tone is now the crystal tilt plus a
    // one-click preset. This stays as a flat constant so the summing below has
    // exactly the same shape as the server's buildSummedEqualizer (which no
    // longer has a trim term either), keeping the two provably identical rather
    // than merely similar. It adds zero to every band.
    const ampTrim = new Array(15).fill(0);

    // Mirrors WebServer.buildSummedEqualizer() — the FINAL 15 band gains, after
    // the crystal tilt, the preset and the headroom scaling. Nothing on screen
    // plots this curve any more; it exists so ampMaxAmplitude can predict the
    // peak the players will actually hit, and so ampVerify can prove that
    // prediction against the server band by band.
    //
    // Which of the two banks will run it decides both the cap and whether the
    // curve gets normalised, and that is driven off stage.loudness rather than
    // being a separate argument, so this cannot describe a path the fleet is
    // not on.
    // Low-shelf weights for the bass fader, mirroring WebServer.BASS_SHELF.
    // Bands 0-3 are 25/40/63/100Hz; band 4 (160Hz) gets a light touch so the
    // shelf does not end in a cliff the ear hears as a notch.
    const AMP_BASS_SHELF = [1.0, 0.85, 0.6, 0.35, 0.15];

    // Mirrors WebServer.BASS_MIN_DB / BASS_MAX_DB. Asymmetric because the
    // boost side saturates against EQ_PEAK_CEILING at about +6 while the cut
    // side stays accurate all the way down — see the note in index.html.
    const AMP_BASS_MIN = -12;
    const AMP_BASS_MAX = 6;

    // Automatic bass ducking constants (mirrors WebServer.DUCK_MAX_DB, SHELF_MIN_DB)
    const AMP_DUCK_MAX_DB = -6;
    const AMP_SHELF_MIN_DB = -18;

    // Automatic bass duck — mirrors WebServer.autoDuckDb()
    function ampAutoDuckDb(volume, gainDb) {
        const r = Math.max(10, Math.min(Math.round(Number(volume) || 0), 10000));
        const g = Math.max(-12, Math.min(Number(gainDb) || 0, 12));
        // Same log ramp the clarity curve uses, so the duck deepens in step
        // with the low cuts already in the crystal tilt instead of fighting
        // them. The gain knob's positive half counts too: +6dB of drive costs
        // headroom exactly like a knob move does.
        const fromVolume = Math.max(0, Math.min(Math.log10(r / 100) / 2, 1));
        const fromGain = Math.max(0, g) / 12;
        const drive = Math.max(0, Math.min(fromVolume * 0.75 + fromGain * 0.25, 1));
        return Math.round(AMP_DUCK_MAX_DB * drive * 10) / 10;
    }

    // dB on the fader → Lavalink band gain. A band scales by (1 + 4g), so
    // g = (10^(dB/20) - 1) / 4 makes the fader's dB the TRUE dB of that band
    // rather than a number that merely correlates with one.
    function ampBassGain(bassDb, weight) {
        const db = Math.max(AMP_BASS_MIN, Math.min(Number(bassDb) || 0, AMP_BASS_MAX)) * weight;
        if (db === 0) return 0;
        return (Math.pow(10, db / 20) - 1) / 4;
    }

    function ampSummedEq(stage) {
        const preset = AMP_PRESET_EQ[ampActiveFilter()] || {};
        const c = stage.clarity;
        const k = stage.gainDb / 12;
        // Use shelfDb (user bass + automatic duck) instead of raw bassDb
        const shelf = stage.shelfDb || 0;
        const flat = c === 0 && stage.gainDb === 0 && shelf === 0;
        const summed = [];
        for (let band = 0; band < 15; band++) {
            let gain = 0;
            if (!flat) {
                gain = AMP_CRYSTAL_TARGET[band] * c;
                if (k !== 0) gain += (gain >= 0 ? 0.05 : -0.06) * k;
                gain = Math.max(-0.25, Math.min(gain, 1.0));
                gain = Math.round(gain * 1000) / 1000;
            }
            if (preset[band] !== undefined) gain += preset[band];
            if (band < AMP_BASS_SHELF.length) gain += ampBassGain(shelf, AMP_BASS_SHELF[band]);
            gain += ampTrim[band] || 0;
            summed.push(gain);
        }
        const cap = stage.loudness ? AMP_EQ_PLUGIN_PEAK_CEILING : AMP_EQ_PEAK_CEILING;
        const raw = summed.reduce((m, g) => Math.max(m, g), 0);
        const scale = raw > cap ? cap / raw : 1;
        const shaped = summed.map(gain => {
            const scaled = gain > 0 ? gain * scale : gain;
            return Math.max(-0.25, Math.min(scaled, 1.0));
        });

        /* Both paths now emit the curve as drawn — only the CAP above differs,
           and the difference in what that costs shows up in ampMaxAmplitude
           rather than in the curve.

           Plugin path: its bank runs ahead of the compressor and the look-ahead
           limiter, so a cut is just a quieter input that makeup gain re-levels
           and a boost is just a louder input the limiter catches. Both
           directions are free, which is why the cap there is far looser.

           DSPX path: the curve goes to Lavalink's OWN bank, which runs AFTER
           the limiter, so a boost is a real downstream multiplier the limiter's
           ceiling has to absorb.

           This used to normalise the DSPX curve to unity, on the theory that
           the broadband constant came back from the volume stage. The server
           does no such thing — WebServer.buildSummedEqualizer caps the boost
           side at EQ_PEAK_CEILING and rounds, full stop. So the deck drew a
           curve the player never ran, and reported a flat 0.97 of headroom
           while the server sent as little as 0.606: up to 4.1dB of headroom
           that did not exist. Mirror the server instead. */
        return shaped.map(g => Math.round(Math.max(-0.25, Math.min(g, 1.0)) * 1000) / 1000);
    }

    // Mirrors WebServer.broadbandEqGain(). The headroom the EQ actually costs is
    // an ENERGY-WEIGHTED mean of the band multipliers, not the loudest band:
    // real music puts its amplitude in 60-400Hz, and the crystal curve boosts
    // 2.5-4kHz where there is little. A share of the peak band is added back as
    // the margin for band-dominant transients.
    function ampBroadbandGain(bands) {
        if (!bands || !bands.length) return 1;
        let weighted = 0, weightSum = 0, peakMult = 0;
        for (let band = 0; band < bands.length && band < 15; band++) {
            const w = AMP_BAND_ENERGY[band];
            const mult = 1 + 4 * (bands[band] || 0);
            weighted += w * mult;
            weightSum += w;
            if (mult > peakMult) peakMult = mult;
        }
        if (weightSum <= 0) return 1;
        weighted /= weightSum;
        return weighted + AMP_EQ_PEAK_SHARE * Math.max(0, peakMult - weighted);
    }

    // Mirrors the eqPeak/eqBoost term in WebServer.resolveLimiterChain() +
    // buildLimiterChain() — the equalizer's TRUE worst-case gain, which is the
    // loudest band's multiplier. This is a BOUND: a sine on that band's centre
    // frequency passes at exactly this much.
    //
    // Only the DSPX fallback needs it. It is NOT always 1 — that claim was left
    // over from when this file normalised the curve, and it is what made the
    // headroom meter read a flat 0.97 no matter how much boost was dialled in.
    // On the loudness path the bank runs inside the plugin, ahead of the
    // limiter, so there is genuinely no downstream multiplier to divide by.
    function ampPeakEqGain(bands) {
        if (!bands || !bands.length) return 1;
        let peak = 1;
        for (let band = 0; band < bands.length && band < 15; band++) {
            const mult = 1 + 4 * (bands[band] || 0);
            if (mult > peak) peak = mult;
        }
        return peak;
    }

    // Mirrors WebServer.chainCeiling() — the peak ceiling the ACTIVE chain is
    // really enforcing, as a fraction of full scale, or null if nothing is.
    //
    // The two paths divide by different things, and the difference is the whole
    // point of the rewire. A plugin filter is the FIRST thing in Lavalink's
    // chain, so the loudness ceiling has to account for every multiplier after
    // it — but the equalizer is no longer one of them: the tone curve is handed
    // to the plugin in `loudness.bands` and Lavalink's own bank is left out of
    // the payload entirely. Only the volume stage is left. The DSPX fallback has
    // no such option, so there the EQ still runs downstream and is still divided
    // out (at 1, since that path normalises the curve).
    function ampMaxAmplitude(stage, bands) {
        if (stage.loudness) {
            const volGain = Math.max(1, ampVolumeGain(stage.playerVolume));
            const c = Math.max(0.05, Math.min(AMP_PEAK_TARGET / volGain, AMP_PEAK_TARGET));
            return Math.round(c * 1000) / 1000;
        }

        if (!ampLimiter) return null;
        const eqBoost = ampPeakEqGain(bands || ampSummedEq(stage));
        // WebServer.buildLimiterChain() declines to arm the limiter when
        // nothing can clip — flat curve, unity-or-less gain, no EQ boost. The
        // deck has to refuse the same way, or the ceiling meter claims a
        // limiter the players are not running (the server sends null then).
        const eqPeak = Math.max(0, (eqBoost - 1) / 4);
        if (stage.clarity === 0 && (stage.gainDb || 0) <= 0 && eqPeak === 0) return null;
        // Always armed when the node has it — computeStage sizes the volume
        // stage against this ceiling, so it cannot be conditional.
        //
        // AMP_PEAK_FLOOR mirrors the 0.55 clamp in WebServer.buildLimiterChain().
        // Without it the deck keeps dividing past the point the server stops,
        // and reports a ceiling lower than the one actually sent — the same
        // class of lie as the old missing normalisation, just in the other
        // direction.
        return Math.round(Math.max(AMP_PEAK_FLOOR,
            Math.min(AMP_PEAK_TARGET / eqBoost, AMP_PEAK_TARGET)) * 1000) / 1000;
    }

    const ampEl = {
        status: document.getElementById('amp-status'),
        chain: document.getElementById('amp-chain'),
        ladder: document.getElementById('amp-ladder'),
        peak: document.getElementById('amp-peak'),
        headroom: document.getElementById('amp-headroom'),
        density: document.getElementById('amp-density'),
        amp: document.getElementById('amp-amp'),
        crystalPct: document.getElementById('amp-crystal-pct'),
        crystalBar: document.querySelector('#crystal-meter .knob-crystal-bar i'),
        note: document.getElementById('knob-volume-note')
    };

    function setStage(name, on) {
        if (!ampEl.chain) return;
        const el = ampEl.chain.querySelector(`[data-stage="${name}"]`);
        if (el) el.classList.toggle('is-on', !!on);
    }

    // Repaint every instrument from a resolved stage object.
    function renderAmp(stage) {
        // The ladder reads PREDICTED PEAK against full scale, which is the only
        // thing that actually predicts distortion. It used to read player volume
        // against a volume ceiling — a number that sat comfortably mid-scale
        // while the signal was several times over full scale and wrapping sign.
        const pct = Math.max(0, Math.min(stage.predictedPeak, 1.2)) * 100;

        if (ampEl.ladder) {
            ampEl.ladder.style.setProperty('--lvl', `${Math.min(pct, 100).toFixed(1)}%`);
            ampEl.ladder.classList.toggle('is-hot', pct >= 90);
        }
        if (ampEl.peak) ampEl.peak.textContent = pct.toFixed(1);

        // Over full scale is the real clip condition. atCeiling only means the
        // knob is asking for more than the stage can pass, which on the
        // compressor path is normal and harmless — the request turns into
        // density instead of level.
        const clipping = stage.predictedPeak > 1.0005;

        if (ampEl.headroom) {
            // When the request is being thrown away, show how much rather than a
            // meaningless 0.0% — otherwise the knob looks broken.
            ampEl.headroom.innerHTML = clipping
                ? `<span class="amp-over">+${(20 * Math.log10(stage.predictedPeak)).toFixed(1)}</span><i>dB over</i>`
                : `${stage.headroom.toFixed(1)}<i>%</i>`;
            ampEl.headroom.classList.toggle('is-warn', !clipping && stage.headroom < 6 && stage.headroom >= 2);
            ampEl.headroom.classList.toggle('is-crit', clipping || stage.headroom < 2);
        }

        // Density is the honest "how much louder" figure: level added to
        // everything under the threshold at an unchanged peak. Without the
        // compressor there is none to report, and saying so is the point.
        if (ampEl.density) {
            ampEl.density.textContent = stage.loudness
                ? `${stage.densityDb > 0 ? '+' : ''}${stage.densityDb.toFixed(1)} dB`
                : '—';
            ampEl.density.classList.toggle('is-warn', false);
        }

        if (ampEl.ladder) ampEl.ladder.classList.toggle('is-clip', clipping);
        if (ampEl.status) ampEl.status.classList.toggle('is-ceiling', clipping);

        // Resolve the curve once and reuse it: the ceiling is derived from these
        // exact bands, so sizing the limiter from anything else would let the
        // meters and the number disagree.
        const bands = ampSummedEq(stage);

        const maxAmp = ampMaxAmplitude(stage, bands);
        if (ampEl.amp) ampEl.amp.textContent = maxAmp === null ? '—' : maxAmp.toFixed(2);

        const cPct = stage.clarity * 100;
        if (ampEl.crystalBar) ampEl.crystalBar.style.width = `${cPct.toFixed(1)}%`;
        if (ampEl.crystalPct) ampEl.crystalPct.textContent = `${Math.round(cPct)}%`;

        // Light the chain to match what is actually engaged right now. The HPF,
        // compressor and brickwall all live in the loudness plugin, so they are
        // lit together or not at all; on a DSPX-only node the "Limiter" lamp is
        // the peak clamp, which is protection without density gain.
        setStage('gain', stage.gainDb !== 0);
        setStage('hpf', stage.loudness || (ampLimiter && maxAmp !== null));
        setStage('comp', stage.loudness && stage.grDb > 0);
        setStage('lim', stage.loudness || (ampLimiter && maxAmp !== null));
        setStage('eq', stage.clarity > 0 || stage.gainDb !== 0 || stage.bassDb !== 0 || bands.some(g => g !== 0));

        if (ampEl.note) {
            ampEl.note.textContent = clipping
                ? 'Over full scale · reduce gain'
                : stage.loudness
                    ? (stage.densityDb > 0.05
                        ? `Crystal ${Math.round(cPct)}% · +${stage.densityDb.toFixed(1)}dB density · ${stage.ratio.toFixed(1)}:1`
                        : 'Clean · unity, no compression')
                    : stage.clarity === 0
                        ? 'Clean · no gain'
                        : `Crystal ${Math.round(cPct)}% · ${stage.playerVolume}/${stage.ceiling}`;
        }
    }

    /**
     * The plugin lamp. Three real states, because the node can offer three
     * genuinely different things and conflating them is how a deck starts
     * lying:
     *   loudness — compressor + look-ahead brickwall. Density gain is real.
     *   armed    — LavaDSPX peak clamp only. Peak-safe, no density gain.
     *   absent   — neither. The volume stage is bounded and on its own.
     */
    function setLimiterStatus(state) {
        if (!ampEl.status) return;
        const text = ampEl.status.querySelector('.amp-status-text');
        // 'loudness' reuses the armed styling — both are the good case, and the
        // text is what distinguishes them.
        ampEl.status.dataset.state = state === 'loudness' ? 'armed' : state;
        if (text) {
            text.textContent = state === 'loudness' ? 'Compressor Armed'
                : state === 'armed' ? 'Peak Clamp Only'
                    : state === 'absent' ? 'No Limiter'
                        : 'Probing';
        }
        ampEl.status.title = state === 'loudness'
            ? 'selfbot-loudness detected — soft-knee compressor, look-ahead brickwall and 28Hz '
              + 'high-pass in the float domain. Loudness comes from density at a fixed peak, so the '
              + 'volume stage stays at unity and nothing clips.'
            : state === 'armed'
                ? 'LavaDSPX normalization only — the peak is protected but nothing can make the '
                  + 'audio louder without clipping, so the output stage runs a bounded curve. '
                  + 'Build the compressor with: bash Lavalink/plugin-src/build.sh, then restart Lavalink.'
                : state === 'absent'
                    ? 'No limiter plugin on the Lavalink node — running the conservative curve. '
                      + 'Build the compressor with: bash Lavalink/plugin-src/build.sh, then restart Lavalink.'
                    : 'Querying the Lavalink node for its audio filter plugins…';
    }

    // Read live knob values from the DOM rather than the knob closures.
    // initKnob() calls render() — and therefore isHot/onRender — before its
    // own `const` binding exists, so touching volumeKnob/gainKnob from those
    // callbacks would hit the temporal dead zone on first paint. dataset.value
    // is written by render() and is always current.
    function knobVal(id, fallback) {
        const el = document.getElementById(id);
        const v = el ? parseFloat(el.dataset.value) : NaN;
        return Number.isFinite(v) ? v : fallback;
    }

    function refreshAmp() {
        renderAmp(ampStage(knobVal('knob-volume', 100), knobVal('knob-gain', 0),
            ampLimiter, ampLoudness, knobVal('fader-bass', 0)));
        syncPresets();
    }

    function initKnob(el, opts) {
        if (!el) return null;

        const min = parseFloat(el.dataset.min);
        const max = parseFloat(el.dataset.max);
        const def = parseFloat(el.dataset.default);
        const log = !!opts.log;
        const bipolar = !!opts.bipolar;

        const bodyEl = el.querySelector('.knob-body');
        const valueEl = el.querySelector('.knob-value');

        let value = parseFloat(el.dataset.value);
        let commitTimer = null;

        // value <-> normalised travel [0..1]
        const toT = (v) => log
            ? (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min))
            : (v - min) / (max - min);
        const fromT = (t) => log
            ? Math.exp(Math.log(min) + t * (Math.log(max) - Math.log(min)))
            : min + t * (max - min);

        function render() {
            const t = Math.max(0, Math.min(toT(value), 1));

            bodyEl.style.setProperty('--angle', `${SWEEP_START + t * SWEEP_ARC}deg`);

            if (bipolar) {
                // fill outward from the centre detent in whichever direction
                const half = SWEEP_ARC / 2;
                const centre = SWEEP_START + half;
                const span = Math.abs(t - 0.5) * 2 * half;
                el.style.setProperty('--fill-from', `${t >= 0.5 ? centre : centre - span}deg`);
                el.style.setProperty('--fill', `${span}deg`);
            } else {
                el.style.setProperty('--fill-from', `${SWEEP_START}deg`);
                el.style.setProperty('--fill', `${t * SWEEP_ARC}deg`);
            }

            el.classList.toggle('is-hot', opts.isHot ? opts.isHot(value) : false);
            if (opts.onRender) opts.onRender(value);

            valueEl.textContent = opts.format(value);
            el.dataset.value = value;
            el.setAttribute('aria-valuenow', bipolar ? value.toFixed(1) : Math.round(value));
            el.setAttribute('aria-valuetext', `${opts.format(value)} ${opts.unit}`);
            if (opts.mirror) {
                const m = document.getElementById(opts.mirror);
                if (m) m.value = Math.round(value);
            }
        }

        function setValue(v, commit) {
            const next = Math.max(min, Math.min(v, max));
            if (next === value && !commit) return;
            value = next;
            render();
            if (commit) {
                clearTimeout(commitTimer);
                commitTimer = setTimeout(() => opts.commit(value), 220);
            }
        }

        // ── pointer drag: vertical is primary, horizontal assists ──
        // `.knob` is the drag surface. If the markup ever lacks it, degrade to
        // a read-only knob rather than throwing out of initKnob() and taking
        // the rest of the panel's wiring down with it.
        const knobEl = el.querySelector('.knob');
        if (!knobEl) {
            render();
            return { set: (v) => setValue(v, false), get: () => value };
        }
        let dragging = false, lastX = 0, lastY = 0;

        knobEl.addEventListener('pointerdown', (e) => {
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            el.classList.add('is-active');
            el.focus();
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { }
            e.preventDefault();
        });

        knobEl.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const delta = (lastY - e.clientY) + (e.clientX - lastX);
            lastX = e.clientX;
            lastY = e.clientY;
            // fine control while shift is held
            const step = (e.shiftKey ? 0.0008 : 0.004) * delta;
            setValue(fromT(Math.max(0, Math.min(toT(value) + step, 1))), true);
        });

        const endDrag = (e) => {
            if (!dragging) return;
            dragging = false;
            el.classList.remove('is-active');
            try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) { }
        };
        knobEl.addEventListener('pointerup', endDrag);
        knobEl.addEventListener('pointercancel', endDrag);

        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            const step = (e.shiftKey ? 0.004 : 0.02) * (e.deltaY < 0 ? 1 : -1);
            setValue(fromT(Math.max(0, Math.min(toT(value) + step, 1))), true);
        }, { passive: false });

        el.addEventListener('keydown', (e) => {
            const big = e.key === 'PageUp' || e.key === 'PageDown';
            const up = e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'PageUp';
            const down = e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'PageDown';
            if (!up && !down) {
                if (e.key === 'Home') { e.preventDefault(); setValue(def, true); }
                return;
            }
            e.preventDefault();
            const step = (big ? 0.1 : 0.02) * (up ? 1 : -1);
            setValue(fromT(Math.max(0, Math.min(toT(value) + step, 1))), true);
        });

        el.addEventListener('dblclick', (e) => {
            e.preventDefault();
            setValue(def, true);
            showToast(`${opts.label} reset to ${opts.format(def)}${opts.unit}`, 'info');
        });

        render();
        return { set: (v) => setValue(v, false), get: () => value };
    }

    /**
     * Vertical fader, sibling of initKnob(). Same value/commit/format
     * contract so the two controls stay interchangeable to callers.
     *
     * opts.invert — when true, the TOP of the physical throw is the MINIMUM
     * value. The bass fader uses this: up cuts, down boosts. The inversion
     * lives here and nowhere else, so the thumb position, the fill, the
     * keyboard handler and the wheel all agree by construction rather than
     * by three separate sign flips that can drift apart.
     */
    function initFader(el, opts) {
        if (!el) return null;

        const min = parseFloat(el.dataset.min);
        const max = parseFloat(el.dataset.max);
        const def = parseFloat(el.dataset.default);
        const invert = !!opts.invert;

        const valueEl = el.querySelector('.knob-value');
        const fillEl = el.querySelector('.fader-fill');
        // Declared up here, not beside the drag handlers, because uiToPct()
        // measures it and render() can run before those are wired.
        const faderEl = el.querySelector('.fader');
        const scaleEl = el.querySelector('.fader-scale');

        let value = parseFloat(el.dataset.value);
        let commitTimer = null;

        const toT = (v) => (v - min) / (max - min);
        const fromT = (t) => min + t * (max - min);

        // Where 0 (the detent) sits in the visual travel. The bass range is
        // asymmetric, so this is derived rather than assumed to be centre.
        // It is not published as a custom property — the CSS wants the
        // resolved --zero-pct set in render(), which also accounts for the
        // thumb inset; a raw ratio here would just be a second, wronger
        // answer to the same question.
        const tZeroVal = Math.max(0, Math.min(toT(0), 1));
        const tZeroUi = invert ? 1 - tZeroVal : tZeroVal;

        /* The thumb CENTRE rides an inset track: it can only reach half a
           thumb from each end of the slot, so travel is (slotH - thumbH).
           The fill, the detent and the printed scale have to be placed on
           that same inset track or they drift from the cap — measured at up
           to 11px of overshoot at the end stops when the fill used full slot
           height. Everything below converts a normalised position into a
           percentage of the SLOT while accounting for that inset. */
        function slotHeight() {
            return faderEl ? faderEl.getBoundingClientRect().height : 0;
        }
        function thumbHeight() {
            return parseFloat(getComputedStyle(el).getPropertyValue('--thumb-h')) || 22;
        }
        function uiToPct(tUi, slotH) {
            const h = slotH === undefined ? slotHeight() : slotH;
            if (!h) return (1 - tUi) * 100;   // pre-layout: harmless fallback
            const centrePx = (h - thumbHeight()) * (1 - tUi) + thumbHeight() / 2;
            return centrePx / h * 100;
        }

        /* The printed scale is laid out from the real values, not with
           space-between. Under space-between the middle label prints at the
           geometric centre of the slot, which is only correct for a symmetric
           range — on -12..+6 it put "0" 16px away from the detent it was
           supposed to annotate. Each label declares its own dB in the markup
           and is placed on the same inset track as the thumb. */
        function layoutScale(slotH) {
            if (!scaleEl) return;
            scaleEl.querySelectorAll('span').forEach((span) => {
                const db = parseFloat(span.dataset.db);
                if (!Number.isFinite(db)) return;
                const t = Math.max(0, Math.min(toT(db), 1));
                span.style.top = `${uiToPct(invert ? 1 - t : t, slotH).toFixed(2)}%`;
            });
        }

        // Only re-lay the scale when the box actually changes size; render()
        // runs at frame rate during a drag and the labels do not move.
        let lastSlotH = -1;

        function render() {
            const t = Math.max(0, Math.min(toT(value), 1));
            // Visual position: 0 = bottom of slot, 1 = top.
            const tUi = invert ? 1 - t : t;
            el.style.setProperty('--t-ui', tUi.toFixed(4));

            const slotH = slotHeight();
            // Re-lay whenever the measurement changes, but only CACHE a real
            // one. If this runs before layout the fallback geometry is
            // approximate, and caching 0 would freeze the labels there until
            // the user happened to touch the control.
            if (slotH !== lastSlotH) {
                if (slotH) lastSlotH = slotH;
                layoutScale(slotH);
            }

            // Fill spans between the 0 dB detent and the thumb, both measured
            // on the thumb's inset track so the lit bar ends exactly at the
            // cap rather than overshooting it.
            const posPct = uiToPct(tUi, slotH);
            const zeroPct = uiToPct(tZeroUi, slotH);
            el.style.setProperty('--zero-pct', `${zeroPct.toFixed(2)}%`);
            fillEl.style.setProperty('--fill-top', `${Math.min(zeroPct, posPct).toFixed(2)}%`);
            fillEl.style.setProperty('--fill-h', `${Math.abs(zeroPct - posPct).toFixed(2)}%`);

            el.classList.toggle('is-hot', opts.isHot ? opts.isHot(value) : false);
            if (opts.onRender) opts.onRender(value);

            valueEl.textContent = opts.format(value);
            el.dataset.value = value;
            el.setAttribute('aria-valuenow', value.toFixed(1));
            el.setAttribute('aria-valuetext', `${opts.format(value)} ${opts.unit}`);
        }

        function setValue(v, commit) {
            const next = Math.max(min, Math.min(v, max));
            if (next === value && !commit) return;
            value = next;
            render();
            if (commit) {
                clearTimeout(commitTimer);
                commitTimer = setTimeout(() => opts.commit(value), 220);
            }
        }

        if (!faderEl) {
            render();
            return { set: (v) => setValue(v, false), get: () => value };
        }

        // Absolute positioning: the thumb goes where you press, like a real
        // fader, rather than accumulating a relative delta. The usable travel
        // is inset by half a thumb at each end so the cap centre can actually
        // reach both extremes.
        function valueFromEvent(e) {
            const slot = faderEl.getBoundingClientRect();
            const thumbH = parseFloat(getComputedStyle(el).getPropertyValue('--thumb-h')) || 22;
            const usable = Math.max(1, slot.height - thumbH);
            const y = e.clientY - slot.top - thumbH / 2;
            const tUi = 1 - Math.max(0, Math.min(y / usable, 1));
            return fromT(invert ? 1 - tUi : tUi);
        }

        let dragging = false;

        faderEl.addEventListener('pointerdown', (e) => {
            dragging = true;
            el.classList.add('is-active');
            el.focus();
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { }
            setValue(valueFromEvent(e), true);
            e.preventDefault();
        });

        faderEl.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            // Shift = fine: fall back to relative nudges so a precise
            // adjustment is not yanked to the cursor.
            if (e.shiftKey) {
                setValue(value - e.movementY * 0.05 * (invert ? -1 : 1), true);
            } else {
                setValue(valueFromEvent(e), true);
            }
        });

        const endDrag = (e) => {
            if (!dragging) return;
            dragging = false;
            el.classList.remove('is-active');
            try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) { }
        };
        faderEl.addEventListener('pointerup', endDrag);
        faderEl.addEventListener('pointercancel', endDrag);

        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            // Wheel-up moves the thumb UP, which on this fader means DOWN in
            // value. Matching the hardware, not the number.
            const dir = e.deltaY < 0 ? 1 : -1;
            const step = (e.shiftKey ? 0.004 : 0.02) * dir * (invert ? -1 : 1);
            setValue(fromT(Math.max(0, Math.min(toT(value) + step, 1))), true);
        }, { passive: false });

        el.addEventListener('keydown', (e) => {
            const big = e.key === 'PageUp' || e.key === 'PageDown';
            const up = e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'PageUp';
            const down = e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'PageDown';
            if (!up && !down) {
                if (e.key === 'Home') { e.preventDefault(); setValue(def, true); }
                return;
            }
            e.preventDefault();
            // Arrow-up moves the THUMB up, so on an inverted fader it lowers
            // the value — the key follows the cap, which is what a hand
            // expects from a physical control.
            const step = (big ? 0.1 : 0.02) * (up ? 1 : -1) * (invert ? -1 : 1);
            setValue(fromT(Math.max(0, Math.min(toT(value) + step, 1))), true);
        });

        el.addEventListener('dblclick', (e) => {
            e.preventDefault();
            setValue(def, true);
            showToast(`${opts.label} reset to ${opts.format(def)}${opts.unit}`, 'info');
        });

        render();
        return { set: (v) => setValue(v, false), get: () => value };
    }

    const volumeKnob = initKnob(document.getElementById('knob-volume'), {
        log: true,
        label: 'Output',
        unit: '%',
        mirror: 'music-volume',
        format: (v) => String(Math.round(v)),
        // Redline on the resolved PEAK, which is the real clipping predictor —
        // not the raw knob number and not the player volume. On the compressor
        // path the peak is pinned at the target, so the knob correctly never
        // redlines: turning it up buys density, not distortion.
        isHot: (v) => {
            const s = ampStage(v, knobVal('knob-gain', 0), ampLimiter, ampLoudness,
                knobVal('fader-bass', 0));
            return s.predictedPeak > 1.0005;
        },
        onRender: () => refreshAmp(),
        commit: (v) => {
            const t = getTargets();
            callApi('/music/volume', 'POST', {
                volume: Math.round(v), targetBot: t.targetBot, targetBots: t.targetBots
            });
        }
    });

    const gainKnob = initKnob(document.getElementById('knob-gain'), {
        bipolar: true,
        label: 'Gain',
        unit: 'dB',
        format: (v) => (v > 0 ? '+' : '') + v.toFixed(1),
        isHot: (v) => v >= 8,
        onRender: () => refreshAmp(),
        commit: (v) => {
            const t = getTargets();
            callApi('/music/gain', 'POST', {
                gainDb: Math.round(v * 10) / 10, targetBot: t.targetBot, targetBots: t.targetBots
            });
        }
    });

    // Bass fader. `bassDb` is the SHELF the user wants: positive means more
    // bass. The fader inverts the travel, not the number — everything
    // downstream (EQ, server, presets) speaks in plain "+dB of bass" so the
    // inversion cannot leak into the audio maths.
    const bassFader = initFader(document.getElementById('fader-bass'), {
        invert: true,
        label: 'Bass',
        unit: 'dB',
        format: (v) => (v > 0 ? '+' : '') + v.toFixed(1),
        // Light up once the boost is against the EQ cap — past this the fader
        // has nothing left to give and the user should know rather than keep
        // pulling. ASK the mirror where that is rather than hard-coding it:
        // the cap is on the summed curve, so the point where bass stops
        // responding moves with volume, gain and the active preset. It sits at
        // +4.5 flat, and does not exist at all once clarity has pulled the low
        // bands down — a fixed threshold lies in both directions.
        isHot: (v) => {
            if (v <= 0) return false;   // the cut side is never capped
            const vol = knobVal('knob-volume', 100);
            const g = knobVal('knob-gain', 0);
            const at = (b) => {
                const eq = ampSummedEq(ampStage(vol, g, ampLimiter, ampLoudness, b));
                return 20 * Math.log10(1 + 4 * eq[0]);   // delivered 25Hz, in dB
            };
            const probe = 0.5;
            const delivered = at(v) - at(Math.max(0, v - probe));
            // Hot when the last half-dB of pull bought less than half a
            // half-dB. Band 0 carries shelf weight 1.0, so the honest
            // delivery for a `probe` request is `probe`.
            return delivered < probe * 0.5;
        },
        onRender: () => refreshAmp(),
        commit: (v) => {
            const t = getTargets();
            callApi('/music/bass', 'POST', {
                bassDb: Math.round(v * 10) / 10, targetBot: t.targetBot, targetBots: t.targetBots
            });
        }
    });

    // Quick-set presets. Marks itself active when the current mode matches.
    // Queries the DOM each call rather than closing over a const, so it is safe
    // to invoke from refreshAmp() during the knobs' very first render.
    function syncPresets() {
        const v = Math.round(knobVal('knob-volume', 100));
        const g = knobVal('knob-gain', 0);
        const modes = (window.WebServer && window.WebServer.VOLUME_MODES) || {};
        document.querySelectorAll('.amp-preset').forEach(b => {
            const mode = b.dataset.mode;
            const preset = modes[mode];
            const on = preset && preset.volume === v && Math.abs(preset.gainDb - g) < 0.05;
            b.classList.toggle('is-on', on);
        });
    }

    document.querySelectorAll('.amp-preset').forEach(btn => {
        btn.onclick = async () => {
            const mode = btn.dataset.mode;
            const t = getTargets();
            const res = await callApi('/music/mode', 'POST', { mode, targetBot: t.targetBot, targetBots: t.targetBots });
            if (res && res.status === 'success') {
                if (volumeKnob) volumeKnob.set(res.volume);
                if (gainKnob) gainKnob.set(res.gainDb);
                refreshAmp();
                syncPresets();
                const st = ampStage(res.volume, res.gainDb, ampLimiter, ampLoudness, knobVal('fader-bass', 0));
                showToast(
                    st.loudness
                        ? `${btn.textContent.trim()} · crystal ${Math.round(st.clarity * 100)}% · +${st.densityDb.toFixed(1)}dB density`
                        : `${btn.textContent.trim()} · ${st.playerVolume}/${st.ceiling} · crystal ${Math.round(st.clarity * 100)}%`,
                    'success'
                );
            } else {
                showToast(`Mode ${mode} failed: ${res?.message || 'unknown error'}`, 'danger');
            }
        };
    });

    // Restore the knobs to whatever the server currently has applied, and learn
    // whether the limiter is available before drawing the meters for real.
    setLimiterStatus('probing');
    Promise.all([
        callApi('/music/levels', 'GET'),
        callApi('/music/modes', 'GET')
    ]).then(([levelsRes, modesRes]) => {
        if (!levelsRes || levelsRes.status !== 'success') return setLimiterStatus('absent');
        ampLimiter = !!levelsRes.limiter;
        // `chain` is the authority on which of the two mutually exclusive chains
        // is armed; res.stage.loudness is the same answer from the stage object.
        // Prefer the explicit field and fall back, so an older server response
        // degrades to "no compressor" rather than to a wrong meter.
        ampLoudness = levelsRes.chain === 'loudness' || (levelsRes.stage && levelsRes.stage.loudness === true);
        setLimiterStatus(ampLoudness ? 'loudness' : ampLimiter ? 'armed' : 'absent');
        if (volumeKnob && Number.isFinite(levelsRes.volume)) volumeKnob.set(levelsRes.volume);
        if (gainKnob && Number.isFinite(levelsRes.gainDb)) gainKnob.set(levelsRes.gainDb);
        if (bassFader && Number.isFinite(levelsRes.bassDb)) bassFader.set(levelsRes.bassDb);

        // Store mode definitions from backend for syncPresets()
        window.WebServer = window.WebServer || {};
        window.WebServer.VOLUME_MODES = {};
        if (modesRes && modesRes.status === 'success' && modesRes.modes) {
            for (const m of modesRes.modes) {
                window.WebServer.VOLUME_MODES[m.name] = { volume: m.volume, gainDb: m.gainDb, label: m.label };
            }
        }

        refreshAmp();
        syncPresets();

        // The meters are driven by ampStage(), a local mirror of the server's
        // computeStage(). If the two ever drift the gauges would be quietly
        // misreporting what the audio is doing, so check the mirror against
        // the authority once per load and say so rather than fail silently.
        if (res.stage) {
            const mine = ampStage(res.volume, res.gainDb, ampLimiter, ampLoudness, res.bassDb);
            const drift = ['playerVolume', 'ceiling', 'headroom', 'atCeiling',
                           'predictedPeak', 'densityDb', 'thresholdDb', 'ratio',
                           // The multiband and clipper settings ride in the
                           // stage object now, so the mirror has to agree on
                           // them too — densityDb is derived from them, and a
                           // silent disagreement there would show up only as a
                           // meter reading a few dB off with no other symptom.
                           'mbThresholdDb', 'mbRatio', 'mbLowGain', 'mbMidGain',
                           'mbHighGain', 'clipDrive', 'clipKnee',
                           // Bass ducking fields
                           'duckDb', 'shelfDb']
                .filter(k => mine[k] !== res.stage[k]);
            if (drift.length) {
                console.warn('[amp] meter mirror disagrees with server on:', drift.join(', '),
                    '\n  local :', mine, '\n  server:', res.stage);
            }

            if (Number.isFinite(res.maxAmplitude)) {
                const localMax = ampMaxAmplitude(mine);
                if (localMax !== null && Math.abs(localMax - res.maxAmplitude) > 0.002) {
                    console.warn('[amp] limiter ceiling mirror disagrees:', localMax, 'vs', res.maxAmplitude);
                }
            }
        }
    }).catch(() => {
        setLimiterStatus('absent');
        refreshAmp();
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = async () => {
            const filter = btn.getAttribute('data-filter');
            const targetsData = getTargets();
            const res = await callApi('/music/filter', 'POST', { filter, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
            if (res && res.status === 'success') {
                if (filter === 'clear') {
                    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('is-on'));
                } else {
                    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('is-on', b === btn));
                }
                // A preset adds EQ boost downstream of the limiter, which moves
                // the ceiling — repaint so the readout is not stale.
                refreshAmp();
                showToast(`Applied music filter: ${filter.toUpperCase()}`, 'info');
            } else {
                showToast(`Filter ${filter.toUpperCase()} failed`, 'error');
            }
        };
    });

    /* ================= FLEET COHERENCE SCOPE =================
       N units in one voice channel are N independent Lavalink players. Discord
       sums them, so the fleet is only as loud as its alignment allows:

         aligned   → amplitudes add       → 20·log10(N) dB
         scattered → adds as uncorrelated → 10·log10(N) dB

       That is the entire reason sync is a loudness feature and not just a
       tidiness one — at 8 units it is the difference between +18dB and +9dB,
       plus smeared transients on top. This panel reads the real positions back
       from Lavalink over REST (never the cached player.position, which is up to
       5s stale) and shows each unit's signed offset from the leader.
       ========================================================== */
    const scopeEl = {
        rows: document.getElementById('scope-rows'),
        skew: document.getElementById('scope-skew'),
        units: document.getElementById('scope-units'),
        gain: document.getElementById('scope-gain'),
        lock: document.getElementById('scope-lock'),
        foot: document.getElementById('scope-foot'),
        drift: document.getElementById('scope-stat-drift'),
        autosync: document.getElementById('autosync-toggle')
    };

    function fmtSkew(ms) {
        const v = Math.abs(Math.round(Number(ms) || 0));
        return v < 1000 ? `${v}ms` : `${(v / 1000).toFixed(1)}s`;
    }

    function renderScope(res) {
        if (!scopeEl.rows) return;

        const units = Array.isArray(res.units) ? res.units : [];
        const tol = Number(res.tolerance) || 80;
        const playing = Number(res.playing) || 0;

        if (scopeEl.units) scopeEl.units.textContent = playing;

        if (scopeEl.skew) {
            scopeEl.skew.textContent = playing > 1 ? fmtSkew(res.skew) : '—';
            const bad = playing > 1 && res.skew > tol;
            scopeEl.skew.classList.toggle('is-crit', bad && res.skew > tol * 4);
            scopeEl.skew.classList.toggle('is-warn', bad && res.skew <= tol * 4);
            scopeEl.skew.classList.toggle('is-good', playing > 1 && res.skew <= tol);
        }

        // The honest number: what the fleet is ACTUALLY worth right now, not
        // the best case. Inside tolerance the copies sum coherently; outside it
        // they do not, and the readout says so rather than flattering itself.
        if (scopeEl.gain) {
            if (playing < 1) {
                scopeEl.gain.textContent = '—';
                scopeEl.gain.classList.remove('is-good', 'is-warn');
            } else {
                const locked = playing < 2 || res.skew <= tol;
                const db = locked ? res.coherentGainDb : res.incoherentGainDb;
                scopeEl.gain.textContent = `+${Number(db).toFixed(1)}dB`;
                scopeEl.gain.classList.toggle('is-good', locked);
                scopeEl.gain.classList.toggle('is-warn', !locked);
                scopeEl.gain.title = locked
                    ? `${playing} aligned units sum coherently: 20·log10(${playing}) = +${Number(res.coherentGainDb).toFixed(1)}dB.`
                    : `Drifted past ${tol}ms — the units sum as uncorrelated sources: only +${Number(res.incoherentGainDb).toFixed(1)}dB instead of +${Number(res.coherentGainDb).toFixed(1)}dB.`;
            }
        }

        if (scopeEl.lock) {
            let text = '—', cls = '';
            if (playing < 1) text = 'idle';
            else if (res.tracks > 1) { text = `${res.tracks} tracks`; cls = 'is-crit'; }
            else if (playing < 2) { text = 'solo'; }
            else if (res.skew <= tol) { text = 'LOCKED'; cls = 'is-good'; }
            else { text = 'DRIFT'; cls = 'is-warn'; }
            scopeEl.lock.textContent = text;
            scopeEl.lock.classList.toggle('is-good', cls === 'is-good');
            scopeEl.lock.classList.toggle('is-warn', cls === 'is-warn');
            scopeEl.lock.classList.toggle('is-crit', cls === 'is-crit');
        }

        if (!units.length) {
            scopeEl.rows.innerHTML = '<div class="scope-empty">No unit is playing.</div>';
        } else {
            // Bar scale: whichever is larger, the tolerance band or the worst
            // offset. A fixed scale would peg every bar the moment one unit
            // stalled, hiding the rest.
            const worst = Math.max(tol, ...units.map(u => Math.abs(Number(u.offset) || 0)));
            const lead = units.find(u => u.offset === 0);
            scopeEl.rows.innerHTML = units.map(u => {
                const off = Number.isFinite(u.offset) ? u.offset : null;
                const mag = off === null ? 0 : Math.min(Math.abs(off) / worst, 1) * 100;
                const state = off === null ? 'is-unknown'
                    : u.paused ? 'is-paused'
                        : Math.abs(off) <= tol ? 'is-lock' : 'is-drift';
                const isLead = u === lead && !u.paused;
                return `
                    <div class="scope-row ${state}">
                        <span class="scope-row-id">#${u.index}</span>
                        <span class="scope-row-track" title="${escapeAttr(u.track || '')}">${escapeHtml(u.track || 'idle')}</span>
                        <span class="scope-row-bar"><i style="width:${mag.toFixed(1)}%"></i></span>
                        <span class="scope-row-off">${off === null ? '—'
                        : u.paused ? 'paused'
                            : isLead ? 'lead'
                                : `−${fmtSkew(off)}`}</span>
                    </div>`;
            }).join('');
        }

        if (scopeEl.foot) {
            const as = res.autoSync || {};
            scopeEl.foot.textContent = as.on
                ? `Auto-sync on · every ${Math.round((as.interval || 15000) / 1000)}s · ${as.ticks || 0} checks, ${as.corrections || 0} corrections`
                : playing > 1
                    ? `Tolerance ${tol}ms. Past that the fleet loses ${(Number(res.coherentGainDb) - Number(res.incoherentGainDb)).toFixed(1)}dB and smears transients.`
                    : 'Aligned copies sum coherently. Drift past tolerance costs level and smears transients.';
        }

        if (scopeEl.autosync && document.activeElement !== scopeEl.autosync) {
            scopeEl.autosync.checked = !!(res.autoSync && res.autoSync.on);
        }
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }
    const escapeAttr = escapeHtml;

    // Poll only while the panel can actually be seen. The endpoint costs one
    // Lavalink REST round-trip per bot, so polling a hidden tab would put real
    // load on the node for nothing.
    let scopeBusy = false;
    async function pollScope() {
        if (scopeBusy || !scopeEl.rows) return;
        if (document.hidden || !scopeEl.rows.offsetParent) return;
        scopeBusy = true;
        try {
            const t = getTargets();
            const q = new URLSearchParams();
            if (t.targetBot) q.set('targetBot', t.targetBot);
            if (t.targetBots && t.targetBots.length) q.set('targetBots', t.targetBots.join(','));
            const res = await callApi(`/music/skew${q.toString() ? `?${q}` : ''}`, 'GET');
            if (res && res.status === 'success') renderScope(res);
        } catch (_) { } finally {
            scopeBusy = false;
        }
    }
    setInterval(pollScope, 2500);
    pollScope();

    if (scopeEl.autosync) {
        scopeEl.autosync.onchange = async () => {
            const on = scopeEl.autosync.checked;
            const t = getTargets();
            const res = await callApi('/music/autosync', 'POST', {
                enabled: on, targetBot: t.targetBot, targetBots: t.targetBots
            });
            if (res && res.status === 'success') {
                showToast(res.message || (on ? 'Auto-sync armed' : 'Auto-sync off'), on ? 'success' : 'info');
            } else {
                // Put the switch back — it must not claim a watchdog that is
                // not running.
                scopeEl.autosync.checked = !on;
                showToast((res && res.message) || 'Auto-sync request failed', 'error');
            }
            pollScope();
        };
    }

    document.querySelectorAll('.join-owner-music').forEach(btn => {
        btn.onclick = () => {
            const deaf = document.getElementById('music-deafen')?.checked || false;
            const mute = document.getElementById('music-mute')?.checked || false;
            const targetsData = getTargets(true);
            callApi('/music/join', 'POST', { type: 'owner', deaf, mute, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
            showToast('Join Owner triggered for fleet', 'info');
        };
    });

    document.querySelectorAll('.join-id-music').forEach(btn => {
        btn.onclick = () => {
            const id = document.getElementById('music-channel-id')?.value?.trim();
            const deaf = document.getElementById('music-deafen')?.checked || false;
            const mute = document.getElementById('music-mute')?.checked || false;
            const targetsData = getTargets(true);
            if (!id) return showToast('Please enter a Channel ID', 'warning');
            callApi('/music/join', 'POST', { type: 'id', channel_id: id, deaf, mute, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
            showToast(`Connecting fleet to channel ${id}...`, 'info');
        };
    });

    document.querySelectorAll('.follow-owner-music').forEach(btn => {
        btn.onclick = async () => {
            const targetsData = getTargets();
            const res = await callApi('/follow/toggle', 'POST', { targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
            document.querySelectorAll('#follow-owner, .follow-owner-music').forEach(b => {
                if (res.enabled) {
                    b.classList.add('active-btn');
                    b.innerHTML = '<i class="fas fa-pause"></i> Stop Following';
                } else {
                    b.classList.remove('active-btn');
                    b.innerHTML = '<i class="fas fa-person-walking"></i> Follow Owner';
                }
            });
            showToast(`Follow Owner ${res.enabled ? 'ENABLED' : 'DISABLED'}`, res.enabled ? 'success' : 'info');
        };
    });

    document.querySelectorAll('.leave-vc-music').forEach(btn => {
        btn.onclick = () => {
            const targetsData = getTargets();
            callApi('/music/disconnect', 'POST', { targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
            showToast('Left Voice Channel', 'warning');
        };
    });

    // Spammer
    document.getElementById('send-once').onclick = () => {
        const channelId = document.getElementById('spam-channel-id').value;
        const content = document.getElementById('spam-content').value;
        const targetsData = getTargets();
        if (!channelId || !content) return showToast('Fill Channel ID and message content', 'warning');
        callApi('/message/send', 'POST', { channel_id: channelId, content, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        showToast('Single Message Sent!', 'success');
    };

    document.getElementById('start-spam').onclick = () => {
        const channelId = document.getElementById('spam-channel-id').value;
        const content = document.getElementById('spam-content').value;
        const interval = document.getElementById('spam-interval').value;
        const targetsData = getTargets();
        if (!channelId || !content) return showToast('Fill Channel ID and message content', 'warning');
        callApi('/message/send', 'POST', { channel_id: channelId, content, interval, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        showToast('Auto-Spam Started!', 'danger');
    };

    document.getElementById('stop-spam').onclick = () => {
        const targetsData = getTargets();
        callApi('/message/stop', 'POST', { targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        showToast('Auto-Spam Stopped', 'info');
    };

    // ==================== TOKEN MANAGER ====================
    const tmList = document.getElementById('tm-list');

    function tmEscape(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }

    async function loadTokenManager() {
        if (!tmList) return;
        const res = await callApi('/tokens/list');
        if (!res || res.status !== 'success') {
            tmList.innerHTML = '<div class="empty-state">Could not load registry.</div>';
            return;
        }

        const tokens = res.tokens || [];
        const online = tokens.filter(t => t.online).length;

        // Update counters
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('tm-count', tokens.length);
        set('tm-stat-total', tokens.length);
        set('tm-stat-online', online);
        set('tm-stat-offline', tokens.length - online);

        if (tokens.length === 0) {
            tmList.innerHTML = '<div class="empty-state">No units enrolled. Add tokens above to begin.</div>';
            return;
        }

        tmList.innerHTML = '';
        tokens.forEach(t => {
            const row = document.createElement('div');
            row.className = 'token-manage-item';
            const title = t.tag ? tmEscape(t.tag) : (t.online ? 'Authorised' : 'Not started');
            row.innerHTML = `
                <span class="tm-dot ${t.online ? 'on' : 'off'}"></span>
                <div class="tm-info">
                    <span class="tm-title">${title}</span>
                    <span class="tm-sub">${tmEscape(t.masked)}${t.userId ? ' · ' + t.userId : ''}</span>
                </div>
                <span class="tm-badge">#${t.index}</span>
                <div class="tm-actions">
                    <button class="btn btn-sm ${t.online ? 'btn-secondary' : 'btn-success'} tm-session" data-index="${t.index}" data-action="${t.online ? 'logout' : 'login'}" title="${t.online ? 'Log out' : 'Log in'}">
                        <i class="fas ${t.online ? 'fa-power-off' : 'fa-play'}"></i>
                    </button>
                    <button class="btn btn-sm btn-danger tm-remove" data-index="${t.index}" title="Remove">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            tmList.appendChild(row);
        });

        // Wire per-row actions
        tmList.querySelectorAll('.tm-session').forEach(btn => {
            btn.onclick = async () => {
                const index = btn.getAttribute('data-index');
                const action = btn.getAttribute('data-action');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                const r = await callApi('/tokens/session', 'POST', { index, action });
                showToast(r.message || 'Done', r.status === 'success' ? 'success' : 'danger');
                setTimeout(loadTokenManager, 600);
            };
        });

        tmList.querySelectorAll('.tm-remove').forEach(btn => {
            btn.onclick = async (e) => {
                if (e) e.stopPropagation();
                const index = btn.getAttribute('data-index');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                try {
                    const r = await callApi('/tokens/remove', 'POST', { index });
                    if (r && r.status === 'success') {
                        showToast(r.message || `Unit #${index} removed`, 'success');
                    } else {
                        showToast((r && r.message) || `Failed to remove unit #${index}`, 'danger');
                    }
                } catch(err) {
                    showToast('Remove error: ' + err.message, 'danger');
                }
                await loadTokenManager();
                updateStats();
            };
        });
    }

    // Add tokens (bulk)
    const tmTokenInput = document.getElementById('tm-token-input');
    tmTokenInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('tm-add-btn')?.click();
        }
    });

    document.getElementById('tm-add-btn')?.addEventListener('click', async () => {
        const input = document.getElementById('tm-token-input');
        const autoLogin = document.getElementById('tm-auto-login')?.checked !== false;
        const raw = (input?.value || '').trim();
        if (!raw) { showToast('Paste at least one token', 'warning'); return; }

        const btn = document.getElementById('tm-add-btn');
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding…';

        const res = await callApi('/tokens/add', 'POST', { tokens: raw, login: autoLogin });

        const resultDiv = document.getElementById('tm-add-result');
        if (res && res.status === 'success') {
            const failed = (res.results || []).filter(r => !r.ok);
            const addedCount = typeof res.added === 'number' ? res.added : (res.results || []).filter(r => r.ok).length;
            showToast(`Added ${addedCount} token(s)${failed.length ? `, ${failed.length} skipped` : ''}`, addedCount ? 'success' : 'warning');
            if (resultDiv) {
                resultDiv.innerHTML = (res.results || []).map(r => `
                    <div class="tm-result-line ${r.ok ? 'ok' : 'bad'}">
                        <i class="fas ${r.ok ? 'fa-check' : 'fa-xmark'}"></i>
                        <span>${tmEscape(r.token)}</span>
                        <span class="tm-result-msg">${tmEscape(r.message)}</span>
                    </div>`).join('');
            }
            if (res.added) input.value = '';
            await loadTokenManager();
            updateStats();
        } else {
            showToast((res && res.message) || 'Failed to add tokens', 'danger');
        }

        btn.disabled = false;
        btn.innerHTML = original;
    });

    document.getElementById('tm-refresh')?.addEventListener('click', loadTokenManager);

    // Refresh registry whenever the Token Manager tab is opened
    document.querySelector('.nav-links li[data-tab="token-manager"]')?.addEventListener('click', loadTokenManager);

    // Token Manager
    document.getElementById('check-validity').onclick = async () => {
        const btn = document.getElementById('check-validity');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
        showToast('Checking Token Validity...', 'info');

        const res = await callApi('/tokens/check-validity', 'POST');
        if (res && res.data) {
            showToast(`Check Finished! Valid: ${res.data.valid} | Invalid: ${res.data.invalid} | Locked: ${res.data.locked || 0}`, 'success', 5000);
            const resultDiv = document.getElementById('validity-result');
            if (resultDiv) {
                resultDiv.innerHTML = `
                    <div style="padding: 16px; background: rgba(0,0,0,0.4); border-radius: 20px; border: 1px solid var(--border-color); display: flex; gap: 15px; justify-content: space-around;">
                        <span style="color: var(--success); font-weight: 700;">Valid: ${res.data.valid}</span>
                        <span style="color: var(--danger); font-weight: 700;">Invalid: ${res.data.invalid}</span>
                        <span style="color: var(--warning); font-weight: 700;">Locked: ${res.data.locked || 0}</span>
                    </div>
                `;
            }
        }

        btn.disabled = false;
        btn.innerHTML = originalText;
    };

    document.getElementById('extract-info').onclick = async () => {
        const btn = document.getElementById('extract-info');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Extracting...';

        const res = await callApi('/tokens/extract');
        showToast(res.message, res.status === 'success' ? 'success' : 'danger');

        btn.disabled = false;
        btn.innerHTML = originalText;
    };

    document.getElementById('auto-recover').onclick = async () => {
        const btn = document.getElementById('auto-recover');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recovering...';

        const res = await callApi('/tokens/auto-recover', 'POST');
        showToast(res.message, 'info', 5000);

        btn.disabled = false;
        btn.innerHTML = originalText;
    };

    document.getElementById('send-friend-request').onclick = async () => {
        const targetUser = document.getElementById('adv-spam-target-user').value;
        if (!targetUser) return showToast('Please enter a Target User ID or Username', 'warning');

        const btn = document.getElementById('send-friend-request');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending Requests...';

        const targetsData = getTargets();
        const res = await callApi('/tokens/friend-request', 'POST', { targetUser, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        showToast(res.message, 'info');

        btn.disabled = false;
        btn.innerHTML = originalText;
    };

    document.getElementById('send-dm-spam').onclick = async () => {
        const targetUser = document.getElementById('adv-spam-target-user').value;
        const content = document.getElementById('adv-spam-content').value;

        if (!targetUser) return showToast('Please enter a Target User ID or Username', 'warning');
        if (!content) return showToast('Please enter message content for DM Spam', 'warning');

        const btn = document.getElementById('send-dm-spam');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Spawning DMs...';

        const targetsData = getTargets();
        const res = await callApi('/tokens/dm-spam', 'POST', { targetUser, content, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        showToast(res.message, 'info');

        btn.disabled = false;
        btn.innerHTML = originalText;
    };

    // Settings & RPC
    document.getElementById('update-status').onclick = () => {
        const status = document.getElementById('rpc-status').value;
        const type = document.getElementById('rpc-type').value;
        const text = document.getElementById('rpc-text').value;
        const targetsData = getTargets();
        callApi('/status', 'POST', { status, type, text, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        showToast(`Updated Bot Status to ${status.toUpperCase()} (${type}: ${text})`, 'success');
    };

    // --- CUSTOM AUDIO PLAYER LOGIC ---
    async function loadAudioList() {
        const res = await callApi('/audio/list');
        const select = document.getElementById('audio-file-list');
        if (res.status === 'success' && select) {
            select.innerHTML = '<option value="">Select Audio File...</option>';
            res.files.forEach(file => {
                const opt = document.createElement('option');
                opt.value = file;
                opt.textContent = file;
                select.appendChild(opt);
            });
        }
    }
    loadAudioList();

    const audioUploadInput = document.getElementById('audio-upload-input');
    const browseBtn = document.getElementById('browse-audio-btn');
    const selectedFileName = document.getElementById('selected-file-name');

    if (browseBtn) browseBtn.onclick = () => audioUploadInput.click();

    if (audioUploadInput) {
        audioUploadInput.onchange = () => {
            const file = audioUploadInput.files[0];
            selectedFileName.textContent = file ? `Selected: ${file.name}` : 'No file selected';
        };
    }

    const uploadBtn = document.getElementById('upload-audio-btn');
    if (uploadBtn) {
        uploadBtn.onclick = async () => {
            const fileInput = document.getElementById('audio-upload-input');
            if (fileInput.files.length === 0) return showToast('Please select a file first', 'warning');

            const formData = new FormData();
            formData.append('audio', fileInput.files[0]);

            const originalText = uploadBtn.innerHTML;
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

            try {
                const response = await fetch('/api/audio/upload', {
                    method: 'POST',
                    body: formData
                });
                const res = await response.json();
                if (res.status === 'success') {
                    showToast('File uploaded successfully!', 'success');
                    loadAudioList();
                    fileInput.value = '';
                    selectedFileName.textContent = 'No file selected';
                } else {
                    showToast('Upload failed: ' + res.message, 'danger');
                }
            } catch (e) {
                showToast('Upload error: ' + e.message, 'danger');
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = originalText;
            }
        };
    }

    // --- CUSTOM VIDEO PLAYER LOGIC ---
    async function loadVideoList() {
        try {
            const res = await callApi('/video/list');
            const select = document.getElementById('video-file-list');
            if (res && res.status === 'success' && select) {
                select.innerHTML = '<option value="">Select Video File...</option>';
                res.files.forEach(file => {
                    const opt = document.createElement('option');
                    opt.value = file;
                    opt.textContent = file;
                    select.appendChild(opt);
                });
            }
        } catch (e) { }
    }
    loadVideoList();

    const videoUploadInput = document.getElementById('video-upload-input');
    const browseVideoBtn = document.getElementById('browse-video-btn');
    const selectedVideoName = document.getElementById('selected-video-name');

    if (browseVideoBtn) browseVideoBtn.onclick = () => videoUploadInput.click();

    if (videoUploadInput) {
        videoUploadInput.onchange = () => {
            const file = videoUploadInput.files[0];
            selectedVideoName.textContent = file ? `Selected: ${file.name}` : 'No file selected';
        };
    }

    const uploadVideoBtn = document.getElementById('upload-video-btn');
    if (uploadVideoBtn) {
        uploadVideoBtn.onclick = async () => {
            const fileInput = document.getElementById('video-upload-input');
            if (fileInput.files.length === 0) return showToast('Please select a video file first', 'warning');

            const formData = new FormData();
            formData.append('video', fileInput.files[0]);

            const originalText = uploadVideoBtn.innerHTML;
            uploadVideoBtn.disabled = true;
            uploadVideoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

            try {
                const response = await fetch('/api/video/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) throw new Error(`Server returned ${response.status}`);

                const res = await response.json();
                if (res.status === 'success') {
                    showToast('Video uploaded successfully!', 'success');
                    loadVideoList();
                    fileInput.value = '';
                    selectedVideoName.textContent = 'No file selected';
                } else {
                    showToast('Upload failed: ' + res.message, 'danger');
                }
            } catch (e) {
                showToast('Upload error: ' + e.message, 'danger');
            } finally {
                uploadVideoBtn.disabled = false;
                uploadVideoBtn.innerHTML = originalText;
            }
        };
    }

    document.getElementById('play-custom-audio').onclick = () => {
        const file = document.getElementById('audio-file-list').value;
        const targetsData = getTargets(true);
        if (!file) return showToast('Please select an audio file', 'warning');
        const vol = document.getElementById('custom-audio-volume').value;
        callApi('/audio/play', 'POST', { file, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots, volume: vol });
        showToast(`Playing custom audio: ${file}`, 'success');
    };

    document.getElementById('stop-custom-audio').onclick = () => {
        const targetsData = getTargets(true);
        callApi('/audio/stop', 'POST', { targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        showToast('Stopped custom audio', 'info');
    };

    document.getElementById('play-custom-video').onclick = () => {
        const file = document.getElementById('video-file-list').value;
        const targetsData = getTargets(true);
        if (!file) return showToast('Please select a video file', 'warning');
        callApi('/video/play', 'POST', { file, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        showToast(`Streaming video: ${file}`, 'success');
    };

    document.getElementById('stop-custom-video').onclick = () => {
        const targetsData = getTargets(true);
        callApi('/video/stop', 'POST', { targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        showToast('Stopped video stream', 'info');
    };

    const setCustomVolBtn = document.getElementById('set-custom-audio-volume');
    if (setCustomVolBtn) {
        setCustomVolBtn.onclick = () => {
            const vol = document.getElementById('custom-audio-volume').value;
            const targetsData = getTargets();
            callApi('/audio/volume', 'POST', { volume: vol, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
            showToast(`Custom Audio Volume set to ${vol}`, 'success');
        };
    }

    document.querySelectorAll('.custom-audio-filter-btn').forEach(btn => {
        btn.onclick = async () => {
            const filter = btn.getAttribute('data-filter');
            const targetsData = getTargets();
            const res = await callApi('/audio/filter', 'POST', { filter, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
            if (res && res.status === 'success') {
                document.querySelectorAll('.custom-audio-filter-btn').forEach(b => b.classList.toggle('is-on', b === btn));
                showToast(`Applied audio filter: ${filter.toUpperCase()}`, 'info');
            } else {
                showToast(`Filter ${filter.toUpperCase()} failed`, 'error');
            }
        };
    });

    // Mass Reaction Handlers
    document.getElementById('add-reactions').onclick = async () => {
        const channel_id = document.getElementById('reaction-channel-id').value;
        const message_id = document.getElementById('reaction-message-id').value;
        const emojis = document.getElementById('reaction-emojis').value;
        const targetsData = getTargets();

        if (!channel_id || !message_id || !emojis) return showToast('Please fill Channel ID, Message ID and Emoji(s)', 'warning');

        const btn = document.getElementById('add-reactions');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

        const res = await callApi('/reactions/add', 'POST', { channel_id, message_id, emojis, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        showToast(res.message, 'success');

        btn.disabled = false;
        btn.innerHTML = originalText;
    };

    document.getElementById('copy-reactions').onclick = async () => {
        const channel_id = document.getElementById('reaction-channel-id').value;
        const message_id = document.getElementById('reaction-message-id').value;
        const targetsData = getTargets();

        if (!channel_id || !message_id) return showToast('Please fill Channel ID and Message ID', 'warning');

        const btn = document.getElementById('copy-reactions');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Copying...';

        const res = await callApi('/reactions/copy', 'POST', { channel_id, message_id, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        showToast(res.message, 'info');

        btn.disabled = false;
        btn.innerHTML = originalText;
    };

    document.getElementById('remove-reactions').onclick = async () => {
        const channel_id = document.getElementById('reaction-channel-id').value;
        const message_id = document.getElementById('reaction-message-id').value;
        const targetsData = getTargets();

        if (!channel_id || !message_id) return showToast('Please fill Channel ID and Message ID', 'warning');

        const btn = document.getElementById('remove-reactions');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removing...';

        const res = await callApi('/reactions/remove', 'POST', { channel_id, message_id, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
        showToast(res.message, 'danger');

        btn.disabled = false;
        btn.innerHTML = originalText;
    };

    // TTS Control
    document.getElementById('send-tts').onclick = async () => {
        const text = document.getElementById('tts-content').value;
        if (!text) return showToast('Please enter some text to speak', 'warning');

        const btn = document.getElementById('send-tts');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Speaking...';

        const res = await callApi('/tts', 'POST', { text });
        if (res.status === 'success') {
            document.getElementById('tts-content').value = '';
            showToast('TTS Broadcast Sent!', 'success');
        } else {
            showToast(res.message, 'danger');
        }

        btn.disabled = false;
        btn.innerHTML = originalText;
    };

    // Music Timeline Logic
    const timelineContainer = document.getElementById('timeline-container');
    const timeline = document.getElementById('music-timeline');
    const timeCurrent = document.getElementById('time-current');
    const timeTotal = document.getElementById('time-total');
    const nowPlayingText = document.getElementById('now-playing-text');
    let isDraggingTimeline = false;
    let currentDuration = 0;

    function formatTime(ms) {
        if (!ms || isNaN(ms)) return '0:00';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    if (timeline) {
        timeline.addEventListener('mousedown', () => isDraggingTimeline = true);
        timeline.addEventListener('mouseup', () => isDraggingTimeline = false);
        timeline.addEventListener('touchstart', () => isDraggingTimeline = true);
        timeline.addEventListener('touchend', () => isDraggingTimeline = false);

        timeline.addEventListener('change', () => {
            if (currentDuration > 0) {
                const percentage = timeline.value;
                const targetPosition = Math.floor((percentage / 100) * currentDuration);
                const targetsData = getTargets();
                callApi('/music/seek', 'POST', { position: targetPosition, targetBot: targetsData.targetBot, targetBots: targetsData.targetBots });
            }
        });
    }

    setInterval(async () => {
        try {
            const targetsData = getTargets();
            const res = await fetch(`/api/music/state?targetBot=${targetsData.targetBot || ''}&targetBots=${targetsData.targetBots ? targetsData.targetBots.join(',') : ''}`);
            const data = await res.json();

            if (data.title && timelineContainer) {
                timelineContainer.style.display = 'block';
                nowPlayingText.innerText = data.title;
                currentDuration = data.duration;

                if (timeTotal) timeTotal.innerText = formatTime(data.duration);
                if (timeCurrent) timeCurrent.innerText = formatTime(data.position);

                if (!isDraggingTimeline && timeline) {
                    const percentage = (data.position / data.duration) * 100;
                    timeline.value = isNaN(percentage) ? 0 : percentage;
                }

                const pauseBtn = document.getElementById('pause-music');
                if (pauseBtn) {
                    const isPaused = data.isPaused || false;
                    pauseBtn.setAttribute('data-paused', isPaused.toString());
                    pauseBtn.innerHTML = isPaused ? '<i class="fas fa-play"></i> Resume' : '<i class="fas fa-pause"></i> Pause';
                    pauseBtn.className = isPaused ? 'btn btn-success' : 'btn btn-secondary';
                }
            } else if (timelineContainer) {
                timelineContainer.style.display = 'none';
            }
        } catch (e) { }
    }, 2000);
});

/* ============================================================
   LIVING GLASS · v16 — pointer specular tracking
   ------------------------------------------------------------
   Writes --mx / --my (the cursor position, in %, relative to the
   hovered pane) onto each glass surface so its ::before / ::after
   highlight glides under the pointer. Pure presentation: one
   delegated pointermove, coalesced into a single rAF write per
   frame, and fully disabled when the user prefers reduced motion.
   ============================================================ */
(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches) return;

    // Panes whose highlight tracks the cursor. Matches the selector list the
    // v16 CSS layer attaches ::before/::after spotlights to.
    const SELECTOR = '.card, .stat-card, .deck, .sidebar, .command-palette-card, .theme-picker-card, .access-panel';

    let pending = null; // {el, x, y} queued for the next frame

    document.addEventListener('pointermove', (e) => {
        const el = e.target.closest && e.target.closest(SELECTOR);
        if (!el) return;

        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;

        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;

        if (!pending) {
            requestAnimationFrame(() => {
                if (pending) {
                    pending.el.style.setProperty('--mx', pending.x.toFixed(1) + '%');
                    pending.el.style.setProperty('--my', pending.y.toFixed(1) + '%');
                }
                pending = null;
            });
        }
        pending = { el, x, y };
    }, { passive: true });

    // Park the highlight back at the top-centre rest position when the pointer
    // leaves a pane, so it fades out from where it started rather than freezing
    // wherever the cursor happened to exit.
    document.addEventListener('pointerout', (e) => {
        const el = e.target.closest && e.target.closest(SELECTOR);
        if (el && (!e.relatedTarget || !el.contains(e.relatedTarget))) {
            el.style.removeProperty('--mx');
            el.style.removeProperty('--my');
        }
    }, { passive: true });
})();
