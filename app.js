// ===== DATA STORE =====
const STORAGE_KEY = 'patientAssessments';
const THEME_KEY = 'patientAssessTheme';

function getPatients() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}
function savePatients(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ===== THEME TOGGLE =====
function applyTheme(theme) {
    const body = document.body;
    const moonIcon = document.querySelector('.icon-moon');
    const sunIcon = document.querySelector('.icon-sun');
    if (theme === 'light') {
        body.classList.add('light-theme');
        if (moonIcon) moonIcon.style.display = 'none';
        if (sunIcon) sunIcon.style.display = 'block';
    } else {
        body.classList.remove('light-theme');
        if (moonIcon) moonIcon.style.display = 'block';
        if (sunIcon) sunIcon.style.display = 'none';
    }
    localStorage.setItem(THEME_KEY, theme);
}

// Apply saved theme on load
applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

document.getElementById('themeToggle').addEventListener('click', () => {
    const current = document.body.classList.contains('light-theme') ? 'light' : 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ===== NAVIGATION =====
function showSection(id) {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.dataset.section === id);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (id === 'dashboard') refreshDashboard();
    if (id === 'indicators') refreshIndicatorSelect();
    if (id === 'history') refreshHistory();
}

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        showSection(link.dataset.section);
    });
});

// ===== TOAST =====
function showToast(msg, type = 'success') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ===== SCORING =====
function calcVitalScore(v) {
    let s = 0;
    if (v.temp && (v.temp < 36.1 || v.temp > 37.2)) s += v.temp > 38.5 || v.temp < 35 ? 3 : 1;
    if (v.hr && (v.hr < 60 || v.hr > 100)) s += v.hr > 130 || v.hr < 40 ? 3 : 1;
    if (v.rr && (v.rr < 12 || v.rr > 20)) s += v.rr > 30 || v.rr < 8 ? 3 : 1;
    if (v.bpSys && (v.bpSys < 90 || v.bpSys > 140)) s += v.bpSys > 180 || v.bpSys < 70 ? 3 : 2;
    if (v.bpDia && (v.bpDia < 60 || v.bpDia > 90)) s += v.bpDia > 110 ? 2 : 1;
    if (v.o2 && v.o2 < 95) s += v.o2 < 90 ? 3 : 1;
    return s;
}

function calcTotalScore(patient) {
    const v = patient.vitals || {};
    const ind = patient.indicators || {};
    let score = calcVitalScore(v);
    score += parseInt(ind.pain || 0);
    const cMap = { alert: 0, verbal: 1, pain: 2, unresponsive: 3 };
    score += cMap[ind.consciousness] || 0;
    const mMap = { independent: 0, assisted: 1, wheelchair: 2, bedbound: 3 };
    score += mMap[ind.mobility] || 0;
    const fMap = { low: 0, moderate: 1, high: 2 };
    score += fMap[ind.fallRisk] || 0;
    const nMap = { good: 0, fair: 1, poor: 2 };
    score += nMap[ind.nutrition] || 0;
    const sMap = { intact: 0, redness: 1, partial: 2, severe: 3 };
    score += sMap[ind.skinIntegrity] || 0;
    return score;
}

function getStatus(score) {
    if (score <= 5) return { text: 'คงที่', cls: 'stable', label: 'ความเสี่ยงต่ำ' };
    if (score <= 12) return { text: 'เฝ้าระวัง', cls: 'warning', label: 'ความเสี่ยงปานกลาง' };
    return { text: 'วิกฤต', cls: 'critical', label: 'ความเสี่ยงสูง' };
}

