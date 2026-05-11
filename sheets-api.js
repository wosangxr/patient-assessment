/**
 * =============================================================
 *  SheetsConnector — Google Sheets Integration Layer
 * =============================================================
 *  Provides async CRUD operations via Google Apps Script Web App.
 *  Falls back to localStorage when not connected.
 * =============================================================
 */

const SHEETS_CONFIG_KEY = 'sheetsConfig';

class SheetsConnector {
    constructor() {
        this.config = this._loadConfig();
        this.connected = false;
        this.syncing = false;
    }

    // ----- Configuration -----

    _loadConfig() {
        try {
            return JSON.parse(localStorage.getItem(SHEETS_CONFIG_KEY)) || { webAppUrl: '', enabled: false };
        } catch { return { webAppUrl: '', enabled: false }; }
    }

    saveConfig(webAppUrl, enabled) {
        this.config = { webAppUrl: webAppUrl.trim().replace(/\/+$/, ''), enabled };
        localStorage.setItem(SHEETS_CONFIG_KEY, JSON.stringify(this.config));
    }

    isEnabled() {
        return this.config.enabled && this.config.webAppUrl.length > 0;
    }

    getWebAppUrl() {
        return this.config.webAppUrl;
    }

    // ----- Connection Test -----

    async testConnection() {
        if (!this.config.webAppUrl) return { ok: false, message: 'ยังไม่ได้ระบุ Web App URL' };
        try {
            const res = await fetch(this.config.webAppUrl, {
                method: 'GET',
                redirect: 'follow',
            });
            const json = await res.json();
            if (json.status === 'ok') {
                this.connected = true;
                return { ok: true, message: 'เชื่อมต่อสำเร็จ', rowCount: json.data?.length || 0 };
            }
            return { ok: false, message: json.message || 'ข้อมูลตอบกลับไม่ถูกต้อง' };
        } catch (err) {
            this.connected = false;
            return { ok: false, message: 'ไม่สามารถเชื่อมต่อได้: ' + err.message };
        }
    }

    // ----- CRUD Operations -----

    async fetchAll() {
        if (!this.isEnabled()) return null;
        try {
            const res = await fetch(this.config.webAppUrl, { redirect: 'follow' });
            const json = await res.json();
            if (json.status === 'ok') {
                return json.data.map(row => this._rowToPatient(row));
            }
            return null;
        } catch { return null; }
    }

    async savePatient(patient) {
        if (!this.isEnabled()) return false;
        try {
            const res = await fetch(this.config.webAppUrl, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'save', patient }),
            });
            const json = await res.json();
            return json.status === 'ok';
        } catch { return false; }
    }

    async deletePatient(hn) {
        if (!this.isEnabled()) return false;
        try {
            const res = await fetch(this.config.webAppUrl, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'delete', hn }),
            });
            const json = await res.json();
            return json.status === 'ok';
        } catch { return false; }
    }

    async clearAll() {
        if (!this.isEnabled()) return false;
        try {
            const res = await fetch(this.config.webAppUrl, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'clear' }),
            });
            const json = await res.json();
            return json.status === 'ok';
        } catch { return false; }
    }

    // ----- Sync: Pull from Sheets → localStorage -----

    async syncFromSheets() {
        if (!this.isEnabled()) return { ok: false, message: 'ยังไม่ได้เปิดใช้งาน' };
        this.syncing = true;
        try {
            const patients = await this.fetchAll();
            if (patients === null) {
                this.syncing = false;
                return { ok: false, message: 'ไม่สามารถดึงข้อมูลจาก Sheets ได้' };
            }
            savePatients(patients);
            this.syncing = false;
            return { ok: true, count: patients.length };
        } catch (err) {
            this.syncing = false;
            return { ok: false, message: err.message };
        }
    }

    // ----- Sync: Push localStorage → Sheets -----

    async syncToSheets() {
        if (!this.isEnabled()) return { ok: false, message: 'ยังไม่ได้เปิดใช้งาน' };
        this.syncing = true;
        try {
            // Clear sheets first, then push all local data
            await this.clearAll();
            const patients = getPatients();
            let success = 0;
            for (const p of patients) {
                const ok = await this.savePatient(p);
                if (ok) success++;
            }
            this.syncing = false;
            return { ok: true, count: success, total: patients.length };
        } catch (err) {
            this.syncing = false;
            return { ok: false, message: err.message };
        }
    }

    // ----- Row Mapping -----

    _rowToPatient(row) {
        return {
            hn: row['HN'] || '',
            name: row['Name'] || '',
            age: row['Age'] || '',
            gender: row['Gender'] || '',
            diagnosis: row['Diagnosis'] || '',
            ward: row['Ward'] || '',
            bed: row['Bed'] || '',
            vitals: {
                temp: parseFloat(row['Temp']) || null,
                hr: parseInt(row['HR']) || null,
                rr: parseInt(row['RR']) || null,
                bpSys: parseInt(row['BPSys']) || null,
                bpDia: parseInt(row['BPDia']) || null,
                o2: parseInt(row['O2']) || null,
            },
            indicators: {
                pain: row['Pain'] || '0',
                consciousness: row['Consciousness'] || 'alert',
                mobility: row['Mobility'] || 'independent',
                fallRisk: row['FallRisk'] || 'low',
                nutrition: row['Nutrition'] || 'good',
                skinIntegrity: row['SkinIntegrity'] || 'intact',
            },
            notes: row['Notes'] || '',
            date: row['Date'] || new Date().toISOString(),
        };
    }
}

// Global instance
const sheetsConnector = new SheetsConnector();
