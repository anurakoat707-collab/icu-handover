/* ICU Handover - FICTIONAL demo data (names / HN / AN are made up).
   Every record carries isDemo: true and can be removed in Settings -> "รีเซ็ตข้อมูลสมมติ". */
window.ICU = window.ICU || {};

ICU.seedDemo = function (db) {
  'use strict';
  const U = ICU.util;
  const today = U.dateStr();
  const cur = U.currentShift();
  const prev = U.prevSlot(today, cur);
  const t = U.now();
  const by = 'ข้อมูลสมมติ';

  const P = [
    { hn: '900101', an: '690201', name: 'นายสมชาย ใจดี', sex: 'M', age: 58, weight: 72, bed: 'ICU-1 / 01', diagnosis: 'Sepsis with septic shock', underlying: 'DM, HT', allergies: 'ไม่มี', days: 2 },
    { hn: '900102', an: '690202', name: 'นางกาญจนา ศรีสุข', sex: 'F', age: 72, weight: 55, bed: 'ICU-1 / 02', diagnosis: 'Pneumonia with ARDS', underlying: 'CKD stage 3', allergies: 'Penicillin', days: 1 },
    { hn: '900103', an: '690203', name: 'นายธนโชติ แสงทอง', sex: 'M', age: 65, weight: 80, bed: 'ICU-2 / 03', diagnosis: 'Post-op CABG', underlying: 'CAD, DLP', allergies: 'ไม่มี', days: 3 },
    { hn: '900104', an: '690204', name: 'นางสาวจันทร์เพ็ญ มาลัย', sex: 'F', age: 45, weight: 60, bed: 'ICU-2 / 04', diagnosis: 'Acute respiratory failure', underlying: 'Asthma', allergies: 'ไม่มี', days: 0 },
    { hn: '900105', an: '690205', name: 'นายวรพงษ์ ศิริวงศ์', sex: 'M', age: 70, weight: 68, bed: 'ICU-3 / 01', diagnosis: 'Acute ischemic stroke', underlying: 'AF, HT', allergies: 'Sulfa', days: 4 },
    { hn: '900106', an: '690206', name: 'นางสาวอรทัย พงษ์ศรี', sex: 'F', age: 62, weight: 58, bed: 'ICU-3 / 02', diagnosis: 'Septic shock (UTI source)', underlying: 'DM', allergies: 'ไม่มี', days: 1 },
    { hn: '900107', an: '690207', name: 'นายภัทรพงษ์ กิตติชร', sex: 'M', age: 50, weight: 75, bed: 'ICU-4 / 01', diagnosis: 'ARDS', underlying: '-', allergies: 'ไม่มี', days: 5, status: 'transferred' },
    { hn: '900108', an: '690208', name: 'นางปิยวรรณ รัตนวงศ์', sex: 'F', age: 68, weight: 50, bed: 'ICU-4 / 02', diagnosis: 'COPD exacerbation', underlying: 'COPD', allergies: 'ไม่มี', days: 6, status: 'discharged' }
  ];

  const ids = P.map(p => {
    const id = U.uid('p');
    db.patients.push({
      id, hn: p.hn, an: p.an, name: p.name, sex: p.sex, age: p.age, weight: p.weight, bed: p.bed,
      admitDate: U.addDays(today, -p.days), admitTime: '10:30', diagnosis: p.diagnosis, underlying: p.underlying,
      allergies: p.allergies, note: '', status: p.status || 'active', isDemo: true,
      createdAt: t, createdBy: by, updatedAt: t, updatedBy: by
    });
    return id;
  });

  /* fill a handover; level: 'full' | 'part' | 'none' */
  function ho(pi, slot, status, level, profile) {
    const h = Object.assign(ICU.emptyHandover(), {
      id: U.uid('h'), patientId: ids[pi], date: slot.date, shift: slot.shift, time: U.shift(slot.shift).time.slice(0, 5),
      giver: ['พว.วิภา', 'พว.สุดา', 'พว.กานดา'][pi % 3], receiver: status === 'handed_over' || status === 'ready_for_review' ? ['พว.มาลี', 'พว.อรุณี', 'พว.ปวีณา'][pi % 3] : '',
      status, isDemo: true, createdAt: t, createdBy: by, updatedAt: t, updatedBy: by
    });
    if (status === 'handed_over') { h.submittedAt = t; h.submittedBy = h.giver; }
    const pr = profile || {};
    const vent = !!pr.vent;
    const fan = pr.fancas || {};
    const fanCount = level === 'full' ? 6 : level === 'part' ? 3 : 0;
    ICU.FANCAS.slice(0, fanCount).forEach(g => {
      const f = h.fancas[g.id];
      const items = fan[g.id];
      if (items) { f.state = 'problem'; items.forEach(x => { if (Array.isArray(x)) { f.items[x[0]] = true; f.values[x[0]] = x[1]; } else f.items[x] = true; }); }
      else f.state = 'no_problem';
    });
    const fhCount = level === 'full' ? 11 : level === 'part' ? 4 : 0;
    ICU.FASTHUGBID.slice(0, fhCount).forEach((f, i) => {
      const issue = (pr.issues || {})[f.id];
      const x = h.fasthugbid[f.id];
      if (f.id === 'sbt' && !vent) { x.state = 'not_applicable'; return; }
      x.state = 'assessed'; x.finding = issue ? 1 : 0; x.note = issue || '';
    });
    h.dope.onVentilator = level === 'none' ? null : vent;
    if (vent && level === 'full') {
      ICU.DOPE.forEach(d => { h.dope.items[d.id].result = 'not_found'; });
      if (pr.dope) Object.assign(h.dope.items[pr.dope.id], { result: 'found', finding: pr.dope.finding, action: pr.dope.action });
      h.dope.summary = pr.dope ? 'พบปัญหา ' + pr.dope.id + ' แก้ไขแล้ว' : 'ไม่มีปัญหา';
    }
    if (level !== 'none') {
      h.care.reason = pr.reason || '';
      (pr.monitoring || []).forEach(m => { h.care.monitoring[m] = true; });
      if (level === 'full') {
        (pr.plan || []).forEach(m => { h.care.plan[m] = true; });
        h.care.pendingTasks = pr.pending || '';
        h.care.nextShiftNote = pr.next || '';
      }
    }
    db.handovers.push(h);
  }

  const prof = [
    { vent: true, reason: 'Septic shock จาก pneumonia ใส่ท่อช่วยหายใจ on norepinephrine',
      fancas: { fluid: ['shock', ['vasopressor', 'Norepinephrine 0.1 mcg/kg/min'], 'io'], aeration: ['ett_mv', 'high_o2', 'pneumonia'], nutrition: [['enteral', '50']],
        communication: [['sedation', '-2']], activity: [['bed_rest', 'shock'], 'pressure_risk'], stimulation: [['pain', 'CPOT 2']] },
      issues: { glycemic: 'DTX 250-280 ปรับ RI drip', sbt: 'ยังใช้ PEEP 10' },
      monitoring: ['perfusion', 'oxygenation', 'ventilator', 'infection'], plan: ['vitals', 'lab', 'med'],
      pending: 'รอผล hemoculture, lactate ซ้ำ 14:00', next: 'ติดตาม MAP > 65 ปรับ norepinephrine ตามแผนแพทย์' },
    { vent: true, reason: 'Pneumonia with ARDS, P/F ratio 120',
      fancas: { aeration: ['ett_mv', 'ards', 'hypoxemia', 'prone'], fluid: ['overload'], communication: [['sedation', '-3']] },
      issues: { sedation: 'RASS -4 แจ้งแพทย์ลด propofol' }, dope: { id: 'O', finding: 'เสมหะเหนียวอุดท่อ', action: 'Suction + แจ้งแพทย์ ดีขึ้น' },
      monitoring: ['oxygenation', 'ventilator', 'fluid'], plan: ['prone', 'weaning'], pending: 'ทำ prone รอบถัดไป 16:00', next: '' },
    { vent: false, reason: 'Post-op CABG day 1 สัญญาณชีพคงที่',
      fancas: { fluid: ['io'], activity: ['prom'], stimulation: [['pain', 'NRS 4']] }, issues: { catheter: 'พิจารณาถอด foley พรุ่งนี้' },
      monitoring: ['perfusion', 'fluid'], plan: ['vitals', 'line_removal'], pending: 'ถอด chest drain ตามแผน', next: '' },
    { vent: true, reason: 'Acute respiratory failure จาก asthma exacerbation',
      fancas: { aeration: ['ett_mv', 'secretion'] }, monitoring: ['airway'] },
    { vent: false, reason: 'Acute ischemic stroke หลังให้ rtPA',
      fancas: { communication: [['alert', 'E4V4M6']], activity: [['bed_rest', 'post rtPA']] }, monitoring: ['neuro'], plan: ['vitals'], pending: 'CT brain ซ้ำ 24 ชม.' },
    { vent: false, reason: 'Septic shock (UTI) ตอบสนองต่อ fluid',
      fancas: { fluid: ['shock', 'io'] }, monitoring: ['perfusion', 'infection'], plan: ['lab', 'med'], issues: { deescalation: 'รอผล urine culture' } },
    { vent: true, reason: 'ARDS ดีขึ้น ย้ายออกหอผู้ป่วยสามัญ', fancas: { aeration: ['ett_mv'] }, monitoring: ['oxygenation'], plan: ['weaning'] },
    { vent: false, reason: 'COPD exacerbation', fancas: {}, monitoring: ['oxygenation'], plan: ['vitals'] }
  ];

  const p2 = U.prevSlot(prev.date, prev.shift);
  [0, 1, 2, 4, 6, 7].forEach(i => ho(i, p2, 'handed_over', 'full', prof[i]));
  [0, 1, 2, 4, 5, 6].forEach(i => ho(i, prev, 'handed_over', 'full', prof[i]));
  ho(0, { date: today, shift: cur }, 'in_progress', 'part', prof[0]);
  ho(1, { date: today, shift: cur }, 'ready_for_review', 'full', prof[1]);
  ho(3, { date: today, shift: cur }, 'draft', 'none', prof[3]);
  ho(5, { date: today, shift: cur }, 'handed_over', 'full', prof[5]);

  db.audit.push({ id: U.uid('a'), entity: 'system', entityId: '-', action: 'demo', by, at: t, changes: [], note: 'สร้างข้อมูลสมมติ' });
};
