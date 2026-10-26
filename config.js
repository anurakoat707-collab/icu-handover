/* ICU Handover - checklist definitions (from the paper "ICU Handover Checklist").
   Wording can be changed here without touching the rest of the app.
   Items marked in REVIEW_ITEMS must be confirmed by ICU nurses / physicians before real use. */
window.ICU = window.ICU || {};

ICU.APP_VERSION = '1.0.0';

/* 2 shifts (26 Oct): the night shift belongs to the date it STARTS (20:00 on that date -> 08:00 next day).
   no = order inside a date. */
ICU.SHIFTS = [
  { id: 'morning', label: 'เช้า', time: '08:00-20:00', start: 8, no: 1 },
  { id: 'night',   label: 'ดึก',  time: '20:00-08:00', start: 20, no: 3 }
];
/* records made before 26 Oct may still say "afternoon" */
ICU.LEGACY_SHIFTS = [{ id: 'afternoon', label: 'บ่าย (เดิม)', time: '16:00-24:00', start: 16, no: 2 }];

ICU.PATIENT_STATUS = {
  active:      { label: 'อยู่ใน ICU', cls: 'teal' },
  transferred: { label: 'ย้ายออก',   cls: 'blue' },
  discharged:  { label: 'จำหน่าย',   cls: 'gray' },
  deceased:    { label: 'เสียชีวิต', cls: 'dark' }
};

ICU.HANDOVER_STATUS = {
  draft:            { label: 'Draft',            th: 'ฉบับร่าง',     cls: 'gray' },
  in_progress:      { label: 'In Progress',      th: 'กำลังกรอก',    cls: 'blue' },
  ready_for_review: { label: 'Ready for Review', th: 'รอตรวจสอบ',    cls: 'amber' },
  handed_over:      { label: 'Handed Over',      th: 'ส่งเวรแล้ว',    cls: 'teal' }
};

ICU.ROLES = { nurse: 'พยาบาล', head_nurse: 'หัวหน้าเวร', viewer: 'ดูอย่างเดียว' };

ICU.FANCAS_STATES = [
  { id: 'not_assessed', label: 'ยังไม่ประเมิน' },
  { id: 'no_problem',   label: 'ไม่พบปัญหา' },
  { id: 'problem',      label: 'มีปัญหา / ต้องดูแล' }
];

/* item.input = label of a short text box (e.g. GCS ___) */
ICU.FANCAS = [
  { id: 'fluid', letter: 'F', en: 'Fluid', th: 'การน้ำ / การไหลเวียนเลือด', items: [
    { id: 'shock', label: 'Septic shock / Hypoperfusion' },
    { id: 'overload', label: 'Fluid overload' },
    { id: 'vasopressor', label: 'Vasopressor', input: 'ระบุ' },
    { id: 'io', label: 'I/O balance' },
    { id: 'oliguria', label: 'Oliguria' },
    { id: 'other', label: 'อื่นๆ', input: 'ระบุ' }
  ] },
  { id: 'aeration', letter: 'A', en: 'Aeration', th: 'การหายใจ / การแลกเปลี่ยนแก๊ส', items: [
    { id: 'ett_mv', label: 'ETT + MV' },
    { id: 'high_o2', label: 'High O₂ / PEEP' },
    { id: 'pneumonia', label: 'Pneumonia' },
    { id: 'ards', label: 'ARDS' },
    { id: 'hypoxemia', label: 'Hypoxemia (SpO₂ < เป้าหมาย)' },
    { id: 'secretion', label: 'Secretion มาก / เหนียว' },
    { id: 'prone', label: 'Prone position' },
    { id: 'other', label: 'อื่นๆ', input: 'ระบุ' }
  ] },
  { id: 'nutrition', letter: 'N', en: 'Nutrition', th: 'โภชนาการ', items: [
    { id: 'npo', label: 'NPO' },
    { id: 'enteral', label: 'Enteral feeding', input: 'อัตรา ml/hr' },
    { id: 'intolerance', label: 'Feeding intolerance (high GRV / อาเจียน)' },
    { id: 'tpn', label: 'TPN / PN' },
    { id: 'other', label: 'อื่นๆ', input: 'ระบุ' }
  ] },
  { id: 'communication', letter: 'C', en: 'Communication', th: 'การสื่อสาร / ระบบประสาท', items: [
    { id: 'alert', label: 'รู้สึกตัวดี', input: 'GCS' },
    { id: 'delirium', label: 'สับสน / Delirium (CAM-ICU +)' },
    { id: 'sedation', label: 'Sedation', input: 'RASS' },
    { id: 'cannot_talk', label: 'สื่อสารไม่ได้ (ETT / Tracheostomy)' },
    { id: 'other', label: 'อื่นๆ', input: 'ระบุ' }
  ] },
  { id: 'activity', letter: 'A', en: 'Activity', th: 'การเคลื่อนไหว / กิจกรรม', items: [
    { id: 'bed_rest', label: 'Bed rest', input: 'เหตุผล' },
    { id: 'prom', label: 'Passive ROM' },
    { id: 'active_ex', label: 'Active exercise (ถ้ามี)' },
    { id: 'pressure_risk', label: 'เสี่ยงแผลกดทับ / Pressure injury risk' },
    { id: 'other', label: 'อื่นๆ', input: 'ระบุ' }
  ] },
  { id: 'stimulation', letter: 'S', en: 'Stimulation', th: 'สิ่งกระตุ้น / สิ่งแวดล้อม', items: [
    { id: 'pain', label: 'Pain', input: 'NRS / CPOT' },
    { id: 'sedation', label: 'Sedation', input: 'RASS' },
    { id: 'delirium', label: 'Delirium', input: 'CAM-ICU' },
    { id: 'sleep', label: 'Sleep / Noise control' },
    { id: 'other', label: 'อื่นๆ', input: 'ระบุ' }
  ] }
];

