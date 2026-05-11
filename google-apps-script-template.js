/**
 * =============================================================
 *  Google Apps Script — Patient Assessment Web App (Template)
 * =============================================================
 *
 *  วิธีใช้:
 *  1. เปิด Google Sheets ใหม่
 *  2. ตั้งชื่อ Sheet แรกเป็น "patients"
 *  3. ใส่หัวตาราง Row 1 ดังนี้:
 *     HN | Name | Age | Gender | Diagnosis | Ward | Bed |
 *     Temp | HR | RR | BPSys | BPDia | O2 |
 *     Pain | Consciousness | Mobility | FallRisk | Nutrition | SkinIntegrity |
 *     Notes | Date
 *
 *  4. ไปที่ Extensions > Apps Script
 *  5. คัดลอกโค้ดนี้ไปวาง แทนที่โค้ดเดิม
 *  6. กด Deploy > New deployment
 *     - Type: Web app
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  7. คัดลอก Web App URL ไปวางในหน้าตั้งค่าของระบบ
 *
 *  หมายเหตุ: ไฟล์นี้เป็น TEMPLATE เท่านั้น
 *  ไม่ได้รันในโปรเจกต์นี้ ให้ copy ไปวางใน Apps Script Editor
 * =============================================================
 */

const SHEET_NAME = 'patients';

// ========== GET: อ่านข้อมูลทั้งหมด ==========
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', data: rows }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ========== POST: เพิ่ม/อัปเดต/ลบ ข้อมูล ==========
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action; // 'save', 'delete', 'clear'
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

    if (action === 'save') {
      const p = body.patient;
      const row = [
        p.hn, p.name, p.age, p.gender, p.diagnosis, p.ward, p.bed,
        p.vitals?.temp || '', p.vitals?.hr || '', p.vitals?.rr || '',
        p.vitals?.bpSys || '', p.vitals?.bpDia || '', p.vitals?.o2 || '',
        p.indicators?.pain || 0, p.indicators?.consciousness || '',
        p.indicators?.mobility || '', p.indicators?.fallRisk || '',
        p.indicators?.nutrition || '', p.indicators?.skinIntegrity || '',
        p.notes || '', p.date || new Date().toISOString()
      ];

      // หา row เดิมโดย HN
      const data = sheet.getDataRange().getValues();
      let found = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === p.hn) { found = i + 1; break; }
      }

      if (found > 0) {
        // อัปเดต row เดิม
        sheet.getRange(found, 1, 1, row.length).setValues([row]);
      } else {
        // เพิ่ม row ใหม่
        sheet.appendRow(row);
      }

      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', action: 'saved' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'delete') {
      const hn = body.hn;
      const data = sheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if (data[i][0] === hn) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', action: 'deleted' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'clear') {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', action: 'cleared' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
