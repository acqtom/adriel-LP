/* Application form, inline on the home page.
   Every "#apply" button smoothly scrolls here. Answers save as people go (/api/form).
   "I can't afford that level" ends on a thank-you message; any other answer opens Calendly.
   Booking a time marks the visit as booked, then sends the visitor to /confirmation. */
(function () {
  /* ====== SETTINGS ====== */
  var CALENDLY_URL = 'https://calendly.com/team-propertyhsu/adriel-hsu-mentorship-strategy-call?hide_event_type_details=1&hide_gdpr_banner=1';

  var QUESTIONS = [
    { key: 'situation', type: 'choice', required: true,
      title: 'Which situation best describes you?',
      sub: "This helps us understand what kind of project we'd be working on with you.",
      choices: ["I'm building on a lot right now", 'I have a deal under contract or in due diligence',
                'I own a lot and want to build on it', "I'm looking for a lot to build on"] },
    { key: 'problems', type: 'long', required: true,
      title: "Please describe the main problems you'd need help with?",
      sub: 'The more specific you are, the more useful your Strategy Session will be.' },
    { key: 'why_now', type: 'long', required: false,
      title: 'Why are you looking for development guidance right now?' },
    { key: 'name', type: 'text', required: true, contact: true, autocomplete: 'given-name',
      title: 'What is your first name' },
    { key: 'phone', type: 'phone', required: true, contact: true,
      title: 'What is your phone number?' },
    { key: 'email', type: 'email', required: true, contact: true,
      title: 'What is your best Email' },
    { key: 'capital', type: 'choice', required: true,
      title: 'How much capital do you have access to for the project itself?',
      sub: 'This is separate from the mentorship. It tells us what size project makes sense for you right now.',
      choices: ['$500k - $1M', '$300k - $500k', '$100k - $300k', '$50k - $100k', 'Under $50k'] },
    { key: 'investment', type: 'choice', required: true,
      title: 'If we can help you, the investment is $7,000-$12,000 depending on the level of support. Can you invest at this level?',
      sub: 'We will only ask you to join us if we 100% believe we can deliver you your goals.',
      choices: ['Yes, I have the resources to pay in full', "I'd need to split it up into 12-24 payments",
                "I can't afford that level of investment right now"],
      noCalendar: "I can't afford that level of investment right now" }
  ];
  var COUNTRIES = [['US', '+1', '🇺🇸'], ['CA', '+1', '🇨🇦'], ['GB', '+44', '🇬🇧'], ['AU', '+61', '🇦🇺'], ['NZ', '+64', '🇳🇿'],
                   ['IE', '+353', '🇮🇪'], ['DE', '+49', '🇩🇪'], ['NL', '+31', '🇳🇱'], ['AE', '+971', '🇦🇪'], ['SG', '+65', '🇸🇬'],
                   ['IN', '+91', '🇮🇳'], ['MX', '+52', '🇲🇽'], ['PH', '+63', '🇵🇭'], ['ZA', '+27', '🇿🇦']];

  /* ====== state ====== */
  var root = document.getElementById('ph-apply-form');
  if (!root) return;
  function sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function visitId() {
    if (window.phTrack && window.phTrack.visitId) return window.phTrack.visitId;
    var v = sget('ph_v');
    if (!v) { v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); sset('ph_v', v); }
    return v;
  }
  var S = { i: 0, answers: {}, country: 'US', sms: false, smsMarketing: false, started: false, end: null };
  try { var saved = JSON.parse(sget('ph_apply') || 'null'); if (saved && saved.answers) S = Object.assign(S, saved); } catch (e) {}
  function persist() { sset('ph_apply', JSON.stringify(S)); }
  var N = QUESTIONS.length;

  function post(path, body) {
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true })
      .catch(function () {});
  }
  function save(step, done, noCal) {
    var a = S.answers, answers = {};
    QUESTIONS.forEach(function (q) { if (!q.contact && a[q.key]) answers[q.key] = a[q.key]; });
    var body = { v: visitId(), step: step, done: !!done, noCalendar: !!noCal, answers: answers,
      utm: (window.phTrack && window.phTrack.utm) || {},
      contact: { name: a.name || null, email: a.email || null, phone: fullPhone() || null } };
    if (a.phone) { body.contact.sms = !!S.sms; body.contact.smsMarketing = !!S.smsMarketing; }
    return post('/api/form', body);
  }
  function markStarted() {
    if (S.started) return;
    S.started = true; persist();
    save(1, false);
    try { if (typeof fbq === 'function') fbq('track', 'Lead', { content_name: 'Application Form Open' }); } catch (e) {}
  }

  /* ====== phone ====== */
  function dial() { for (var i = 0; i < COUNTRIES.length; i++) if (COUNTRIES[i][0] === S.country) return COUNTRIES[i][1]; return '+1'; }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function fullPhone() { var d = digits(S.answers.phone); return d ? dial() + d.replace(/^0+/, '') : ''; }
  function fmtUS(d) {
    d = d.slice(0, 10);
    if (d.length < 4) return d;
    if (d.length < 7) return '(' + d.slice(0, 3) + ') ' + d.slice(3);
    return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
  }

  /* ====== render ====== */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var ARROW = '<span class="pa-btn__arrow" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>';

  function render(focus) {
    if (S.end) return renderEnd(focus);
    var q = QUESTIONS[S.i], val = S.answers[q.key] || '';
    var pct = 50 + Math.round((S.i / N) * 50);
    var h = '<div class="pa-top"><span>Question ' + (S.i + 1) + '</span><span>' + pct + '%</span></div>' +
      '<div class="pa-bar"><span style="width:' + pct + '%"></span></div>' +
      '<div class="pa-q" id="pa-q">' +
      '<h3 class="pa-title" id="pa-title">' + esc(q.title) + (q.required ? '' : ' <em>(optional)</em>') + '</h3>' +
      (q.sub ? '<p class="pa-sub">' + esc(q.sub) + '</p>' : '');

    if (q.type === 'choice') {
      h += '<div class="pa-choices" role="radiogroup" aria-labelledby="pa-title">' + q.choices.map(function (c, k) {
        var on = val === c;
        return '<button type="button" class="pa-choice' + (on ? ' is-on' : '') + '" role="radio" aria-checked="' + on + '" data-choice="' + esc(c) + '">' +
          '<span class="pa-key">' + String.fromCharCode(65 + k) + '</span><span>' + esc(c) + '</span></button>';
      }).join('') + '</div>';
    } else if (q.type === 'long') {
      h += '<textarea class="pa-input pa-input--long" id="pa-input" rows="3" maxlength="5000" placeholder="Type your answer here..." aria-labelledby="pa-title">' + esc(val) + '</textarea>' +
        '<p class="pa-hint"><b>Shift ⇧ + Enter ↵</b> to make a line break</p>';
    } else if (q.type === 'phone') {
      h += '<div class="pa-phone"><select class="pa-cc" id="pa-cc" aria-label="Country code">' + COUNTRIES.map(function (c) {
        return '<option value="' + c[0] + '"' + (c[0] === S.country ? ' selected' : '') + '>' + c[2] + ' ' + c[0] + ' ' + c[1] + '</option>';
      }).join('') + '</select>' +
        '<input class="pa-input" id="pa-input" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="' + (dial() === '+1' ? '(201) 555-0123' : 'Phone number') + '" value="' + esc(val) + '" aria-labelledby="pa-title"></div>' +
        '<label class="pa-check"><input type="checkbox" id="pa-sms"' + (S.sms ? ' checked' : '') + '> <span>I agree to receive text messages from SETX Properties LLC (Propertyhsu) about my application and booking, such as appointment reminders and follow-ups. Message frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase. <a href="/pp" target="_blank" rel="noopener">Privacy Policy</a> · <a href="/tos" target="_blank" rel="noopener">Terms</a></span></label>' +
        '<label class="pa-check"><input type="checkbox" id="pa-sms2"' + (S.smsMarketing ? ' checked' : '') + '> <span>I agree to receive marketing text messages from SETX Properties LLC (Propertyhsu), such as offers and program announcements. Message frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out. Consent is not a condition of purchase.</span></label>';
    } else {
      h += '<input class="pa-input" id="pa-input" type="' + (q.type === 'email' ? 'email' : 'text') + '"' +
        (q.type === 'email' ? ' inputmode="email" autocomplete="email" placeholder="name@example.com"' : ' autocomplete="' + (q.autocomplete || 'off') + '" placeholder="Type your answer here..."') +
        ' maxlength="200" value="' + esc(val) + '" aria-labelledby="pa-title">';
    }
    h += '<p class="pa-err" id="pa-err" role="alert"></p>' +
      '<div class="pa-nav">' +
      '<button type="button" class="pa-btn" id="pa-next">' + (S.i === N - 1 ? 'Submit' : 'Continue') + ARROW + '</button>' +
      (S.i > 0 ? '<button type="button" class="pa-back" id="pa-back">Back</button>' : '') +
      (q.type !== 'choice' ? '<span class="pa-enter">press <b>Enter ↵</b></span>' : '') +
      '</div></div>';
    root.innerHTML = h;
    updateNext();
    if (focus) {
      var el = document.getElementById('pa-input');
      if (el && !matchMedia('(hover: none)').matches) el.focus({ preventScroll: true });
    }
  }

  function renderEnd() {
    var a = S.answers;
    if (S.end === 'thanks') {
      root.innerHTML = '<div class="pa-end"><div class="pa-end__icon">✓</div><h3 class="pa-title">Thank you for your application, we will be in touch.</h3>' +
        '<p class="pa-sub">We review every application personally and will reach out if it’s a fit.</p></div>';
      return;
    }
    root.innerHTML = '<div class="pa-top"><span>Last step</span><span>100%</span></div><div class="pa-bar"><span style="width:100%"></span></div>' +
      '<h3 class="pa-title">Book Your Mentorship Strategy Call</h3>' +
      '<div class="pa-cal" id="pa-cal"></div>';
    var box = document.getElementById('pa-cal');
    if (!CALENDLY_URL) { box.innerHTML = '<p class="pa-err">The booking calendar isn’t connected yet.</p>'; return; }
    var url = CALENDLY_URL;
    var utm = (window.phTrack && window.phTrack.utm) || {};
    function init() {
      window.Calendly.initInlineWidget({
        url: url, parentElement: box,
        prefill: { name: a.name || '', email: a.email || '' },
        utm: { utmSource: utm.src || '', utmCampaign: utm.cmp || '', utmContent: utm.ad || '' }
      });
    }
    if (window.Calendly) return init();
    var s = document.createElement('script');
    s.src = 'https://assets.calendly.com/assets/external/widget.js'; s.async = true; s.onload = init;
    document.head.appendChild(s);
  }

  /* ====== validation + navigation ====== */
  function current() {
    var q = QUESTIONS[S.i], el = document.getElementById('pa-input');
    if (el) S.answers[q.key] = q.type === 'phone' ? el.value : el.value.trim();
    return q;
  }
  function problem(q) {
    var v = S.answers[q.key] || '';
    if (q.required && !String(v).trim()) return q.type === 'choice' ? 'Please choose an option' : 'Please fill this in';
    if (q.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Please enter a valid email address';
    if (q.type === 'phone' && v) {
      var d = digits(v);
      if (dial() === '+1' ? d.replace(/^1/, '').length !== 10 : (d.length < 6 || d.length > 14)) return 'Your phone number doesn\u2019t look right';
    }
    return '';
  }
  function updateNext() {
    var q = QUESTIONS[S.i], btn = document.getElementById('pa-next');
    if (btn) btn.classList.toggle('is-ready', !problem(q));
  }
  function next() {
    var q = current(), err = problem(q);
    if (err) { var e = document.getElementById('pa-err'); e.textContent = err; shake(); return; }
    if (q.type === 'phone' && dial() === '+1') S.answers.phone = fmtUS(digits(S.answers.phone).replace(/^1(?=\d{10}$)/, ''));
    markStarted();
    if (S.i < N - 1) {
      S.i++; persist();
      save(S.i + 1, false);
      go();
      return;
    }
    var noCal = !!(q.noCalendar && S.answers[q.key] === q.noCalendar);
    S.end = noCal ? 'thanks' : 'calendar'; persist();
    save(N, true, noCal);
    go();
  }
  function back() { current(); if (S.i > 0) { S.i--; persist(); go(); } }
  function go() {
    var card = root.closest('.pa-card');
    root.classList.add('is-leaving');
    setTimeout(function () {
      render(true);
      root.classList.remove('is-leaving');
      var r = card.getBoundingClientRect();
      if (r.top < 0 || r.top > innerHeight * 0.4) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 160);
  }
  function shake() { root.classList.remove('is-shake'); void root.offsetWidth; root.classList.add('is-shake'); }

  /* ====== events ====== */
  root.addEventListener('click', function (e) {
    var c = e.target.closest('.pa-choice');
    if (c) {
      S.answers[QUESTIONS[S.i].key] = c.getAttribute('data-choice');
      root.querySelectorAll('.pa-choice').forEach(function (b) { var on = b === c; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); });
      document.getElementById('pa-err').textContent = '';
      updateNext(); persist();
      setTimeout(next, 260);
      return;
    }
    if (e.target.closest('#pa-next')) return next();
    if (e.target.closest('#pa-back')) return back();
  });
  root.addEventListener('input', function (e) {
    if (e.target.id === 'pa-input') {
      var q = QUESTIONS[S.i];
      S.answers[q.key] = e.target.value;
      if (q.type === 'phone' && dial() === '+1') {
        var d = digits(e.target.value);
        if (d.length === 11 && d[0] === '1') d = d.slice(1);
        e.target.value = fmtUS(d); S.answers.phone = e.target.value;
      }
      document.getElementById('pa-err').textContent = '';
      updateNext(); persist();
    }
  });
  root.addEventListener('change', function (e) {
    if (e.target.id === 'pa-cc') { S.country = e.target.value; persist(); render(true); }
    if (e.target.id === 'pa-sms') { S.sms = e.target.checked; persist(); }
    if (e.target.id === 'pa-sms2') { S.smsMarketing = e.target.checked; persist(); }
  });
  root.addEventListener('focusin', function (e) { if (e.target.id === 'pa-input') markStarted(); });
  root.addEventListener('keydown', function (e) {
    if (S.end) return;
    var q = QUESTIONS[S.i];
    if (e.key === 'Enter' && e.target.id === 'pa-input' && !(q.type === 'long' && e.shiftKey)) { e.preventDefault(); next(); return; }
    if (q.type === 'choice' && !e.metaKey && !e.ctrlKey && /^[a-z]$/i.test(e.key) && e.target.tagName !== 'INPUT') {
      var b = root.querySelectorAll('.pa-choice')[e.key.toUpperCase().charCodeAt(0) - 65];
      if (b) { e.preventDefault(); b.click(); }
    }
  });

  /* Calendly booked -> mark booked, then go to the confirmation page */
  addEventListener('message', function (e) {
    if (e.origin !== 'https://calendly.com' || !e.data || e.data.event !== 'calendly.event_scheduled') return;
    var body = JSON.stringify({ t: 'booked', v: visitId() });
    try { navigator.sendBeacon('/api/t', new Blob([body], { type: 'text/plain' })); } catch (err) { post('/api/t', JSON.parse(body)); }
    try { sessionStorage.removeItem('ph_apply'); } catch (err) {}
    setTimeout(function () { location.href = '/confirmation'; }, 1200);
  });

  /* Every "#apply" button scrolls smoothly to the form */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="#apply"]');
    if (!a) return;
    e.preventDefault();
    if (window.phCloseBreakdown) window.phCloseBreakdown();
    var card = document.getElementById('apply');
    var top = card.getBoundingClientRect().top + pageYOffset - 24;
    var smooth = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    window.scrollTo({ top: top, behavior: smooth ? 'smooth' : 'auto' });
    card.classList.remove('is-glow'); void card.offsetWidth; card.classList.add('is-glow');
  });

  render(false);
})();