// ===== DASHBOARD =====
function refreshDashboard() {
    const patients = getPatients();
    const tbody = document.getElementById('patientTableBody');
    const empty = document.getElementById('emptyState');
    const table = document.getElementById('patientTable');

    // Stats
    document.getElementById('totalPatients').textContent = patients.length;
    const scores = patients.map(p => ({ p, score: calcTotalScore(p) }));
    document.getElementById('criticalCount').textContent = scores.filter(s => s.score > 12).length;
    document.getElementById('stableCount').textContent = scores.filter(s => s.score <= 5).length;
    const today = new Date().toLocaleDateString('th-TH');
    document.getElementById('todayAssessments').textContent = patients.filter(p => new Date(p.date).toLocaleDateString('th-TH') === today).length;

    // Animate numbers
    document.querySelectorAll('.stat-number').forEach(el => {
        const end = parseInt(el.textContent);
        let cur = 0;
        const step = Math.max(1, Math.ceil(end / 20));
        const timer = setInterval(() => {
            cur = Math.min(cur + step, end);
            el.textContent = cur;
            if (cur >= end) clearInterval(timer);
        }, 30);
    });

    if (!patients.length) {
        table.style.display = 'none';
        empty.classList.remove('hidden');
        return;
    }
    table.style.display = '';
    empty.classList.add('hidden');

    tbody.innerHTML = patients.slice().reverse().map(p => {
        const score = calcTotalScore(p);
        const st = getStatus(score);
        return `<tr>
            <td style="font-family:var(--font-mono);color:var(--accent-secondary)">${p.hn}</td>
            <td>${p.name}</td>
            <td>${p.age}</td>
            <td><span class="badge badge-${st.cls}"><span class="badge-dot"></span>${st.text}</span></td>
            <td style="font-family:var(--font-mono);font-weight:700">${score}</td>
            <td>${new Date(p.date).toLocaleString('th-TH')}</td>
            <td>
                <button class="btn btn-sm" onclick="viewDetail('${p.hn}')">ดูข้อมูล</button>
                <button class="btn btn-sm btn-danger" onclick="deletePatient('${p.hn}')">ลบ</button>
            </td>
        </tr>`;
    }).join('');
}

// ===== FORM SUBMIT =====
document.getElementById('assessmentForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const patient = {
        hn: document.getElementById('patientHN').value.trim(),
        name: document.getElementById('patientName').value.trim(),
        age: document.getElementById('patientAge').value,
        gender: document.getElementById('patientGender').value,
        diagnosis: document.getElementById('patientDiagnosis').value.trim(),
        ward: document.getElementById('patientWard').value.trim(),
        bed: document.getElementById('patientBed').value.trim(),
        vitals: {
            temp: parseFloat(document.getElementById('vitalTemp').value) || null,
            hr: parseInt(document.getElementById('vitalHR').value) || null,
            rr: parseInt(document.getElementById('vitalRR').value) || null,
            bpSys: parseInt(document.getElementById('vitalBPSys').value) || null,
            bpDia: parseInt(document.getElementById('vitalBPDia').value) || null,
            o2: parseInt(document.getElementById('vitalO2').value) || null,
        },
        indicators: {
            pain: document.getElementById('painScale').value,
            consciousness: document.getElementById('consciousness').value,
            mobility: document.getElementById('mobility').value,
            fallRisk: document.getElementById('fallRisk').value,
            nutrition: document.getElementById('nutrition').value,
            skinIntegrity: document.getElementById('skinIntegrity').value,
        },
        notes: document.getElementById('assessmentNotes').value.trim(),
        date: new Date().toISOString(),
    };

    const patients = getPatients();
    const idx = patients.findIndex(p => p.hn === patient.hn);
    if (idx >= 0) patients[idx] = patient; else patients.push(patient);
    savePatients(patients);
    // Auto-sync to Sheets
    if (sheetsConnector.isEnabled()) {
        sheetsConnector.savePatient(patient);
    }
    this.reset();
    document.getElementById('painValue').textContent = '0';
    showToast('บันทึกการประเมินสำเร็จ');
    showSection('dashboard');
});

// Pain slider
document.getElementById('painScale').addEventListener('input', function () {
    const v = this.value;
    const el = document.getElementById('painValue');
    el.textContent = v;
    el.style.color = v <= 3 ? 'var(--success)' : v <= 6 ? 'var(--warning)' : 'var(--danger)';
});

