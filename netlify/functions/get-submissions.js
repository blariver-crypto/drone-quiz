/*
 * Netlify Function: get-submissions
 * 目的: Netlify Forms の "quiz-results" フォームへの送信データを取得し、
 *       ダッシュボード用に正規化して返す。
 *
 * 必要な環境変数（Netlify サイト設定 → Environment variables）:
 *   - NETLIFY_API_TOKEN : Netlify ユーザの Personal Access Token
 *   - NETLIFY_SITE_ID   : 対象サイトの ID（URL か Netlify API で取得可）
 *
 * 両方が未設定の場合は 501 を返し、フロントエンドは localStorage にフォールバックする。
 */

exports.handler = async function (event) {
  const token = process.env.NETLIFY_API_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;

  if (!token || !siteId) {
    return {
      statusCode: 501,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        error: 'NETLIFY_API_TOKEN or NETLIFY_SITE_ID is not configured.',
        hint: 'Netlify サイトの Environment variables に設定してください。'
      })
    };
  }

  try {
    // 1) フォーム一覧から quiz-results フォームを取得
    const formsRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}/forms`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!formsRes.ok) throw new Error(`forms API ${formsRes.status}`);
    const forms = await formsRes.json();
    const target = forms.find(f => f.name === 'quiz-results');
    if (!target) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ records: [], note: 'quiz-results form not found yet.' })
      };
    }

    // 2) submissions を取得（ページング対応: 最大 1000件）
    const records = [];
    let page = 1;
    const perPage = 100;
    while (page <= 10) {
      const subRes = await fetch(
        `https://api.netlify.com/api/v1/forms/${target.id}/submissions?per_page=${perPage}&page=${page}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!subRes.ok) throw new Error(`submissions API ${subRes.status}`);
      const list = await subRes.json();
      if (!list.length) break;
      for (const sub of list) {
        const d = sub.data || {};
        records.push({
          name: d.name || '',
          student_id: d.student_id || '',
          chapter: d.chapter || 'chapter2',
          chapter_title: d.chapter_title || '',
          score: d.score || '0',
          total: d.total || '0',
          percentage: d.percentage || '0',
          duration_sec: d.duration_sec || '0',
          submitted_at: d.submitted_at || sub.created_at,
          details: d.details || '[]'
        });
      }
      if (list.length < perPage) break;
      page++;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify({ records })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: String(err && err.message || err) })
    };
  }
};
