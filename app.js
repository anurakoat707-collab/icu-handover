/* ICU Handover - app shell, router and pages (home, patients, history, settings).
   The handover editor lives in editor.js, the A4 paper form in print.js. */
(function () {
  'use strict';
  const U = ICU.util, S = ICU.store, esc = U.esc;
  ICU.views = ICU.views || {};

  /* ------------------------------------------------------------------ icons */
  const IC = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M16 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4"/>',
    history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    file: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/>',
    pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    lungs: '<path d="M12 3v8"/><path d="M12 11c-2 0-3 1-4 3l-3 6c-1 2 1 3 3 2l4-2z"/><path d="M12 11c2 0 3 1 4 3l3 6c1 2-1 3-3 2l-4-2z"/>',
    plan: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4M16 2v4M8 11h8M8 15h5"/>',
    archive: '<rect x="3" y="4" width="18" height="4"/><path d="M5 8v12h14V8M10 12h4"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
    bed: '<path d="M3 18V7M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="10.5" r="1.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'
  };
  const icon = (n, s) => '<svg class="ic" viewBox="0 0 24 24" width="' + (s || 18) + '" height="' + (s || 18) + '" aria-hidden="true">' + (IC[n] || '') + '</svg>';

  /* --------------------------------------------------------------- UI bits */
  const UI = ICU.ui = {
    icon,
    badge(status) { const s = ICU.HANDOVER_STATUS[status]; return s ? '<span class="badge ' + s.cls + '">' + s.label + '</span>' : '<span class="badge outline">ยังไม่เริ่ม</span>'; },
    pBadge(status) { const s = ICU.PATIENT_STATUS[status] || ICU.PATIENT_STATUS.active; return '<span class="badge ' + s.cls + '">' + s.label + '</span>'; },
    avatar(name, big) {
      const n = String(name || '?').replace(/^(นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.|พว\.)/, '').trim();
      return '<span class="avatar-c' + (big ? ' big' : '') + '" aria-hidden="true">' + esc(n.charAt(0) || '?') + '</span>';
    },
    bar(done, total, na) {
      if (na) return '<div class="bar na"><span style="width:100%"></span></div>';
      const pct = total ? Math.round(done / total * 100) : 0;
      return '<div class="bar' + (pct === 100 ? ' full' : '') + '"><span style="width:' + pct + '%"></span></div>';
    },
    count(r) { return r.na ? 'ไม่เกี่ยวข้อง' : r.done + '/' + r.total; },
    toast(msg, type) {
      const t = document.getElementById('toast');
      t.textContent = msg; t.className = 'toast ' + (type || ''); t.hidden = false;
      clearTimeout(UI._tt); UI._tt = setTimeout(() => { t.hidden = true; }, 2600);
    },
    /* dialog: returns a Promise with the submitted FormData (or null when cancelled) */
    dialog(o) {
      const d = document.getElementById('dialog');
      d.innerHTML = '<form method="dialog" class="dlg">' +
        '<h3>' + esc(o.title) + '</h3>' + (o.html || '') +
        '<div class="dlg-actions"><button type="button" class="btn ghost" data-cancel>' + esc(o.cancel || 'ยกเลิก') + '</button>' +
        '<button type="submit" class="btn ' + (o.danger ? 'danger' : 'primary') + '">' + esc(o.ok || 'ตกลง') + '</button></div></form>';
      return new Promise(res => {
        const f = d.querySelector('form');
        let done = false;
        const finish = v => { if (done) return; done = true; d.close(); res(v); };
        d.querySelector('[data-cancel]').onclick = () => finish(null);
        d.oncancel = e => { e.preventDefault(); finish(null); };
        f.onsubmit = e => {
          e.preventDefault();
          if (!f.reportValidity()) return;
          const fd = new FormData(f);
          if (o.validate) { const err = o.validate(fd); if (err) { UI.toast(err, 'error'); return; } }
          finish(fd);
        };
        d.showModal();
        const first = f.querySelector('input,textarea,select');
        if (first) first.focus();
      });
    },
    confirm(title, text, ok, danger) { return UI.dialog({ title, html: '<p>' + esc(text) + '</p>', ok, danger }).then(Boolean); },
    copy(text) {
      const fallback = () => {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        ta.remove(); return ok;
      };
      const done = ok => UI.toast(ok ? 'คัดลอกสรุปแล้ว' : 'คัดลอกไม่สำเร็จ', ok ? 'ok' : 'error');
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => done(true), () => done(fallback()));
      else done(fallback());
    },
    go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  };
  ICU.toast = UI.toast;

  /* open (or create) the handover of a patient for a date + shift */
  ICU.openHandover = function (pid, date, shift, step) {
    let h = S.handoverFor(pid, date, shift);
    if (!h) { h = S.newHandover(pid, { date, shift }); UI.toast(h.copiedFrom ? 'สร้างบันทึกใหม่ (คัดลอกจากเวรก่อน)' : 'สร้างบันทึกใหม่'); }
    UI.go('#/handover/' + h.id + '/' + (step || (h.status === 'ready_for_review' || h.status === 'handed_over' ? 'summary' : 'fancas')));
  };

  /* ------------------------------------------------------------- nav + shell */
  const NAV = [
    { href: '#/home', key: 'home', label: 'หน้าหลัก', icon: 'home' },
    { href: '#/patients', key: 'patients', label: 'จัดการผู้ป่วย', short: 'ผู้ป่วย', icon: 'users' },
    { href: '#/history', key: 'history', label: 'ประวัติการส่งเวร', short: 'ประวัติ', icon: 'history' },
    { href: '#/settings', key: 'settings', label: 'ตั้งค่า', icon: 'settings' }
  ];
  function renderNav(active, extra) {
    const side = NAV.map(n => '<a href="' + n.href + '" class="' + (n.key === active ? 'on' : '') + '">' + icon(n.icon, 20) + '<span>' + n.label + '</span></a>').join('');
    document.getElementById('side-nav').innerHTML = side + (extra || '');
    document.getElementById('bottom-nav').innerHTML = NAV.map(n =>
      '<a href="' + n.href + '" class="' + (n.key === active ? 'on' : '') + '">' + icon(n.icon, 22) + '<span>' + (n.short || n.label) + '</span></a>').join('');
    const st = S.settings();
    document.getElementById('side-user').innerHTML = UI.avatar(st.userName) + '<span><b>' + esc(st.userName) + '</b><small>' + esc(ICU.ROLES[st.role] || '') + ' · ICU</small></span>';
    document.getElementById('top-avatar').innerHTML = UI.avatar(st.userName);
  }
  function tick() {
    const d = new Date();
    document.getElementById('top-clock').textContent = U.thaiDate(U.dateStr(d)) + ' ' + U.timeStr(d) + ' น.';
  }

  /* ------------------------------------------------------------------ router */
  const routes = [
    [/^\/home$/, 'home'], [/^\/patients$/, 'patients'], [/^\/patients\/new$/, 'patientForm'],
    [/^\/patient\/([\w-]+)\/edit$/, 'patientForm'], [/^\/patient\/([\w-]+)$/, 'patient'],
    [/^\/handover\/([\w-]+)(?:\/(\w+))?$/, 'handover'], [/^\/print\/([\w-]+)$/, 'print'],
    [/^\/history$/, 'history'], [/^\/settings$/, 'settings']
  ];
  function parse() {
    const raw = location.hash.replace(/^#/, '') || '/home';
    const [path, qs] = raw.split('?');
    const q = {};
    new URLSearchParams(qs || '').forEach((v, k) => { q[k] = v; });
    for (const [re, name] of routes) { const m = path.match(re); if (m) return { name, params: m.slice(1), q }; }
    return { name: 'home', params: [], q };
  }
  function render() {
    if (ICU.beforeLeave) { ICU.beforeLeave(); ICU.beforeLeave = null; }
    const r = parse();
    const view = ICU.views[r.name];
    const out = view(r.params, r.q) || {};
    if (out.redirect) { location.replace(out.redirect); return; }
    document.body.classList.toggle('print-mode', r.name === 'print');
    renderNav(out.nav || r.name, out.sideExtra);
    document.getElementById('top-title').textContent = out.title || '';
    const back = document.getElementById('back-btn');
    back.hidden = !out.back;
    back.innerHTML = icon('back', 22);
    back.onclick = () => UI.go(out.back);
    const el = document.getElementById('view');
    el.innerHTML = out.html || '';
    document.title = (out.title ? out.title + ' - ' : '') + 'ICU Handover';
    if (!out.keepScroll) window.scrollTo(0, 0);
    if (out.mount) out.mount(el);
  }
  ICU.render = render;

  /* ------------------------------------------------------------- helpers */
  function shiftSeg(date, shift, base) {
    return '<div class="seg" role="tablist">' + ICU.SHIFTS.map(s =>
      '<a role="tab" aria-selected="' + (s.id === shift) + '" class="' + (s.id === shift ? 'on' : '') + '" href="' + base + '?date=' + date + '&shift=' + s.id + '">' +
      s.label + '<small>' + s.time + '</small></a>').join('') + '</div>';
  }
  function pageHead(title, en, right) {
    return '<div class="page-head"><div><h1>' + esc(title) + (en ? ' <span class="en">' + esc(en) + '</span>' : '') + '</h1></div>' + (right || '') + '</div>';
  }
  function patientMeta(p) {
    return 'HN ' + esc(p.hn) + (p.an ? ' · AN ' + esc(p.an) : '') + ' · ' + (p.age != null && p.age !== '' ? esc(p.age) + ' ปี' : '-') + ' / ' + U.sexLabel(p.sex);
  }
  ICU.patientMeta = patientMeta;

  function progressGrid(v, compact) {
    const rows = [
      ['FANCAS', v.fancas, 'pulse'], ['FASTHUGBID', v.fasthugbid, 'list'], ['DOPE', v.dope, 'lungs'], ['แผนการดูแล', v.care, 'plan']
    ];
    return '<div class="prog' + (compact ? ' compact' : '') + '">' + rows.map(r =>
      '<div class="prog-row"><span class="prog-l">' + r[0] + '</span>' + UI.bar(r[1].done, r[1].total, r[1].na) + '<span class="prog-n">' + UI.count(r[1]) + '</span></div>').join('') + '</div>';
  }
  ICU.progressGrid = progressGrid;

  /* ================================================================ HOME */
  ICU.views.home = function (p, q) {
    const date = q.date || U.dateStr(), shift = q.shift || U.currentShift();
    const slot = U.slot(date, shift);
    const list = S.patients().filter(pt => pt.status === 'active' || S.handoverFor(pt.id, date, shift))
      .sort((a, b) => String(a.bed).localeCompare(String(b.bed), 'th', { numeric: true }));
    const k = { all: list.length, handed_over: 0, ready_for_review: 0, progress: 0, none: 0 };
    const rows = list.map(pt => {
      const h = S.handoverFor(pt.id, date, shift);
      const st = h ? h.status : 'none';
      if (st === 'handed_over' || st === 'ready_for_review') k[st]++; else if (st === 'none') k.none++; else k.progress++;
      return { pt, h, st, v: h ? ICU.validate(h, pt) : null, prev: S.latestHandover(pt.id, slot) };
    });
    const f = q.f || 'all';
    const show = rows.filter(r => f === 'all' || (f === 'progress' ? (r.st === 'draft' || r.st === 'in_progress') : r.st === f));
    const kpi = (key, n, label, cls) => '<a class="kpi ' + cls + (f === key ? ' on' : '') + '" href="#/home?date=' + date + '&shift=' + shift + (f === key ? '' : '&f=' + key) + '"><b>' + n + '</b><span>' + label + '</span></a>';

    const cards = show.map(r => {
      const pt = r.pt;
      let btn;
      if (r.st === 'none') btn = '<button class="btn primary sm" data-open="' + pt.id + '">' + icon('plus') + (r.prev ? 'ส่งเวรต่อ' : 'เริ่มส่งเวร') + '</button>';
      else if (r.st === 'handed_over') btn = '<a class="btn ghost sm" href="#/print/' + r.h.id + '">' + icon('print') + 'พิมพ์ A4</a><a class="btn primary sm" href="#/handover/' + r.h.id + '/summary">' + icon('eye') + 'ดูสรุป</a>';
      else if (r.st === 'ready_for_review') btn = '<a class="btn primary sm" href="#/handover/' + r.h.id + '/summary">' + icon('check') + 'ตรวจสอบ</a>';
      else btn = '<a class="btn primary sm" href="#/handover/' + r.h.id + '/fancas">' + icon('edit') + 'กรอกต่อ</a>';
      return '<article class="pcard st-' + r.st + '">' +
        '<header>' + UI.avatar(pt.name) + '<div class="pc-who"><a href="#/patient/' + pt.id + '"><b>' + esc(pt.name) + '</b></a><small>' + patientMeta(pt) + '</small></div>' + UI.badge(r.h && r.st) + '</header>' +
        '<div class="pc-bed">' + icon('bed', 16) + esc(pt.bed || '-') + (pt.status !== 'active' ? ' ' + UI.pBadge(pt.status) : '') + '<span class="pc-dx">' + esc(pt.diagnosis || '') + '</span></div>' +
        (r.v ? progressGrid(r.v, true) : '<p class="muted pc-empty">' + (r.prev ? 'ล่าสุด: เวร' + U.shift(r.prev.shift).label + ' ' + U.thaiDate(r.prev.date) + ' (' + ICU.HANDOVER_STATUS[r.prev.status].label + ')' : 'ยังไม่มีบันทึกส่งเวร') + '</p>') +
        (r.v && !r.v.complete && r.st !== 'none' ? '<p class="pc-miss">' + icon('alert', 14) + 'ยังขาด ' + r.v.missing.length + ' รายการ</p>' : '') +
        '<footer><span class="muted">' + (r.h ? 'แก้ไขล่าสุด ' + esc(U.timeStr(new Date(r.h.updatedAt))) + ' · ' + esc(r.h.updatedBy) : '') + '</span><div class="btns">' + btn + '</div></footer></article>';
    }).join('');

    return {
      title: 'หน้าหลัก',
      html: pageHead('หน้าหลัก', 'Dashboard',
          '<a class="btn primary" href="#/patients/new">' + icon('plus') + 'เพิ่มผู้ป่วย</a>') +
        '<div class="dash-bar card"><label class="date-in">' + icon('history', 16) + '<input type="date" id="home-date" value="' + date + '" aria-label="วันที่"></label>' +
        shiftSeg(date, shift, '#/home') + '<a class="btn ghost sm" href="#/home">เวรปัจจุบัน</a></div>' +
        '<div class="kpis">' + kpi('all', k.all, 'ผู้ป่วยในเวรนี้', 'navy') + kpi('none', k.none, 'ยังไม่เริ่ม', 'gray') + kpi('progress', k.progress, 'Draft / In Progress', 'blue') +
        kpi('ready_for_review', k.ready_for_review, 'Ready for Review', 'amber') + kpi('handed_over', k.handed_over, 'ส่งเวรแล้ว', 'teal') + '</div>' +
        (show.length ? '<div class="pcards">' + cards + '</div>' : '<div class="empty card">' + icon('users', 40) + '<p>ไม่มีผู้ป่วยในรายการนี้</p><div class="btns" style="justify-content:center"><a class="btn primary" href="#/patients/new">' + icon('plus') + 'เพิ่มผู้ป่วย</a>' +
          (S.patients({ includeArchived: true }).length ? '' : '<a class="btn ghost" href="#/settings">ลองใช้ด้วยข้อมูลตัวอย่าง</a>') + '</div></div>'),
      mount(el) {
        el.querySelector('#home-date').onchange = e => UI.go('#/home?date=' + e.target.value + '&shift=' + shift);
        el.querySelectorAll('[data-open]').forEach(b => { b.onclick = () => ICU.openHandover(b.dataset.open, date, shift); });
      }
    };
  };

  /* ============================================================ PATIENTS */
  const pf = { q: '', status: 'active', shift: '', room: '', page: 1 };
  ICU.views.patients = function () {
    const all = S.patients();
    const rooms = Array.from(new Set(all.map(p => String(p.bed || '').split('/')[0].trim()).filter(Boolean))).sort();
    const latest = {};
    all.forEach(p => { latest[p.id] = S.latestHandover(p.id); });
    function rowsHtml() {
      const q = pf.q.trim().toLowerCase();
      const list = all.filter(p => (!pf.status || p.status === pf.status)
          && (!pf.room || String(p.bed || '').split('/')[0].trim() === pf.room)
          && (!pf.shift || (latest[p.id] && latest[p.id].shift === pf.shift))
          && (!q || [p.name, p.hn, p.an, p.bed, p.diagnosis].join(' ').toLowerCase().includes(q)))
        .sort((a, b) => String(a.bed).localeCompare(String(b.bed), 'th', { numeric: true }));
      const per = 8, pages = Math.max(1, Math.ceil(list.length / per));
      pf.page = Math.min(pf.page, pages);
      const items = list.slice((pf.page - 1) * per, pf.page * per);
      return '<p class="muted list-count">ทั้งหมด ' + list.length + ' รายการ</p>' +
        '<div class="ptable" role="table">' +
        '<div class="pt-row pt-head" role="row"><span>ลำดับ</span><span>ชื่อผู้ป่วย</span><span>HN</span><span>AN</span><span>อายุ/เพศ</span><span>ห้อง/เตียง</span><span>วันที่รับเข้า ICU</span><span>สถานะ</span><span>การดำเนินการ</span></div>' +
        items.map((p, i) => '<div class="pt-row" role="row">' +
          '<span class="pt-no">' + ((pf.page - 1) * per + i + 1) + '</span>' +
          '<span class="pt-name">' + UI.avatar(p.name) + '<a href="#/patient/' + p.id + '"><b>' + esc(p.name) + '</b><small>' + esc(p.diagnosis || '') + '</small></a></span>' +
          '<span data-l="HN">' + esc(p.hn) + '</span><span data-l="AN">' + esc(p.an || '-') + '</span>' +
          '<span data-l="อายุ/เพศ">' + esc(p.age) + ' ปี / ' + U.sexLabel(p.sex) + '</span><span data-l="เตียง">' + esc(p.bed || '-') + '</span>' +
          '<span data-l="รับเข้า">' + U.thaiDate(p.admitDate) + ' ' + esc(p.admitTime || '') + '</span>' +
          '<span class="pt-st">' + UI.pBadge(p.status) + '</span>' +
          '<span class="pt-act"><a class="icon-btn" href="#/patient/' + p.id + '" title="ดูรายละเอียด" aria-label="ดูรายละเอียด">' + icon('eye') + '</a>' +
          '<a class="icon-btn" href="#/patient/' + p.id + '/edit" title="แก้ไขข้อมูล" aria-label="แก้ไขข้อมูล">' + icon('edit') + '</a>' +
          (p.status === 'active' ? '<button class="icon-btn" data-open="' + p.id + '" title="บันทึกส่งเวรเวรนี้" aria-label="บันทึกส่งเวรเวรนี้">' + icon('clipboard') + '</button>' : '') + '</span></div>').join('') +
        (items.length ? '' : '<div class="empty">ไม่พบผู้ป่วย</div>') + '</div>' +
        (pages > 1 ? '<div class="pager">' + Array.from({ length: pages }, (_, i) => '<button class="' + (i + 1 === pf.page ? 'on' : '') + '" data-page="' + (i + 1) + '">' + (i + 1) + '</button>').join('') + '</div>' : '');
    }
    const opt = (v, l, cur) => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + esc(l) + '</option>';
    return {
      title: 'จัดการผู้ป่วย',
      html: pageHead('จัดการผู้ป่วย', 'Patient Management', '<a class="btn primary" href="#/patients/new">' + icon('plus') + 'เพิ่มผู้ป่วย</a>') +
        '<div class="card filters">' +
        '<label class="search">' + icon('search') + '<input type="search" id="pf-q" placeholder="ค้นหา HN, AN, ชื่อผู้ป่วย..." value="' + esc(pf.q) + '"></label>' +
        '<label class="fld">สถานะผู้ป่วย<select id="pf-status">' + opt('', 'ทั้งหมด', pf.status) + Object.keys(ICU.PATIENT_STATUS).map(k => opt(k, ICU.PATIENT_STATUS[k].label, pf.status)).join('') + '</select></label>' +
        '<label class="fld">เวร (บันทึกล่าสุด)<select id="pf-shift">' + opt('', 'ทั้งหมด', pf.shift) + ICU.SHIFTS.map(s => opt(s.id, s.label, pf.shift)).join('') + '</select></label>' +
        '<label class="fld">ห้อง<select id="pf-room">' + opt('', 'ทั้งหมด', pf.room) + rooms.map(r => opt(r, r, pf.room)).join('') + '</select></label></div>' +
        '<div id="pt-list">' + rowsHtml() + '</div>',
      mount(el) {
        const box = el.querySelector('#pt-list');
        const re = () => { box.innerHTML = rowsHtml(); bind(); };
        const bind = () => {
          box.querySelectorAll('[data-page]').forEach(b => { b.onclick = () => { pf.page = +b.dataset.page; re(); }; });
          box.querySelectorAll('[data-open]').forEach(b => { b.onclick = () => ICU.openHandover(b.dataset.open, U.dateStr(), U.currentShift()); });
        };
        el.querySelector('#pf-q').oninput = e => { pf.q = e.target.value; pf.page = 1; re(); };
        ['status', 'shift', 'room'].forEach(k => { el.querySelector('#pf-' + k).onchange = e => { pf[k] = e.target.value; pf.page = 1; re(); }; });
        bind();
      }
    };
  };

  /* -------------------------------------------------------- patient form */
  ICU.views.patientForm = function (params) {
    const p = params[0] ? S.patient(params[0]) : null;
    if (params[0] && !p) return { redirect: '#/patients' };
    const v = p || { status: 'active', admitDate: U.dateStr(), admitTime: U.timeStr() };
    const val = k => esc(v[k] == null ? '' : v[k]);
    const opt = (k, l, cur) => '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(l) + '</option>';
    const title = p ? 'แก้ไขข้อมูลผู้ป่วย' : 'เพิ่มผู้ป่วยใหม่';
    return {
      title, nav: 'patients', back: p ? '#/patient/' + p.id : '#/patients',
      html: pageHead(title, p ? 'Edit Patient' : 'New Patient') +
        '<form id="pform" class="stack" novalidate>' +
        '<section class="card"><h2 class="sec-t">' + icon('user') + 'ข้อมูลผู้ป่วย</h2><div class="grid g4">' +
        '<label class="fld span2">ชื่อ-นามสกุล *<input name="name" required value="' + val('name') + '" placeholder="เช่น นายสมชาย ใจดี"></label>' +
        '<label class="fld">HN *<input name="hn" required inputmode="numeric" value="' + val('hn') + '" placeholder="เช่น 123456"></label>' +
        '<label class="fld">AN<input name="an" inputmode="numeric" value="' + val('an') + '" placeholder="เช่น 654321"></label>' +
        '<label class="fld">อายุ (ปี) *<input name="age" type="number" min="0" max="130" required value="' + val('age') + '"></label>' +
        '<label class="fld">เพศ *<select name="sex" required>' + opt('', 'เลือกเพศ', v.sex || '') + opt('M', 'ชาย', v.sex) + opt('F', 'หญิง', v.sex) + '</select></label>' +
        '<label class="fld">น้ำหนัก (กก.)<input name="weight" type="number" min="0" max="400" step="0.1" value="' + val('weight') + '"></label>' +
        (p ? '<label class="fld">สถานะผู้ป่วย<select name="status">' + Object.keys(ICU.PATIENT_STATUS).map(k => opt(k, ICU.PATIENT_STATUS[k].label, v.status)).join('') + '</select></label>' : '') +
        '</div></section>' +
        '<section class="card"><h2 class="sec-t">' + icon('bed') + 'ข้อมูลการรับเข้า ICU</h2><div class="grid g4">' +
        '<label class="fld">วันที่รับเข้า *<input name="admitDate" type="date" required value="' + val('admitDate') + '"></label>' +
        '<label class="fld">เวลา<input name="admitTime" type="time" value="' + val('admitTime') + '"></label>' +
        '<label class="fld span2">ห้อง / เตียง *<input name="bed" required value="' + val('bed') + '" placeholder="เช่น ICU-1 / 01"></label>' +
        '<label class="fld span4">อาการสำคัญ / การวินิจฉัย *<input name="diagnosis" required value="' + val('diagnosis') + '"></label>' +
        '<label class="fld span2">โรคประจำตัว<input name="underlying" value="' + val('underlying') + '"></label>' +
        '<label class="fld span2">ประวัติการแพ้ยา<input name="allergies" value="' + val('allergies') + '"></label>' +
        '<label class="fld span4">หมายเหตุเพิ่มเติม<textarea name="note" rows="2">' + val('note') + '</textarea></label>' +
        '</div></section>' +
        '<p class="hint">' + icon('shield', 14) + ' ข้อมูลเก็บในเครื่องนี้เท่านั้น · ใส่เท่าที่จำเป็นต่อการส่งเวร</p>' +
        '<div class="action-bar"><a class="btn ghost" href="' + (p ? '#/patient/' + p.id : '#/patients') + '">ยกเลิก</a><button class="btn primary" type="submit">' + icon('check') + 'บันทึก</button></div>' +
        '</form>',
      mount(el) {
        const f = el.querySelector('#pform');
        f.onsubmit = e => {
          e.preventDefault();
          if (!f.reportValidity()) { UI.toast('กรอกข้อมูลที่มี * ให้ครบ', 'error'); return; }
          const d = Object.fromEntries(new FormData(f).entries());
          Object.keys(d).forEach(k => { d[k] = String(d[k]).trim(); });
          d.age = d.age === '' ? '' : +d.age;
          d.weight = d.weight === '' ? '' : +d.weight;
          if (p) d.id = p.id;
          const r = S.savePatient(d);
          if (r.error) { UI.toast(r.error, 'error'); return; }
          UI.toast('บันทึกข้อมูลผู้ป่วยแล้ว', 'ok');
          UI.go('#/patient/' + r.patient.id);
        };
      }
    };
  };

  /* ------------------------------------------------------ patient detail */
  ICU.views.patient = function (params, q) {
    const p = S.patient(params[0]);
    if (!p) return { redirect: '#/patients' };
    const tab = q.tab || 'info';
    const hs = S.handoversOf(p.id);
    const latest = hs[0];
    const cur = S.handoverFor(p.id, U.dateStr(), U.currentShift());
    const tabs = [['info', 'ข้อมูลพื้นฐาน'], ['latest', 'บันทึกล่าสุด'], ['history', 'ประวัติการส่งเวร']];
    let body = '';
    if (tab === 'info') {
      const row = (l, v) => '<div class="kv"><span>' + l + '</span><b>' + esc(v || '-') + '</b></div>';
      body = '<div class="card kvs">' + row('อาการสำคัญ / การวินิจฉัย', p.diagnosis) + row('โรคประจำตัว', p.underlying) + row('ประวัติการแพ้ยา', p.allergies) +
        row('น้ำหนัก', p.weight ? p.weight + ' กก.' : '') + row('วันที่รับเข้า ICU', U.thaiDate(p.admitDate) + ' ' + (p.admitTime || '')) + row('หมายเหตุ', p.note) +
        row('บันทึกโดย', p.createdBy + ' · ' + U.thaiDateTime(p.createdAt)) + row('แก้ไขล่าสุด', p.updatedBy + ' · ' + U.thaiDateTime(p.updatedAt)) + '</div>';
    } else if (tab === 'latest') {
      if (!latest) body = '<div class="empty card">ยังไม่มีบันทึกส่งเวร</div>';
      else {
        const v = ICU.validate(latest, p);
        const sec = (id, name, sub, ic, r) => '<a class="sec-card" href="#/handover/' + latest.id + '/' + id + '"><span class="sec-ic">' + icon(ic, 22) + '</span><b>' + name + '</b><small>' + sub + '</small>' +
          '<span class="badge ' + (r.na ? 'gray' : r.done === r.total ? 'teal' : 'red') + '">' + (r.na ? 'ไม่เกี่ยวข้อง' : r.done === r.total ? 'ครบแล้ว' : 'ยังไม่ครบ') + '</span>' + UI.bar(r.done, r.total, r.na) + '<span class="prog-n">' + UI.count(r) + '</span></a>';
        body = '<div class="card"><div class="row-between"><div><b>เวร' + U.shift(latest.shift).label + ' ' + U.thaiDate(latest.date) + '</b> ' + UI.badge(latest.status) + '</div>' +
          '<div class="btns"><a class="btn ghost sm" href="#/print/' + latest.id + '">' + icon('print') + 'พิมพ์ A4</a><a class="btn primary sm" href="#/handover/' + latest.id + '/summary">' + icon('eye') + 'สรุป</a></div></div>' +
          '<div class="reason"><span>เหตุผลที่รับไว้ใน ICU</span><p>' + esc(latest.care.reason || '-') + '</p></div></div>' +
          '<div class="sec-cards">' + sec('fancas', 'FANCAS', 'สรุปปัญหาผู้ป่วย 6 ด้าน', 'pulse', v.fancas) + sec('fasthugbid', 'FASTHUGBID', 'รายการดูแลประจำวัน', 'list', v.fasthugbid) +
          sec('dope', 'DOPE', 'ประเมินภาวะฉุกเฉิน', 'lungs', v.dope) + sec('care', 'แผนการดูแลต่อเนื่อง', 'เฝ้าระวังและแผนการรักษา', 'plan', v.care) + '</div>';
      }
    } else {
      const range = q.range || 'all';
      const from = range === 'today' ? U.dateStr() : range === '7' ? U.addDays(U.dateStr(), -6) : range === '30' ? U.addDays(U.dateStr(), -29) : '';
      const list = hs.filter(h => !from || h.date >= from);
      body = '<div class="chips">' + [['all', 'ทั้งหมด'], ['today', 'วันนี้'], ['7', '7 วัน'], ['30', '30 วัน']].map(r =>
        '<a class="chip' + (r[0] === range ? ' on' : '') + '" href="#/patient/' + p.id + '?tab=history&range=' + r[0] + '">' + r[1] + '</a>').join('') + '</div>' +
        historyList(list, false);
    }
    return {
      title: p.name, nav: 'patients', back: '#/patients',
      html: '<div class="card phead">' + UI.avatar(p.name, true) + '<div class="ph-main"><h1>' + esc(p.name) + '</h1><p>' + patientMeta(p) + '</p>' +
        '<p class="ph-bed">' + icon('bed', 16) + esc(p.bed || '-') + ' · รับเข้า ' + U.thaiDate(p.admitDate) + ' ' + esc(p.admitTime || '') + '</p></div>' + UI.pBadge(p.status) +
        (p.isDemo ? '<span class="badge outline">ข้อมูลสมมติ</span>' : '') + '</div>' +
        '<div class="tabs">' + tabs.map(t => '<a class="' + (t[0] === tab ? 'on' : '') + '" href="#/patient/' + p.id + '?tab=' + t[0] + '">' + t[1] + '</a>').join('') + '</div>' +
        body +
        '<div class="action-bar"><a class="btn ghost" href="#/patient/' + p.id + '/edit">' + icon('edit') + 'แก้ไขข้อมูล</a>' +
        '<button class="btn ghost danger-t" id="p-archive">' + icon('archive') + 'เก็บถาวร</button>' +
        (p.status === 'active' ? '<button class="btn primary" id="p-new">' + icon('clipboard') + (cur ? 'เปิดบันทึกเวรนี้' : 'สร้างบันทึกส่งเวร') + '</button>' : '') + '</div>',
      mount(el) {
        const nb = el.querySelector('#p-new');
        if (nb) nb.onclick = async () => {
          if (cur) return ICU.openHandover(p.id, cur.date, cur.shift);
          const fd = await UI.dialog({
            title: 'สร้างบันทึกส่งเวร', ok: 'สร้าง',
            html: '<div class="grid g2"><label class="fld">วันที่<input type="date" name="date" required value="' + U.dateStr() + '"></label>' +
              '<label class="fld">เวร<select name="shift">' + ICU.SHIFTS.map(s => '<option value="' + s.id + '"' + (s.id === U.currentShift() ? ' selected' : '') + '>' + s.label + ' (' + s.time + ')</option>').join('') + '</select></label></div>' +
              (latest ? '<p class="hint">FANCAS และแผนการดูแลจะคัดลอกจากบันทึกล่าสุด (เวร' + U.shift(latest.shift).label + ' ' + U.thaiDate(latest.date) + ') ส่วน FASTHUGBID และ DOPE ต้องประเมินใหม่</p>' : '')
          });
          if (fd) ICU.openHandover(p.id, fd.get('date'), fd.get('shift'));
        };
        el.querySelector('#p-archive').onclick = async () => {
          if (!await UI.confirm('เก็บถาวรผู้ป่วย', 'ซ่อน ' + p.name + ' ออกจากรายชื่อ (ข้อมูลและประวัติการส่งเวรยังอยู่ ไม่ถูกลบ)', 'เก็บถาวร', true)) return;
          S.archivePatient(p.id);
          UI.toast('เก็บถาวรแล้ว');
          UI.go('#/patients');
        };
      }
    };
  };

  /* ============================================================= HISTORY */
  function historyList(list, withPatient) {
    if (!list.length) return '<div class="empty card">ไม่มีบันทึกส่งเวรในช่วงนี้</div>';
    const sup = S.supersededIds();
    let lastDate = '';
    return '<div class="hlist">' + list.map(h => {
      const p = S.patient(h.patientId) || { name: '(ผู้ป่วยถูกเก็บถาวร)', hn: '' };
      const head = h.date !== lastDate ? '<h3 class="h-date">' + U.thaiDate(h.date, true) + '</h3>' : '';
      lastDate = h.date;
      return head + '<div class="hitem card">' +
        '<span class="shift-tag s-' + h.shift + '">เวร' + U.shift(h.shift).label + '</span>' +
        '<div class="hi-main">' + (withPatient ? '<b>' + esc(p.name) + '</b> <small class="muted">HN ' + esc(p.hn) + '</small><br>' : '') +
        '<small>โดย ' + esc(h.giver || h.createdBy) + (h.receiver ? ' → ' + esc(h.receiver) : '') + ' · ' + esc(h.time || '') + ' น.</small>' +
        (h.amendsId ? ' <span class="badge outline">บันทึกแก้ไข</span>' : '') + (sup.has(h.id) ? ' <span class="badge gray">ถูกแก้ไขแล้ว</span>' : '') + '</div>' +
        UI.badge(h.status) +
        '<div class="btns"><a class="btn ghost sm" href="#/print/' + h.id + '" aria-label="พิมพ์ A4">' + icon('print') + '</a><a class="btn ghost sm" href="#/handover/' + h.id + '/summary">ดูรายละเอียด</a></div></div>';
    }).join('') + '</div>';
  }

  ICU.views.history = function (p, q) {
    const range = q.range || '7', st = q.status || '', qq = q.q || '';
    const from = range === 'today' ? U.dateStr() : range === '7' ? U.addDays(U.dateStr(), -6) : range === '30' ? U.addDays(U.dateStr(), -29) : '';
    const needle = qq.trim().toLowerCase();
    const list = S.handovers().filter(h => (!from || h.date >= from) && (!st || h.status === st) && (!needle || (() => {
      const pt = S.patient(h.patientId) || {};
      return [pt.name, pt.hn, pt.an, pt.bed].join(' ').toLowerCase().includes(needle);
    })())).sort((a, b) => U.slot(b.date, b.shift).localeCompare(U.slot(a.date, a.shift)) || b.updatedAt.localeCompare(a.updatedAt));
    const link = (r, s) => '#/history?range=' + r + '&status=' + s + '&q=' + encodeURIComponent(qq);
    return {
      title: 'ประวัติการส่งเวร',
      html: pageHead('ประวัติการส่งเวร', 'Handover History') +
        '<div class="card filters">' +
        '<label class="search">' + icon('search') + '<input type="search" id="h-q" placeholder="ค้นหา HN, AN, ชื่อผู้ป่วย, เตียง..." value="' + esc(qq) + '"></label>' +
        '<div class="chips">' + [['all', 'ทั้งหมด'], ['today', 'วันนี้'], ['7', '7 วัน'], ['30', '30 วัน']].map(r => '<a class="chip' + (r[0] === range ? ' on' : '') + '" href="' + link(r[0], st) + '">' + r[1] + '</a>').join('') + '</div>' +
        '<label class="fld">สถานะ<select id="h-st"><option value="">ทั้งหมด</option>' + Object.keys(ICU.HANDOVER_STATUS).map(k => '<option value="' + k + '"' + (k === st ? ' selected' : '') + '>' + ICU.HANDOVER_STATUS[k].label + '</option>').join('') + '</select></label></div>' +
        '<p class="muted list-count">' + list.length + ' รายการ</p>' + historyList(list, true),
      mount(el) {
        let t;
        el.querySelector('#h-q').oninput = e => { clearTimeout(t); t = setTimeout(() => { location.replace('#/history?range=' + range + '&status=' + st + '&q=' + encodeURIComponent(e.target.value)); }, 400); };
        el.querySelector('#h-st').onchange = e => UI.go(link(range, e.target.value));
        if (qq) { const i = el.querySelector('#h-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
      },
      keepScroll: !!qq
    };
  };

  /* ============================================================ SETTINGS */
  ICU.views.settings = function () {
    const st = S.settings();
    const raw = S.raw();
    const actions = { create: 'สร้าง', update: 'แก้ไข', status: 'เปลี่ยนสถานะ', submit: 'ยืนยันส่งเวร', amend: 'สร้างบันทึกแก้ไข', archive: 'เก็บถาวร', discard: 'ลบฉบับร่าง', import: 'นำเข้า', demo: 'ข้อมูลสมมติ' };
    const auditRows = S.auditAll().slice(0, 80).map(a => {
      let target = '';
      if (a.entity === 'patient') target = (S.patient(a.entityId) || {}).name || 'ผู้ป่วย';
      else if (a.entity === 'handover') { const h = S.handover(a.entityId); const p = h && S.patient(h.patientId); target = h ? (p ? p.name : '') + ' เวร' + U.shift(h.shift).label + ' ' + U.thaiDate(h.date) : 'บันทึกส่งเวร'; }
      return '<tr><td>' + U.thaiDateTime(a.at) + '</td><td>' + esc(a.by) + '</td><td>' + esc(actions[a.action] || a.action) + '</td><td>' + esc(target) +
        (a.changes.length ? '<br><small class="muted">' + esc(a.changes.join(', ')) + '</small>' : '') + (a.note ? '<br><small class="muted">' + esc(a.note) + '</small>' : '') + '</td></tr>';
    }).join('');
    const size = Math.round((localStorage.getItem('icuhandover.v1') || '').length / 1024);
    return {
      title: 'ตั้งค่า',
      html: pageHead('ตั้งค่า', 'Settings') +
        '<form class="card" id="set-user"><h2 class="sec-t">' + icon('user') + 'ผู้ใช้งาน (สำหรับประวัติการแก้ไข)</h2><div class="grid g4">' +
        '<label class="fld span2">ชื่อผู้ใช้งาน<input name="userName" required value="' + esc(st.userName) + '"></label>' +
        '<label class="fld">บทบาท<select name="role">' + Object.keys(ICU.ROLES).map(k => '<option value="' + k + '"' + (k === st.role ? ' selected' : '') + '>' + ICU.ROLES[k] + '</option>').join('') + '</select></label>' +
        '<div class="fld"><span>&nbsp;</span><button class="btn primary" type="submit">บันทึก</button></div></div>' +
        '<p class="hint">ชื่อนี้ใช้บันทึกว่าใครสร้าง / แก้ไขข้อมูล (Audit log) และเป็นค่าเริ่มต้นของ "ผู้ส่งเวร"</p></form>' +
        '<form class="card" id="set-print"><h2 class="sec-t">' + icon('print') + 'หัวกระดาษแบบฟอร์ม A4</h2><div class="grid g4">' +
        '<label class="fld span2">ชื่อโรงพยาบาล<input name="hospital" value="' + esc(st.hospital) + '"></label>' +
        '<label class="fld span2">ชื่อภาษาอังกฤษ<input name="hospitalEn" value="' + esc(st.hospitalEn) + '"></label>' +
        '<label class="fld span2">หอผู้ป่วย<input name="ward" value="' + esc(st.ward) + '"></label>' +
        '<div class="fld"><span>&nbsp;</span><button class="btn primary" type="submit">บันทึก</button></div>' +
        '<div class="fld"><span>&nbsp;</span><a class="btn ghost" href="#/print/blank">' + icon('file') + 'แบบฟอร์มเปล่า</a></div></div></form>' +
        '<section class="card"><h2 class="sec-t">' + icon('download') + 'สำรอง / ย้ายข้อมูล</h2>' +
        '<p class="hint">ข้อมูลเก็บในเครื่องนี้เท่านั้น (' + raw.patients.length + ' ผู้ป่วย, ' + raw.handovers.length + ' บันทึก, ~' + size + ' KB) มือถือกับคอมไม่ซิงค์กันเอง ใช้ Export / Import</p>' +
        '<div class="btns"><button class="btn ghost" id="exp">' + icon('download') + 'Export (.json)</button>' +
        '<label class="btn ghost">' + icon('upload') + 'Import (.json)<input type="file" id="imp" accept=".json,application/json" hidden></label>' +
        '<button class="btn ghost" id="demo">โหลดข้อมูลตัวอย่าง (สมมติ)</button><button class="btn danger" id="wipe">ลบข้อมูลทั้งหมด</button></div>' +
        '<p class="hint">ข้อมูลตัวอย่างมีป้าย "ข้อมูลสมมติ" กดอีกครั้งเพื่อลบชุดเดิมแล้วสร้างใหม่ ข้อมูลผู้ป่วยจริงไม่ถูกแตะ</p></section>' +
        '<section class="card"><h2 class="sec-t">' + icon('alert') + 'ต้องให้ผู้เชี่ยวชาญตรวจสอบก่อนใช้งานจริง</h2><ol class="review">' + ICU.REVIEW_ITEMS.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>' +
        '<p class="hint">ระบบนี้ช่วยบันทึกและตรวจความครบถ้วนเท่านั้น ไม่สร้างคำแนะนำการรักษาหรือการตัดสินใจทางคลินิก</p></section>' +
        '<section class="card"><h2 class="sec-t">' + icon('history') + 'ประวัติการแก้ไขข้อมูล (Audit log) ล่าสุด</h2><div class="table-wrap"><table class="tbl"><thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>รายการ</th></tr></thead><tbody>' + auditRows + '</tbody></table></div></section>' +
        '<section class="card"><h2 class="sec-t">' + icon('shield') + 'ติดตั้งเป็นแอป</h2><p class="hint">iPhone / iPad (Safari): ปุ่มแชร์ → "เพิ่มไปยังหน้าจอโฮม" · Android (Chrome): เมนู ⋮ → "ติดตั้งแอป" · ICU Handover v' + ICU.APP_VERSION + '</p></section>',
      mount(el) {
        el.querySelector('#set-user').onsubmit = e => { e.preventDefault(); S.saveSettings(Object.fromEntries(new FormData(e.target))); UI.toast('บันทึกแล้ว', 'ok'); render(); };
        el.querySelector('#set-print').onsubmit = e => { e.preventDefault(); S.saveSettings(Object.fromEntries(new FormData(e.target))); UI.toast('บันทึกแล้ว', 'ok'); };
        el.querySelector('#exp').onclick = () => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([S.exportJSON()], { type: 'application/json' }));
          a.download = 'icu-handover-' + U.dateStr() + '.json';
          document.body.appendChild(a); a.click(); a.remove();
        };
        el.querySelector('#imp').onchange = async e => {
          const file = e.target.files[0];
          if (!file) return;
          if (!await UI.confirm('นำเข้าข้อมูล', 'ข้อมูลในเครื่องนี้จะถูกแทนที่ด้วยข้อมูลจากไฟล์ ' + file.name + ' (แนะนำให้ Export เก็บไว้ก่อน)', 'นำเข้า', true)) { e.target.value = ''; return; }
          try { S.importJSON(await file.text()); UI.toast('นำเข้าข้อมูลแล้ว', 'ok'); render(); }
          catch (err) { UI.toast('นำเข้าไม่สำเร็จ: ' + err.message, 'error'); }
        };
        el.querySelector('#demo').onclick = async () => {
          if (!await UI.confirm('โหลดข้อมูลตัวอย่าง', 'เพิ่มผู้ป่วยสมมติ 8 คนไว้ทดลองใช้ (ถ้ามีชุดเดิมจะลบแล้วสร้างใหม่) ข้อมูลผู้ป่วยที่คุณเพิ่มเองจะยังอยู่', 'โหลด')) return;
          S.resetDemo(); UI.toast('โหลดข้อมูลตัวอย่างแล้ว', 'ok'); UI.go('#/home');
        };
        el.querySelector('#wipe').onclick = async () => {
          const fd = await UI.dialog({ title: 'ลบข้อมูลทั้งหมด', danger: true, ok: 'ลบทั้งหมด',
            html: '<p>ลบผู้ป่วย บันทึกส่งเวร และประวัติทั้งหมดในเครื่องนี้ <b>กู้คืนไม่ได้</b> (ยกเว้นมีไฟล์ Export)</p><label class="fld">พิมพ์คำว่า ลบ เพื่อยืนยัน<input name="c" required autocomplete="off"></label>',
            validate: f => f.get('c').trim() === 'ลบ' ? '' : 'พิมพ์คำว่า ลบ ให้ถูกต้อง' });
          if (!fd) return;
          S.clearAll(); UI.toast('ลบข้อมูลทั้งหมดแล้ว'); UI.go('#/home');
        };
      }
    };
  };

  /* ---------------------------------------------------------------- start */
  window.addEventListener('hashchange', render);
  tick(); setInterval(tick, 30000);
  render();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