// ===== VIEW DETAIL =====
function viewDetail(hn) {
    const p = getPatients().find(x => x.hn === hn);
    if (!p) return;
    const score = calcTotalScore(p);
    const st = getStatus(score);
    const genderMap = { male: 'ชาย', female: 'หญิง', other: 'อื่นๆ' };
    const consMap = { alert: 'รู้สึกตัวดี', verbal: 'ตอบสนองต่อเสียง', pain: 'ตอบสนองต่อความเจ็บปวด', unresponsive: 'ไม่ตอบสนอง' };
    const mobMap = { independent: 'เคลื่อนไหวเอง', assisted: 'ต้องมีผู้ช่วย', wheelchair: 'รถเข็น', bedbound: 'ติดเตียง' };
    const fallMap = { low: 'ต่ำ', moderate: 'ปานกลาง', high: 'สูง' };
    const nutMap = { good: 'ดี', fair: 'พอใช้', poor: 'ไม่ดี' };
    const skinMap = { intact: 'ปกติ', redness: 'ผิวแดง', partial: 'แผลเปิด', severe: 'แผลลึก' };

    const v = p.vitals || {};
    document.getElementById('modalBody').innerHTML = `
        <div class="detail-section-title">ข้อมูลผู้ป่วย</div>
        <div class="detail-row"><span class="detail-label">HN</span><span class="detail-value">${p.hn}</span></div>
        <div class="detail-row"><span class="detail-label">ชื่อ</span><span class="detail-value">${p.name}</span></div>
        <div class="detail-row"><span class="detail-label">อายุ/เพศ</span><span class="detail-value">${p.age} ปี / ${genderMap[p.gender] || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">วินิจฉัย</span><span class="detail-value">${p.diagnosis || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Ward / Bed</span><span class="detail-value">${p.ward || '-'} / ${p.bed || '-'}</span></div>
        <div class="detail-section-title">สัญญาณชีพ</div>
        <div class="detail-row"><span class="detail-label">อุณหภูมิ</span><span class="detail-value">${v.temp || '-'} °C</span></div>
        <div class="detail-row"><span class="detail-label">ชีพจร</span><span class="detail-value">${v.hr || '-'} bpm</span></div>
        <div class="detail-row"><span class="detail-label">อัตราหายใจ</span><span class="detail-value">${v.rr || '-'} /min</span></div>
        <div class="detail-row"><span class="detail-label">ความดัน</span><span class="detail-value">${v.bpSys || '-'}/${v.bpDia || '-'} mmHg</span></div>
        <div class="detail-row"><span class="detail-label">O₂ Sat</span><span class="detail-value">${v.o2 || '-'} %</span></div>
        <div class="detail-section-title">ตัวชี้วัด</div>
        <div class="detail-row"><span class="detail-label">Pain</span><span class="detail-value">${p.indicators?.pain || 0}/10</span></div>
        <div class="detail-row"><span class="detail-label">Consciousness</span><span class="detail-value">${consMap[p.indicators?.consciousness] || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Mobility</span><span class="detail-value">${mobMap[p.indicators?.mobility] || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Fall Risk</span><span class="detail-value">${fallMap[p.indicators?.fallRisk] || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Nutrition</span><span class="detail-value">${nutMap[p.indicators?.nutrition] || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Skin</span><span class="detail-value">${skinMap[p.indicators?.skinIntegrity] || '-'}</span></div>
        <div class="detail-section-title">ผลประเมิน</div>
        <div class="detail-row"><span class="detail-label">คะแนนรวม</span><span class="detail-value" style="font-size:18px;font-weight:800">${score}</span></div>
        <div class="detail-row"><span class="detail-label">สถานะ</span><span class="badge badge-${st.cls}"><span class="badge-dot"></span>${st.text}</span></div>
        ${p.notes ? `<div class="detail-section-title">หมายเหตุ</div><p style="color:var(--text-secondary);font-size:13px">${p.notes}</p>` : ''}
        <div class="detail-row" style="border:none;margin-top:8px"><span class="detail-label">วันที่ประเมิน</span><span class="detail-value">${new Date(p.date).toLocaleString('th-TH')}</span></div>
    `;
    document.getElementById('detailModal').classList.remove('hidden');
}

