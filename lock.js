/* ICU Handover - login / screen lock.
   Only a hash of the password is stored (salted, 20000 x SHA-256). This is a screen lock for the device:
   it stops other people opening the app, the data itself stays in this browser's localStorage. */
(function () {
  'use strict';
  window.ICU = window.ICU || {};

  /* default account (password hash only) - can be changed in Settings */
  const DEFAULT_CRED = {
    user: 'nanita', iter: 20000,
    salt: 'f060ef68aa05a405f5807bbc1bc4bf2b',
    hash: 'deef94d9fe226a33fcef6ac0fb0bb2401b148073714838753de2103fceb076ef'
  };
  const CRED_KEY = 'icuhandover.cred', SES_KEY = 'icuhandover.session', FAIL_KEY = 'icuhandover.fail';

  /* ------------------------------------------------------------ sha-256 */
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256(str) {
    const bytes = Array.from(unescape(encodeURIComponent(str)), c => c.charCodeAt(0));
    const l = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (l >>> (i * 8)) & 255);
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Array(64);
    const r = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < bytes.length; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  function derive(user, pass, salt, iter) {
    let h = sha256(salt + ':' + String(user).trim().toLowerCase() + ':' + pass);
    for (let i = 0; i < iter; i++) h = sha256(h + salt);
    return h;
  }

  /* -------------------------------------------------------------- auth */
  const cred = () => { try { return JSON.parse(localStorage.getItem(CRED_KEY)) || DEFAULT_CRED; } catch (e) { return DEFAULT_CRED; } };
  const idleMin = () => +((ICU.store && ICU.store.settings().lockMinutes) || 15);

  const A = ICU.auth = {
    sha256,
    user: () => cred().user,
    session() { try { return JSON.parse(sessionStorage.getItem(SES_KEY)); } catch (e) { return null; } },
    isUnlocked() {
      const s = A.session();
      if (!s) return false;
      if (Date.now() - s.at > idleMin() * 60000) { A.lock(); return false; }
      return true;
    },
    touch() { const s = A.session(); if (s) { s.at = Date.now(); sessionStorage.setItem(SES_KEY, JSON.stringify(s)); } },
    lock() { sessionStorage.removeItem(SES_KEY); },
    /* seconds to wait after too many wrong attempts */
    waitSeconds() {
      const f = JSON.parse(localStorage.getItem(FAIL_KEY) || '{"n":0,"t":0}');
      if (f.n < 5) return 0;
      return Math.max(0, Math.ceil((f.t + 30000 * Math.pow(2, Math.min(f.n - 5, 5)) - Date.now()) / 1000));
    },
    login(user, pass) {
      if (A.waitSeconds() > 0) return false;
      const c = cred();
      const ok = String(user).trim().toLowerCase() === c.user && derive(user, pass, c.salt, c.iter) === c.hash;
      const f = JSON.parse(localStorage.getItem(FAIL_KEY) || '{"n":0,"t":0}');
      if (ok) {
        localStorage.removeItem(FAIL_KEY);
        sessionStorage.setItem(SES_KEY, JSON.stringify({ user: c.user, at: Date.now() }));
      } else localStorage.setItem(FAIL_KEY, JSON.stringify({ n: f.n + 1, t: Date.now() }));
      return ok;
    },
    change(curPass, newUser, newPass) {
      const c = cred();
      if (derive(c.user, curPass, c.salt, c.iter) !== c.hash) return 'รหัสผ่านปัจจุบันไม่ถูกต้อง';
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
      const user = String(newUser).trim().toLowerCase();
      localStorage.setItem(CRED_KEY, JSON.stringify({ user, iter: c.iter, salt, hash: derive(user, newPass, salt, c.iter) }));
      return '';
    }
  };

  /* lock screen; resolves after a successful login */
  ICU.lockScreen = function (onOk) {
    document.body.classList.add('locked');
    const v = document.getElementById('view');
    v.innerHTML = '<div class="lock-wrap"><form class="lock-card" id="lock-form" autocomplete="on">' +
      '<span class="brand-logo big" aria-hidden="true"></span><h1>ICU Handover</h1><p class="muted">แบบส่งเวรผู้ป่วยวิกฤต · เข้าสู่ระบบ</p>' +
      '<label class="fld">ชื่อผู้ใช้<input name="user" autocomplete="username" autocapitalize="off" required></label>' +
      '<label class="fld">รหัสผ่าน<input name="pass" type="password" autocomplete="current-password" inputmode="numeric" required></label>' +
      '<p class="lock-err" id="lock-err" role="alert"></p>' +
      '<button class="btn primary" type="submit">เข้าสู่ระบบ</button>' +
      '<p class="hint">ข้อมูลผู้ป่วยเก็บในเครื่องนี้เท่านั้น · ระบบล็อกอัตโนมัติเมื่อไม่ใช้งาน ' + idleMin() + ' นาที</p></form></div>';
    const f = v.querySelector('#lock-form'), err = v.querySelector('#lock-err');
    f.user.value = localStorage.getItem('icuhandover.lastUser') || '';
    (f.user.value ? f.pass : f.user).focus();
    f.onsubmit = e => {
      e.preventDefault();
      const w = A.waitSeconds();
      if (w > 0) { err.textContent = 'ใส่รหัสผิดหลายครั้ง รอ ' + w + ' วินาที'; return; }
      const btn = f.querySelector('button');
      btn.disabled = true; btn.textContent = 'กำลังตรวจสอบ...';
      setTimeout(() => {
        if (A.login(f.user.value, f.pass.value)) {
          localStorage.setItem('icuhandover.lastUser', f.user.value.trim());
          document.body.classList.remove('locked');
          onOk();
        } else {
          btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
          f.pass.value = ''; f.pass.focus();
          const w2 = A.waitSeconds();
          err.textContent = w2 > 0 ? 'ใส่รหัสผิดหลายครั้ง รอ ' + w2 + ' วินาที' : 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
        }
      }, 30);
    };
  };

  /* activity keeps the session alive; coming back after the idle time locks the app */
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => A.touch(), { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !document.body.classList.contains('locked') && !A.isUnlocked() && ICU.render) ICU.render();
  });
  setInterval(() => { if (!document.body.classList.contains('locked') && !A.isUnlocked() && ICU.render) ICU.render(); }, 30000);
})();
