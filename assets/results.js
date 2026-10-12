/* Client results dashboard.
   Data comes from a Google Sheet published to the web as CSV, with columns:
     section, label, value, baseline, unit, better, note
   Sections: info, hero, kpi, trend:<chart name>, workflow, milestone.
   Link format: results.html?id=<published id, the part after /d/e/>&gid=<tab id>
   With no id (or ?demo) the page shows the built-in example data. */
(function () {
  'use strict';

  var DEMO_CSV = [
    'section,label,value,baseline,unit,better,note',
    'info,Client,Example: Surrey electrical contractor,,,,',
    'info,Engagement,Implementation Sprint + AI Partner,,,,',
    'info,Started,April 2026,,,,',
    'info,Last updated,30 September 2026,,,,',
    'hero,Admin hours saved so far,212,,hrs,,Across April to September 2026',
    'kpi,Average first reply to a new enquiry,6,450,mins,down,Was the next working evening',
    'kpi,Quotes followed up,100,35,%,up,Every quote gets 3 polite chasers',
    'kpi,Quote win rate,31,22,%,up,Jobs won ÷ quotes sent',
    'kpi,Office admin per week,5,14,hrs,down,"Invoicing, confirmations and reminders"',
    'kpi,New Google reviews per month,11,2,,up,Asked automatically after sign-off',
    'kpi,Estimated value of extra jobs won,58500,,£,up,"Estimate: extra jobs × average job value"',
    'trend:Admin hours saved,Apr,18,,hrs,up,Hours of office work handled by the workflows each month',
    'trend:Admin hours saved,May,29,,hrs,up,',
    'trend:Admin hours saved,Jun,34,,hrs,up,',
    'trend:Admin hours saved,Jul,38,,hrs,up,',
    'trend:Admin hours saved,Aug,44,,hrs,up,',
    'trend:Admin hours saved,Sep,49,,hrs,up,',
    'trend:Jobs won from quotes,Apr,9,9,,up,Jobs won each month. The line shows the monthly average before we started',
    'trend:Jobs won from quotes,May,11,9,,up,',
    'trend:Jobs won from quotes,Jun,12,9,,up,',
    'trend:Jobs won from quotes,Jul,13,9,,up,',
    'trend:Jobs won from quotes,Aug,12,9,,up,',
    'trend:Jobs won from quotes,Sep,14,9,,up,',
    'workflow,Instant enquiry reply,Live,,,,"Website, Checkatrade and email enquiries answered within minutes, approved from your phone"',
    'workflow,Quote follow-up,Live,,,,"Chasers on day 2, 5 and 10; stops as soon as the customer replies"',
    'workflow,Reviews and referrals,Live,,,,Thank-you and review link when a job is signed off',
    'workflow,Survey to quote,Building,,,,Voice note from site to a draft quote in your template',
    'workflow,Invoice reminders,Planned,,,,Polite reminders for overdue invoices from Xero',
    'milestone,Process audit complete,April 2026,done,,,Baseline measured and roadmap agreed',
    'milestone,First workflows live,May 2026,done,,,Enquiry replies and quote follow-up',
    'milestone,Reviews workflow live,July 2026,done,,,',
    'milestone,Survey-to-quote pilot,October 2026,next,,,Testing on real jobs with the team',
    'milestone,Quarterly review,December 2026,planned,,,Agree the next workflows'
  ].join('\n');

  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    var rows = [], row = [], f = '', q = false;
    text = text.replace(/^﻿/, '');
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(f); rows.push(row); row = []; f = '';
      } else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    var head = (rows.shift() || []).map(function (h) { return h.trim().toLowerCase(); });
    return rows.filter(function (r) { return r.join('').trim(); }).map(function (r) {
      var o = {};
      head.forEach(function (h, j) { o[h] = (r[j] || '').trim(); });
      return o;
    });
  }

  /* ---------- formatting ---------- */
  function num(v) {
    if (v == null || v === '') return null;
    var n = parseFloat(String(v).replace(/[£,%\s]/g, ''));
    return isFinite(n) ? n : null;
  }
  function round(n, dp) { var m = Math.pow(10, dp); return Math.round(n * m) / m; }
  function fmt(v, unit) {
    var n = num(v);
    if (n == null) return v || '–';
    var u = (unit || '').toLowerCase();
    if (u === '£') return '£' + Math.round(n).toLocaleString('en-GB');
    if (u === '%') return round(n, 1) + '%';
    if (u === 'mins' || u === 'min') return n < 60 ? round(n, 1) + ' min' : round(n / 60, 1) + ' hrs';
    if (u === 'hrs' || u === 'hours') return round(n, 1).toLocaleString('en-GB') + ' hrs';
    if (u === 'x') return round(n, 1) + '×';
    return round(n, 1).toLocaleString('en-GB') + (unit ? ' ' + unit : '');
  }
  function axisFmt(n, unit) {
    var u = (unit || '').toLowerCase();
    var s = n >= 1000 ? round(n / 1000, 1) + 'K' : String(round(n, 1));
    if (u === '£') return '£' + s;
    if (u === '%') return s + '%';
    return s;
  }
  function niceMax(m) {
    if (m <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(m))), r = m / p;
    var step = r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10;
    return step * p;
  }

  /* ---------- tooltip ---------- */
  var tip = $('tip');
  function showTip(target, value, label, evt) {
    tip.textContent = '';
    tip.appendChild(el('strong', null, value));
    tip.appendChild(el('span', null, label));
    tip.hidden = false;
    var r = target.getBoundingClientRect();
    var x = evt && evt.clientX != null ? evt.clientX : r.left + r.width / 2;
    var y = r.top;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px';
    tip.style.top = Math.max(8, y - h - 10) + 'px';
  }
  function hideTip() { tip.hidden = true; }
  window.addEventListener('scroll', function () {
    var a = document.activeElement;
    if (a && a.classList && a.classList.contains('rcol')) a.dispatchEvent(new Event('focus'));
    else hideTip();
  }, { passive: true });

  /* ---------- render ---------- */
  function render(rows, isDemo) {
    var by = function (s) { return rows.filter(function (r) { return r.section === s; }); };

    // header
    var info = by('info'), meta = $('meta');
    meta.textContent = '';
    var client = 'Your results';
    info.forEach(function (r) {
      if (r.label.toLowerCase() === 'client') { client = r.value; return; }
      var d = el('div');
      d.appendChild(el('dt', null, r.label));
      d.appendChild(el('dd', null, r.value));
      meta.appendChild(d);
    });
    $('clientName').textContent = client;
    document.title = client + ' | Results | Brooks Process Solutions';

    var hero = by('hero')[0];
    if (hero) {
      $('heroLabel').textContent = hero.label;
      $('heroValue').textContent = fmt(hero.value, hero.unit);
      $('heroNote').textContent = hero.note || '';
      $('hero').hidden = false;
    }

    // KPI tiles
    var kpis = $('kpis');
    kpis.textContent = '';
    by('kpi').forEach(function (r) {
      var t = el('div', 'kpi-tile');
      t.appendChild(el('span', 'lbl', r.label));
      t.appendChild(el('span', 'val', fmt(r.value, r.unit)));
      var v = num(r.value), b = num(r.baseline);
      if (b != null) {
        t.appendChild(el('span', 'was', 'Before: ' + fmt(r.baseline, r.unit)));
        if (v != null) {
          var down = (r.better || '').toLowerCase() === 'down';
          var diff = v - b, good = down ? diff < 0 : diff > 0;
          var mag = (r.unit === '%') ? round(Math.abs(diff), 1) + ' pts'
            : b !== 0 ? Math.round(Math.abs(diff / b) * 100) + '%' : '';
          var chg = el('span', 'chg ' + (diff === 0 ? 'flat' : good ? 'good' : 'bad'));
          var ic = el('span', 'ic', diff > 0 ? '▲' : diff < 0 ? '▼' : '•');
          ic.setAttribute('aria-hidden', 'true');
          chg.appendChild(ic);
          chg.appendChild(document.createTextNode(diff === 0 ? 'No change' :
            (diff > 0 ? 'Up ' : 'Down ') + mag + (good ? ', better' : ', worse')));
          t.appendChild(chg);
        }
      }
      if (r.note) t.appendChild(el('span', 'note', r.note));
      kpis.appendChild(t);
    });

    // trend charts
    var trends = $('trends'), groups = {}, order = [];
    trends.textContent = '';
    rows.forEach(function (r) {
      if (r.section.indexOf('trend:') !== 0) return;
      var name = r.section.slice(6).trim();
      if (!groups[name]) { groups[name] = []; order.push(name); }
      groups[name].push(r);
    });
    $('trendSec').hidden = !order.length;
    order.forEach(function (name) { trends.appendChild(chart(name, groups[name])); });

    // workflows
    var wf = $('workflows');
    wf.textContent = '';
    by('workflow').forEach(function (r) {
      var li = el('li');
      li.appendChild(el('span', 'name', r.label));
      var st = (r.value || 'Planned');
      li.appendChild(el('span', 'pill ' + st.toLowerCase().replace(/[^a-z]/g, ''), st));
      if (r.note) li.appendChild(el('span', 'desc', r.note));
      wf.appendChild(li);
    });

    // milestones
    var ms = $('milestones');
    ms.textContent = '';
    by('milestone').forEach(function (r) {
      var state = (r.baseline || '').toLowerCase();
      var li = el('li', state === 'done' ? 'done' : '');
      var dot = el('span', 'dot'); dot.setAttribute('aria-hidden', 'true');
      li.appendChild(dot);
      var body = el('div');
      body.appendChild(el('div', 't', r.label));
      body.appendChild(el('div', 'd', (r.value || '') + (state === 'done' ? ' · Done' : state === 'next' ? ' · Up next' : state ? ' · Planned' : '')));
      li.appendChild(body);
      if (r.note) li.appendChild(el('span', 'n', r.note));
      ms.appendChild(li);
    });

    $('demoNote').hidden = !isDemo;
  }

  function chart(name, rows) {
    var unit = (rows.filter(function (r) { return r.unit; })[0] || {}).unit || '';
    var vals = rows.map(function (r) { return num(r.value) || 0; });
    var base = rows.map(function (r) { return num(r.baseline); }).filter(function (b) { return b != null; })[0];
    var top = niceMax(Math.max.apply(null, vals.concat(base != null ? [base] : [0])));
    var maxI = vals.indexOf(Math.max.apply(null, vals)), lastI = vals.length - 1;

    var card = el('div', 'chart-card');
    card.appendChild(el('h3', null, name));
    var note = (rows.filter(function (r) { return r.note; })[0] || {}).note;
    if (note) card.appendChild(el('p', 'sub', note));

    if (base != null) {
      var key = el('div', 'key');
      key.appendChild(el('i'));
      key.appendChild(document.createTextNode('Before we started: ' + fmt(base, unit)));
      card.appendChild(key);
    }
    var plot = el('div', 'plot');
    [0, 0.5, 1].forEach(function (f) {
      var g = el('div', 'grid');
      g.style.bottom = (f * 100) + '%';
      g.appendChild(el('span', null, axisFmt(top * f, unit)));
      plot.appendChild(g);
    });
    var cols = el('div', 'cols');
    rows.forEach(function (r, i) {
      var c = el('div', 'rcol');
      c.tabIndex = 0;
      var h = Math.max(0, vals[i]) / top * 100;
      var bar = el('i'); bar.style.height = h + '%';
      c.appendChild(bar);
      if (i === lastI || i === maxI) {
        var lab = el('b', null, fmt(r.value, unit));
        lab.style.bottom = h + '%';
        c.appendChild(lab);
      }
      var show = function (e) { showTip(c, fmt(r.value, unit), r.label + (base != null ? ' · before: ' + fmt(base, unit) : ''), e); };
      c.addEventListener('pointermove', show);
      c.addEventListener('focus', function () { show(); });
      c.addEventListener('pointerleave', hideTip);
      c.addEventListener('blur', hideTip);
      cols.appendChild(c);
    });
    if (base != null) {
      var ref = el('div', 'ref');
      ref.style.bottom = (base / top * 100) + '%';
      plot.appendChild(ref);
    }
    plot.appendChild(cols);
    card.appendChild(plot);
    cols.querySelectorAll('.rcol').forEach(function (c, i) {
      c.setAttribute('role', 'img');
      c.setAttribute('aria-label', rows[i].label + ': ' + fmt(rows[i].value, unit));
    });
    plot.querySelectorAll('.grid,.ref').forEach(function (g) { g.setAttribute('aria-hidden', 'true'); });

    var ax = el('div', 'xaxis');
    ax.setAttribute('aria-hidden', 'true');
    rows.forEach(function (r) { ax.appendChild(el('span', null, r.label)); });
    card.appendChild(ax);

    var det = el('details');
    det.appendChild(el('summary', null, 'Show as table'));
    var tbl = el('table'), thead = el('thead'), hr = el('tr');
    hr.appendChild(el('th', null, 'Period'));
    hr.appendChild(el('th', null, name));
    thead.appendChild(hr); tbl.appendChild(thead);
    var tb = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(el('td', null, r.label));
      tr.appendChild(el('td', null, fmt(r.value, unit)));
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); det.appendChild(tbl); card.appendChild(det);
    return card;
  }

  /* ---------- load ---------- */
  function sourceURL() {
    var p = new URLSearchParams(location.search);
    if (p.has('demo')) return null;
    var id = p.get('id');
    if (id && /^[\w-]{20,}$/.test(id)) {
      var gid = /^\d+$/.test(p.get('gid') || '') ? p.get('gid') : '0';
      return 'https://docs.google.com/spreadsheets/d/e/' + id + '/pub?gid=' + gid + '&single=true&output=csv';
    }
    return null;
  }

  $('printBtn').addEventListener('click', function (e) { e.preventDefault(); window.print(); });

  var src = sourceURL();
  if (!src) { render(parseCSV(DEMO_CSV), true); return; }
  var note = $('loadNote');
  note.hidden = false; note.textContent = 'Loading your latest figures…';
  fetch(src, { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (t) {
      var rows = parseCSV(t);
      if (!rows.length || !('section' in rows[0])) throw new Error('format');
      note.hidden = true;
      render(rows, false);
    })
    .catch(function () {
      note.className = 'load-note err';
      note.textContent = 'We couldn’t load your figures just now. Please refresh in a minute, or email brooksprocesssolutions@gmail.com and we’ll send them over.';
      $('clientName').textContent = 'Results unavailable';
    });
})();
