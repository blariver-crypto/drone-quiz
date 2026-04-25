/* クイズ画面の制御 */
(function () {
  'use strict';
  var D = window.DroneQuiz;
  var session = D.loadSession();
  var chapterId = D.getParam('chapter') || 'chapter2';
  var requestedCount = parseInt(D.getParam('count') || session.count || '50', 10);
  if (isNaN(requestedCount) || requestedCount <= 0) requestedCount = 50;

  if (!session.name) {
    alert('受講者名が未入力です。トップに戻ります。');
    window.location.href = '/';
    return;
  }

  var state = {
    chapterMeta: null,
    questions: [],
    answers: [],   // 回答した選択肢のindex
    index: 0,
    startedAt: new Date()
  };

  var loadingView = document.getElementById('loading-view');
  var quizView = document.getElementById('quiz-view');
  var resultView = document.getElementById('result-view');

  D.loadChapter(chapterId).then(function (data) {
    state.chapterMeta = data;
    var pool = data.questions || [];
    // 出題数がプールより少ない場合はランダム抽出（多い場合はプール全件）
    var actualCount = Math.min(requestedCount, pool.length);
    state.questions = (actualCount < pool.length)
      ? D.shuffle(pool).slice(0, actualCount)
      : pool.slice();
    state.answers = new Array(state.questions.length).fill(null);

    document.getElementById('p-name').textContent = session.name;
    document.getElementById('p-chapter').textContent = data.title
      + '（' + state.questions.length + '問）';
    document.getElementById('p-total').textContent = state.questions.length;

    loadingView.classList.add('hidden');
    quizView.classList.remove('hidden');
    renderQuestion();
  }).catch(function (e) {
    loadingView.innerHTML = '<p class="muted" style="color:var(--danger)">読み込みエラー：' + D.escapeHTML(e.message) + '</p>';
  });

  function renderQuestion() {
    var q = state.questions[state.index];
    document.getElementById('q-section').textContent = q.section;
    document.getElementById('q-subsection').textContent = q.subsection || '';
    document.getElementById('q-text').textContent = (state.index + 1) + '. ' + q.question;

    var form = document.getElementById('q-form');
    form.innerHTML = '';
    q.choices.forEach(function (c, i) {
      var label = document.createElement('label');
      label.className = 'choice';
      if (state.answers[state.index] === i) label.classList.add('selected');
      label.innerHTML =
        '<input type="radio" name="choice" value="' + i + '"' +
        (state.answers[state.index] === i ? ' checked' : '') + '>' +
        '<span>' + D.escapeHTML(c) + '</span>';
      label.querySelector('input').addEventListener('change', function () {
        state.answers[state.index] = i;
        // 見た目の選択状態を更新
        Array.prototype.forEach.call(form.querySelectorAll('.choice'), function (el) {
          el.classList.remove('selected');
        });
        label.classList.add('selected');
      });
      form.appendChild(label);
    });

    document.getElementById('p-current').textContent = state.index + 1;
    var pct = Math.round(((state.index) / state.questions.length) * 100);
    document.getElementById('p-bar').style.width = pct + '%';

    document.getElementById('btn-prev').disabled = state.index === 0;
    document.getElementById('btn-next').textContent =
      state.index === state.questions.length - 1 ? '結果を見る ✓' : '次の問題 →';
  }

  document.getElementById('btn-prev').addEventListener('click', function () {
    if (state.index > 0) { state.index--; renderQuestion(); }
  });
  document.getElementById('btn-next').addEventListener('click', function () {
    if (state.answers[state.index] === null) {
      if (!confirm('未回答です。スキップして次へ進みますか？')) return;
    }
    if (state.index < state.questions.length - 1) {
      state.index++;
      renderQuestion();
    } else {
      finish();
    }
  });

  function finish() {
    var qs = state.questions;
    var score = 0;
    var details = qs.map(function (q, i) {
      var userIdx = state.answers[i];
      var correct = userIdx === q.answer;
      if (correct) score++;
      return {
        id: q.id,
        section: q.section,
        subsection: q.subsection,
        user: userIdx,
        answer: q.answer,
        correct: correct
      };
    });
    var endedAt = new Date();
    var durationSec = Math.max(1, Math.round((endedAt - state.startedAt) / 1000));
    var pct = Math.round((score / qs.length) * 100);

    // 結果表示
    document.getElementById('r-name').textContent = session.name;
    document.getElementById('r-chapter').textContent = state.chapterMeta.title;
    document.getElementById('r-duration').textContent = formatDuration(durationSec);
    document.getElementById('score-pct').textContent = pct + '%';
    document.getElementById('score-raw').textContent = score + ' / ' + qs.length;
    document.getElementById('score-circle').style.setProperty('--pct', pct + '%');

    // 分野別正答率
    var secMap = {};
    details.forEach(function (d) {
      var k = d.section;
      if (!secMap[k]) secMap[k] = { correct: 0, total: 0 };
      secMap[k].total++;
      if (d.correct) secMap[k].correct++;
    });
    var secNames = state.chapterMeta.sections || {};
    var secTbody = document.getElementById('sec-table');
    secTbody.innerHTML = '';
    Object.keys(secMap).sort().forEach(function (sec) {
      var s = secMap[sec];
      var p = Math.round(s.correct / s.total * 100);
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><strong>' + sec + '</strong></td>' +
        '<td>' + D.escapeHTML(secNames[sec] || '') + '</td>' +
        '<td>' +
          '<div class="flex"><div class="bar-wrap" style="width:120px"><span style="width:' + p + '%"></span></div>' +
          '<span>' + s.correct + '/' + s.total + '（' + p + '%）</span></div>' +
        '</td>';
      secTbody.appendChild(tr);
    });

    // 問題別リスト
    var ul = document.getElementById('result-list');
    ul.innerHTML = '';
    details.forEach(function (d, i) {
      var q = qs[i];
      var li = document.createElement('li');
      li.className = 'result-item';
      var tag = d.correct
        ? '<span class="tag-correct">✓ 正解</span>'
        : '<span class="tag-incorrect">✗ 不正解</span>';
      var userAnswer = d.user == null
        ? '<em>未回答</em>'
        : D.escapeHTML(q.choices[d.user]);
      li.innerHTML =
        '<div class="q">' + tag + '  Q' + (i + 1) + '.（' + q.section + '）' + D.escapeHTML(q.question) + '</div>' +
        '<div class="muted">あなたの回答：' + userAnswer + '</div>' +
        '<div class="muted">正解：' + D.escapeHTML(q.choices[q.answer]) + '</div>' +
        (q.explanation ? '<div style="margin-top:4px">💡 ' + D.escapeHTML(q.explanation) + '</div>' : '');
      ul.appendChild(li);
    });

    var record = {
      name: session.name,
      student_id: session.student_id || '',
      chapter: chapterId,
      chapter_title: state.chapterMeta.title,
      count: qs.length,
      score: score,
      total: qs.length,
      percentage: pct,
      duration_sec: durationSec,
      submitted_at: endedAt.toISOString(),
      details: details
    };

    // ローカル履歴にも保存
    D.appendHistory(record);

    // Netlify Forms 送信
    var sentEl = document.getElementById('r-sent');
    D.submitToNetlify(record).then(function (r) {
      if (r.ok) sentEl.innerHTML = '送信ステータス：<strong style="color:var(--success)">✓ 送信完了</strong>';
      else throw new Error('HTTP ' + r.status);
    }).catch(function (e) {
      sentEl.innerHTML = '送信ステータス：<strong style="color:var(--danger)">送信失敗</strong>（ローカルには保存済み）';
      console.warn(e);
    });

    quizView.classList.add('hidden');
    resultView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function formatDuration(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + '分' + (s < 10 ? '0' : '') + s + '秒';
  }
})();
