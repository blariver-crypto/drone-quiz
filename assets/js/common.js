/* 共通ユーティリティ（名前空間 DroneQuiz）*/
(function () {
  'use strict';

  var SESSION_KEY = 'droneQuizSession';
  var HISTORY_KEY = 'droneQuizHistory';

  function saveSession(data) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  }
  function loadSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function appendHistory(record) {
    var hist = loadHistory();
    hist.push(record);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
  }

  // Netlify Forms にサブミット
  // https://docs.netlify.com/forms/setup/#submit-javascript-rendered-forms-with-ajax
  function submitToNetlify(record) {
    var body = {
      'form-name': 'quiz-results',
      'bot-field': '',
      name: record.name || '',
      student_id: record.student_id || '',
      chapter: record.chapter || '',
      score: String(record.score),
      total: String(record.total),
      percentage: String(record.percentage),
      duration_sec: String(record.duration_sec),
      submitted_at: record.submitted_at || '',
      details: JSON.stringify(record.details || [])
    };
    var form = Object.keys(body).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(body[k]);
    }).join('&');
    return fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    });
  }

  // 問題JSONをロード（?chapter= を chapter2.json にマップ）
  function loadChapter(chapterId) {
    var url = '/data/' + chapterId + '.json';
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('問題データ取得失敗: ' + url);
      return r.json();
    });
  }

  function getParam(name) {
    var m = new URLSearchParams(window.location.search).get(name);
    return m || '';
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(d) {
    if (!(d instanceof Date)) d = new Date(d);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  window.DroneQuiz = {
    saveSession: saveSession,
    loadSession: loadSession,
    clearSession: clearSession,
    loadHistory: loadHistory,
    appendHistory: appendHistory,
    submitToNetlify: submitToNetlify,
    loadChapter: loadChapter,
    getParam: getParam,
    shuffle: shuffle,
    escapeHTML: escapeHTML,
    formatDate: formatDate
  };
})();