function closeModal() { document.getElementById('detailModal').classList.add('hidden'); }
document.getElementById('detailModal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });

// ===== DELETE =====
function deletePatient(hn) {
    if (!confirm('ต้องการลบข้อมูลผู้ป่วย ' + hn + ' หรือไม่?')) return;
    const patients = getPatients().filter(p => p.hn !== hn);
    savePatients(patients);
    // Auto-sync to Sheets
    if (sheetsConnector.isEnabled()) {
        sheetsConnector.deletePatient(hn);
    }
    showToast('ลบข้อมูลเรียบร้อย', 'info');
    refreshDashboard();
}

function clearAllData() {
    if (!confirm('ต้องการล้างข้อมูลทั้งหมดหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้')) return;
    localStorage.removeItem(STORAGE_KEY);
    // Auto-sync to Sheets
    if (sheetsConnector.isEnabled()) {
        sheetsConnector.clearAll();
    }
    showToast('ล้างข้อมูลทั้งหมดเรียบร้อย', 'info');
    refreshHistory();
}

// ===== INDICATORS SECTION =====
function refreshIndicatorSelect() {
    const sel = document.getElementById('indicatorPatientSelect');
    const patients = getPatients();
    sel.innerHTML = '<option value="">-- เลือกผู้ป่วยเพื่อดูตัวชี้วัด --</option>';
    patients.forEach(p => {
        sel.innerHTML += `<option value="${p.hn}">${p.hn} — ${p.name}</option>`;
    });
}

document.getElementById('indicatorPatientSelect').addEventListener('change', function () {
    const dash = document.getElementById('indicatorDashboard');
    if (!this.value) { dash.classList.add('hidden'); return; }
    dash.classList.remove('hidden');
    const p = getPatients().find(x => x.hn === this.value);
    if (!p) return;
    const v = p.vitals || {};
    const ind = p.indicators || {};

    function setInd(id, val, statusId, check) {
        document.getElementById(id).textContent = val ?? '--';
        const el = document.getElementById(statusId);
        const res = check(val);
        el.textContent = res.text;
        el.className = 'ind-status ' + res.cls;
    }

    setInd('indTemp', v.temp, 'indTempStatus', v => {
        if (v == null) return { text: '-', cls: '' };
        if (v >= 36.1 && v <= 37.2) return { text: 'ปกติ', cls: 'normal' };
        if (v > 38.5 || v < 35) return { text: 'ผิดปกติมาก', cls: 'critical' };
        return { text: 'ผิดปกติเล็กน้อย', cls: 'abnormal' };
    });
    setInd('indHR', v.hr, 'indHRStatus', v => {
        if (v == null) return { text: '-', cls: '' };
        if (v >= 60 && v <= 100) return { text: 'ปกติ', cls: 'normal' };
        if (v > 130 || v < 40) return { text: 'ผิดปกติมาก', cls: 'critical' };
        return { text: 'ผิดปกติ', cls: 'abnormal' };
    });
    setInd('indRR', v.rr, 'indRRStatus', v => {
        if (v == null) return { text: '-', cls: '' };
        if (v >= 12 && v <= 20) return { text: 'ปกติ', cls: 'normal' };
        if (v > 30 || v < 8) return { text: 'ผิดปกติมาก', cls: 'critical' };
        return { text: 'ผิดปกติ', cls: 'abnormal' };
    });

    document.getElementById('indBP').textContent = (v.bpSys || '--') + '/' + (v.bpDia || '--');
    const bpEl = document.getElementById('indBPStatus');
    if (v.bpSys && v.bpDia) {
        if (v.bpSys >= 90 && v.bpSys <= 140 && v.bpDia >= 60 && v.bpDia <= 90) {
            bpEl.textContent = 'ปกติ'; bpEl.className = 'ind-status normal';
        } else if (v.bpSys > 180 || v.bpSys < 70) {
            bpEl.textContent = 'ผิดปกติมาก'; bpEl.className = 'ind-status critical';
        } else {
            bpEl.textContent = 'ผิดปกติ'; bpEl.className = 'ind-status abnormal';
        }
    } else { bpEl.textContent = '-'; bpEl.className = 'ind-status'; }

    setInd('indO2', v.o2, 'indO2Status', v => {
        if (v == null) return { text: '-', cls: '' };
        if (v >= 95) return { text: 'ปกติ', cls: 'normal' };
        if (v < 90) return { text: 'ผิดปกติมาก', cls: 'critical' };
        return { text: 'ต่ำ', cls: 'abnormal' };
    });
    setInd('indPain', ind.pain, 'indPainStatus', v => {
        v = parseInt(v);
        if (!v) return { text: 'ไม่เจ็บ', cls: 'normal' };
        if (v <= 3) return { text: 'เจ็บเล็กน้อย', cls: 'normal' };
        if (v <= 6) return { text: 'เจ็บปานกลาง', cls: 'abnormal' };
        return { text: 'เจ็บมาก', cls: 'critical' };
    });

    // Clinical Summary
    const consMap = { alert: 'รู้สึกตัวดี', verbal: 'ตอบสนองต่อเสียง', pain: 'ตอบสนองต่อความเจ็บปวด', unresponsive: 'ไม่ตอบสนอง' };
    const mobMap = { independent: 'เคลื่อนไหวเอง', assisted: 'ต้องมีผู้ช่วย', wheelchair: 'รถเข็น', bedbound: 'ติดเตียง' };
    const fallMap = { low: 'ต่ำ', moderate: 'ปานกลาง', high: 'สูง' };
    const nutMap = { good: 'ดี', fair: 'พอใช้', poor: 'ไม่ดี' };
    const skinMap = { intact: 'ปกติ', redness: 'ผิวแดง (Stage 1)', partial: 'แผลเปิด (Stage 2-3)', severe: 'แผลลึก (Stage 4)' };

    document.getElementById('clinicalSummary').innerHTML = `
        <div class="clinical-row"><span class="clinical-label">ระดับความรู้สึกตัว</span><span class="clinical-value">${consMap[ind.consciousness] || '-'}</span></div>
        <div class="clinical-row"><span class="clinical-label">ความสามารถเคลื่อนไหว</span><span class="clinical-value">${mobMap[ind.mobility] || '-'}</span></div>
        <div class="clinical-row"><span class="clinical-label">ความเสี่ยงพลัดตก</span><span class="clinical-value">${fallMap[ind.fallRisk] || '-'}</span></div>
        <div class="clinical-row"><span class="clinical-label">สภาพโภชนาการ</span><span class="clinical-value">${nutMap[ind.nutrition] || '-'}</span></div>
        <div class="clinical-row"><span class="clinical-label">สภาพผิวหนัง</span><span class="clinical-value">${skinMap[ind.skinIntegrity] || '-'}</span></div>
    `;

    // Gauge
    const score = calcTotalScore(p);
    const st = getStatus(score);
    const maxScore = 30;
    const pct = Math.min(score / maxScore, 1);
    const arcLen = 251.2;
    document.getElementById('gaugeArc').setAttribute('stroke-dasharray', `${pct * arcLen} ${arcLen}`);
    document.getElementById('gaugeValue').textContent = score;
    document.getElementById('gaugeValue').style.color = st.cls === 'stable' ? 'var(--success)' : st.cls === 'warning' ? 'var(--warning)' : 'var(--danger)';
    document.getElementById('gaugeLabel').textContent = st.label;
});

// ===== HISTORY =====
function refreshHistory() {
    const patients = getPatients();
    const tbody = document.getElementById('historyTableBody');
    const empty = document.getElementById('historyEmpty');
    const table = document.getElementById('historyTable');
    if (!patients.length) { table.style.display = 'none'; empty.classList.remove('hidden'); return; }
    table.style.display = ''; empty.classList.add('hidden');
    tbody.innerHTML = patients.slice().reverse().map(p => {
        const v = p.vitals || {};
        const score = calcTotalScore(p);
        const st = getStatus(score);
        return `<tr>
            <td>${new Date(p.date).toLocaleString('th-TH')}</td>
            <td style="font-family:var(--font-mono);color:var(--accent-secondary)">${p.hn}</td>
            <td>${p.name}</td>
            <td style="font-family:var(--font-mono);font-size:12px">${v.temp||'-'}°C | ${v.hr||'-'}bpm | ${v.bpSys||'-'}/${v.bpDia||'-'}</td>
            <td style="font-weight:700">${score}</td>
            <td><span class="badge badge-${st.cls}"><span class="badge-dot"></span>${st.text}</span></td>
        </tr>`;
    }).join('');
}

// ===== GOOGLE SHEETS SETTINGS =====
function updateConnectionUI() {
    const dot = document.getElementById('connectionDot');
    const text = document.getElementById('connectionText');
    const badge = document.getElementById('settingsStatusBadge');
    const badgeText = document.getElementById('settingsStatusText');
    const pullBtn = document.getElementById('btnPull');
    const pushBtn = document.getElementById('btnPush');

    if (sheetsConnector.isEnabled()) {
        dot.className = 'status-dot connected';
        text.textContent = 'SHEETS CONNECTED';
        badge.className = 'badge badge-stable';
        badgeText.textContent = 'เชื่อมต่อแล้ว';
        pullBtn.disabled = false;
        pushBtn.disabled = false;
        document.getElementById('connectionInfo').innerHTML =
            '<p style="color:var(--success);font-size:13px">ระบบเชื่อมต่อกับ Google Sheets — ข้อมูลจะถูกซิงค์เมื่อบันทึก</p>';
    } else {
        dot.className = 'status-dot disconnected';
        text.textContent = 'LOCAL MODE';
        badge.className = 'badge badge-warning';
        badgeText.textContent = 'ไม่ได้เชื่อมต่อ';
        pullBtn.disabled = true;
        pushBtn.disabled = true;
        document.getElementById('connectionInfo').innerHTML =
            '<p style="color:var(--text-secondary);font-size:13px">ระบบกำลังใช้ localStorage ในการเก็บข้อมูล ข้อมูลจะอยู่ในเครื่องนี้เท่านั้น</p>';
    }
}

function loadSettingsUI() {
    const config = sheetsConnector._loadConfig();
    document.getElementById('webAppUrl').value = config.webAppUrl || '';
    document.getElementById('sheetsEnabled').checked = config.enabled || false;
    document.getElementById('toggleLabel').textContent = config.enabled ? 'เปิดใช้งาน' : 'ปิดอยู่';
    updateConnectionUI();
}

document.getElementById('sheetsEnabled').addEventListener('change', function () {
    document.getElementById('toggleLabel').textContent = this.checked ? 'เปิดใช้งาน' : 'ปิดอยู่';
});

function saveSheetsConfig() {
    const url = document.getElementById('webAppUrl').value.trim();
    const enabled = document.getElementById('sheetsEnabled').checked;

    if (enabled && !url) {
        showToast('กรุณาระบุ Web App URL ก่อนเปิดใช้งาน', 'error');
        return;
    }

    sheetsConnector.saveConfig(url, enabled);
    updateConnectionUI();
    showToast('บันทึกการตั้งค่าเรียบร้อย');
}

async function testSheetsConnection() {
    const url = document.getElementById('webAppUrl').value.trim();
    if (!url) {
        showToast('กรุณาระบุ Web App URL ก่อน', 'error');
        return;
    }

    // Temporarily set URL for testing
    sheetsConnector.config.webAppUrl = url;
    showToast('กำลังทดสอบการเชื่อมต่อ...', 'info');

    const result = await sheetsConnector.testConnection();
    if (result.ok) {
        showToast('เชื่อมต่อสำเร็จ — พบข้อมูล ' + result.rowCount + ' รายการ');
    } else {
        showToast('เชื่อมต่อไม่สำเร็จ: ' + result.message, 'error');
    }
}

async function pullFromSheets() {
    if (!sheetsConnector.isEnabled()) return;
    const dot = document.getElementById('connectionDot');
    dot.className = 'status-dot syncing';
    showToast('กำลังดึงข้อมูลจาก Sheets...', 'info');

    const result = await sheetsConnector.syncFromSheets();
    if (result.ok) {
        showToast('ดึงข้อมูลสำเร็จ — ' + result.count + ' รายการ');
        refreshDashboard();
    } else {
        showToast('เกิดข้อผิดพลาด: ' + result.message, 'error');
    }
    updateConnectionUI();
}

async function pushToSheets() {
    if (!sheetsConnector.isEnabled()) return;
    if (!confirm('ข้อมูลใน Sheets จะถูกเขียนทับด้วยข้อมูลในเครื่อง ต้องการดำเนินการต่อหรือไม่?')) return;

    const dot = document.getElementById('connectionDot');
    dot.className = 'status-dot syncing';
    showToast('กำลังส่งข้อมูลไป Sheets...', 'info');

    const result = await sheetsConnector.syncToSheets();
    if (result.ok) {
        showToast('ส่งข้อมูลสำเร็จ — ' + result.count + '/' + result.total + ' รายการ');
    } else {
        showToast('เกิดข้อผิดพลาด: ' + result.message, 'error');
    }
    updateConnectionUI();
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    loadSettingsUI();
    refreshDashboard();
});