/* Work status (not a judgement of the treatment) */
ICU.FH_STATES = [
  { id: 'not_assessed',   label: 'ยังไม่ได้ประเมิน' },
  { id: 'assessed',       label: 'ประเมินแล้ว' },
  { id: 'not_applicable', label: 'ไม่เกี่ยวข้อง' }
];

/* opts = the two boxes printed on the paper form */
ICU.FASTHUGBID = [
  { id: 'feeding',      letter: 'F', en: 'Feeding', th: 'โภชนาการ', opts: ['ตามแผน', 'ไม่ได้ / ไม่เหมาะสม'] },
  { id: 'analgesia',    letter: 'A', en: 'Analgesia', th: 'การจัดการความปวด', opts: ['ได้ตามแผน', 'ยังปวด'] },
  { id: 'sedation',     letter: 'S', en: 'Sedation', th: 'การใช้ยาระงับประสาท', opts: ['เหมาะสม', 'มาก / น้อยเกิน'] },
  { id: 'thrombo',      letter: 'T', en: 'Thromboembolic prophylaxis', th: 'การป้องกันลิ่มเลือดอุดตัน', opts: ['ได้ตามแผน', 'ไม่ได้ / มีข้อห้าม'] },
  { id: 'hob',          letter: 'H', en: 'Head-of-bed elevation', th: 'การจัดท่าศีรษะสูง', opts: ['30-45°', 'ไม่ได้ / มีข้อจำกัด'] },
  { id: 'ulcer',        letter: 'U', en: 'Ulcer prophylaxis', th: 'การป้องกันแผลในกระเพาะอาหาร', opts: ['ได้ตามแผน', 'ไม่ได้ / มีข้อห้าม'] },
  { id: 'glycemic',     letter: 'G', en: 'Glycemic control', th: 'การควบคุมน้ำตาลในเลือด', opts: ['อยู่ในเป้าหมาย', 'สูง / ต่ำ'] },
  { id: 'sbt',          letter: 'S', en: 'Spontaneous breathing trial', th: 'การหย่าเครื่องช่วยหายใจ', opts: ['พร้อม SBT', 'ยังไม่พร้อม'] },
  { id: 'bowel',        letter: 'B', en: 'Bowel care', th: 'การดูแลการขับถ่าย', opts: ['ปกติ', 'ท้องผูก / ท้องเสีย'] },
  { id: 'catheter',     letter: 'I', en: 'Indwelling catheter removal', th: 'การถอดสายสวน / สาย', opts: ['จำเป็นต้องคง', 'ถอดได้'] },
  { id: 'deescalation', letter: 'D', en: 'De-escalation of antibiotics', th: 'การลด / หยุดยาปฏิชีวนะ', opts: ['ตามแผน', 'พิจารณาลด / หยุด'] }
];

ICU.DOPE_RESULTS = [
  { id: 'not_assessed', label: 'ยังไม่ได้ประเมิน' },
  { id: 'not_found',    label: 'ไม่พบ' },
  { id: 'found',        label: 'พบ' }
];

ICU.DOPE = [
  { id: 'D', en: 'Displacement', th: 'ท่อช่วยหายใจเลื่อนหรือหลุด' },
  { id: 'O', en: 'Obstruction', th: 'ท่อหรือทางเดินหายใจอุดตัน' },
  { id: 'P', en: 'Pneumothorax', th: 'ภาวะลมในช่องเยื่อหุ้มปอด' },
  { id: 'E', en: 'Equipment failure', th: 'อุปกรณ์หรือเครื่องช่วยหายใจขัดข้อง' }
];

ICU.DOPE_DISCLAIMER = 'Checklist นี้ใช้ช่วยบันทึกเท่านั้น ไม่ใช้แทนการประเมินและการช่วยเหลือฉุกเฉินตามแนวทางของโรงพยาบาล';

