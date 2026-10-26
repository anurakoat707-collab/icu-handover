/* ICU Handover - completeness check + text summary.
   Checks only whether the form is filled in; it never judges the treatment. */
(function () {
  'use strict';
  const U = ICU.util;

  function itemText(def, sel, values) {
    return def.filter(it => sel[it.id]).map(it => {
      const v = (values || {})[it.id];
      return it.label + (v ? ' (' + (it.input && it.input !== 'ระบุ' ? it.input + ' ' : '') + v + ')' : '');
    });
  }
  ICU.itemText = itemText;

  ICU.validate = function (h, p) {
    const R = { info: { missing: [] }, fancas: { missing: [] }, fasthugbid: { missing: [] }, dope: { missing: [] }, care: { missing: [] } };

    if (!p || !p.name) R.info.missing.push('ชื่อผู้ป่วย');
    if (!p || !p.bed) R.info.missing.push('ห้อง / เตียง');
    if (!h.date) R.info.missing.push('วันที่');
    if (!h.shift) R.info.missing.push('เวร');
    if (!String(h.giver || '').trim()) R.info.missing.push('ผู้ส่งเวร');

    let fd = 0;
    ICU.FANCAS.forEach(g => {
      const f = h.fancas[g.id];
      const anyItem = Object.keys(f.items).some(k => f.items[k]);
      if (f.state === 'not_assessed') R.fancas.missing.push(g.letter + ' ' + g.en + ': ยังไม่ประเมิน');
      else if (f.state === 'problem' && !anyItem && !f.detail.trim()) R.fancas.missing.push(g.letter + ' ' + g.en + ': เลือก "มีปัญหา" แต่ยังไม่ระบุรายการ');
      else fd++;
    });
    Object.assign(R.fancas, { done: fd, total: ICU.FANCAS.length });

    let hd = 0;
    ICU.FASTHUGBID.forEach(f => {
      const x = h.fasthugbid[f.id];
      if (x.state === 'not_assessed') R.fasthugbid.missing.push(f.en + ': ยังไม่ได้ประเมิน');
      else if (x.state === 'assessed' && x.finding == null) R.fasthugbid.missing.push(f.en + ': ประเมินแล้ว แต่ยังไม่เลือกสิ่งที่พบ');
      else hd++;
    });
    Object.assign(R.fasthugbid, { done: hd, total: ICU.FASTHUGBID.length });

    let dd = 0;
    if (h.dope.onVentilator == null) {
      R.dope.missing.push('ระบุว่าผู้ป่วยใช้เครื่องช่วยหายใจหรือไม่');
      Object.assign(R.dope, { done: 0, total: 4 });
    } else if (!h.dope.onVentilator) {
      Object.assign(R.dope, { done: 0, total: 0, na: true });
    } else {
      ICU.DOPE.forEach(d => {
        const x = h.dope.items[d.id];
        if (x.result === 'not_assessed') R.dope.missing.push(d.id + ' ' + d.en + ': ยังไม่ได้ประเมิน');
        else if (x.result === 'found' && !x.action.trim()) R.dope.missing.push(d.id + ' ' + d.en + ': พบ แต่ยังไม่บันทึกการดำเนินการ');
        else dd++;
      });
      Object.assign(R.dope, { done: dd, total: 4 });
    }

    const c = h.care;
    let cd = 0;
    if (c.reason.trim()) cd++; else R.care.missing.push('A. เหตุผลการรับไว้ใน ICU');
    if (Object.keys(c.monitoring).some(k => c.monitoring[k])) cd++; else R.care.missing.push('B. เลือกรายการเฝ้าระวังอย่างน้อย 1 ข้อ');
    if (Object.keys(c.plan).some(k => c.plan[k]) || c.pendingTasks.trim() || (c.tasks || []).length) cd++; else R.care.missing.push('C. แผนการดูแลต่อเนื่องอย่างน้อย 1 ข้อ');
    Object.assign(R.care, { done: cd, total: 3 });

    const stepOf = { info: 'fancas', fancas: 'fancas', fasthugbid: 'fasthugbid', dope: 'dope', care: 'care' };
    const names = { info: 'ข้อมูลผู้ป่วย / เวร', fancas: 'FANCAS', fasthugbid: 'FASTHUGBID', dope: 'DOPE', care: 'แผนการดูแล' };
    R.missing = [];
    Object.keys(stepOf).forEach(k => R[k].missing.forEach(m => R.missing.push({ step: stepOf[k], section: names[k], text: m, info: k === 'info' })));
    R.complete = R.missing.length === 0;
    return R;
  };

  /* plain-text summary for copy / paste */
  ICU.summaryText = function (h, p) {
    const L = [];
    const sh = U.shift(h.shift);
    L.push('สรุปการส่งเวร ICU (ICU Handover Summary)');
    L.push(p.name + (p.hn ? ' | HN ' + p.hn : '') + (p.an ? ' | AN ' + p.an : '') + ' | ' + U.sexLabel(p.sex) + ' ' + (p.age || '-') + ' ปี' + (p.weight ? ' | ' + p.weight + ' กก.' : ''));
    L.push('เตียง ' + (p.bed || '-') + ' | เวร' + sh.label + ' ' + U.thaiDate(h.date) + ' ' + (h.time || '') + ' น.');
    L.push('ผู้ส่งเวร: ' + (h.giver || '-') + ' | ผู้รับเวร: ' + (h.receiver || '-') + ' | สถานะ: ' + ICU.HANDOVER_STATUS[h.status].label);
    if (p.isDemo || h.isDemo) L.push('*** ข้อมูลสมมติ (DEMO) ***');
    L.push('');
    L.push('เหตุผลรับไว้ใน ICU: ' + (h.care.reason || '-'));
    L.push('');
    L.push('[FANCAS]');
    ICU.FANCAS.forEach(g => {
      const f = h.fancas[g.id];
      const st = f.state === 'no_problem' ? 'ไม่พบปัญหา' : f.state === 'not_assessed' ? 'ยังไม่ประเมิน' : itemText(g.items, f.items, f.values).join(', ') || 'มีปัญหา';
      L.push(g.letter + ' ' + g.en + ': ' + st + (f.detail ? ' - ' + f.detail : ''));
    });
    L.push('');
    L.push('[FASTHUGBID]');
    ICU.FASTHUGBID.forEach(f => {
      const x = h.fasthugbid[f.id];
      const st = x.state === 'assessed' ? (x.finding != null ? f.opts[x.finding] : 'ประเมินแล้ว') : ICU.FH_STATES.find(s => s.id === x.state).label;
      L.push(f.letter + ' ' + f.en + ': ' + st + (x.note ? ' - ' + x.note : ''));
    });
    L.push('');
    L.push('[DOPE]');
    if (h.dope.onVentilator == null) L.push('ยังไม่ระบุการใช้เครื่องช่วยหายใจ');
    else if (!h.dope.onVentilator) L.push('ไม่ได้ใช้เครื่องช่วยหายใจ');
    else {
      ICU.DOPE.forEach(d => {
        const x = h.dope.items[d.id];
        L.push(d.id + ' ' + d.en + ': ' + ICU.DOPE_RESULTS.find(r => r.id === x.result).label + (x.finding ? ' - ' + x.finding : '') + (x.action ? ' / ดำเนินการ: ' + x.action : ''));
      });
      if (h.dope.summary) L.push('สรุป: ' + h.dope.summary);
    }
    L.push('');
    const mon = itemText(ICU.MONITORING, h.care.monitoring, h.care.monitoringValues);
    const plan = itemText(ICU.PLAN, h.care.plan, h.care.planValues);
    L.push('[เฝ้าระวัง] ' + (mon.join(', ') || '-') + (h.care.monitoringNote ? ' - ' + h.care.monitoringNote : ''));
    L.push('[แผนการดูแล] ' + (plan.join(', ') || '-'));
    taskLines(h).forEach(t => L.push(t));
    if (h.care.pendingTasks) L.push('[งานที่ยังไม่เสร็จ / ต้องติดตาม] ' + h.care.pendingTasks);
    if (h.care.nextShiftNote) L.push('[ข้อมูลสำคัญสำหรับเวรถัดไป] ' + h.care.nextShiftNote);
    return L.join('\n');
  };

  function taskLines(h) {
    const ts = (h.care && h.care.tasks) || [];
    if (!ts.length) return [];
    return ['[งานที่ต้องติดตาม]'].concat(ts.map(t => (t.done ? '☑ ' : '☐ ') + (t.due ? t.due + ' ' : '') + t.text + (t.done ? ' (เสร็จ ' + (t.doneBy || '') + ')' : '')));
  }
  ICU.taskLines = taskLines;

  /* problems worth saying out loud: FANCAS with problems, FASTHUGBID "second box", DOPE found */
  ICU.keyPoints = function (h) {
    const out = [];
    ICU.FANCAS.forEach(g => {
      const f = h.fancas[g.id];
      if (f.state === 'problem') out.push(g.letter + ': ' + (itemText(g.items, f.items, f.values).join(', ') || f.detail || 'มีปัญหา'));
    });
    const fh = ICU.FASTHUGBID.filter(f => h.fasthugbid[f.id].state === 'assessed' && h.fasthugbid[f.id].finding === 1)
      .map(f => f.en + ' ' + f.opts[1] + (h.fasthugbid[f.id].note ? ' (' + h.fasthugbid[f.id].note + ')' : ''));
    if (fh.length) out.push('FASTHUGBID: ' + fh.join(', '));
    if (h.dope.onVentilator) {
      const found = ICU.DOPE.filter(d => h.dope.items[d.id].result === 'found').map(d => d.en + (h.dope.items[d.id].action ? ' → ' + h.dope.items[d.id].action : ''));
      if (found.length) out.push('DOPE: ' + found.join(', '));
    }
    return out;
  };

  /* short text for LINE (one bed) */
  ICU.lineText = function (h, p) {
    const L = ['🛏 ' + (p.bed || '-') + ' · ' + p.name + ' (' + (p.age || '-') + ' ปี ' + U.sexLabel(p.sex) + ')'];
    if (h.care.reason) L.push('Dx/เหตุผล: ' + h.care.reason);
    ICU.keyPoints(h).forEach(k => L.push('• ' + k));
    const mon = itemText(ICU.MONITORING, h.care.monitoring, h.care.monitoringValues);
    if (mon.length) L.push('⚠ เฝ้าระวัง: ' + mon.join(', '));
    ICU.openTasksOf(h).forEach(t => L.push('☐ ' + (t.due ? t.due + ' ' : '') + t.text));
    if (h.care.pendingTasks) L.push('☐ ' + h.care.pendingTasks);
    if (h.care.nextShiftNote) L.push('➡ ' + h.care.nextShiftNote);
    return L.join('\n');
  };
  ICU.openTasksOf = h => ((h.care && h.care.tasks) || []).filter(t => !t.done);

  /* the whole shift for LINE */
  ICU.shiftLineText = function (date, shift, rows) {
    const L = ['📋 ส่งเวร' + U.shift(shift).label + ' ' + U.thaiDate(date) + ' (' + U.shift(shift).time + ')', ''];
    rows.forEach(r => { L.push(r.h ? ICU.lineText(r.h, r.p) : '🛏 ' + (r.p.bed || '-') + ' · ' + r.p.name + ' - ยังไม่มีบันทึกเวรนี้'); L.push(''); });
    return L.join('\n').trim();
  };
})();
