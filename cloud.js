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

  let busy = false, again = false, timer = null, state = 'idle', lastOk = null, lastErr = '', lastRun = 0;

  /* ----------------------------------------------- live updates (Supabase Realtime, Phoenix protocol)
     Only used as a "something changed" signal -> the normal REST pull fetches the rows (RLS applies). */
  const TOPIC = 'realtime:icu-ward';
  const live = {
    ws: null, ok: false, hb: null, retry: 0, ref: 0,
    send(m) { try { this.ws.send(JSON.stringify(Object.assign({ ref: String(++this.ref) }, m))); } catch (e) { /* closed */ } }
  };
  async function connectLive() {
    if (!C.realtime || !enabled() || !session() || typeof WebSocket === 'undefined') return;
    if (live.ws && live.ws.readyState <= 1) return;
    let tok;
    try { tok = await token(); } catch (e) { return; }
    const ws = new WebSocket(C.url.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(C.key) + '&vsn=1.0.0');
    live.ws = ws;
    ws.onopen = () => {
      live.send({ topic: TOPIC, event: 'phx_join', join_ref: '1', payload: {
        config: { broadcast: { self: false }, presence: { key: '' }, postgres_changes: [
          { event: '*', schema: 'public', table: 'patients' }, { event: '*', schema: 'public', table: 'handovers' }] },
        access_token: tok } });
      clearInterval(live.hb);
      live.hb = setInterval(() => live.send({ topic: 'phoenix', event: 'heartbeat', payload: {} }), 25000);
    };
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.topic !== TOPIC) return;
      if (m.event === 'phx_reply' && m.payload) {
        if (m.payload.status === 'ok' && m.ref === '1') { live.ok = true; live.retry = 0; paintChip(); }
        if (m.payload.status === 'error') { live.ok = false; lastErr = 'realtime: ' + JSON.stringify(m.payload.response || {}); paintChip(); }
      }
      if (m.event === 'postgres_changes') {
        const t = m.payload && m.payload.data && m.payload.data.type;
        if (t === 'DELETE') fullDone = false;          /* look at the id list on the next pull */
        schedule(300);
      }
      if (m.event === 'phx_error' || m.event === 'phx_close') ws.close();
    };
    ws.onclose = () => {
      clearInterval(live.hb);
      const was = live.ok;
      live.ok = false; live.ws = null; paintChip();
      if (!session()) return;
      live.retry = Math.min(live.retry + 1, 6);
      setTimeout(connectLive, 1000 * Math.pow(2, live.retry));   /* 2 s ... 64 s */
      if (was) schedule(500);                                     /* catch up on what was missed */
    };
    ws.onerror = () => { /* onclose follows */ };
  }
  function closeLive() { if (live.ws) { live.retry = 99; try { live.ws.close(); } catch (e) { /* ignore */ } } }

  /* ------------------------------------------------------------------ auth */
  const session = () => { try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch (e) { return null; } };
  const keep = s => {
    const old = session() || {};
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      access_token: s.access_token, refresh_token: s.refresh_token,
      expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
      email: (s.user && s.user.email) || old.email || ''
    }));
    if (live.ws && live.ws.readyState === 1) live.send({ topic: TOPIC, event: 'access_token', payload: { access_token: s.access_token } });
  };

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
    if (rec.purgedAt && sy.ver[k] == null) { S.removeLocal(kind, id); return; }   /* deleted before it ever reached the server */
    const json = JSON.stringify(rec);
    const row = { id, data: rec };
    if (kind === 'h') row.patient_id = rec.patientId;
    const ver = sy.ver[k];
    let locked = false;
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
      } catch (e) { if (e.code !== 'P0001') throw e; locked = true; }
    }
    /* conflict: somebody else changed it (or it is locked) */
    const cur = (await api('GET', TABLE[kind] + '?id=eq.' + enc(id) + '&select=id,data,version'))[0];
    if (!cur) {
      if (rec.purgedAt || sy.ver[k] != null) { S.removeLocal(kind, id); changedRemote = true; return; }   /* deleted for good elsewhere */
      sy.ver[k] = null; return pushRecord(kind, id);
    }
    const lockedRemote = () => {
      S.applyRemote(kind, cur, true);
      ICU.toast('บันทึกนี้ถูกส่งเวรจากเครื่องอื่นแล้ว - การแก้ไขล่าสุดของเครื่องนี้ไม่ถูกบันทึก', 'error');
      changedRemote = true;
    };
    if (locked) return lockedRemote();
    const merged = merge(sy.base[k], rec, cur.data);
    let r2;
    try { r2 = await api('PATCH', TABLE[kind] + '?id=eq.' + enc(id) + '&version=eq.' + cur.version, { data: merged }, 'return=representation'); }
    catch (e) { if (e.code === 'P0001') return lockedRemote(); throw e; }
    if (!r2 || !r2.length) { again = true; return; }
    S.applyRemote(kind, r2[0], true);
    ICU.toast('มีคนแก้ ' + (kind === 'h' ? 'บันทึกส่งเวร' : 'ข้อมูลผู้ป่วย') + ' นี้พร้อมกัน - รวมการแก้ไขแล้ว (' + (cur.data.updatedBy || 'อีกเครื่อง') + ')');
    changedRemote = true;
  }

  async function push() {
    const sy = S.syncState();
    const keys = Object.keys(sy.dirty).sort();          /* "h:..." < "p:..." -> send patients first */
    for (const k of keys.filter(x => x[0] === 'p').concat(keys.filter(x => x[0] === 'h'))) {
      const kind = k[0], id = k.slice(2);
      await pushRecord(kind, id);
      /* "delete for good": the server copy is in the trash now -> remove the row */
      const r = S.record(kind, id);
      if (kind === 'h' && r && r.purgedAt && sy.ver[k] != null && !sy.dirty[k]) {
        await api('DELETE', 'handovers?id=eq.' + enc(id));
        S.removeLocal('h', id);
      }
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
  let changedRemote = false, fullDone = false, pulls = 0;
  async function pull() {
    const sy = S.syncState();
    const since = sy.lastPull || '1970-01-01T00:00:00Z';
    let maxAt = sy.lastPull;
    for (const kind of ['p', 'h']) {
      const rows = await api('GET', TABLE[kind] + '?select=id,data,version,updated_at&updated_at=gte.' + enc(since) + '&order=updated_at.asc&limit=2000');
      rows.forEach(r => { if (S.applyRemote(kind, r)) changedRemote = true; if (!maxAt || r.updated_at > maxAt) maxAt = r.updated_at; });
    }
    if (!fullDone || ++pulls % 4 === 0) {
      /* records deleted for good (or empty drafts deleted) on other phones - checked about once a minute */
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
    busy = true; again = false; changedRemote = false; lastRun = Date.now();
    setState('sync');
    try {
      await push();
      await pull();
      S.save();
      lastOk = new Date(); lastErr = '';
      setState(S.pendingCount() ? 'pending' : 'ok');
      if (ICU.onSynced) { try { ICU.onSynced(); } catch (e) { /* never break the sync */ } }
      if (!live.ws) connectLive();
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
    el.className = 'sync-chip s-' + state + (live.ok ? ' is-live' : '');
    el.textContent = txt;
    el.title = (lastErr || 'ข้อมูลกลางของวอร์ด (Supabase)') + (live.ok ? ' · เชื่อมต่อสด' : '');
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
      '<label class="fld">ชื่อผู้ใช้ <small class="muted">(ถ้ามีบัญชีของตัวเอง · ว่างไว้ = ใช้รหัสวอร์ด)</small><input name="user" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" value="' + U.esc(localStorage.getItem('icuhandover.user') || '') + '" placeholder="เช่น malee"></label>' +
      '<label class="fld"><span id="pass-label">รหัสวอร์ด</span><span class="pass-row"><input name="pass" type="password" required autocomplete="current-password" autocorrect="off" autocapitalize="off" spellcheck="false">' +
      '<button type="button" class="eye" id="login-eye">แสดง</button></span></label>' +
      '<p class="lock-err" id="login-err" role="alert"></p>' +
      '<button class="btn primary" type="submit">เข้าสู่ระบบ</button>' +
      '<p class="hint">ใส่รหัสครั้งเดียว เครื่องนี้จะจำไว้ · ข้อมูลผู้ป่วยใช้ชื่อย่อ + เตียง</p></form></div>';
    const f = v.querySelector('#login-form'), err = v.querySelector('#login-err');
    (f.name.value ? f.pass : f.name).focus();
    const isWard = () => { const u = f.user.value.trim().toLowerCase(); return !u || u === 'ward'; };
    const label = () => { v.querySelector('#pass-label').textContent = isWard() ? 'รหัสวอร์ด' : 'รหัสผ่านของคุณ'; };
    f.user.oninput = label; label();
    v.querySelector('#login-eye').onclick = e => {
      const show = f.pass.type === 'password';
      f.pass.type = show ? 'text' : 'password'; e.target.textContent = show ? 'ซ่อน' : 'แสดง';
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ…'; err.textContent = '';
      try {
        const user = f.user.value.trim().toLowerCase().replace(/@.*$/, '');
        keep(await authCall('password', isWard()
          ? { email: C.email, password: f.pass.value.trim().toUpperCase() + (C.passSuffix || '') }
          : { email: user + '@' + C.userDomain, password: f.pass.value }));
        S.saveSettings({ userName: f.name.value.trim() });
        localStorage.setItem('icuhandover.named', '1');
        localStorage.setItem('icuhandover.user', isWard() ? '' : user);
        document.body.classList.remove('locked');
        btn.textContent = 'กำลังโหลดข้อมูลวอร์ด…';
        fullDone = false;
        await run();
        onOk();
      } catch (ex) {
        btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
        err.textContent = ex.status === 400 ? (isWard() ? 'รหัสวอร์ดไม่ถูกต้อง' : 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง') + ' (กด "แสดง" เพื่อดูสิ่งที่พิมพ์)'
          : ex.status === 429 ? 'ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่'
          : ex instanceof TypeError ? 'เชื่อมต่อไม่ได้ - ตรวจสอบอินเทอร์เน็ต' : 'เข้าสู่ระบบไม่สำเร็จ: ' + ex.message;
      }
    };
  }

  ICU.cloud = {
    enabled, schedule, run, loginScreen, paintChip,
    signedIn: () => !!session(),
    account: () => { const s = session(); return s ? (s.email === C.email ? 'บัญชีวอร์ด (รหัสวอร์ด)' : (s.email || '').replace('@' + C.userDomain, '')) : ''; },
    status: () => ({ state, lastOk, lastErr, pending: S.pendingCount(), live: live.ok }),
    signOut() { closeLive(); localStorage.removeItem(AUTH_KEY); render(); },
    /* clear this phone's copy and download everything again */
    async reload() { S.resetLocal(); fullDone = false; await run(); render(); }
  };

  if (enabled()) {
    /* polling: every pollSeconds; while the live connection works only once a minute as a safety net */
    setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (live.ok && Date.now() - lastRun < 60000) return;
      run();
    }, (C.pollSeconds || 15) * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { run(); if (!live.ws) { live.retry = 0; connectLive(); } }
    });
    window.addEventListener('online', () => { run(); live.retry = 0; connectLive(); });
    window.addEventListener('offline', () => setState('offline'));
    if (session()) setTimeout(run, 50);
  }
})();
