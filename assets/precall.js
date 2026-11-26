/* Confirmation page video tracking for the dashboard's "Pre-call engagement" view.
   Counts seconds actually watched (sound on) for every vturb and YouTube video.
   Skipped for browsers that ticked "Don't count my visits" in the dashboard. */
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

  var view = get(sessionStorage, 'ph_cv');
  if (!view) { view = rid(); set(sessionStorage, 'ph_cv', view); }
  var mobile = (window.matchMedia && matchMedia('(max-width: 760px)').matches) || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  send({ t: 'cview', v: view, lv: get(localStorage, 'ph_last_v') || '', dev: mobile ? 'mobile' : 'desktop' });

  /* per video: watched seconds, duration, last position/time, last sent */
  var W = {};
  function track(id, playing, pos, dur) {
    var w = W[id] || (W[id] = { watched: 0, dur: 0, lastPos: null, lastAt: 0, sent: 0 });
    var now = Date.now();
    if (dur && isFinite(dur)) w.dur = dur;
    if (playing && w.lastPos != null) {
      var elapsed = (now - w.lastAt) / 1000;
      var moved = pos - w.lastPos;
      /* count real playback only: ignore seeking forward/back */
      if (moved > 0) w.watched += Math.min(moved, elapsed * 2 + 0.5);
      if (w.dur) w.watched = Math.min(w.watched, w.dur);
    }
    w.lastPos = playing ? pos : null;
    w.lastAt = now;
    if (w.watched - w.sent >= 5) flushOne(id);
  }
  function flushOne(id) {
    var w = W[id];
    if (!w || w.watched < 1 || w.watched === w.sent) return;
    w.sent = w.watched;
    send({ t: 'cvid', v: view, vid: id, s: Math.round(w.watched * 10) / 10, d: Math.round(w.dur) });
  }
  function flushAll() { for (var id in W) flushOne(id); }
  addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushAll(); });

  /* vturb players */
  function vturbVideo(el) {
    return el.querySelector('video') || (el.shadowRoot && el.shadowRoot.querySelector('video'));
  }

  /* YouTube players (iframes need enablejsapi=1) */
  var YTP = [];
  function setupYouTube() {
    var frames = document.querySelectorAll('iframe[src*="youtube.com/embed/"]');
    if (!frames.length || !window.YT || !YT.Player) return;
    frames.forEach(function (f) {
      if (f.getAttribute('data-ph-yt')) return;
      var m = f.src.match(/embed\/([\w-]+)/);
      if (!m) return;
      f.setAttribute('data-ph-yt', m[1]);
      try { YTP.push({ id: m[1], p: new YT.Player(f) }); } catch (e) {}
    });
  }
  var prevReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () { if (prevReady) try { prevReady(); } catch (e) {} setupYouTube(); };
  if (document.querySelector('iframe[src*="youtube.com/embed/"]')) {
    var s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    document.head.appendChild(s);
  }

  setInterval(function () {
    document.querySelectorAll('vturb-smartplayer[id^="vid-"]').forEach(function (el) {
      var vd = vturbVideo(el);
      if (!vd) return;
      track(el.id.slice(4), !vd.paused && !vd.muted && vd.currentTime > 0, vd.currentTime, vd.duration);
    });
    YTP.forEach(function (y) {
      var p = y.p;
      if (!p || typeof p.getPlayerState !== 'function') return;
      var playing = p.getPlayerState() === 1 && !(p.isMuted && p.isMuted());
      track(y.id, playing, p.getCurrentTime ? p.getCurrentTime() : 0, p.getDuration ? p.getDuration() : 0);
    });
  }, 1000);
})();
