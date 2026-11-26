/* Page tracking for the /dashboard.
   - One visit per browser tab (a new tab = a new visit).
   - Ad / source from utm_content, utm_campaign, utm_source (fbclid alone counts as "facebook").
   - VSL: furthest point watched with sound on.
   - Button clicks: every "#apply" button, labelled by where it sits on the page.
   - Booked: the confirmation page marks the last home-page visit as booked.
   Visits from a browser that ticked "Don't count my visits" in the dashboard are skipped. */
(function () {
  function get(st, k) { try { return st.getItem(k); } catch (e) { return null; } }
  function set(st, k, v) { try { st.setItem(k, v); } catch (e) {} }
  if (get(localStorage, 'ph_no_track') === '1' || navigator.webdriver) return;

  function rid() {
    try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }
  function send(o) {
    var body = JSON.stringify(o);
    try { if (navigator.sendBeacon && navigator.sendBeacon('/api/t', new Blob([body], { type: 'text/plain' }))) return; } catch (e) {}
    try { fetch('/api/t', { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }); } catch (e) {}
  }

  var page = document.documentElement.getAttribute('data-ph-page') || 'home';

  if (page === 'confirmation') {
    var last = get(localStorage, 'ph_last_v');
    if (last) send({ t: 'booked', v: last });
    return;
  }

  var visitor = get(localStorage, 'ph_vr');
  if (!visitor) { visitor = rid(); set(localStorage, 'ph_vr', visitor); }
  var v = get(sessionStorage, 'ph_v');
  if (!v) { v = rid(); set(sessionStorage, 'ph_v', v); }
  set(localStorage, 'ph_last_v', v);

  var qs = new URLSearchParams(location.search);
  var utm = JSON.parse(get(sessionStorage, 'ph_utm') || 'null');
  if (!utm) {
    utm = {
      src: qs.get('utm_source') || (qs.get('fbclid') ? 'facebook' : ''),
      cmp: qs.get('utm_campaign') || '',
      ad: qs.get('utm_content') || ''
    };
    set(sessionStorage, 'ph_utm', JSON.stringify(utm));
  }
  var mobile = (window.matchMedia && matchMedia('(max-width: 760px)').matches) || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  send({ t: 'visit', v: v, vr: visitor, dev: mobile ? 'mobile' : 'desktop', src: utm.src, cmp: utm.cmp, ad: utm.ad,
         ref: document.referrer || '', path: location.pathname });

  /* Shared with the application form */
  window.phTrack = {
    visitId: v,
    utm: utm,
    formStep: function (step) { send({ t: 'form', v: v, step: step }); }
  };

  /* Button clicks (capture phase, so the popup's preventDefault doesn't hide them) */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="#apply"]');
    if (!a) return;
    var key = a.getAttribute('data-ph-btn') ||
      (a.closest('.ph-bd') ? 'breakdown' : a.closest('.ph-hero') ? 'video' : a.closest('.ph-results') ? 'proof' :
       a.closest('.ph-mkt') ? 'framework' : a.closest('.ph-why') ? 'why' : 'other');
    send({ t: 'click', v: v, b: key });
  }, true);

  /* VSL watch time */
  var VSL_ID = 'vid-6ad99fcc1eb03a0a760dc9a8';
  var max = 0, dur = 0, sent = -1;
  function findVideo() {
    var el = document.getElementById(VSL_ID);
    if (el) {
      var vd = el.querySelector('video') || (el.shadowRoot && el.shadowRoot.querySelector('video'));
      if (vd) return vd;
    }
    var inst = window.smartplayer && window.smartplayer.instances;
    if (inst) for (var i = 0; i < inst.length; i++) {
      var p = inst[i];
      if (p && p.video && (!p.id || String(p.id).indexOf(VSL_ID.slice(4)) !== -1)) return p.video;
    }
    return null;
  }
  function flush() {
    if (max <= 0 || max === sent) return;
    sent = max;
    send({ t: 'vsl', v: v, s: Math.round(max * 10) / 10, d: Math.round(dur) });
  }
  setInterval(function () {
    var vd = findVideo();
    if (!vd) return;
    /* vturb autoplays a silent preview; a real play is one with the sound on */
    if (!vd.paused && !vd.muted && vd.currentTime > 0) {
      if (vd.duration && isFinite(vd.duration)) dur = vd.duration;
      if (vd.currentTime > max) max = vd.currentTime;
      if (sent < 0 || max - sent >= 5) flush();
    }
  }, 1000);
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
})();