ICU.MONITORING = [
  { id: 'perfusion', label: 'Perfusion / Shock (BP, UO, Lactate)' },
  { id: 'oxygenation', label: 'Oxygenation (SpO₂, P/F ratio)' },
  { id: 'airway', label: 'Secretion / Airway' },
  { id: 'ventilator', label: 'Ventilator management (lung protective)' },
  { id: 'fluid', label: 'Fluid balance (Overload / Dehydration)' },
  { id: 'infection', label: 'Infection / Sepsis control' },
  { id: 'nutrition', label: 'Nutrition (EN / PN)' },
  { id: 'neuro', label: 'Neurological status / Delirium' },
  { id: 'skin', label: 'Skin / Pressure injury / Mobility' },
  { id: 'other', label: 'อื่นๆ', input: 'ระบุ' }
];

ICU.PLAN = [
  { id: 'vitals', label: 'ติดตามสัญญาณชีพ / Trend ตามแผน' },
  { id: 'lab', label: 'ติดตาม Lab' },
  { id: 'med', label: 'ปรับยา / แจ้งแพทย์' },
  { id: 'complication', label: 'เฝ้าระวังภาวะแทรกซ้อน' },
  { id: 'procedure', label: 'วางแผนการตรวจพิเศษ / Procedure' },
  { id: 'weaning', label: 'วางแผน SBT / Weaning' },
  { id: 'prone', label: 'วางแผน Prone position' },
  { id: 'line_removal', label: 'วางแผนถอดสายสวน' },
  { id: 'other', label: 'อื่นๆ', input: 'ระบุ' }
];

ICU.STEPS = [
  { id: 'fancas', no: 1, label: 'FANCAS', th: 'สรุปปัญหาผู้ป่วย 6 ด้าน' },
  { id: 'fasthugbid', no: 2, label: 'FASTHUGBID', th: 'รายการดูแลประจำวัน' },
  { id: 'dope', no: 3, label: 'DOPE', th: 'ประเมินเครื่องช่วยหายใจฉุกเฉิน' },
  { id: 'care', no: 4, label: 'แผนการดูแล', th: 'เหตุผลรับไว้ / เฝ้าระวัง / แผนต่อเนื่อง' },
  { id: 'summary', no: 5, label: 'สรุป', th: 'ตรวจสอบและส่งเวร' }
];

/* Must be confirmed by ICU nurses / physicians before real use */
ICU.REVIEW_ITEMS = [
  'ข้อความรายการทั้งหมด (คัดจากภาพแบบฟอร์ม บางจุดภาพไม่ชัด เช่น "ติดตามสัญญาณชีพ / Trend ตามแผน")',
  'FASTHUGBID: ใช้ทั้งสถานะงาน (ยังไม่ได้ประเมิน / ประเมินแล้ว / ไม่เกี่ยวข้อง) และตัวเลือก 2 ช่องตามกระดาษ',
  'กติกาตรวจความครบถ้วนก่อนส่งเวร (หน้า "สรุป")',
  'ยึดรายการตามกระดาษต้นฉบับ (ภาพตัวอย่าง UI มีบางข้อต่างจากกระดาษ)',
  'DOPE: แสดงเฉพาะผู้ป่วยที่ใช้เครื่องช่วยหายใจ',
  '"ส่งเวรต่อ": คัดลอก FANCAS / แผนการดูแลจากเวรก่อน แต่ FASTHUGBID และ DOPE ต้องประเมินใหม่ทุกเวร',
  'สิทธิ์ "ยืนยันส่งเวร" และ "แก้ไขหลังส่งเวร" (ตอนนี้ทุกคนที่เปิดแอปในเครื่องทำได้)',
  'ข้อความเตือน DOPE ต้องอ้างอิงแนวทางฉุกเฉินของโรงพยาบาล'
];

/* Shared ward database (Supabase). The publishable key is meant to be public - access is controlled by
   Row Level Security + the ward login. Leave url empty to run without cloud (data only on this device). */
ICU.CLOUD = {
  url: 'https://fifduhwrmkvdpdjxlewq.supabase.co',
  key: 'sb_publishable_2HXAhXF3gLyMw5xK3aMSDA_g9kWT0ik',
  email: 'ward@icu-handover.app',
  /* Supabase needs >= 6 characters: the typed ward code (upper case) + this suffix = the account password */
  passSuffix: '-icu-ward',
  pollSeconds: 15
};

ICU.DEFAULT_SETTINGS = {
  userName: 'Nanita',
  role: 'nurse',
  hospital: 'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี',
  hospitalEn: 'Suranaree University of Technology Hospital',
  ward: 'หอผู้ป่วยวิกฤต (ICU)'
};
