/* ICU Handover - data layer.
   Prototype: everything is kept in localStorage of this device only.
   Phase 5: replace the functions of ICU.store with API calls (same names / same objects). */
(function () {
  'use strict';
  const KEY = 'icuhandover.v1';

  /* ------------------------------------------------------------------ utils */
  const U = ICU.util = {
    uid(prefix) { return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
    now() { return new Date().toISOString(); },
    pad(n) { return String(n).padStart(2, '0'); },
    dateStr(d) { d = d || new Date(); return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()); },
    timeStr(d) { d = d || new Date(); return U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()); },
    addDays(ds, n) { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return U.dateStr(d); },
    /* morning 08:00-19:59 = today; night 20:00-07:59 = the date the night STARTED (00:00-07:59 -> yesterday) */
    currentShift(d) { const h = (d || new Date()).getHours(); return h >= 8 && h < 20 ? 'morning' : 'night'; },
    currentDate(d) { d = d || new Date(); return d.getHours() < 8 ? U.addDays(U.dateStr(d), -1) : U.dateStr(d); },
    shift(id) { return ICU.SHIFTS.concat(ICU.LEGACY_SHIFTS || []).find(s => s.id === id) || { id, label: id, time: '', no: 0 }; },
    slot(date, shift) { return date + '-' + U.shift(shift).no; },
    prevSlot(date, shift) { return shift === 'night' ? { date, shift: 'morning' } : { date: U.addDays(date, -1), shift: 'night' }; },
    thaiDate(ds, long) {
      if (!ds) return '';
      const m = long
        ? ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
        : ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const d = new Date(String(ds).slice(0, 10) + 'T12:00:00');
      if (isNaN(d)) return '';
      return d.getDate() + ' ' + m[d.getMonth()] + ' ' + (d.getFullYear() + 543);
    },
    thaiDateTime(iso) { if (!iso) return ''; const d = new Date(iso); return U.thaiDate(U.dateStr(d)) + ' ' + U.timeStr(d) + ' น.'; },
    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    clone(o) { return JSON.parse(JSON.stringify(o)); },
    sexLabel(s) { return s === 'M' ? 'ชาย' : s === 'F' ? 'หญิง' : '-'; }
  };

  /* ------------------------------------------------------------ empty shapes */
  function emptyHandover() {
    const fancas = {}, fh = {}, dopeItems = {};
    ICU.FANCAS.forEach(g => { fancas[g.id] = { state: 'not_assessed', items: {}, values: {}, detail: '' }; });
    ICU.FASTHUGBID.forEach(f => { fh[f.id] = { state: 'not_assessed', finding: null, note: '' }; });
    ICU.DOPE.forEach(d => { dopeItems[d.id] = { result: 'not_assessed', finding: '', action: '' }; });
    return {
      fancas, fasthugbid: fh,
      dope: { onVentilator: null, items: dopeItems, summary: '' },
      care: { reason: '', monitoring: {}, monitoringValues: {}, monitoringNote: '', plan: {}, planValues: {}, pendingTasks: '', nextShiftNote: '' },
      headNurse: { name: '', position: '', date: '', time: '' }
    };
  }
  ICU.emptyHandover = emptyHandover;

  /* ------------------------------------------------------------ persistence */
  let db = null;
  function fresh() {
    return { version: 1, patients: [], handovers: [], audit: [], settings: Object.assign({}, ICU.DEFAULT_SETTINGS), demoSeeded: false,
      sync: { dirty: {}, ver: {}, base: {}, auditOut: [], dels: [], lastPull: '', lastAuditPull: '' } };
  }
  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { db = null; }
    if (!db || !Array.isArray(db.patients)) db = fresh();
    db.settings = Object.assign({}, ICU.DEFAULT_SETTINGS, db.settings || {});
    /* cloud sync bookkeeping: dirty records, server versions, last synced copies, unsent audit, deletes */
    db.sync = Object.assign(fresh().sync, db.sync || {});
    return db;
  }
  const keyOf = (kind, id) => kind + ':' + id;
  function markDirty(kind, id) { db.sync.dirty[keyOf(kind, id)] = true; if (ICU.cloud) ICU.cloud.schedule(); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) { if (ICU.toast) ICU.toast('บันทึกไม่สำเร็จ: พื้นที่เก็บข้อมูลในเครื่องเต็ม (ลองลบประวัติเก่าหรือ Export)', 'error'); return false; }
  }
  const me = () => db.settings.userName || 'ไม่ระบุชื่อ';

  /* ------------------------------------------------------------------ audit */
  const HO_SECTIONS = { date: 'วันที่', shift: 'เวร', time: 'เวลา', giver: 'ผู้ส่งเวร', receiver: 'ผู้รับเวร', fancas: 'FANCAS',
    fasthugbid: 'FASTHUGBID', dope: 'DOPE', care: 'แผนการดูแล', headNurse: 'หัวหน้าเวร' };
  const PT_FIELDS = { hn: 'HN', an: 'AN', name: 'ชื่อ', sex: 'เพศ', age: 'อายุ', weight: 'น้ำหนัก', bed: 'เตียง', admitDate: 'วันที่รับเข้า',
    admitTime: 'เวลารับเข้า', diagnosis: 'อาการสำคัญ / การวินิจฉัย', allergies: 'ประวัติแพ้ยา', underlying: 'โรคประจำตัว', note: 'หมายเหตุ', status: 'สถานะ' };

  function changed(before, after, keys) {
    return Object.keys(keys).filter(k => JSON.stringify(before ? before[k] : undefined) !== JSON.stringify(after[k])).map(k => keys[k]);
  }
  function audit(entity, entityId, action, changes, note) {
    const last = db.audit[db.audit.length - 1];
    const t = U.now();
    /* consecutive edits of the same record are merged - only while that entry is not sent to the cloud yet */
    if (action === 'update' && last && last.action === 'update' && last.entityId === entityId && last.by === me()
        && Date.parse(t) - Date.parse(last.at) < 5 * 60 * 1000 && (!ICU.cloud || !ICU.cloud.enabled() || db.sync.auditOut.includes(last.id))) {
      last.changes = Array.from(new Set(last.changes.concat(changes || [])));
      last.at = t;
    } else {
      const a = { id: U.uid('a'), entity, entityId, action, by: me(), at: t, changes: changes || [], note: note || '' };
      db.audit.push(a);
      db.sync.auditOut.push(a.id);
    }
    if (db.audit.length > 3000) db.audit.splice(0, db.audit.length - 3000);
  }

  /* ---------------------------------------------------------------- store */
  const S = ICU.store = {
    load, save,
    raw: () => db,
    settings: () => db.settings,
    saveSettings(s) { Object.assign(db.settings, s); save(); },

    /* patients */
    patients(opts) { return db.patients.filter(p => (opts && opts.includeArchived) || !p.archivedAt); },
    patient: id => db.patients.find(p => p.id === id) || null,
    savePatient(data) {
      const hn = String(data.hn || '').trim();
      const dup = hn && db.patients.find(p => !p.archivedAt && p.hn === hn && p.id !== data.id);
      if (dup) return { error: 'HN ' + hn + ' มีอยู่แล้ว (' + dup.name + ')' };
      const t = U.now();
      let p = data.id && S.patient(data.id);
      if (p) {
        const ch = changed(p, data, PT_FIELDS);
        Object.assign(p, data, { updatedAt: t, updatedBy: me() });
        if (ch.length) audit('patient', p.id, 'update', ch);
      } else {
        p = Object.assign({ status: 'active', isDemo: false }, data, { id: U.uid('p'), hn, createdAt: t, createdBy: me(), updatedAt: t, updatedBy: me() });
        db.patients.push(p);
        audit('patient', p.id, 'create', []);
      }
      markDirty('p', p.id);
      save();
      return { patient: p };
    },
    archivePatient(id) {
      const p = S.patient(id);
      if (!p) return;
      p.archivedAt = U.now(); p.archivedBy = me();
      audit('patient', id, 'archive', []);
      markDirty('p', id);
      save();
    },

    /* handovers */
    /* records in the trash (deletedAt) or being deleted for good (purgedAt) are hidden everywhere except the trash */
    handovers: () => db.handovers.filter(h => !h.deletedAt && !h.purgedAt),
    handover: id => db.handovers.find(h => h.id === id && !h.purgedAt) || null,
    trash: () => db.handovers.filter(h => h.deletedAt && !h.purgedAt).sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt))),
    handoversOf(pid) {
      return S.handovers().filter(h => h.patientId === pid)
        .sort((a, b) => U.slot(b.date, b.shift).localeCompare(U.slot(a.date, a.shift)) || b.createdAt.localeCompare(a.createdAt));
    },
    /* newest record of a patient for a date + shift (an amendment wins over the record it amends) */
    handoverFor(pid, date, shift) { return S.handoversOf(pid).find(h => h.date === date && h.shift === shift) || null; },
    latestHandover(pid, beforeSlot) {
      return S.handoversOf(pid).find(h => !beforeSlot || U.slot(h.date, h.shift) < beforeSlot) || null;
    },
    supersededIds() { return new Set(S.handovers().filter(h => h.amendsId).map(h => h.amendsId)); },

    newHandover(pid, opt) {
      opt = opt || {};
      const date = opt.date || U.currentDate(), shift = opt.shift || U.currentShift();
      const src = opt.fromId ? S.handover(opt.fromId) : S.latestHandover(pid, U.slot(date, shift));
      const t = U.now();
      const h = Object.assign(emptyHandover(), {
        id: U.uid('h'), patientId: pid, date, shift, time: U.timeStr(), giver: me(), receiver: '',
        status: 'draft', isDemo: !!(S.patient(pid) || {}).isDemo, createdAt: t, createdBy: me(), updatedAt: t, updatedBy: me()
      });
      if (src) {
        /* continue from the previous shift: problems / plans are copied, the per-shift checks must be done again */
        h.copiedFrom = src.id;
        h.fancas = U.clone(src.fancas);
        h.care = U.clone(src.care);
        h.dope.onVentilator = src.dope.onVentilator;
        ICU.FASTHUGBID.forEach(f => { h.fasthugbid[f.id].note = (src.fasthugbid[f.id] || {}).note || ''; });
      }
      db.handovers.push(h);
      audit('handover', h.id, 'create', [], src ? 'คัดลอกจากเวร' + U.shift(src.shift).label + ' ' + U.thaiDate(src.date) : '');
      markDirty('h', h.id);
      save();
      return h;
    },
    /* mutate(h) changes the record; returns false when locked */
    updateHandover(id, mutate) {
      const h = S.handover(id);
      if (!h || h.status === 'handed_over' || h.deletedAt) return false;
      const before = U.clone(h);
      mutate(h);
      const ch = changed(before, h, HO_SECTIONS);
      if (!ch.length) return true;
      let reopened = false;
      if (h.status === 'draft') h.status = 'in_progress';
      if (h.status === 'ready_for_review') { h.status = 'in_progress'; reopened = true; }
      h.updatedAt = U.now(); h.updatedBy = me();
      audit('handover', id, 'update', ch, reopened ? 'แก้ไขหลังส่งตรวจ -> กลับเป็น In Progress' : '');
      markDirty('h', id);
      save();
      return reopened ? 'reopened' : true;
    },
    setStatus(id, status, extra) {
      const h = S.handover(id);
      if (!h) return;
      const t = U.now();
      h.status = status;
      if (status === 'ready_for_review') { h.reviewRequestedAt = t; h.reviewRequestedBy = me(); }
      if (status === 'handed_over') { h.submittedAt = t; h.submittedBy = me(); }
      Object.assign(h, extra || {});
      h.updatedAt = t; h.updatedBy = me();
      audit('handover', id, status === 'handed_over' ? 'submit' : 'status', [ICU.HANDOVER_STATUS[status].label]);
      markDirty('h', id);
      save();
    },
    amend(id, reason) {
      const src = S.handover(id);
      if (!src) return null;
      const t = U.now();
      const h = Object.assign(U.clone(src), {
        id: U.uid('h'), status: 'in_progress', amendsId: src.id, amendReason: reason, copiedFrom: null,
        createdAt: t, createdBy: me(), updatedAt: t, updatedBy: me(), submittedAt: null, submittedBy: null, reviewRequestedAt: null, reviewRequestedBy: null
      });
      db.handovers.push(h);
      audit('handover', src.id, 'amend', [], 'สร้างบันทึกแก้ไข: ' + reason);
      audit('handover', h.id, 'create', [], 'บันทึกแก้ไขของ #' + src.id.slice(-5) + ': ' + reason);
      markDirty('h', h.id);
      save();
      return h;
    },
    deleteDraft(id) {
      const h = S.handover(id);
      if (!h || h.status !== 'draft') return false;
      db.handovers = db.handovers.filter(x => x.id !== id);
      audit('handover', id, 'discard', [], 'ลบฉบับร่างที่ยังไม่ได้กรอก');
      const k = keyOf('h', id);
      if (db.sync.ver[k] != null) db.sync.dels.push(id);
      delete db.sync.dirty[k]; delete db.sync.ver[k]; delete db.sync.base[k];
      if (ICU.cloud) ICU.cloud.schedule();
      save();
      return true;
    },

    /* ------------------------------------------- delete: trash first, then for good */
    trashHandover(id, reason) {
      const h = S.handover(id);
      if (!h || h.deletedAt) return false;
      const t = U.now();
      Object.assign(h, { deletedAt: t, deletedBy: me(), deleteReason: String(reason || '').trim() });
      audit('handover', id, 'trash', [], 'ย้ายไปถังขยะ' + (h.deleteReason ? ': ' + h.deleteReason : ''));
      markDirty('h', id);
      save();
      return true;
    },
    restoreHandover(id) {
      const h = S.handover(id);
      if (!h || !h.deletedAt) return false;
      delete h.deletedAt; delete h.deletedBy; delete h.deleteReason;
      audit('handover', id, 'restore', [], 'กู้คืนจากถังขยะ');
      markDirty('h', id);
      save();
      return true;
    },
    /* only from the trash; with the cloud the record is removed after the server has it in the trash too */
    purgeHandover(id) {
      const h = S.handover(id);
      if (!h || !h.deletedAt) return false;
      const k = keyOf('h', id);
      const p = S.patient(h.patientId);
      audit('handover', id, 'purge', [], 'ลบถาวร: ' + (p ? p.name + ' ' : '') + 'เวร' + U.shift(h.shift).label + ' ' + U.thaiDate(h.date));
      if (ICU.cloud && ICU.cloud.enabled() && db.sync.ver[k] != null) { h.purgedAt = U.now(); markDirty('h', id); }
      else S.removeLocal('h', id);
      save();
      return true;
    },
    removeLocal(kind, id) {
      const k = keyOf(kind, id);
      if (kind === 'h') db.handovers = db.handovers.filter(x => x.id !== id);
      else db.patients = db.patients.filter(x => x.id !== id);
      delete db.sync.dirty[k]; delete db.sync.ver[k]; delete db.sync.base[k];
    },

    /* ---------------------------------------------------- cloud sync helpers */
    syncState: () => db.sync,
    pendingCount: () => Object.keys(db.sync.dirty).length + db.sync.auditOut.length + db.sync.dels.length,
    record(kind, id) { return (kind === 'p' ? db.patients : db.handovers).find(x => x.id === id) || null; },
    /* a row from the server: replaces the local copy unless this device has unsent changes; returns true when applied */
    applyRemote(kind, row, force) {
      const k = keyOf(kind, row.id);
      if (!force && db.sync.dirty[k]) return false;
      if (!force && db.sync.ver[k] != null && row.version <= db.sync.ver[k]) return false;
      const list = kind === 'p' ? db.patients : db.handovers;
      const data = Object.assign({}, row.data, { id: row.id });
      const i = list.findIndex(x => x.id === row.id);
      if (i >= 0) list[i] = data; else list.push(data);
      db.sync.ver[k] = row.version;
      db.sync.base[k] = JSON.stringify(row.data);
      if (force) delete db.sync.dirty[k];
      return true;
    },
    /* the server no longer has this draft (deleted on another phone) */
    dropRemoved(kind, ids) {
      let n = 0;
      const keep = new Set(ids);
      const list = kind === 'p' ? db.patients : db.handovers;
      for (let i = list.length - 1; i >= 0; i--) {
        const k = keyOf(kind, list[i].id);
        if (db.sync.ver[k] != null && !db.sync.dirty[k] && !keep.has(list[i].id)) {
          list.splice(i, 1); delete db.sync.ver[k]; delete db.sync.base[k]; n++;
        }
      }
      return n;
    },
    sent(kind, id, version, json) {
      const k = keyOf(kind, id);
      db.sync.ver[k] = version;
      db.sync.base[k] = json;
      const r = S.record(kind, id);
      if (r && JSON.stringify(r) === json) delete db.sync.dirty[k];
    },
    mergeAudit(rows) {
      const have = new Set(db.audit.map(a => a.id));
      let n = 0;
      rows.forEach(r => {
        if (have.has(r.id)) return;
        db.audit.push({ id: r.id, entity: r.entity, entityId: r.entity_id, action: r.action, by: r.by_name, at: r.at, changes: r.changes || [], note: r.note || '' });
        n++;
      });
      if (n) db.audit.sort((a, b) => String(a.at).localeCompare(String(b.at)));
      if (db.audit.length > 3000) db.audit.splice(0, db.audit.length - 3000);
      return n;
    },
    /* forget everything local (data comes back from the cloud) - settings are kept */
    resetLocal() { const s = db.settings; db = fresh(); db.settings = s; db.demoSeeded = true; save(); },

    auditOf: id => db.audit.filter(a => a.entityId === id).reverse(),
    auditAll: () => db.audit.slice().reverse(),

    /* backup */
    exportJSON() { return JSON.stringify(Object.assign({ app: 'icu-handover', exportedAt: U.now() }, db), null, 1); },
    importJSON(text) {
      const d = JSON.parse(text);
      if (!d || d.app !== 'icu-handover' || !Array.isArray(d.patients) || !Array.isArray(d.handovers)) throw new Error('ไม่ใช่ไฟล์สำรองของ ICU Handover');
      delete d.app; delete d.exportedAt;
      db = Object.assign(fresh(), d);
      db.audit.push({ id: U.uid('a'), entity: 'system', entityId: '-', action: 'import', by: me(), at: U.now(), changes: [], note: 'นำเข้าข้อมูลจากไฟล์' });
      save();
    },
    resetDemo() {
      const keep = new Set(db.patients.filter(p => !p.isDemo).map(p => p.id));
      db.patients = db.patients.filter(p => keep.has(p.id));
      db.handovers = db.handovers.filter(h => keep.has(h.patientId));
      ICU.seedDemo(db);
      db.demoSeeded = true;
      audit('system', '-', 'demo', [], 'รีเซ็ตข้อมูลสมมติ');
      save();
    },
    clearAll() { const s = db.settings; db = fresh(); db.settings = s; db.demoSeeded = true; save(); }
  };

  load();
})();
