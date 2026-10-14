/* Brooks Process Solutions: interactions for the trades package site (index.html).
   The archived consultancy site still uses main.js. */
(function () {
  'use strict';
  /* ---------- site configuration ----------
     CONTACT_EMAIL  where enquiries go (also the mailto fallback).
     FORM_ENDPOINT  FormSubmit AJAX endpoint, using the private alias FormSubmit issued for
                    CONTACT_EMAIL so the address is not in the request URL. To change the
                    inbox, put the new email here, activate it, then swap in its new alias.
     MAKE_WEBHOOK   optional. Make (make.com) custom webhook that also receives every form
                    submission as simple fields, so it can be added to HubSpot automatically.
     BOOKING_URL    optional. Paste a Calendly or Cal.com scheduling link (for example
                    'https://calendly.com/your-name/30min') to embed it instead of the
                    built-in request-a-time calendar. */
  var CONTACT_EMAIL = 'brooksprocesssolutions@gmail.com';
  var FORM_ENDPOINT = 'https://formsubmit.co/ajax/91353fed478083e64f7aa009c8da68a5';
  var BOOKING_URL = 'https://cal.com/devin-brooks-ok2jta/free-intro-call';
  var MAKE_WEBHOOK = 'https://hook.eu1.make.com/n2tzgpkn5tiwyp5lcjwws9aanp8972dy';
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

  /* ---------- message composer (calculator and pricing buttons fill the message box) ---------- */
  var blocks = {};
  var msg = $('#msg');
  var userText = '';
  function autoText() { return [blocks.calc, blocks.plan].filter(Boolean).join('\n\n'); }
  function compose() {
    var auto = autoText();
    msg.value = (userText ? userText + (auto ? '\n\n' : '') : '') + auto;
  }
  msg.addEventListener('input', function () {
    // Keep whatever the visitor typed above the auto-filled blocks.
    var auto = autoText(), v = msg.value;
    userText = auto && v.slice(-auto.length) === auto ? v.slice(0, -auto.length).replace(/\s+$/, '') : v;
  });
  function goContact() {
    var f = $('#form');
    $('#contact').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    f.classList.remove('flash'); void f.offsetWidth; f.classList.add('flash');
    setTimeout(function () { f.elements.name.focus({ preventScroll: true }); }, reduced ? 0 : 600);
  }
  $$('[data-plan]').forEach(function (a) {
    a.addEventListener('click', function () { blocks.plan = 'I’d like to ask about: ' + a.dataset.plan; compose(); });
  });

  /* ---------- missed-jobs calculator ----------
     Cautious model: only half of the slipping enquiries are assumed recoverable,
     and those convert at the visitor's usual win rate. */
  var RECOVERABLE = 0.5;
  var money = function (n) { return '£' + Math.round(n).toLocaleString('en-GB'); };
  var num = function (n) { return Math.round(n).toLocaleString('en-GB'); };
  var one = function (n) { return n < 10 ? (Math.round(n * 10) / 10).toLocaleString('en-GB') : num(n); };
  var C = { enq: $('#c-enq'), job: $('#c-job'), miss: $('#c-miss'), win: $('#c-win') };
  var lastCalc = null;
  function paint(r) { r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); }
  function calc() {
    var enq = +C.enq.value, job = +C.job.value, miss = +C.miss.value / 100, win = +C.win.value / 100;
    var lost = enq * miss, saved = lost * RECOVERABLE, jobsMonth = saved * win, jobsYear = jobsMonth * 12, value = jobsYear * job;
    $('#o-enq').textContent = enq;
    $('#o-job').textContent = money(job);
    $('#o-miss').textContent = Math.round(miss * 100) + '%';
    $('#o-win').textContent = Math.round(win * 100) + '%';
    $('#r-value').firstChild.nodeValue = money(value);
    $('#r-jobs').textContent = one(jobsYear) + ' extra jobs a year';
    $('#r-lost').textContent = one(lost);
    $('#r-month').textContent = one(jobsMonth);
    $('#b-now').style.width = (100 - miss * 100) + '%';
    $('#b-ai').style.width = (100 - (miss - miss * RECOVERABLE) * 100) + '%';
    $('#b-now-l').textContent = num(enq - lost);
    $('#b-ai-l').textContent = num(enq - lost + saved);
    Object.keys(C).forEach(function (k) { paint(C[k]); });
    lastCalc = { enq: enq, job: job, miss: miss, win: win, jobsYear: jobsYear, value: value };
  }
  Object.keys(C).forEach(function (k) { C[k].addEventListener('input', calc); });
  calc();
  $('#calcSend').addEventListener('click', function () {
    var c = lastCalc;
    blocks.calc = 'My missed-jobs estimate:\n• ' + c.enq + ' enquiries a month, average job ' + money(c.job) + '\n• ' + Math.round(c.miss * 100) +
      '% missed or answered late, usual win rate ' + Math.round(c.win * 100) + '%\n• Estimate: ~' + one(c.jobsYear) + ' extra jobs, ' + money(c.value) + ' a year';
    compose(); goContact();
  });

  /* ---------- form delivery ---------- */
  // Copy each submission to Make as plain form fields. Resolves true once the request has been
  // delivered (the response is opaque, so a resolved fetch is the only signal), false otherwise.
  function notifyMake(subject, fields) {
    if (!MAKE_WEBHOOK) return Promise.resolve(false);
    try {
      var body = new URLSearchParams();
      body.append('type', /^Call request/.test(subject) ? 'call_request' : 'enquiry');
      body.append('subject', subject);
      Object.keys(fields).forEach(function (k) {
        body.append(k.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), fields[k]);
      });
      body.append('page', location.href);
      body.append('submitted_at', new Date().toISOString());
      return fetch(MAKE_WEBHOOK, { method: 'POST', mode: 'no-cors', keepalive: true, body: body })
        .then(function () { return true; }, function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  function sendEmail(subject, fields, replyTo) {
    var payload = { _subject: subject, _template: 'table', _captcha: 'false' };
    if (replyTo) payload._replyto = replyTo;
    Object.keys(fields).forEach(function (k) { payload[k] = fields[k]; });
    return fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok || String(d.success) !== 'true') throw new Error(d.message || ('Send failed, status ' + r.status));
        return d;
      });
    });
  }
  // Succeeds if either channel takes the submission: the email (FormSubmit) or the CRM feed (Make).
  function deliver(subject, fields, replyTo) {
    var toMake = notifyMake(subject, fields);
    return sendEmail(subject, fields, replyTo).then(function (d) { return d; }, function (emailErr) {
      if (window.console) console.warn('Email delivery failed, checking CRM feed:', emailErr && emailErr.message);
      return toMake.then(function (ok) {
        if (ok) return { success: 'true', via: 'make' };
        throw emailErr;
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
  function showFailure(errEl, subject, fields, error) {
    var reason = (error && error.message) || '';
    if (window.console) console.warn('Form delivery failed:', reason);
    errEl.innerHTML = /activat/i.test(reason)
      ? 'This form hasn’t been activated yet. The site owner needs to click the activation link FormSubmit emailed to ' + CONTACT_EMAIL + '. Meanwhile, you can <a href="#">email us directly</a>.'
      : 'Sorry, that didn’t send. Please try again, or <a href="#">email us directly</a>.';
    errEl.querySelector('a').href = mailtoHref(subject, fields);
    if (reason && !/activat/i.test(reason)) {
      var d = document.createElement('small');
      d.className = 'err-detail';
      d.textContent = ' (Reason: ' + reason.slice(0, 160) + ')';
      errEl.appendChild(d);
    }
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
      Trade: f.trade.value, 'Jobs slipping': areas, Message: f.msg.value.trim() || '-' };
    var subject = 'Website enquiry: ' + fields.Name + (f.company.value.trim() ? ' (' + fields.Company + ')' : '');
    var btn = form.querySelector('[type=submit]');
    busy(btn, true, 'Sending…');
    deliver(subject, fields, fields.Email).then(function () {
      form.classList.add('done');
      $('#sent').classList.add('show');
      $('#sent').focus();
    }).catch(function (e) {
      showFailure(err, subject, fields, e);
    }).then(function () { busy(btn, false); });
  });


  /* ---------- booking (Cal.com inline embed, with a plain link as fallback) ---------- */
  var tz = (function () {
    try {
      var part = new Intl.DateTimeFormat('en-GB', { timeZoneName: 'long' }).formatToParts(new Date())
        .filter(function (p) { return p.type === 'timeZoneName'; })[0];
      if (part) return part.value;
    } catch (e) { /* fall through */ }
    return (Intl.DateTimeFormat().resolvedOptions().timeZone || 'your local time').replace(/_/g, ' ');
  })();
  $$('[data-tz]').forEach(function (el) { el.textContent = tz; });

  if (BOOKING_URL) {
    var stage = $('#bookStage');
    stage.textContent = '';
    // Fallback link, shown until (and in case) the embed loads.
    var fallback = document.createElement('p');
    fallback.className = 'book-fallback';
    var fbLink = document.createElement('a');
    fbLink.className = 'btn';
    fbLink.href = BOOKING_URL;
    fbLink.target = '_blank';
    fbLink.rel = 'noopener';
    fbLink.textContent = 'Open the booking calendar \u2192';
    fallback.appendChild(document.createTextNode('Loading the booking calendar\u2026 '));
    fallback.appendChild(fbLink);
    stage.appendChild(fallback);
    var calMatch = BOOKING_URL.match(/^https:\/\/(?:app\.)?cal\.com\/(.+?)\/?$/);
    if (calMatch) {
      // Cal.com's official inline embed (loads app.cal.com/embed/embed.js).
      var holder = document.createElement('div');
      holder.id = 'calInline';
      holder.className = 'cal-inline';
      stage.appendChild(holder);
      (function (C, A, L) { var p = function (a, ar) { a.q.push(ar); }; var d = C.document; C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement('script')).src = A; cal.loaded = true; } if (ar[0] === L) { var api = function () { p(api, arguments); }; var namespace = ar[1]; api.q = api.q || []; if (typeof namespace === 'string') { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ['initNamespace', namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, 'https://app.cal.com/embed/embed.js', 'init');
      window.Cal('init', 'intro', { origin: 'https://cal.com' });
      window.Cal.ns.intro('inline', { elementOrSelector: '#calInline', calLink: calMatch[1], config: { layout: 'month_view', theme: 'light' } });
      window.Cal.ns.intro('ui', { theme: 'light', layout: 'month_view', hideEventTypeDetails: true, cssVarsPerTheme: { light: { 'cal-brand': '#15181d' } } });
      // Hide the loading line once Cal.com has drawn its iframe.
      var tries = 0, check = setInterval(function () {
        if (holder.querySelector('iframe')) { fallback.firstChild.textContent = 'Calendar not showing? '; fallback.classList.add('quiet'); clearInterval(check); }
        else if (++tries > 40) { fallback.firstChild.textContent = 'The calendar couldn\u2019t load here. '; clearInterval(check); }
      }, 250);
    } else {
      var url = BOOKING_URL + (BOOKING_URL.indexOf('?') === -1 ? '?' : '&') +
        (/calendly\.com/.test(BOOKING_URL) ? 'embed_type=Inline&hide_gdpr_banner=1&embed_domain=' + location.hostname : 'embed=true');
      var frame = document.createElement('iframe');
      frame.src = url;
      frame.title = 'Book a call';
      frame.loading = 'lazy';
      frame.className = 'book-frame';
      stage.appendChild(frame);
    }
  }
})();
