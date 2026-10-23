/* ICU Handover - shared ward data in Supabase (REST, no library).
   The app keeps working on the local copy (localStorage); this module
   - signs in with the ward password (one shared account, session is remembered),
   - sends changed records (optimistic locking with `version`, section-level merge on conflicts),
   - pulls changes from the other phones every few seconds,
   - keeps everything queued while offline. */
(function () {
  'use strict';
  const C = ICU.CLOUD || {};
  const S = ICU.store, U = ICU.util;
  const AUTH_KEY = 'icuhandover.auth';
  const TABLE = { p: 'patients', h: 'handovers' };

  let busy = false, again = false, timer = null, state = 'idle', lastOk = null, lastErr = '';

  /* ------------------------------------------------------------------ auth */
  const session = () => { try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch (e) { return null; } };
  const keep = s => localStorage.setItem(AUTH_KEY, JSON.stringify({
    access_token: s.access_token, refresh_token: s.refresh_token,
    expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600)
  }));

  async function authCall(grant, body) {
    const r = await fetch(C.url + '/auth/v1/token?grant_type=' + grant, {
      method: 'POST', headers: { apikey: C.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error_description || j.msg || j.message || ('HTTP ' + r.status)); e.status = r.status; e.code = j.error_code || j.error; throw e; }
    return j;
  }
  async function token() {
    const s = session();
    if (!s) throw Object.assign(new Error('signed out'), { status: 401 });
    if (s.expires_at - 90 > Date.now() / 1000) return s.access_token;
    try { const n = await authCall('refresh_token', { refresh_token: s.refresh_token }); keep(n); return n.access_token; }
    catch (e) { if (e.status === 400 || e.status === 401 || e.status === 403) { localStorage.removeItem(AUTH_KEY); render(); } throw e; }
  }

  /* ------------------------------------------------------------------ REST */
  async function api(method, path, body, prefer) {
    const h = { apikey: C.key, Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' };
    if (prefer) h.Prefer = prefer;
    const r = await fetch(C.url + '/rest/v1/' + path, { method, headers: h, body: body == null ? undefined : JSON.stringify(body) });
    const txt = await r.text();
    let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = txt; }
    if (r.status === 401) { localStorage.removeItem(AUTH_KEY); render(); }
    if (!r.ok) { const e = new Error((j && (j.message || j.msg)) || ('HTTP ' + r.status)); e.status = r.status; e.code = j && j.code; throw e; }
    return j;
  }
  const enc = encodeURIComponent;

  /* take the other phone's version and re-apply the sections this phone changed */
  function merge(baseJson, local, remote) {
    const base = baseJson ? JSON.parse(baseJson) : {};
    const out = Object.assign({}, remote);
    Object.keys(local).forEach(k => { if (JSON.stringify(local[k]) !== JSON.stringify(base[k])) out[k] = local[k]; });
    return out;
  }

  /* ------------------------------------------------------------------ push */
  async function pushRecord(kind, id) {
    const sy = S.syncState(), k = kind + ':' + id;
    const rec = S.record(kind, id);
    if (!rec) { delete sy.dirty[k]; return; }
    const json = JSON.stringify(rec);
    const row = { id, data: rec };
    if (kind === 'h') row.patient_id = rec.patientId;
    const ver = sy.ver[k];
    if (ver == null) {
      try {
        const r = await api('POST', TABLE[kind], row, 'return=representation');
        S.sent(kind, id, r[0].version, json);
        return;
      } catch (e) { if (e.status !== 409) throw e; }
    } else {
      try {
        const r = await api('PATCH', TABLE[kind] + '?id=eq.' + enc(id) + '&version=eq.' + ver, { data: rec }, 'return=representation');
        if (r && r.length) { S.sent(kind, id, r[0].version, json); return; }
      } catch (e) { if (e.code !== 'P0001') throw e; }
    }
    /* conflict: somebody else changed it (or it is locked) */
    const cur = (await api('GET', TABLE[kind] + '?id=eq.' + enc(id) + '&select=id,data,version'))[0];
    if (!cur) { sy.ver[k] = null; return pushRecord(kind, id); }
    if (kind === 'h' && cur.data.status === 'handed_over') {
      S.applyRemote(kind, cur, true);
      ICU.toast('บันทึกนี้ถูกส่งเวรจากเครื่องอื่นแล้ว - การแก้ไขล่าสุดของเครื่องนี้ไม่ถูกบันทึก', 'error');
      changedRemote = true;
      return;
    }
    const merged = merge(sy.base[k], rec, cur.data);
    const r2 = await api('PATCH', TABLE[kind] + '?id=eq.' + enc(id) + '&version=eq.' + cur.version, { data: merged }, 'return=representation');
    if (!r2 || !r2.length) { again = true; return; }
    S.applyRemote(kind, r2[0], true);
    ICU.toast('มีคนแก้ ' + (kind === 'h' ? 'บันทึกส่งเวร' : 'ข้อมูลผู้ป่วย') + ' นี้พร้อมกัน - รวมการแก้ไขแล้ว (' + (cur.data.updatedBy || 'อีกเครื่อง') + ')');
    changedRemote = true;
  }

  async function push() {
    const sy = S.syncState();
    const keys = Object.keys(sy.dirty).sort();          /* "h:..." < "p:..." -> send patients first */
    for (const k of keys.filter(x => x[0] === 'p').concat(keys.filter(x => x[0] === 'h'))) {
      await pushRecord(k[0], k.slice(2));
    }
    while (sy.dels.length) {
      await api('DELETE', 'handovers?id=eq.' + enc(sy.dels[0]));
      sy.dels.shift();
    }
    if (sy.auditOut.length) {
      const ids = sy.auditOut.slice(0, 200), set = new Set(ids);
      const rows = S.raw().audit.filter(a => set.has(a.id)).map(a => ({
        id: a.id, entity: a.entity, entity_id: a.entityId, action: a.action, by_name: a.by, at: a.at, changes: a.changes || [], note: a.note || ''
      }));
      if (rows.length) await api('POST', 'audit?on_conflict=id', rows, 'resolution=ignore-duplicates,return=minimal');
      sy.auditOut = sy.auditOut.filter(id => !set.has(id));
    }
  }

  /* ------------------------------------------------------------------ pull */
  let changedRemote = false, fullDone = false;
  async function pull() {
    const sy = S.syncState();
    const since = sy.lastPull || '1970-01-01T00:00:00Z';
    let maxAt = sy.lastPull;
    for (const kind of ['p', 'h']) {
      const rows = await api('GET', TABLE[kind] + '?select=id,data,version,updated_at&updated_at=gte.' + enc(since) + '&order=updated_at.asc&limit=2000');
      rows.forEach(r => { if (S.applyRemote(kind, r)) changedRemote = true; if (!maxAt || r.updated_at > maxAt) maxAt = r.updated_at; });
    }
    if (!fullDone) {
      /* drafts deleted on other phones */
      const ids = (await api('GET', 'handovers?select=id')).map(r => r.id);
      if (S.dropRemoved('h', ids)) changedRemote = true;
      fullDone = true;
    }
    sy.lastPull = maxAt || '';
    /* audit times come from each phone's clock (and offline phones send late) -> look back 6 h, duplicates are skipped */
    const aSince = new Date(sy.lastAuditPull ? Date.parse(sy.lastAuditPull) - 6 * 3600000 : Date.now() - 30 * 86400000).toISOString();
    const audits = await api('GET', 'audit?select=*&at=gte.' + enc(aSince) + '&order=at.asc&limit=1000');
    if (S.mergeAudit(audits)) changedRemote = true;
    if (audits.length && (!sy.lastAuditPull || audits[audits.length - 1].at > sy.lastAuditPull)) sy.lastAuditPull = audits[audits.length - 1].at;
  }

  /* ------------------------------------------------------------------ loop */
  async function run() {
    if (!enabled() || !session()) return;
    if (busy) { again = true; return; }
    busy = true; again = false; changedRemote = false;
    setState('sync');
    try {
      await push();
      await pull();
      S.save();
      lastOk = new Date(); lastErr = '';
      setState(S.pendingCount() ? 'pending' : 'ok');
    } catch (e) {
      S.save();
      lastErr = e.message || String(e);
      setState(navigator.onLine === false || e instanceof TypeError ? 'offline' : 'error');
    } finally {
      busy = false;
      if (changedRemote) softRender();
      if (again) schedule(300);
    }
  }
  function schedule(ms) {
    if (!enabled()) return;
    clearTimeout(timer);
    timer = setTimeout(run, ms == null ? 1200 : ms);
  }

  /* re-draw the page with the new data, but never while somebody is typing */
  let deferred = false;
  function softRender() {
    const a = document.activeElement;
    const typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest('#view');
    if (typing || document.getElementById('dialog').open || document.body.classList.contains('locked')) { deferred = true; return; }
    deferred = false;
    ICU._soft = true; ICU.render(); ICU._soft = false;
  }
  document.addEventListener('focusout', () => { if (deferred) setTimeout(() => { if (deferred) softRender(); }, 400); });

  /* ------------------------------------------------------------- status */
  function setState(s) { state = s; paintChip(); }
  function paintChip() {
    const el = document.getElementById('sync-chip');
    if (!el) return;
    if (!enabled()) { el.hidden = true; return; }
    const n = S.pendingCount();
    const txt = { idle: 'ซิงก์', sync: 'กำลังซิงก์…', ok: 'ซิงก์แล้ว ' + (lastOk ? U.timeStr(lastOk) : ''), pending: 'รอส่ง ' + n,
      offline: 'ออฟไลน์' + (n ? ' · รอส่ง ' + n : ''), error: 'ซิงก์ไม่สำเร็จ' + (n ? ' · รอส่ง ' + n : '') }[state];
    el.hidden = false;
    el.className = 'sync-chip s-' + state;
    el.textContent = txt;
    el.title = lastErr || 'ข้อมูลกลางของวอร์ด (Supabase)';
  }

  function render() { if (ICU.render) ICU.render(); }
  const enabled = () => !!(C.url && C.key && C.email);

  /* ------------------------------------------------------------- login */
  function loginScreen(onOk) {
    document.body.classList.add('locked');
    const st = S.settings();
    const named = st.userName && st.userName !== ICU.DEFAULT_SETTINGS.userName ? st.userName : (localStorage.getItem('icuhandover.named') ? st.userName : '');
    const v = document.getElementById('view');
    v.innerHTML = '<div class="lock-wrap"><form class="lock-card" id="login-form" autocomplete="on">' +
      '<span class="brand-logo big" aria-hidden="true"></span><h1>ICU Handover</h1><p class="muted">ข้อมูลกลางของวอร์ด · เข้าสู่ระบบครั้งเดียว</p>' +
      '<label class="fld">ชื่อของคุณ (แสดงในประวัติการแก้ไข)<input name="name" required autocomplete="nickname" value="' + U.esc(named) + '" placeholder="เช่น พว.นานิต้า"></label>' +
      '<label class="fld">รหัสวอร์ด<span class="pass-row"><input name="pass" type="password" required autocomplete="current-password" autocorrect="off" autocapitalize="off" spellcheck="false">' +
      '<button type="button" class="eye" id="login-eye">แสดง</button></span></label>' +
      '<input type="email" name="username" autocomplete="username" value="' + U.esc(C.email) + '" hidden>' +
      '<p class="lock-err" id="login-err" role="alert"></p>' +
      '<button class="btn primary" type="submit">เข้าสู่ระบบ</button>' +
      '<p class="hint">ใส่รหัสครั้งเดียว เครื่องนี้จะจำไว้ · ข้อมูลผู้ป่วยใช้ชื่อย่อ + เตียง</p></form></div>';
    const f = v.querySelector('#login-form'), err = v.querySelector('#login-err');
    (f.name.value ? f.pass : f.name).focus();
    v.querySelector('#login-eye').onclick = e => {
      const show = f.pass.type === 'password';
      f.pass.type = show ? 'text' : 'password'; e.target.textContent = show ? 'ซ่อน' : 'แสดง';
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ…'; err.textContent = '';
      try {
        keep(await authCall('password', { email: C.email, password: f.pass.value.trim() }));
        S.saveSettings({ userName: f.name.value.trim() });
        localStorage.setItem('icuhandover.named', '1');
        document.body.classList.remove('locked');
        btn.textContent = 'กำลังโหลดข้อมูลวอร์ด…';
        fullDone = false;
        await run();
        onOk();
      } catch (ex) {
        btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
        err.textContent = ex.status === 400 ? 'รหัสวอร์ดไม่ถูกต้อง (กด "แสดง" เพื่อดูสิ่งที่พิมพ์)'
          : ex.status === 429 ? 'ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่'
          : ex instanceof TypeError ? 'เชื่อมต่อไม่ได้ - ตรวจสอบอินเทอร์เน็ต' : 'เข้าสู่ระบบไม่สำเร็จ: ' + ex.message;
      }
    };
  }

  ICU.cloud = {
    enabled, schedule, run, loginScreen, paintChip,
    signedIn: () => !!session(),
    status: () => ({ state, lastOk, lastErr, pending: S.pendingCount() }),
    signOut() { localStorage.removeItem(AUTH_KEY); render(); },
    /* clear this phone's copy and download everything again */
    async reload() { S.resetLocal(); fullDone = false; await run(); render(); }
  };

  if (enabled()) {
    setInterval(() => { if (document.visibilityState === 'visible') run(); }, (C.pollSeconds || 15) * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') run(); });
    window.addEventListener('online', () => run());
    window.addEventListener('offline', () => setState('offline'));
    if (session()) setTimeout(run, 50);
  }
})();
