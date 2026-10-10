/* Brooks Process Solutions: site interactions */
(function () {
  'use strict';
  /* ---------- site configuration ----------
     CONTACT_EMAIL  where enquiries go (also the mailto fallback).
     FORM_ENDPOINT  FormSubmit AJAX endpoint. The first submission sends an activation
                    email to CONTACT_EMAIL; after activating, you can swap the address in
                    this URL for the random alias FormSubmit gives you to keep it private.
     BOOKING_URL    optional. Paste a Calendly or Cal.com scheduling link (for example
                    'https://calendly.com/your-name/30min') to embed it instead of the
                    built-in request-a-time calendar. */
  var CONTACT_EMAIL = 'devinbrooks.96@gmail.com';
  var FORM_ENDPOINT = 'https://formsubmit.co/ajax/' + CONTACT_EMAIL;
  var BOOKING_URL = '';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced) $$('.packets').forEach(function (g) { g.remove(); });
  $('#yr').textContent = new Date().getFullYear();

  /* ---------- mobile menu ---------- */
  var menuBtn = $('#menuBtn');
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  menuBtn.addEventListener('click', function () { setMenu(!document.body.classList.contains('menu-open')); });
  $$('#nav a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  /* ---------- scroll progress + active nav ---------- */
  var bar = $('#progress');
  var navLinks = $$('#nav a:not(.btn)');
  var sections = navLinks.map(function (a) { return $(a.getAttribute('href')); });
  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? h.scrollTop / max : 0) + ')';
    var current = -1;
    sections.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < 140) current = i; });
    navLinks.forEach(function (a, i) { a.classList.toggle('active', i === current); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- reveal on scroll ---------- */
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.rv').forEach(function (el, i) { el.style.transitionDelay = (i % 4) * 60 + 'ms'; io.observe(el); });
  } else {
    $$('.rv').forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- service explorer ---------- */
  var SERVICES = [
    { bt: 'Work trapped in inboxes and spreadsheets',
      b: ['Invoices and forms keyed in by hand', 'Status updates chased over email', 'Reports built manually each week', 'Knowledge lives in people’s heads'],
      at: 'Work that routes itself',
      a: ['AI reads, extracts and files documents', 'Tasks trigger and track automatically', 'Dashboards refresh themselves', 'An internal assistant answers “how do we…?”'],
      o: 'Hours back every week, with fewer errors.', t: ['Email', 'Accounting', 'Spreadsheets', 'Shared drives'] },
    { bt: 'Content that depends on who has time',
      b: ['Ideas stall waiting on a writer', 'Each channel is rewritten from scratch', 'Campaign results reviewed monthly, if at all', 'Brand voice drifts across the team'],
      at: 'A content engine in your voice',
      a: ['AI drafts from briefs and your brand guide', 'One idea becomes posts, emails and ads', 'Performance is analysed continuously', 'Your team edits and approves, never starts from blank'],
      o: 'More output, consistent quality, faster learning.', t: ['Social', 'Email marketing', 'Website / CMS', 'Analytics'] },
    { bt: 'Selling slowed by admin',
      b: ['CRM updated days late, or never', 'Follow-ups depend on memory', 'Proposals rebuilt from old documents', 'Call notes lost after the meeting'],
      at: 'Reps spend time selling',
      a: ['Calls are summarised and logged automatically', 'Timely, personalised follow-ups are drafted', 'Proposals assemble from your approved content', 'Stalled deals get flagged before they go cold'],
      o: 'Faster cycles and a CRM you can trust.', t: ['CRM', 'Video calls', 'Calendar', 'E-signature'] },
    { bt: 'Leads that arrive and leak',
      b: ['Prospect research done by hand', 'Enquiries answered hours later', 'No consistent way to qualify', 'Cold leads never nurtured'],
      at: 'A pipeline that never sleeps',
      a: ['AI researches and builds targeted prospect lists', 'Instant, helpful replies to every enquiry', 'Leads scored and routed to the right person', 'Automated nurture keeps warm leads warm'],
      o: 'More qualified conversations, less chasing.', t: ['Web forms', 'Chat', 'CRM', 'Booking'] }
  ];
  var tabs = $$('.tab');
  function li(items) { return items.map(function (x) { var l = document.createElement('li'); l.textContent = x; return l; }); }
  function fill(el, nodes) { el.textContent = ''; nodes.forEach(function (n) { el.appendChild(n); }); }
  function showService(i, focus) {
    var d = SERVICES[i];
    tabs.forEach(function (t, k) {
      t.setAttribute('aria-selected', k === i);
      t.tabIndex = k === i ? 0 : -1;
    });
    if (focus) tabs[i].focus();
    $('#panel').setAttribute('aria-labelledby', 't' + i);
    $('#bt').textContent = d.bt;
    $('#at').textContent = d.at;
    $('#oc').textContent = d.o;
    fill($('#bl'), li(d.b));
    fill($('#al'), li(d.a));
    fill($('#tl'), d.t.map(function (x) { var s = document.createElement('span'); s.textContent = x; return s; }));
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { showService(+t.dataset.i); });
    t.addEventListener('keydown', function (e) {
      var i = +t.dataset.i, n = null;
      if (e.key === 'ArrowRight') n = (i + 1) % 4;
      if (e.key === 'ArrowLeft') n = (i + 3) % 4;
      if (e.key === 'Home') n = 0;
      if (e.key === 'End') n = 3;
      if (n !== null) { e.preventDefault(); showService(n, true); }
    });
  });
  showService(0);

  /* ---------- use-case library ---------- */
  var FN = ['Operations', 'Marketing', 'Sales', 'Lead generation'];
  var CASES = [
    [0, 'Invoice & receipt capture', 'AI reads invoices and receipts from your inbox, extracts the details and queues them in your accounting tool for one-click approval.', 3, 1],
    [0, 'Internal knowledge assistant', 'A private assistant trained on your SOPs, policies and past work, so staff get answers in seconds instead of interrupting a colleague.', 2, 2],
    [0, 'Self-writing weekly reports', 'Numbers pulled from your systems and turned into a plain-English summary, with the trends that need attention called out.', 2, 1],
    [1, 'Brand-voice content engine', 'Briefs become on-brand drafts for blogs, social and email, trained on your best work and reviewed by your team.', 3, 2],
    [1, 'One-to-many repurposing', 'One webinar, video or article automatically becomes a newsletter, social posts, a blog and short clips.', 2, 1],
    [1, 'Review & reputation responder', 'Thoughtful replies drafted for every review, with themes from customer feedback summarised each month.', 2, 1],
    [2, 'Call notes to CRM', 'Sales calls summarised, next steps captured and the CRM updated automatically, before the rep has hung up.', 3, 1],
    [2, 'Proposal generator', 'Tailored proposals assembled from your approved pricing, case material and the client’s own words from discovery.', 3, 2],
    [2, 'Deal-risk alerts', 'Deals that have gone quiet or show warning signs get flagged, with a suggested next action ready to send.', 2, 2],
    [3, 'Speed-to-lead responder', 'Every enquiry answered within minutes, day or night, with qualifying questions asked and a call booked for qualified leads.', 3, 2],
    [3, 'Prospect research briefs', 'Before outreach, AI compiles a one-page brief on each prospect: what they do, recent news and a relevant angle.', 2, 1],
    [3, 'Lead scoring & routing', 'Inbound leads scored on fit and intent, then routed to the right person with context attached.', 2, 2]
  ];
  var shortlist = [];
  var casesEl = $('#cases');
  function dots(n) { var s = ''; for (var i = 1; i <= 3; i++) s += '<i class="' + (i <= n ? 'on' : '') + '"></i>'; return s; }
  CASES.forEach(function (c, idx) {
    var el = document.createElement('article');
    el.className = 'case';
    el.dataset.fn = c[0];
    el.innerHTML =
      '<div class="top mono"><span>' + FN[c[0]] + '</span><b>UC-' + String(idx + 1).padStart(2, '0') + '</b></div>' +
      '<h3></h3><p></p>' +
      '<div class="meta"><div class="dots mono"><span class="imp" title="Impact">Impact' + dots(c[3]) + '</span><span title="Effort">Effort' + dots(c[4]) + '</span></div>' +
      '<button class="link" type="button" aria-pressed="false">+ Shortlist</button></div>';
    el.querySelector('h3').textContent = c[1];
    el.querySelector('p').textContent = c[2];
    var btn = el.querySelector('button');
    btn.addEventListener('click', function () {
      var i = shortlist.indexOf(c[1]);
      if (i === -1) shortlist.push(c[1]); else shortlist.splice(i, 1);
      var on = i === -1;
      btn.setAttribute('aria-pressed', on);
      btn.textContent = on ? '✓ Shortlisted' : '+ Shortlist';
      if (on) checkArea(FN[c[0]]);
      syncShortlist();
    });
    casesEl.appendChild(el);
  });
  var filters = $('#filters');
  ['All'].concat(FN).forEach(function (name, i) {
    var b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.setAttribute('aria-pressed', i === 0);
    var count = i === 0 ? CASES.length : CASES.filter(function (c) { return c[0] === i - 1; }).length;
    b.innerHTML = name + '<span class="n">' + count + '</span>';
    b.addEventListener('click', function () {
      $$('.chip', filters).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      $$('.case', casesEl).forEach(function (el) { el.hidden = i !== 0 && +el.dataset.fn !== i - 1; });
    });
    filters.appendChild(b);
  });

  /* ---------- message composer (shared by shortlist, calculator, quiz) ---------- */
  var blocks = {};
  var msg = $('#msg');
  var userText = '';
  function compose() {
    var parts = [];
    if (blocks.short) parts.push(blocks.short);
    if (blocks.calc) parts.push(blocks.calc);
    if (blocks.quiz) parts.push(blocks.quiz);
    if (blocks.plan) parts.push(blocks.plan);
    var auto = parts.join('\n\n');
    msg.value = (userText ? userText + (auto ? '\n\n' : '') : '') + auto;
  }
  msg.addEventListener('input', function () {
    // Keep whatever the visitor typed above the auto-filled blocks.
    var auto = [blocks.short, blocks.calc, blocks.quiz, blocks.plan].filter(Boolean).join('\n\n');
    var v = msg.value;
    userText = auto && v.slice(-auto.length) === auto ? v.slice(0, -auto.length).replace(/\s+$/, '') : v;
  });
  function syncShortlist() {
    blocks.short = shortlist.length ? 'Use cases I’m interested in:\n' + shortlist.map(function (s) { return '• ' + s; }).join('\n') : '';
    compose();
  }
  function checkArea(v) { $$('input[name=area]').forEach(function (cb) { if (cb.value === v) cb.checked = true; }); }
  function goContact() {
    var f = $('#form');
    $('#contact').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    f.classList.remove('flash'); void f.offsetWidth; f.classList.add('flash');
    setTimeout(function () { f.elements.name.focus({ preventScroll: true }); }, reduced ? 0 : 600);
  }
  $$('[data-plan]').forEach(function (a) {
    a.addEventListener('click', function () { blocks.plan = 'I’d like to talk about: ' + a.dataset.plan; compose(); });
  });

  /* ---------- calculator ---------- */
  var money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var num = function (n) { return Math.round(n).toLocaleString('en-US'); };
  var C = { people: $('#c-people'), hours: $('#c-hours'), rate: $('#c-rate'), pct: $('#c-pct') };
  var lastCalc = null;
  function paint(r) { r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); }
  function calc() {
    var p = +C.people.value, h = +C.hours.value, rate = +C.rate.value, pct = +C.pct.value / 100;
    var weekNow = p * h, weekBack = weekNow * pct, year = weekBack * 48, value = year * rate, fte = year / 1800;
    $('#o-people').textContent = p;
    $('#o-hours').textContent = h;
    $('#o-rate').textContent = '$' + rate;
    $('#o-pct').textContent = Math.round(pct * 100) + '%';
    $('#r-year').firstChild.nodeValue = num(year);
    $('#r-week').textContent = num(weekBack) + ' hours a week returned to your team';
    $('#r-value').textContent = money(value);
    $('#r-fte').textContent = fte < 10 ? fte.toFixed(1) : num(fte);
    $('#b-now').style.width = '100%';
    $('#b-ai').style.width = (100 - pct * 100) + '%';
    $('#b-now-l').textContent = num(weekNow) + 'h';
    $('#b-ai-l').textContent = num(weekNow - weekBack) + 'h';
    Object.keys(C).forEach(function (k) { paint(C[k]); });
    lastCalc = { p: p, h: h, rate: rate, pct: pct, year: year, value: value, weekBack: weekBack };
  }
  Object.keys(C).forEach(function (k) { C[k].addEventListener('input', calc); });
  calc();
  $('#calcSend').addEventListener('click', function () {
    var c = lastCalc;
    blocks.calc = 'My time-back estimate:\n• ' + c.p + ' people × ' + c.h + ' hrs/week of admin at ~$' + c.rate + '/hr\n• Assuming ' + Math.round(c.pct * 100) +
      '% can be automated: ~' + num(c.weekBack) + ' hrs/week, ' + num(c.year) + ' hrs/year, ' + money(c.value) + '/year';
    compose(); goContact();
  });

  /* ---------- readiness check ---------- */
  var QUIZ = [
    { q: 'How are your core processes documented?', o: ['Mostly in people’s heads', 'Partly written down', 'Clearly documented and followed'] },
    { q: 'Where does your customer and lead data live?', o: ['Inboxes and scattered spreadsheets', 'A CRM, but it’s patchy', 'A CRM the team keeps up to date'] },
    { q: 'How is your team using AI today?', o: ['Not really', 'A few people, on their own', 'Some shared workflows already'] },
    { q: 'Who would own an AI rollout?', o: ['Nobody yet', 'Someone, alongside their day job', 'A clear owner with time for it'] },
    { q: 'How do you measure results today?', o: ['Mostly gut feel', 'Some reports, now and then', 'Regular KPIs we review'] },
    { q: 'Which area costs you the most time?', o: FN, area: true }
  ];
  var answers = [], step = 0, body = $('#q-body'), back = $('#q-back');
  function renderQ() {
    var item = QUIZ[step];
    $('#q-count').textContent = 'Question ' + (step + 1) + ' of ' + QUIZ.length;
    $('#q-bar').style.width = (step / QUIZ.length * 100) + '%';
    back.hidden = step === 0;
    body.innerHTML = '<span class="mono" style="color:var(--accent)">Q' + (step + 1) + '</span><h3></h3><div class="opts"></div>';
    body.querySelector('h3').textContent = item.q;
    var wrap = body.querySelector('.opts');
    item.o.forEach(function (text, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.innerHTML = '<span class="k">' + (i + 1) + '</span><span></span>';
      b.lastChild.textContent = text;
      b.addEventListener('click', function () { answer(i); });
      wrap.appendChild(b);
    });
  }
  function answer(i) {
    answers[step] = i;
    step++;
    if (step < QUIZ.length) renderQ(); else result();
  }
  back.addEventListener('click', function () { if (step > 0) { step--; renderQ(); } });
  $('#quiz').addEventListener('keydown', function (e) {
    if (step >= QUIZ.length) return;
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= QUIZ[step].o.length) { e.preventDefault(); answer(n - 1); }
  });
  function result() {
    var raw = answers.slice(0, 5).reduce(function (a, b) { return a + b; }, 0); // 0..10
    var pct = Math.round(raw * 10);
    var area = FN[answers[5]];
    var tier = raw <= 3
      ? { t: 'Foundations first', p: 'AI Process Audit', d: 'There’s real opportunity here, but AI works best on a clear process. We’d start by mapping how work flows today and finding two or three quick wins, so the foundations are solid before anything bigger.' }
      : raw <= 7
      ? { t: 'Ready for quick wins', p: 'AI Process Audit → Implementation Sprint', d: 'You have enough structure to move quickly. A short audit to rank the opportunities, followed by a focused sprint on the highest-impact workflows, would deliver results fast.' }
      : { t: 'Ready to scale', p: 'Implementation Sprint or AI Partner', d: 'Your processes and data are in good shape. You’re ready for connected systems across functions, and an ongoing partner to keep improving them.' };
    $('#q-count').textContent = 'Your result';
    $('#q-bar').style.width = '100%';
    back.hidden = false;
    var C2 = 2 * Math.PI * 70;
    body.innerHTML =
      '<div class="score"><svg class="gauge" viewBox="0 0 180 180" role="img" aria-label="Readiness score ' + pct + ' out of 100">' +
      '<circle class="bg" cx="90" cy="90" r="70"/><circle class="fg" cx="90" cy="90" r="70" stroke-dasharray="' + C2 + '" stroke-dashoffset="' + C2 + '"/>' +
      '<text x="90" y="100" text-anchor="middle">' + pct + '</text><text class="of" x="90" y="124" text-anchor="middle">/ 100</text></svg>' +
      '<div><span class="mono" style="color:var(--accent)">Readiness score</span><h3></h3><p class="d"></p>' +
      '<p><strong>Recommended start:</strong> <span class="p"></span><br><strong>Focus area:</strong> <span class="a"></span></p>' +
      '<div class="acts"><button class="btn" type="button" id="q-send">Send me my results &rarr;</button><button class="link" type="button" id="q-restart">Retake</button></div></div></div>';
    body.querySelector('h3').textContent = tier.t;
    body.querySelector('.d').textContent = tier.d;
    body.querySelector('.p').textContent = tier.p;
    body.querySelector('.a').textContent = area;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { body.querySelector('.fg').style.strokeDashoffset = C2 * (1 - pct / 100); });
    });
    $('#q-restart').addEventListener('click', function () { answers = []; step = 0; renderQ(); });
    $('#q-send').addEventListener('click', function () {
      blocks.quiz = 'My readiness check: ' + pct + '/100 (' + tier.t + ')\n• Recommended start: ' + tier.p + '\n• Biggest time cost: ' + area;
      checkArea(area);
      compose(); goContact();
    });
  }
  renderQ();

  /* ---------- form delivery (shared by contact form and booking) ---------- */
  function deliver(subject, fields, replyTo) {
    var payload = { _subject: subject, _template: 'table', _captcha: 'false' };
    if (replyTo) payload._replyto = replyTo;
    Object.keys(fields).forEach(function (k) { payload[k] = fields[k]; });
    return fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok || String(d.success) !== 'true') throw new Error(d.message || 'Send failed');
        return d;
      });
    });
  }
  function mailtoHref(subject, fields) {
    var text = Object.keys(fields).map(function (k) { return k + ': ' + fields[k]; }).join('\n');
    return 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
  }
  function validate(f, errEl) {
    var problems = [];
    if (!f.name.value.trim()) problems.push('your name');
    if (!f.email.value.trim() || !f.email.checkValidity()) problems.push('a valid email');
    if (problems.length) {
      errEl.textContent = 'Please add ' + problems.join(' and ') + '.';
      errEl.hidden = false;
      (f.name.value.trim() ? f.email : f.name).focus();
      return false;
    }
    errEl.hidden = true;
    return true;
  }
  function showFailure(errEl, subject, fields) {
    errEl.innerHTML = 'Sorry, that didn’t send. Please try again, or <a href="#">email us directly</a>.';
    errEl.querySelector('a').href = mailtoHref(subject, fields);
    errEl.hidden = false;
  }
  function busy(btn, on, label) {
    btn.disabled = on;
    if (on) { btn.dataset.label = btn.innerHTML; btn.textContent = label; } else if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }

  /* ---------- contact form ---------- */
  var form = $('#form'), err = $('#formErr');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements;
    if (f._honey.value) return; // bot trap
    if (!validate(f, err)) return;
    var areas = $$('input[name=area]:checked').map(function (c) { return c.value; }).join(', ') || 'Not specified';
    var fields = { Name: f.name.value.trim(), Email: f.email.value.trim(), Company: f.company.value.trim() || '-',
      'Team size': f.size.value, Focus: areas, Message: f.msg.value.trim() || '-' };
    var subject = 'Website enquiry: ' + fields.Name + (f.company.value.trim() ? ' (' + fields.Company + ')' : '');
    var btn = form.querySelector('[type=submit]');
    busy(btn, true, 'Sending…');
    deliver(subject, fields, fields.Email).then(function () {
      form.classList.add('done');
      $('#sent').classList.add('show');
      $('#sent').focus();
    }).catch(function () {
      showFailure(err, subject, fields);
    }).then(function () { busy(btn, false); });
  });

  /* ---------- booking calendar ---------- */
  var booker = $('#booker');
  var SLOTS = [9, 10, 11, 13, 14, 15, 16];
  var LEAD_DAYS = 1, WINDOW_DAYS = 28;
  var tz = (function () {
    try {
      var part = new Intl.DateTimeFormat('en-US', { timeZoneName: 'long' }).formatToParts(new Date())
        .filter(function (p) { return p.type === 'timeZoneName'; })[0];
      if (part) return part.value;
    } catch (e) { /* fall through */ }
    return (Intl.DateTimeFormat().resolvedOptions().timeZone || 'your local time').replace(/_/g, ' ');
  })();
  $$('[data-tz]').forEach(function (el) { el.textContent = tz; });

  if (BOOKING_URL) {
    var url = BOOKING_URL + (BOOKING_URL.indexOf('?') === -1 ? '?' : '&') +
      (/calendly\.com/.test(BOOKING_URL) ? 'embed_type=Inline&hide_gdpr_banner=1&embed_domain=' + location.hostname : 'embed=true');
    var frame = document.createElement('iframe');
    frame.src = url;
    frame.title = 'Book a call';
    frame.loading = 'lazy';
    frame.className = 'book-frame';
    $('#bookStage').textContent = '';
    $('#bookStage').appendChild(frame);
  } else if (booker) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var first = new Date(today); first.setDate(first.getDate() + LEAD_DAYS);
    var last = new Date(today); last.setDate(last.getDate() + WINDOW_DAYS);
    var viewMonth = new Date(first.getFullYear(), first.getMonth(), 1);
    var picked = null, pickedSlot = null;
    var dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    var monFmt = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
    var timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
    var bookable = function (d) { var w = d.getDay(); return d >= first && d <= last && w !== 0 && w !== 6; };
    var sameDay = function (a, b) { return a && b && a.toDateString() === b.toDateString(); };
    var slotDate = function (d, h) { var x = new Date(d); x.setHours(h, 0, 0, 0); return x; };

    // Default to the first bookable day so the slots column is never empty.
    picked = new Date(first);
    while (!bookable(picked)) picked.setDate(picked.getDate() + 1);

    var grid = $('#calGrid'), slotsEl = $('#calSlots');
    function renderCal() {
      $('#calMonth').textContent = monFmt.format(viewMonth);
      $('#calPrev').disabled = viewMonth <= new Date(first.getFullYear(), first.getMonth(), 1);
      $('#calNext').disabled = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1) > last;
      grid.textContent = '';
      var lead = (viewMonth.getDay() + 6) % 7; // Monday-first
      for (var i = 0; i < lead; i++) grid.appendChild(document.createElement('span'));
      var days = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
      for (var dnum = 1; dnum <= days; dnum++) {
        (function (d) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'day';
          b.textContent = d.getDate();
          b.setAttribute('aria-label', dayFmt.format(d));
          if (sameDay(d, today)) b.classList.add('today');
          if (!bookable(d)) b.disabled = true;
          if (sameDay(d, picked)) { b.setAttribute('aria-pressed', 'true'); }
          b.addEventListener('click', function () { picked = d; pickedSlot = null; renderCal(); renderSlots(); });
          grid.appendChild(b);
        })(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), dnum));
      }
    }
    function renderSlots() {
      $('#slotDay').textContent = dayFmt.format(picked);
      slotsEl.textContent = '';
      var now = new Date();
      SLOTS.forEach(function (h) {
        var t = slotDate(picked, h);
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'slot';
        b.textContent = timeFmt.format(t);
        b.disabled = t <= now;
        b.addEventListener('click', function () { pickedSlot = t; toDetails(); });
        slotsEl.appendChild(b);
      });
    }
    $('#calPrev').addEventListener('click', function () { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1); renderCal(); });
    $('#calNext').addEventListener('click', function () { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1); renderCal(); });

    function step(name) {
      $$('.book-step', booker).forEach(function (s) { s.hidden = s.dataset.step !== name; });
      var target = $('.book-step[data-step="' + name + '"] [data-focus]', booker);
      if (target) target.focus();
    }
    function whenText() {
      var end = new Date(pickedSlot.getTime() + 30 * 60000);
      return dayFmt.format(pickedSlot) + ', ' + timeFmt.format(pickedSlot) + ' – ' + timeFmt.format(end) + ' (' + tz + ')';
    }
    function toDetails() {
      $$('[data-when]', booker).forEach(function (el) { el.textContent = whenText(); });
      step('details');
    }
    $('#bookBack').addEventListener('click', function () { step('pick'); });

    var bform = $('#bookForm'), berr = $('#bookErr');
    bform.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = bform.elements;
      if (f._honey.value) return;
      if (!validate(f, berr)) return;
      var context = [blocks.short, blocks.calc, blocks.quiz].filter(Boolean).join('\n\n');
      var fields = { 'Requested time': whenText(), 'Requested time (UTC)': pickedSlot.toISOString(),
        Name: f.name.value.trim(), Email: f.email.value.trim(), Company: f.company.value.trim() || '-',
        'What to cover': f.notes.value.trim() || '-' };
      if (context) fields['From the website tools'] = context;
      var subject = 'Call request: ' + fields.Name + ', ' + dayFmt.format(pickedSlot) + ' ' + timeFmt.format(pickedSlot);
      var btn = bform.querySelector('[type=submit]');
      busy(btn, true, 'Sending…');
      deliver(subject, fields, fields.Email).then(function () {
        $('#icsLink').href = icsHref(pickedSlot);
        step('done');
      }).catch(function () {
        showFailure(berr, subject, fields);
      }).then(function () { busy(btn, false); });
    });

    function icsHref(start) {
      var stamp = function (d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
      var end = new Date(start.getTime() + 30 * 60000);
      var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Brooks Process Solutions//Booking//EN', 'BEGIN:VEVENT',
        'UID:' + start.getTime() + '@brooksprocesssolutions', 'DTSTAMP:' + stamp(new Date()),
        'DTSTART:' + stamp(start), 'DTEND:' + stamp(end),
        'SUMMARY:Intro call with Brooks Process Solutions (requested)',
        'DESCRIPTION:Tentative hold. We will confirm the time and send a video link by email.',
        'STATUS:TENTATIVE', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    }

    viewMonth = new Date(picked.getFullYear(), picked.getMonth(), 1);
    renderCal();
    renderSlots();
  }
})();
