/* ICU Handover - handover editor (5 steps: FANCAS, FASTHUGBID, DOPE, care plan, summary). */
(function () {
  'use strict';
  const U = ICU.util, S = ICU.store, esc = U.esc;
  ICU.views = ICU.views || {};

  const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  function setPath(o, path, v) {
    const ks = path.split('.');
    const last = ks.pop();
    const t = ks.reduce((a, k) => (a[k] = a[k] || {}), o);
    t[last] = v;
  }

  /* ---------------------------------------------------------- small inputs */
  const chk = (path, on, label) => '<label class="ck"><input type="checkbox" data-path="' + path + '"' + (on ? ' checked' : '') + '><span>' + label + '</span></label>';
  function seg(path, cur, options, cls) {
    return '<div class="seg-r ' + (cls || '') + '" role="radiogroup">' + options.map(o =>
      '<label class="' + (o.cls || '') + '"><input type="radio" name="' + path + '" data-path="' + path + '" value="' + esc(o.id) + '"' + (String(cur) === String(o.id) ? ' checked' : '') + '><span>' + esc(o.label) + '</span></label>').join('') + '</div>';
  }
  const txt = (path, val, ph, cls) => '<input type="text" class="' + (cls || '') + '" data-path="' + path + '" value="' + esc(val || '') + '" placeholder="' + esc(ph || '') + '">';
  const area = (path, val, ph, rows) => '<textarea data-path="' + path + '" rows="' + (rows || 2) + '" placeholder="' + esc(ph || '') + '">' + esc(val || '') + '</textarea>';
  function checklist(def, base, sel, values) {
    return def.map(it => {
      const c = chk(base + '.' + it.id, sel[it.id], esc(it.label));
      return it.input ? '<div class="ck-row">' + c + txt(base.replace(/(items|monitoring|plan)$/, m => m === 'items' ? 'values' : m + 'Values') + '.' + it.id, values[it.id], it.input, 'ck-in') + '</div>' : c;
    }).join('');
  }

  /* ---------------------------------------------------------------- steps */
  function stepFancas(h) {
    return '<div class="step-head"><h2>FANCAS <span>สรุปปัญหาผู้ป่วยแบบองค์รวม 6 ด้าน</span></h2>' +
      '<p class="hint">เน้นปัญหาที่เกี่ยวข้องกับ Septic shock / Pneumonia with ARDS และสิ่งที่ต้องดูแลต่อเนื่อง · ติ๊กรายการแล้วสถานะจะเป็น "มีปัญหา" ให้อัตโนมัติ</p></div>' +
      '<div class="fan-grid">' + ICU.FANCAS.map(g => {
        const f = h.fancas[g.id];
        const b = 'fancas.' + g.id;
        return '<details class="card fan-card st-' + f.state + '" open data-domain="' + g.id + '"><summary><span class="letter">' + g.letter + '</span><span class="fan-name"><b>' + g.en + '</b><small>' + g.th + '</small></span>' +
          '<span class="fan-st" data-st="' + b + '">' + ICU.FANCAS_STATES.find(s => s.id === f.state).label + '</span></summary>' +
          '<div class="fan-body">' + seg(b + '.state', f.state, ICU.FANCAS_STATES.map(s => ({ id: s.id, label: s.label, cls: s.id === 'problem' ? 'warn' : s.id === 'no_problem' ? 'good' : '' })), 'small') +
          '<div class="ck-list">' + checklist(g.items, b + '.items', f.items, f.values) + '</div>' +
          '<label class="fld">หมายเหตุ / รายละเอียดเพิ่มเติม' + area(b + '.detail', f.detail, 'ระบุรายละเอียดเพิ่มเติม...') + '</label></div></details>';
      }).join('') + '</div>';
  }

  function stepFH(h) {
    return '<div class="step-head"><h2>FASTHUGBID <span>รายการดูแลผู้ป่วยวิกฤตประจำวัน</span></h2>' +
      '<p class="hint">สถานะเป็น "สถานะการทำงาน" ไม่ใช่การตัดสินว่าการรักษาถูกต้องหรือไม่ · เลือกสิ่งที่พบ (ตามแบบฟอร์มกระดาษ) แล้วสถานะจะเป็น "ประเมินแล้ว"</p></div>' +
      '<div class="card fh-list">' + ICU.FASTHUGBID.map(f => {
        const x = h.fasthugbid[f.id];
        const b = 'fasthugbid.' + f.id;
        return '<div class="fh-row st-' + x.state + '"><span class="letter">' + f.letter + '</span><div class="fh-name"><b>' + f.en + '</b><small>' + f.th + '</small></div>' +
          '<div class="fh-ctl">' + seg(b + '.state', x.state, ICU.FH_STATES.map(s => ({ id: s.id, label: s.label, cls: s.id === 'assessed' ? 'good' : '' })), 'small') +
          '<div class="fh-find"><span class="muted">สิ่งที่พบ:</span>' + seg(b + '.finding', x.finding == null ? '' : x.finding, f.opts.map((o, i) => ({ id: i, label: o })), 'small find') + '</div>' +
          txt(b + '.note', x.note, 'ปัญหา / เหตุผล / หมายเหตุ', 'fh-note') + '</div></div>';
      }).join('') + '</div>';
  }

  function stepDope(h) {
    const d = h.dope;
    let body = '';
    if (d.onVentilator) {
      body = '<div class="dope-grid">' + ICU.DOPE.map(x => {
        const it = d.items[x.id];
        const b = 'dope.items.' + x.id;
        return '<div class="card dope-card st-' + it.result + '"><div class="dope-h"><span class="letter big">' + x.id + '</span><div><b>' + x.en + '</b><small>' + x.th + '</small></div></div>' +
          seg(b + '.result', it.result, ICU.DOPE_RESULTS.map(r => ({ id: r.id, label: r.label, cls: r.id === 'found' ? 'warn' : r.id === 'not_found' ? 'good' : '' })), 'small') +
          '<label class="fld">สิ่งที่พบ / รายละเอียด' + area(b + '.finding', it.finding, 'ระบุรายละเอียด...') + '</label>' +
          '<label class="fld">การดำเนินการ' + area(b + '.action', it.action, 'สิ่งที่ทำ / แจ้งใคร...') + '</label></div>';
      }).join('') + '</div>' +
        '<div class="card"><label class="fld">สรุปการประเมิน / การดำเนินการ' + area('dope.summary', d.summary, 'สรุปปัญหาเครื่องช่วยหายใจ...', 3) + '</label></div>';
    } else if (d.onVentilator === false) {
      body = '<div class="card empty small">ผู้ป่วยไม่ได้ใช้เครื่องช่วยหายใจ - ไม่ต้องประเมิน DOPE</div>';
    }
    return '<div class="step-head"><h2>DOPE Assessment <span>แนวทางการแก้ไขปัญหาเครื่องช่วยหายใจฉุกเฉิน</span></h2></div>' +
      '<div class="notice">' + ICU.ui.icon('alert', 18) + '<span>' + esc(ICU.DOPE_DISCLAIMER) + '</span></div>' +
      '<div class="card row-wrap"><b>ผู้ป่วยใช้เครื่องช่วยหายใจ (ETT / Tracheostomy + MV) หรือไม่</b>' +
      seg('dope.onVentilator', d.onVentilator == null ? '' : d.onVentilator ? 'yes' : 'no', [{ id: 'yes', label: 'ใช้' }, { id: 'no', label: 'ไม่ใช้' }]) + '</div>' + body;
  }

  /* tasks that travel to the next shift until somebody ticks them */
  function taskBox(tasks) {
    return '<div class="tasks"><div class="tasks-h"><b>งานที่ต้องติดตาม</b><small class="muted">ที่ยังไม่ติ๊กจะส่งต่อไปเวรถัดไปอัตโนมัติ</small></div>' +
      (tasks.length ? '<ul class="task-list">' + tasks.map(t =>
        '<li class="' + (t.done ? 'done' : '') + '"><label class="ck"><input type="checkbox" data-task-done="' + esc(t.id) + '"' + (t.done ? ' checked' : '') + '>' +
        '<span>' + (t.due ? '<b class="task-due">' + esc(t.due) + '</b> ' : '') + esc(t.text) +
        '<small class="muted">' + (t.done ? ' · เสร็จโดย ' + esc(t.doneBy || '-') + ' ' + esc(U.timeStr(new Date(t.doneAt))) : t.fromShift ? ' · ต่อจากเวรก่อน' : '') + '</small></span></label>' +
        '<button type="button" class="icon-btn task-del" data-task-del="' + esc(t.id) + '" aria-label="ลบงานนี้">×</button></li>').join('') + '</ul>'
        : '<p class="muted task-empty">ยังไม่มีงาน</p>') +
      '<div class="task-add"><input type="text" id="task-text" placeholder="เพิ่มงาน เช่น รอผล Lab / ให้ยา / นัดหัตถการ" maxlength="120">' +
      '<input type="time" id="task-due" aria-label="เวลา (ถ้ามี)"><button type="button" class="btn primary sm" id="task-add">เพิ่ม</button></div></div>';
  }

  function stepCare(h) {
    const c = h.care, hn = h.headNurse;
    return '<div class="step-head"><h2>แผนการดูแลต่อเนื่อง <span>ICU Admission &amp; Care Plan</span></h2></div>' +
      '<section class="card"><h3 class="sub-t"><span class="num">A</span>เหตุผลการรับไว้ใน ICU <small>(Chief complaint / Reason for ICU admission)</small></h3>' +
      area('care.reason', c.reason, 'เหตุผลที่รับเข้า ICU และอาการสำคัญ', 3) + '</section>' +
      '<section class="card"><h3 class="sub-t"><span class="num">B</span>ประเด็นสำคัญที่ต้องเฝ้าระวัง <small>(Key Monitoring)</small></h3>' +
      '<div class="ck-cols">' + checklist(ICU.MONITORING, 'care.monitoring', c.monitoring, c.monitoringValues) + '</div>' +
      '<label class="fld">รายละเอียดเพิ่มเติม' + area('care.monitoringNote', c.monitoringNote, 'เป้าหมาย / ค่าที่ต้องติดตาม...') + '</label></section>' +
      '<section class="card"><h3 class="sub-t"><span class="num">C</span>แผนการดูแล / การติดตามต่อ <small>(Ongoing Care Plan)</small></h3>' +
      '<div class="ck-cols">' + checklist(ICU.PLAN, 'care.plan', c.plan, c.planValues) + '</div>' +
      taskBox(c.tasks || []) +
      '<label class="fld">หมายเหตุงานค้างเพิ่มเติม' + area('care.pendingTasks', c.pendingTasks, 'ข้อความอิสระ (ถ้ามี)') + '</label>' +
      '<label class="fld">ข้อมูลสำคัญสำหรับเวรถัดไป' + area('care.nextShiftNote', c.nextShiftNote, 'สิ่งที่เวรถัดไปต้องรู้...') + '</label></section>' +
      '<details class="card"><summary class="sub-t">หัวหน้าเวร <small>(เฉพาะกรณีย้ายออกจากหอผู้ป่วยวิกฤต)</small></summary><div class="grid g4">' +
      '<label class="fld">ชื่อ' + txt('headNurse.name', hn.name) + '</label><label class="fld">ตำแหน่ง' + txt('headNurse.position', hn.position) + '</label>' +
      '<label class="fld">วันที่<input type="date" data-path="headNurse.date" value="' + esc(hn.date) + '"></label>' +
      '<label class="fld">เวลา<input type="time" data-path="headNurse.time" value="' + esc(hn.time) + '"></label></div></details>';
  }

  function stepSummary(h, p, v) {
    const st = h.status;
    const sup = S.supersededIds().has(h.id);
    const amendment = sup ? S.handovers().find(x => x.amendsId === h.id) : null;
    const flow = ['draft', 'in_progress', 'ready_for_review', 'handed_over'];
    const idx = flow.indexOf(st);
    let check;
    if (v.complete) check = '<div class="okbox">' + ICU.ui.icon('check', 22) + '<div><b>ข้อมูลครบถ้วน</b><small>พร้อมส่งตรวจสอบ / ส่งเวร</small></div></div>';
    else {
      const groups = {};
      v.missing.forEach(m => { (groups[m.section] = groups[m.section] || { step: m.step, info: m.info, items: [] }).items.push(m.text); });
      check = '<div class="missbox"><b>' + ICU.ui.icon('alert', 18) + 'ยังขาด ' + v.missing.length + ' รายการ</b>' + Object.keys(groups).map(k =>
        '<div class="miss-g"><div class="row-between"><span>' + esc(k) + '</span>' +
        (groups[k].info ? '<a class="link" href="#/patient/' + p.id + '/edit">แก้ข้อมูลผู้ป่วย</a>' : '<a class="link" href="#/handover/' + h.id + '/' + groups[k].step + '">ไปกรอก ›</a>') + '</div>' +
        '<ul>' + groups[k].items.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>').join('') + '</div>';
    }
    let actions = '';
    if (h.deletedAt) {
      actions = '<p>อยู่ใน<b>ถังขยะ</b> · ลบโดย <b>' + esc(h.deletedBy || '-') + '</b> เมื่อ ' + U.thaiDateTime(h.deletedAt) + (h.deleteReason ? ' · เหตุผล: ' + esc(h.deleteReason) : '') + '</p>' +
        '<button class="btn primary" data-act="restore">กู้คืน</button><button class="btn danger" data-act="purge">ลบถาวร</button>';
    } else if (st === 'draft' || st === 'in_progress') {
      actions = '<button class="btn primary" data-act="review"' + (v.complete ? '' : ' disabled') + '>' + ICU.ui.icon('check') + 'ส่งตรวจสอบ (Ready for Review)</button>' +
        (st === 'draft' ? '<button class="btn ghost danger-t" data-act="discard">ลบฉบับร่าง</button>' : '') +
        (v.complete ? '' : '<p class="hint">กรอกให้ครบก่อนจึงจะส่งตรวจสอบได้</p>');
    } else if (st === 'ready_for_review') {
      actions = '<button class="btn ghost" data-act="reopen">' + ICU.ui.icon('edit') + 'กลับไปแก้ไข</button><button class="btn teal" data-act="submit">' + ICU.ui.icon('check') + 'ยืนยันส่งเวร</button>';
    } else {
      actions = '<p>ส่งเวรแล้วโดย <b>' + esc(h.submittedBy || '-') + '</b> เมื่อ ' + U.thaiDateTime(h.submittedAt) + (h.receiver ? ' · ผู้รับเวร <b>' + esc(h.receiver) + '</b>' : '') + '</p>' +
        (amendment ? '<a class="btn ghost" href="#/handover/' + amendment.id + '/summary">ดูบันทึกที่แก้ไขแล้ว ›</a>' : '<button class="btn ghost" data-act="amend">' + ICU.ui.icon('edit') + 'สร้างบันทึกแก้ไข</button>');
    }
    if (!h.deletedAt) actions += '<button class="btn ghost danger-t" data-act="trash">' + ICU.ui.icon('trash') + 'ลบบันทึกนี้ (ย้ายไปถังขยะ)</button>';
    const auditActions = { create: 'สร้าง', update: 'แก้ไข', status: 'เปลี่ยนสถานะ', submit: 'ยืนยันส่งเวร', amend: 'สร้างบันทึกแก้ไข', discard: 'ลบฉบับร่าง',
      trash: 'ย้ายไปถังขยะ', restore: 'กู้คืน', purge: 'ลบถาวร' };
    const log = S.auditOf(h.id).map(a => '<li><b>' + esc(auditActions[a.action] || a.action) + '</b> ' + esc(a.changes.join(', ')) + (a.note ? ' <span class="muted">' + esc(a.note) + '</span>' : '') +
      '<small>' + esc(a.by) + ' · ' + U.thaiDateTime(a.at) + '</small></li>').join('');
    return '<div class="step-head"><h2>สรุปการส่งเวร <span>Handover Summary</span></h2></div>' +
      '<div class="flow">' + flow.map((f, i) => '<span class="' + (i < idx ? 'done' : i === idx ? 'on' : '') + '">' + ICU.HANDOVER_STATUS[f].label + '</span>').join('<i></i>') + '</div>' +
      '<div class="sum-grid"><div>' +
      '<section class="card">' + check + '</section>' +
      '<section class="card"><h3 class="sub-t">ดำเนินการ</h3><div class="btns col">' + actions + '</div></section>' +
      '<section class="card"><h3 class="sub-t">ความคืบหน้า</h3>' + ICU.progressGrid(v) + '</section></div>' +
      '<div><section class="card"><div class="row-between"><h3 class="sub-t">สรุปสำหรับส่งต่อ</h3><div class="btns">' +
      '<button class="btn ghost sm" data-act="line">' + ICU.ui.icon('share') + 'ส่ง LINE</button>' +
      '<button class="btn ghost sm" data-act="copy">' + ICU.ui.icon('copy') + 'คัดลอกฉบับเต็ม</button>' +
      '<a class="btn primary sm" href="#/print/' + h.id + '">' + ICU.ui.icon('print') + 'พิมพ์ฟอร์ม A4</a></div></div>' +
      '<pre class="sum-text">' + esc(ICU.summaryText(h, p)) + '</pre></section>' +
      '<details class="card"><summary class="sub-t">ประวัติการแก้ไขบันทึกนี้</summary><ul class="audit">' + log + '</ul></details></div></div>';
  }

  /* ---------------------------------------------------------------- view */
  ICU.views.handover = function (params) {
    const h = S.handover(params[0]);
    if (!h) return { redirect: '#/home' };
    const p = S.patient(h.patientId) || { id: '', name: '(ไม่พบผู้ป่วย)', hn: '' };
    const step = ICU.STEPS.some(s => s.id === params[1]) ? params[1] : 'fancas';
    const locked = h.status === 'handed_over' || !!h.deletedAt;
    const v = ICU.validate(h, p);
    const si = ICU.STEPS.findIndex(s => s.id === step);
    const key = h.id + step;
    const keepScroll = ICU._lastEditor === key;
    ICU._lastEditor = key;

    const stepCount = id => id === 'summary' ? '' : ICU.ui.count(v[id]);
    const stepDone = id => id === 'summary' ? v.complete : (v[id].na || v[id].done === v[id].total);
    const stepper = '<nav class="stepper" id="stepper">' + ICU.STEPS.map(s =>
      '<a href="#/handover/' + h.id + '/' + s.id + '" class="' + (s.id === step ? 'on ' : '') + (stepDone(s.id) ? 'done' : '') + '" data-step="' + s.id + '">' +
      '<span class="st-no">' + (stepDone(s.id) ? ICU.ui.icon('check', 14) : s.no) + '</span><span class="st-l">' + s.label + '</span><small class="st-c">' + stepCount(s.id) + '</small></a>').join('') + '</nav>';
    const sideExtra = '<div class="side-sub"><span>บันทึกส่งเวร</span>' + ICU.STEPS.map(s =>
      '<a href="#/handover/' + h.id + '/' + s.id + '" class="' + (s.id === step ? 'on' : '') + '">' + s.no + '. ' + s.label + '</a>').join('') + '</div>';

    const body = step === 'fancas' ? stepFancas(h) : step === 'fasthugbid' ? stepFH(h) : step === 'dope' ? stepDope(h) : step === 'care' ? stepCare(h) : stepSummary(h, p, v);
    const prev = si > 0 ? '#/handover/' + h.id + '/' + ICU.STEPS[si - 1].id : '#/home?date=' + h.date + '&shift=' + h.shift;
    const next = si < ICU.STEPS.length - 1 ? '#/handover/' + h.id + '/' + ICU.STEPS[si + 1].id : '';
    const shiftOpts = ICU.SHIFTS.concat(ICU.SHIFTS.some(s => s.id === h.shift) ? [] : [U.shift(h.shift)]).map(s => '<option value="' + s.id + '"' + (s.id === h.shift ? ' selected' : '') + '>' + s.label + ' (' + s.time + ')</option>').join('');

    return {
      title: ICU.STEPS[si].label + ' · ' + p.name, nav: 'home', back: prev, sideExtra, keepScroll,
      html:
        '<div class="card ho-head">' + ICU.ui.avatar(p.name) + '<div class="ho-who"><a href="#/patient/' + p.id + '"><b>' + esc(p.name) + '</b></a>' +
        '<small>' + ICU.patientMeta(p) + ' · ' + esc(p.bed || '-') + '</small></div>' +
        '<div class="ho-st"><span id="ho-badge">' + ICU.ui.badge(h.status) + '</span><small class="muted" id="save-ind">' + (locked ? 'ล็อกแล้ว' : 'บันทึกอัตโนมัติ') + '</small></div></div>' +
        (h.deletedAt ? '<div class="notice">' + ICU.ui.icon('trash', 18) + '<span>บันทึกนี้อยู่ในถังขยะ (ลบโดย ' + esc(h.deletedBy || '-') + ') · กู้คืน / ลบถาวร ได้ที่หน้า "สรุป"</span></div>' : '') +
        (h.amendsId ? '<div class="notice info">บันทึกแก้ไข (amendment) ของบันทึกที่ส่งเวรแล้ว · เหตุผล: ' + esc(h.amendReason || '-') + '</div>' : '') +
        (locked && !h.deletedAt && step !== 'summary' ? '<div class="notice">' + ICU.ui.icon('shield', 18) + '<span>บันทึกนี้ส่งเวรแล้ว แก้ไขไม่ได้ · ถ้าต้องแก้ ให้ไปที่ "สรุป" → "สร้างบันทึกแก้ไข"</span></div>' : '') +
        '<details class="card ho-meta"' + (window.innerWidth > 900 ? ' open' : '') + '><summary class="sub-t">ข้อมูลการส่งเวร · เวร' + U.shift(h.shift).label + ' ' + U.thaiDate(h.date) + '</summary>' +
        '<fieldset class="grid g5"' + (locked ? ' disabled' : '') + '>' +
        '<label class="fld">วันที่<input type="date" data-path="date" value="' + esc(h.date) + '"></label>' +
        '<label class="fld">เวร<select data-path="shift">' + shiftOpts + '</select></label>' +
        '<label class="fld">เวลา<input type="time" data-path="time" value="' + esc(h.time) + '"></label>' +
        '<label class="fld">ผู้ส่งเวร *' + txt('giver', h.giver) + '</label>' +
        '<label class="fld">ผู้รับเวร' + txt('receiver', h.receiver) + '</label></fieldset></details>' +
        stepper +
        '<fieldset class="ho-body"' + (locked && step !== 'summary' ? ' disabled' : '') + '>' + body + '</fieldset>' +
        '<div class="action-bar sticky"><a class="btn ghost" href="' + prev + '">' + ICU.ui.icon('back') + 'ย้อนกลับ</a>' +
        (step !== 'summary' && !locked ? '<button class="btn ghost" type="button" id="save-draft">บันทึกร่าง</button>' : '') +
        (next ? '<a class="btn primary" href="' + next + '">ถัดไป' + ICU.ui.icon('next') + '</a>' : '<a class="btn primary" href="#/print/' + h.id + '">' + ICU.ui.icon('print') + 'พิมพ์ A4</a>') + '</div>',

      mount(el) {
        const pending = {};
        let timer = null;
        const ind = el.querySelector('#save-ind');

        function refresh() {
          const cur = S.handover(h.id);
          const nv = ICU.validate(cur, p);
          el.querySelector('#ho-badge').innerHTML = ICU.ui.badge(cur.status);
          ICU.STEPS.forEach(s => {
            const a = el.querySelector('#stepper [data-step="' + s.id + '"]');
            const done = s.id === 'summary' ? nv.complete : (nv[s.id].na || nv[s.id].done === nv[s.id].total);
            a.classList.toggle('done', done);
            a.querySelector('.st-no').innerHTML = done ? ICU.ui.icon('check', 14) : s.no;
            a.querySelector('.st-c').textContent = s.id === 'summary' ? '' : ICU.ui.count(nv[s.id]);
          });
          /* sync radios / checkboxes changed by side effects */
          el.querySelectorAll('.ho-body input[type=radio][data-path], .ho-body input[type=checkbox][data-path]').forEach(i => {
            const val = getPath(cur, i.dataset.path);
            if (i.type === 'checkbox') i.checked = !!val;
            else i.checked = String(val == null ? '' : val === true ? 'yes' : val === false ? 'no' : val) === i.value;
          });
          el.querySelectorAll('[data-domain]').forEach(d => {
            const f = cur.fancas[d.dataset.domain];
            d.className = d.className.replace(/st-\w+/, 'st-' + f.state);
            d.querySelector('.fan-st').textContent = ICU.FANCAS_STATES.find(s => s.id === f.state).label;
          });
          el.querySelectorAll('.fh-row').forEach((r, i) => { r.className = r.className.replace(/st-\w+/, 'st-' + cur.fasthugbid[ICU.FASTHUGBID[i].id].state); });
          el.querySelectorAll('.dope-card').forEach((c, i) => { c.className = c.className.replace(/st-\w+/, 'st-' + cur.dope.items[ICU.DOPE[i].id].result); });
          ind.textContent = 'บันทึกแล้ว ' + U.timeStr(new Date());
        }

        function apply(path, value) {
          const r = S.updateHandover(h.id, x => {
            setPath(x, path, value);
            const m = path.match(/^fancas\.(\w+)\.items\.(\w+)$/);
            if (m && value && x.fancas[m[1]].state !== 'problem') x.fancas[m[1]].state = 'problem';
            if (m && m[1] === 'aeration' && m[2] === 'ett_mv' && value && x.dope.onVentilator == null) x.dope.onVentilator = true;
            const v2 = path.match(/^fancas\.(\w+)\.values\.(\w+)$/);
            if (v2 && String(value).trim()) { x.fancas[v2[1]].items[v2[2]] = true; if (x.fancas[v2[1]].state !== 'problem') x.fancas[v2[1]].state = 'problem'; }
            const v3 = path.match(/^care\.(monitoring|plan)Values\.(\w+)$/);
            if (v3 && String(value).trim()) x.care[v3[1]][v3[2]] = true;
            const fh = path.match(/^fasthugbid\.(\w+)\.(finding|state)$/);
            if (fh && fh[2] === 'finding' && value != null) x.fasthugbid[fh[1]].state = 'assessed';
            if (fh && fh[2] === 'state' && value !== 'assessed') x.fasthugbid[fh[1]].finding = null;
          });
          if (r === false) { ICU.ui.toast('บันทึกนี้ล็อกแล้ว แก้ไขไม่ได้', 'error'); return; }
          if (r === 'reopened') ICU.ui.toast('แก้ไขหลังส่งตรวจ: สถานะกลับเป็น In Progress');
          if (path === 'dope.onVentilator' || path === 'date' || path === 'shift') { ICU._lastEditor = key; ICU.render(); return; }
          refresh();
        }
        function flush() {
          clearTimeout(timer);
          Object.keys(pending).forEach(k => { apply(k, pending[k]); delete pending[k]; });
        }
        ICU.beforeLeave = flush;

        function valueOf(i) {
          const path = i.dataset.path;
          if (i.type === 'checkbox') return i.checked;
          if (path === 'dope.onVentilator') return i.value === 'yes';
          if (/\.finding$/.test(path) && /^fasthugbid/.test(path)) return i.value === '' ? null : +i.value;
          return i.value;
        }
        el.addEventListener('change', e => {
          const i = e.target;
          if (!i.dataset || !i.dataset.path) return;
          if (i.type === 'radio' && !i.checked) return;
          if (i.type === 'text' || i.tagName === 'TEXTAREA') { pending[i.dataset.path] = i.value; flush(); return; }
          apply(i.dataset.path, valueOf(i));
        });
        el.addEventListener('input', e => {
          const i = e.target;
          if (!i.dataset || !i.dataset.path || !(i.type === 'text' || i.tagName === 'TEXTAREA')) return;
          pending[i.dataset.path] = i.value;
          ind.textContent = 'กำลังบันทึก...';
          clearTimeout(timer);
          timer = setTimeout(flush, 600);
        });
        const sd = el.querySelector('#save-draft');
        if (sd) sd.onclick = () => { flush(); ICU.ui.toast('บันทึกฉบับร่างแล้ว', 'ok'); };

        /* tasks */
        const me = () => S.settings().userName || 'ไม่ระบุชื่อ';
        const taskChange = fn => {
          flush();
          const r = S.updateHandover(h.id, x => { x.care.tasks = (x.care.tasks || []).map(t => Object.assign({}, t)); fn(x.care.tasks, x); });
          if (r === false) return ICU.ui.toast('บันทึกนี้ล็อกแล้ว แก้ไขไม่ได้', 'error');
          ICU._lastEditor = key; ICU.render();
        };
        const addBtn = el.querySelector('#task-add');
        if (addBtn) {
          const tx = el.querySelector('#task-text'), due = el.querySelector('#task-due');
          const add = () => {
            const text = tx.value.trim();
            if (!text) return tx.focus();
            taskChange(ts => ts.push({ id: U.uid('t'), text, due: due.value || '', done: false, createdBy: me(), createdAt: U.now() }));
            const n = document.getElementById('task-text'); if (n) n.focus();
          };
          addBtn.onclick = add;
          tx.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
        }
        el.querySelectorAll('[data-task-done]').forEach(c => {
          c.onchange = () => taskChange(ts => { const t = ts.find(x => x.id === c.dataset.taskDone); if (t) Object.assign(t, c.checked ? { done: true, doneBy: me(), doneAt: U.now() } : { done: false, doneBy: '', doneAt: '' }); });
        });
        el.querySelectorAll('[data-task-del]').forEach(b => {
          b.onclick = () => taskChange(ts => { const i = ts.findIndex(x => x.id === b.dataset.taskDel); if (i >= 0) ts.splice(i, 1); });
        });

        el.querySelectorAll('[data-act]').forEach(b => { b.onclick = () => act(b.dataset.act); });
        async function act(a) {
          const cur = S.handover(h.id);
          if (a === 'copy') return ICU.ui.copy(ICU.summaryText(cur, p));
          if (a === 'line') return ICU.ui.share(ICU.lineText(cur, p), 'ส่งเวร ' + (p.bed || ''));
          if (a === 'review') {
            if (!ICU.validate(cur, p).complete) return ICU.ui.toast('ข้อมูลยังไม่ครบ', 'error');
            S.setStatus(h.id, 'ready_for_review'); ICU.ui.toast('ส่งตรวจสอบแล้ว (Ready for Review)', 'ok'); return ICU.render();
          }
          if (a === 'reopen') { S.setStatus(h.id, 'in_progress'); return ICU.render(); }
          if (a === 'discard') {
            if (!await ICU.ui.confirm('ลบฉบับร่าง', 'ลบบันทึกฉบับร่างนี้ (ยังไม่มีการกรอกข้อมูล)', 'ลบ', true)) return;
            S.deleteDraft(h.id); return ICU.ui.go('#/home?date=' + h.date + '&shift=' + h.shift);
          }
          if (a === 'submit') {
            if (!ICU.validate(cur, p).complete) return ICU.ui.toast('ข้อมูลยังไม่ครบ', 'error');
            const fd = await ICU.ui.dialog({
              title: 'ยืนยันส่งเวร', ok: 'ยืนยันส่งเวร',
              html: '<label class="fld">ชื่อผู้รับเวร *<input name="receiver" required value="' + esc(cur.receiver) + '"></label>' +
                '<label class="ck"><input type="checkbox" name="ok" required><span>ผู้ส่งและผู้รับเวรตรวจสอบข้อมูลร่วมกันแล้ว</span></label>' +
                '<p class="hint">หลังยืนยัน บันทึกนี้จะถูกล็อก ถ้าต้องแก้ต้องสร้างบันทึกแก้ไขพร้อมเหตุผล</p>'
            });
            if (!fd) return;
            S.setStatus(h.id, 'handed_over', { receiver: fd.get('receiver').trim() });
            ICU.ui.toast('ส่งเวรเรียบร้อย', 'ok');
            return ICU.render();
          }
          if (a === 'trash') return ICU.trashHandover(h.id, '#/history');
          if (a === 'restore') return ICU.restoreHandover(h.id);
          if (a === 'purge') return ICU.purgeHandover(h.id, '#/history?view=trash');
          if (a === 'amend') {
            const fd = await ICU.ui.dialog({ title: 'สร้างบันทึกแก้ไข', ok: 'สร้าง',
              html: '<p>บันทึกเดิมจะยังอยู่ (ไม่ถูกเขียนทับ) ระบบจะสร้างสำเนาใหม่ให้แก้ไขแล้วส่งเวรอีกครั้ง</p><label class="fld">เหตุผลที่ต้องแก้ไข *<textarea name="reason" required rows="3"></textarea></label>' });
            if (!fd) return;
            const n = S.amend(h.id, fd.get('reason').trim());
            return ICU.ui.go('#/handover/' + n.id + '/fancas');
          }
        }
      }
    };
  };
})();
