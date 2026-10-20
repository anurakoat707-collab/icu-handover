/* ICU Handover - A4 paper form, laid out like the original "ICU Handover Checklist".
   #/print/<handover id>  = filled form,  #/print/blank = empty form for handwriting. */
(function () {
  'use strict';
  const U = ICU.util, S = ICU.store, esc = U.esc;
  ICU.views = ICU.views || {};

  const cb = on => '<span class="pp-cb' + (on ? ' on' : '') + '">' + (on ? '✓' : '') + '</span>';
  const line = (v, w) => '<span class="pp-line"' + (w ? ' style="min-width:' + w + '"' : '') + '>' + esc(v == null ? '' : v) + '</span>';
  function items(def, sel, values) {
    return def.map(it => {
      const v = (values || {})[it.id];
      return '<div class="pp-it">' + cb(sel[it.id]) + '<span>' + esc(it.label) + '</span>' +
        (it.input ? ' ' + (it.input !== 'ระบุ' ? '<small>' + esc(it.input) + '</small> ' : '') + line(v, '18mm') : '') + '</div>';
    }).join('');
  }

  ICU.paperHTML = function (h, p, blank) {
    const st = S.settings();
    const fh = h.fasthugbid, d = h.dope, c = h.care;
    const fhIcons = { feeding: '🍽', analgesia: '◔', sedation: '💉', thrombo: '🩸', hob: '🛏', ulcer: '⊙', glycemic: '🩸', sbt: '🫁', bowel: '⌇', catheter: '⟟', deescalation: '💊' };

    /* DOPE summary line */
    let dopeNone = false, dopeProb = false, dopeText = '';
    if (!blank) {
      if (d.onVentilator === false) dopeText = 'ไม่ได้ใช้เครื่องช่วยหายใจ';
      else if (d.onVentilator) {
        const found = ICU.DOPE.filter(x => d.items[x.id].result === 'found');
        const allNo = ICU.DOPE.every(x => d.items[x.id].result === 'not_found');
        dopeProb = found.length > 0; dopeNone = allNo;
        dopeText = found.map(x => x.id + ': ' + [d.items[x.id].finding, d.items[x.id].action].filter(Boolean).join(' / ')).join('; ');
        if (d.summary) dopeText = (dopeText ? dopeText + ' · ' : '') + d.summary;
      }
    }

    const fancas = ICU.FANCAS.map(g => {
      const f = h.fancas[g.id];
      return '<div class="pp-fan"><div class="pp-fan-h"><span class="pp-letter">' + g.letter + '</span><div><b>' + g.en + '</b><small>' + g.th + '</small>' +
        (f.state === 'no_problem' ? '<em class="pp-np">✓ ไม่พบปัญหา</em>' : '') + '</div></div>' +
        '<div class="pp-fan-i">' + items(g.items, f.items, f.values) + (f.detail ? '<div class="pp-detail">' + esc(f.detail) + '</div>' : '') + '</div></div>';
    }).join('');

    const fhRows = ICU.FASTHUGBID.map(f => {
      const x = fh[f.id];
      const note = x.state === 'not_applicable' ? 'ไม่เกี่ยวข้อง' + (x.note ? ' - ' + x.note : '') : x.note;
      return '<tr><td class="pp-l"><span class="pp-letter sm">' + f.letter + '</span></td><td class="pp-n"><b>' + f.en + '</b><small>' + f.th + '</small></td>' +
        '<td class="pp-ic">' + (fhIcons[f.id] || '') + '</td>' +
        '<td class="pp-o">' + cb(x.state === 'assessed' && x.finding === 0) + esc(f.opts[0]) + '</td>' +
        '<td class="pp-o">' + cb(x.state === 'assessed' && x.finding === 1) + esc(f.opts[1]) + '</td>' +
        '<td class="pp-note">' + esc(note || '') + '</td></tr>';
    }).join('');

    const dopeBoxes = ICU.DOPE.map(x => {
      const r = d.items[x.id];
      return '<div class="pp-dope-b' + (r.result === 'found' ? ' found' : '') + '"><div class="pp-dope-t"><span class="pp-letter sm">' + x.id + '</span><b>' + x.en + '</b></div>' +
        '<small>' + x.th + '</small>' + cb(r.result === 'found') + '</div>';
    }).join('');

    const extra = [c.pendingTasks && 'งานค้าง / ติดตาม: ' + c.pendingTasks, c.nextShiftNote && 'เวรถัดไป: ' + c.nextShiftNote, c.monitoringNote && 'เฝ้าระวัง: ' + c.monitoringNote].filter(Boolean);

    return '<div class="a4' + ((p.isDemo || h.isDemo) ? ' is-demo' : '') + '">' +
      ((p.isDemo || h.isDemo) ? '<div class="pp-wm">ข้อมูลสมมติ · DEMO</div>' : '') +
      '<header class="pp-head">' +
      '<div class="pp-logo"><span>ICU</span></div>' +
      '<div class="pp-hosp"><b>' + esc(st.hospital) + '</b><small>' + esc(st.hospitalEn) + '</small><small>' + esc(st.ward) + '</small></div>' +
      '<div class="pp-title"><b>แบบส่งเวรผู้ป่วยวิกฤต</b><span>(ICU HANDOVER CHECKLIST)</span>' +
      '<div class="pp-tags"><i>FANCAS</i><i>FASTHUGBID</i><i>DOPE</i><i>สิ่งที่ต้องเฝ้าระวัง</i></div></div>' +
      '<div class="pp-when"><div>วันที่ ' + line(blank ? '' : U.thaiDate(h.date), '24mm') + ' เวลา ' + line(blank ? '' : h.time, '12mm') + ' น.</div>' +
      '<div>ห้อง ICU / เตียงที่ ' + line(p.bed, '26mm') + '</div>' +
      '<div>การส่งเวร ' + ['morning', 'afternoon', 'night'].map(s => cb(!blank && h.shift === s) + U.shift(s).label).join(' ') + '</div></div>' +
      '</header>' +
      '<div class="pp-pt"><span>ชื่อ-สกุลผู้ป่วย ' + line(p.name, '62mm') + '</span><span>HN ' + line(p.hn, '24mm') + '</span><span>AN ' + line(p.an, '24mm') + '</span>' +
      '<span>เพศ ' + cb(p.sex === 'M') + 'ชาย ' + cb(p.sex === 'F') + 'หญิง</span><span>อายุ ' + line(p.age, '9mm') + ' ปี</span><span>น้ำหนัก ' + line(p.weight, '10mm') + ' กก.</span></div>' +

      '<div class="pp-body">' +
      '<section class="pp-sec pp-s1"><h3><span class="pp-num">1</span>FANCAS : สรุปปัญหาผู้ป่วยแบบองค์รวม</h3>' +
      '<p class="pp-sub">เน้นปัญหาที่เกี่ยวข้องกับ Septic shock / Pneumonia with ARDS และสิ่งที่ต้องดูแลต่อเนื่อง</p>' + fancas + '</section>' +

      '<div class="pp-right">' +
      '<section class="pp-sec pp-s2"><h3><span class="pp-num">2</span>FASTHUGBID : ประเด็นสำคัญที่ต้องดูแลวันนี้</h3>' +
      '<table class="pp-fh"><thead><tr><th colspan="3"></th><th colspan="2">สิ่งที่พบ</th><th>ปัญหา / เหตุผล</th></tr></thead><tbody>' + fhRows + '</tbody></table></section>' +

      '<section class="pp-sec pp-s3"><h3><span class="pp-num">3</span>DOPE : แนวทางการแก้ไขปัญหาเครื่องช่วยหายใจฉุกเฉิน</h3>' +
      '<div class="pp-dope">' + dopeBoxes + '</div>' +
      '<div class="pp-dope-sum">สรุปปัญหาเครื่องช่วยหายใจ : ' + cb(dopeNone) + 'ไม่มีปัญหา ' + cb(dopeProb) + 'มีปัญหา ระบุ ' + line(dopeText, '40mm') + '</div></section>' +
      '</div>' +

      '<section class="pp-sec pp-s4"><h3><span class="pp-num">4</span>เหตุผลการรับไว้ใน ICU <small>(Chief complaint / Reason for ICU admission)</small></h3>' +
      '<div class="pp-lines">' + esc(c.reason || '') + (extra.length ? '<div class="pp-extra">' + extra.map(esc).join('<br>') + '</div>' : '') + '</div></section>' +

      '<section class="pp-sec pp-s5"><h3><span class="pp-num">5</span>สิ่งที่ต้องเฝ้าระวังต่อ / แผนการดูแลต่อเนื่อง</h3>' +
      '<div class="pp-two"><div><h4>⚠ ประเด็นสำคัญที่ต้องเฝ้าระวัง</h4>' + items(ICU.MONITORING, c.monitoring, c.monitoringValues) + '</div>' +
      '<div><h4>แผนการดูแล / การติดตามต่อ</h4>' + items(ICU.PLAN, c.plan, c.planValues) + '</div></div></section>' +
      '</div>' +

      '<footer class="pp-foot">' +
      '<div class="pp-sign"><b>หัวหน้าเวร</b> <small>(เฉพาะกรณีย้ายออกจากหอผู้ป่วยวิกฤต)</small> ชื่อ ' + line(h.headNurse.name, '34mm') + ' ตำแหน่ง ' + line(h.headNurse.position, '26mm') +
      ' วันที่ ' + line(blank ? '' : U.thaiDate(h.headNurse.date), '20mm') + ' เวลา ' + line(h.headNurse.time, '12mm') + '</div>' +
      '<div class="pp-sign">ผู้ส่งเวร ' + line(h.giver, '40mm') + ' ผู้รับเวร ' + line(h.receiver, '40mm') +
      (blank ? '' : '<span class="pp-meta">สถานะ: ' + ICU.HANDOVER_STATUS[h.status].label + (h.amendsId ? ' (บันทึกแก้ไข)' : '') + ' · พิมพ์ ' + U.thaiDateTime(U.now()) + '</span>') + '</div>' +
      '<div class="pp-disc">พิมพ์จากระบบ ICU Handover · ใช้ประกอบการส่งเวรเท่านั้น ไม่ใช่คำแนะนำการรักษา · บุคลากรต้องตรวจสอบความถูกต้องก่อนใช้งาน</div>' +
      '</footer></div>';
  };

  ICU.views.print = function (params) {
    const blank = params[0] === 'blank';
    const h = blank ? Object.assign(ICU.emptyHandover(), { date: '', shift: '', time: '', giver: '', receiver: '', status: 'draft' }) : S.handover(params[0]);
    if (!h) return { redirect: '#/home' };
    const p = blank ? {} : (S.patient(h.patientId) || {});
    const back = blank ? '#/settings' : '#/handover/' + h.id + '/summary';
    const v = blank ? null : ICU.validate(h, p);
    return {
      title: blank ? 'แบบฟอร์มเปล่า A4' : 'พิมพ์ A4 · ' + (p.name || ''), nav: blank ? 'settings' : 'home', back,
      html: '<div class="pp-toolbar no-print"><a class="btn ghost" href="' + back + '">' + ICU.ui.icon('back') + 'กลับ</a>' +
        '<div class="pp-tb-info">' + (blank ? 'แบบฟอร์มเปล่าสำหรับเขียนด้วยมือ' : ICU.ui.badge(h.status) + (v.complete ? '' : ' <span class="badge red">ยังกรอกไม่ครบ ' + v.missing.length + ' รายการ</span>')) +
        '<small>กดพิมพ์ แล้วเลือก "Save as PDF / บันทึกเป็น PDF" ได้ · ขนาด A4 แนวตั้ง</small></div>' +
        '<button class="btn primary" id="do-print">' + ICU.ui.icon('print') + 'พิมพ์ / PDF</button></div>' +
        '<div class="a4-wrap" id="a4-wrap">' + ICU.paperHTML(h, p, blank) + '</div>',
      mount(el) {
        const wrap = el.querySelector('#a4-wrap'), sheet = wrap.querySelector('.a4');
        const fit = () => {
          sheet.style.transform = '';
          const s = Math.min(1, wrap.clientWidth / sheet.offsetWidth);
          sheet.style.transform = s < 1 ? 'scale(' + s + ')' : '';
          wrap.style.height = s < 1 ? (sheet.offsetHeight * s) + 'px' : '';
        };
        fit();
        window.addEventListener('resize', fit);
        ICU.beforeLeave = () => window.removeEventListener('resize', fit);
        el.querySelector('#do-print').onclick = () => window.print();
      }
    };
  };
})();
