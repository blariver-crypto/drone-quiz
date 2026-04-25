/* ダッシュボードの制御 */
(function () {
  'use strict';
  var D = window.DroneQuiz;

  var ALL_CHAPTERS = ['chapter2', 'chapter3'];

  var state = {
    records: [],    // 全受験履歴
    questions: {},  // chapter -> chapter meta (data with .questions, .sections)
    filterChapter: '',
    dataSource: 'localStorage'
  };

  var sourceStatus = document.getElementById('source-status');
  var tabs = document.querySelectorAll('.tab');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      tabs.forEach(function (x) { x.classList.remove('active'); });
      t.classList.add('active');
      ['students', 'sections', 'wrong', 'history'].forEach(function (id) {
        var s = document.getElementById('tab-' + id);
        if (id === t.dataset.tab) s.classList.remove('hidden');
        else s.classList.add('hidden');
      });
    });
  });

  document.getElementById('btn-refresh').addEventListener('click', load);
  document.getElementById('chapter-filter').addEventListener('change', function (e) {
    state.filterChapter = e.target.value;
    render();
  });
  document.getElementById('history-user').addEventListener('change', renderHistory);

  load();

  function load() {
    // 1) Netlify Function から取得を試みる
    // 2) 失敗したら localStorage を使う
    // ついでに問題メタ情報も読み込む
    sourceStatus.textContent = '結果を取得中...';
    fetch('/.netlify/functions/get-submissions', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (json) {
        state.records = (json.records || []).map(normalizeRecord);
        state.dataSource = 'netlify';
        sourceStatus.innerHTML = 'データソース：<strong style="color:var(--success)">Netlify Forms</strong>（' +
          state.records.length + ' 件）';
      })
      .catch(function (e) {
        state.records = D.loadHistory().map(normalizeRecord);
        state.dataSource = 'localStorage';
        sourceStatus.innerHTML = 'データソース：<strong>localStorage</strong>（' + state.records.length +
          ' 件、この端末に保存された履歴のみ）<br>' +
          '<span style="color:var(--muted)">※ Netlify Function 未設定、または環境変数未設定です。</span>';
      })
      .then(function () {
        return Promise.all(ALL_CHAPTERS.map(loadQuestions));
      })
      .then(function () {
        render();
      });
  }

  function loadQuestions(chapter) {
    if (state.questions[chapter]) return Promise.resolve();
    return D.loadChapter(chapter).then(function (data) {
      state.questions[chapter] = data;
    }).catch(function () { /* ignore */ });
  }

  // 章フィルタが「全分野」のときに使えるよう、複数章のメタを統合
  function combinedMeta() {
    var sections = {};
    var questions = [];
    ALL_CHAPTERS.forEach(function (ch) {
      var m = state.questions[ch];
      if (!m) return;
      Object.keys(m.sections || {}).forEach(function (k) {
        sections[k] = m.sections[k];
      });
      (m.questions || []).forEach(function (q) { questions.push(q); });
    });
    return { sections: sections, questions: questions };
  }

  function activeMeta() {
    if (state.filterChapter && state.questions[state.filterChapter]) {
      return state.questions[state.filterChapter];
    }
    return combinedMeta();
  }

  var CHAPTER_TITLES = {
    chapter2: '第2章 無人航空機操縦者の心得',
    chapter3: '第3章 無人航空機に関する規則'
  };

  function normalizeRecord(r) {
    // Netlify Forms submission から返ってくる場合は data ネストなしにしておく
    var ch = r.chapter || 'chapter2';
    var rec = {
      name: r.name || '',
      student_id: r.student_id || '',
      chapter: ch,
      chapter_title: r.chapter_title || CHAPTER_TITLES[ch] || ch,
      count: Number(r.count) || 0,
      score: Number(r.score) || 0,
      total: Number(r.total) || 0,
      percentage: Number(r.percentage) || 0,
      duration_sec: Number(r.duration_sec) || 0,
      submitted_at: r.submitted_at || r.created_at || new Date().toISOString(),
      details: typeof r.details === 'string' ? safeParse(r.details) : (r.details || [])
    };
    return rec;
  }
  function safeParse(s) {
    try { return JSON.parse(s); } catch (e) { return []; }
  }

  function filtered() {
    if (!state.filterChapter) return state.records;
    return state.records.filter(function (r) { return r.chapter === state.filterChapter; });
  }

  function render() {
    var rs = filtered();
    document.getElementById('k-attempts').textContent = rs.length;
    var uniq = new Set(rs.map(function (r) { return r.name + '|' + r.student_id; }));
    document.getElementById('k-unique').textContent = uniq.size;
    if (rs.length === 0) {
      document.getElementById('k-avg').textContent = '—';
      document.getElementById('k-max').textContent = '—';
    } else {
      var avg = rs.reduce(function (a, r) { return a + r.percentage; }, 0) / rs.length;
      var max = rs.reduce(function (a, r) { return Math.max(a, r.percentage); }, 0);
      document.getElementById('k-avg').textContent = Math.round(avg) + '%';
      document.getElementById('k-max').textContent = Math.round(max) + '%';
    }
    renderStudents(rs);
    renderSections(rs);
    renderWrong(rs);
    renderUserSelector(rs);
    renderHistory();
  }

  function renderStudents(rs) {
    var byUser = {};
    rs.forEach(function (r) {
      var key = r.name + '||' + r.student_id;
      if (!byUser[key]) byUser[key] = [];
      byUser[key].push(r);
    });
    var rows = Object.keys(byUser).map(function (k) {
      var list = byUser[k].slice().sort(function (a, b) {
        return new Date(b.submitted_at) - new Date(a.submitted_at);
      });
      var last = list[0];
      var avg = Math.round(list.reduce(function (a, r) { return a + r.percentage; }, 0) / list.length);
      return {
        name: last.name,
        student_id: last.student_id,
        last_at: last.submitted_at,
        last_pct: last.percentage,
        last_score: last.score,
        last_total: last.total,
        avg: avg,
        attempts: list.length
      };
    }).sort(function (a, b) { return b.last_pct - a.last_pct; });

    var tbody = document.querySelector('#students-table tbody');
    tbody.innerHTML = '';
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted">まだ受験結果がありません。</td></tr>';
      return;
    }
    rows.forEach(function (row, i) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + (i + 1) + '</td>' +
        '<td><strong>' + D.escapeHTML(row.name) + '</strong></td>' +
        '<td>' + D.escapeHTML(row.student_id || '-') + '</td>' +
        '<td>' + D.formatDate(row.last_at) + '</td>' +
        '<td>' + row.last_score + '/' + row.last_total + '（' + row.last_pct + '%）</td>' +
        '<td>' +
          '<div class="flex"><div class="bar-wrap" style="width:80px"><span style="width:' + row.avg + '%"></span></div>' +
          '<span>' + row.avg + '%</span></div>' +
        '</td>' +
        '<td>' + row.attempts + '</td>';
      tbody.appendChild(tr);
    });
  }

  function renderSections(rs) {
    var meta = activeMeta();
    var sectionNames = (meta && meta.sections) || {};
    var agg = {};
    rs.forEach(function (r) {
      (r.details || []).forEach(function (d) {
        var sec = d.section || '-';
        if (!agg[sec]) agg[sec] = { correct: 0, total: 0 };
        agg[sec].total++;
        if (d.correct) agg[sec].correct++;
      });
    });
    var tbody = document.querySelector('#sections-table tbody');
    tbody.innerHTML = '';
    var keys = Object.keys(agg).sort();
    if (!keys.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">データがありません。</td></tr>';
      return;
    }
    keys.forEach(function (k) {
      var s = agg[k];
      var p = Math.round(s.correct / s.total * 100);
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><strong>' + D.escapeHTML(k) + '</strong></td>' +
        '<td>' + D.escapeHTML(sectionNames[k] || '-') + '</td>' +
        '<td>' +
          '<div class="flex"><div class="bar-wrap" style="width:160px"><span style="width:' + p + '%"></span></div>' +
          '<span>' + p + '%</span></div>' +
        '</td>' +
        '<td>' + s.correct + ' / ' + s.total + '</td>';
      tbody.appendChild(tr);
    });
  }

  function renderWrong(rs) {
    var meta = activeMeta();
    if (!meta) return;
    var qMap = {};
    (meta.questions || []).forEach(function (q) { qMap[q.id] = q; });

    var agg = {};
    rs.forEach(function (r) {
      (r.details || []).forEach(function (d) {
        if (!d.id) return;
        if (!agg[d.id]) agg[d.id] = { correct: 0, total: 0, section: d.section };
        agg[d.id].total++;
        if (d.correct) agg[d.id].correct++;
      });
    });
    var rows = Object.keys(agg).map(function (id) {
      var s = agg[id];
      return {
        id: id,
        section: s.section || (qMap[id] && qMap[id].section) || '-',
        text: (qMap[id] && qMap[id].question) || '(問題文不明)',
        pct: s.total ? Math.round(s.correct / s.total * 100) : 0,
        total: s.total
      };
    }).sort(function (a, b) { return a.pct - b.pct; }).slice(0, 20);

    var tbody = document.querySelector('#wrong-table tbody');
    tbody.innerHTML = '';
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted">データがありません。</td></tr>';
      return;
    }
    rows.forEach(function (row, i) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + (i + 1) + '</td>' +
        '<td>' + D.escapeHTML(row.id) + '</td>' +
        '<td>' + D.escapeHTML(row.section) + '</td>' +
        '<td>' + D.escapeHTML(row.text) + '</td>' +
        '<td>' +
          '<div class="flex"><div class="bar-wrap" style="width:120px"><span style="width:' + row.pct + '%;background:' +
          (row.pct < 50 ? 'linear-gradient(90deg,var(--danger),var(--accent))' : 'linear-gradient(90deg,var(--primary),var(--accent))') +
          '"></span></div>' +
          '<span>' + row.pct + '%（' + row.total + '回）</span></div>' +
        '</td>';
      tbody.appendChild(tr);
    });
  }

  function renderUserSelector(rs) {
    var sel = document.getElementById('history-user');
    var current = sel.value;
    var keys = {};
    rs.forEach(function (r) {
      var key = r.name + '||' + r.student_id;
      if (!keys[key]) keys[key] = r.name + (r.student_id ? '（' + r.student_id + '）' : '');
    });
    sel.innerHTML = '';
    var opts = Object.keys(keys);
    if (!opts.length) {
      var opt = document.createElement('option');
      opt.textContent = '（受験者なし）';
      sel.appendChild(opt);
      return;
    }
    opts.forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = keys[k];
      sel.appendChild(o);
    });
    if (current && keys[current]) sel.value = current;
  }

  function renderHistory() {
    var sel = document.getElementById('history-user');
    var key = sel.value || '';
    var rs = filtered().filter(function (r) {
      return (r.name + '||' + r.student_id) === key;
    }).sort(function (a, b) {
      return new Date(a.submitted_at) - new Date(b.submitted_at);
    });

    var tbody = document.querySelector('#history-table tbody');
    var chart = document.getElementById('history-chart');
    tbody.innerHTML = '';
    chart.innerHTML = '';

    if (!rs.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted">履歴がありません。</td></tr>';
      return;
    }

    // 簡易スパークライン（SVG折れ線）
    var w = 520, h = 120, pad = 24;
    var ys = rs.map(function (r) { return r.percentage; });
    var xs = rs.map(function (_, i) { return pad + (w - 2 * pad) * (rs.length === 1 ? 0.5 : i / (rs.length - 1)); });
    var pts = xs.map(function (x, i) {
      var y = h - pad - (h - 2 * pad) * (ys[i] / 100);
      return x + ',' + y;
    }).join(' ');
    var dots = xs.map(function (x, i) {
      var y = h - pad - (h - 2 * pad) * (ys[i] / 100);
      return '<circle cx="' + x + '" cy="' + y + '" r="4" fill="#0b67c2"/>' +
        '<text x="' + x + '" y="' + (y - 8) + '" text-anchor="middle" font-size="11" fill="#1b2a3a">' + ys[i] + '</text>';
    }).join('');
    chart.innerHTML =
      '<svg width="100%" viewBox="0 0 ' + w + ' ' + h + '" style="margin:10px 0">' +
        '<line x1="' + pad + '" y1="' + (h - pad) + '" x2="' + (w - pad) + '" y2="' + (h - pad) + '" stroke="#e2e8f0"/>' +
        '<polyline fill="none" stroke="#0b67c2" stroke-width="2" points="' + pts + '"/>' +
        dots +
      '</svg>';

    rs.forEach(function (r, i) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + (i + 1) + '</td>' +
        '<td>' + D.formatDate(r.submitted_at) + '</td>' +
        '<td>' + D.escapeHTML(r.chapter_title || r.chapter) + '</td>' +
        '<td>' + r.score + '/' + r.total + '</td>' +
        '<td>' + r.percentage + '%</td>' +
        '<td>' + formatDuration(r.duration_sec) + '</td>';
      tbody.appendChild(tr);
    });
  }

  function formatDuration(sec) {
    if (!sec) return '-';
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + '分' + (s < 10 ? '0' : '') + s + '秒';
  }
})();
