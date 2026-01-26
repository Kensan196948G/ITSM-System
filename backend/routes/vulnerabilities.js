const express = require('express');

const router = express.Router();
const { authenticateJWT, authorize } = require('../middleware/auth');
const { cacheMiddleware, invalidateCacheMiddleware } = require('../middleware/cache');
const {
  parsePaginationParams,
  buildPaginationSQL,
  createPaginationMeta
} = require('../middleware/pagination');
const auditLog = require('../middleware/auditLog');
const { db } = require('../db');

// GET /api/v1/vulnerabilities - 脆弱性一覧取得
router.get('/', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM vulnerabilities', (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      'SELECT vulnerability_id, title, severity, cvss_score, affected_asset, status, detection_date FROM vulnerabilities ORDER BY cvss_score DESC',
      { limit, offset }
    );

    db.all(sql, (dbErr, rows) => {
      if (dbErr) {
        console.error('Database error:', dbErr);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      res.json({
        data: rows,
        pagination: createPaginationMeta(countRow.total, page, limit)
      });
    });
  });
});

// POST /api/v1/vulnerabilities - 脆弱性作成
router.post(
  '/',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  auditLog,
  invalidateCacheMiddleware('vulnerabilities'),
  (req, res) => {
    const { title, description, severity, cvss_score, affected_asset } = req.body;

    if (!title || !severity) {
      return res.status(400).json({ error: 'タイトルと深刻度は必須です' });
    }

    const vulnerability_id = `VUL-${Date.now().toString().slice(-6)}`;
    const sql = `INSERT INTO vulnerabilities (vulnerability_id, title, description, severity, cvss_score, affected_asset, status)
               VALUES (?, ?, ?, ?, ?, ?, 'Open')`;

    db.run(
      sql,
      [vulnerability_id, title, description, severity, cvss_score, affected_asset],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        res.status(201).json({
          message: '脆弱性が正常に作成されました',
          id: vulnerability_id,
          vulnerability_id,
          created_by: req.user.username
        });
      }
    );
  }
);

// PUT /api/v1/vulnerabilities/:id - 脆弱性更新
router.put(
  '/:id',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  auditLog,
  invalidateCacheMiddleware('vulnerabilities'),
  (req, res) => {
    const { title, description, severity, cvss_score, affected_asset, status } = req.body;
    const sql = `UPDATE vulnerabilities SET
    title = COALESCE(?, title),
    description = COALESCE(?, description),
    severity = COALESCE(?, severity),
    cvss_score = COALESCE(?, cvss_score),
    affected_asset = COALESCE(?, affected_asset),
    status = COALESCE(?, status),
    resolution_date = CASE WHEN ? = 'Resolved' THEN CURRENT_TIMESTAMP ELSE resolution_date END
    WHERE vulnerability_id = ?`;

    db.run(
      sql,
      [title, description, severity, cvss_score, affected_asset, status, status, req.params.id],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: '脆弱性が見つかりません' });
        }
        res.json({
          message: '脆弱性が正常に更新されました',
          changes: this.changes,
          updated_by: req.user.username
        });
      }
    );
  }
);

// DELETE /api/v1/vulnerabilities/:id - 脆弱性削除
router.delete(
  '/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('vulnerabilities'),
  (req, res) => {
    db.run(
      'DELETE FROM vulnerabilities WHERE vulnerability_id = ?',
      [req.params.id],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: '脆弱性が見つかりません' });
        }
        res.json({ message: '脆弱性が正常に削除されました', deleted_by: req.user.username });
      }
    );
  }
);

// POST /api/v1/vulnerabilities/cvss/calculate - CVSSスコア計算
router.post('/cvss/calculate', authenticateJWT, (req, res) => {
  const { metrics } = req.body;

  if (!metrics) {
    return res.status(400).json({ error: 'metricsオブジェクトが必要です' });
  }

  const {
    attackVector, attackComplexity, privilegesRequired, userInteraction,
    scope, confidentialityImpact, integrityImpact, availabilityImpact
  } = metrics;

  // 必須メトリクスの検証
  const requiredMetrics = ['attackVector', 'attackComplexity', 'privilegesRequired', 'userInteraction', 'scope', 'confidentialityImpact', 'integrityImpact', 'availabilityImpact'];
  const missingMetrics = requiredMetrics.filter(m => !metrics[m]);

  if (missingMetrics.length > 0) {
    return res.status(400).json({ error: `必須メトリクスが不足しています: ${missingMetrics.join(', ')}` });
  }

  // CVSS 3.1 スコア計算（簡易版）
  const avScores = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
  const acScores = { L: 0.77, H: 0.44 };
  const prScores = { N: 0.85, L: 0.62, H: 0.27 };
  const uiScores = { N: 0.85, R: 0.62 };
  const ciaScores = { H: 0.56, L: 0.22, N: 0 };

  const av = avScores[attackVector] || 0.85;
  const ac = acScores[attackComplexity] || 0.77;
  const pr = prScores[privilegesRequired] || 0.85;
  const ui = uiScores[userInteraction] || 0.85;
  const c = ciaScores[confidentialityImpact] || 0;
  const i = ciaScores[integrityImpact] || 0;
  const a = ciaScores[availabilityImpact] || 0;

  // Exploitability Score
  const exploitability = 8.22 * av * ac * pr * ui;

  // Impact Score
  const impactBase = 1 - ((1 - c) * (1 - i) * (1 - a));
  let impact;
  if (scope === 'U') {
    impact = 6.42 * impactBase;
  } else {
    impact = 7.52 * (impactBase - 0.029) - 3.25 * ((impactBase - 0.02) ** 15);
  }

  // Base Score
  let baseScore;
  if (impact <= 0) {
    baseScore = 0;
  } else if (scope === 'U') {
    baseScore = Math.min(10, Math.ceil((impact + exploitability) * 10) / 10);
  } else {
    baseScore = Math.min(10, Math.ceil(1.08 * (impact + exploitability) * 10) / 10);
  }

  // Severity 判定
  let severity;
  if (baseScore === 0) severity = 'None';
  else if (baseScore < 4.0) severity = 'Low';
  else if (baseScore < 7.0) severity = 'Medium';
  else if (baseScore < 9.0) severity = 'High';
  else severity = 'Critical';

  // Vector String
  const vectorString = `CVSS:3.1/AV:${attackVector}/AC:${attackComplexity}/PR:${privilegesRequired}/UI:${userInteraction}/S:${scope}/C:${confidentialityImpact}/I:${integrityImpact}/A:${availabilityImpact}`;

  res.json({
    success: true,
    baseScore: Math.round(baseScore * 10) / 10,
    severity,
    vectorString,
    exploitabilityScore: Math.round(exploitability * 10) / 10,
    impactScore: Math.round(impact * 10) / 10
  });
});

// PATCH /api/v1/vulnerabilities/:id/cvss - CVSSスコア更新
router.patch(
  '/:id/cvss',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  invalidateCacheMiddleware('vulnerabilities'),
  (req, res) => {
    const { cvss_score, cvss_vector, severity } = req.body;
    const sql = `UPDATE vulnerabilities SET
      cvss_score = COALESCE(?, cvss_score),
      cvss_vector = COALESCE(?, cvss_vector),
      severity = COALESCE(?, severity)
      WHERE vulnerability_id = ?`;

    db.run(sql, [cvss_score, cvss_vector, severity, req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '脆弱性が見つかりません' });
      }
      res.json({
        success: true,
        message: 'CVSSスコアが更新されました',
        cvss_score,
        updated_by: req.user.username
      });
    });
  }
);

// PATCH /api/v1/vulnerabilities/:id/nist-csf - NIST CSFカテゴリ更新
router.patch(
  '/:id/nist-csf',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  invalidateCacheMiddleware('vulnerabilities'),
  (req, res) => {
    const { function: nistFunction, category, subcategory } = req.body;

    const validFunctions = ['IDENTIFY', 'PROTECT', 'DETECT', 'RESPOND', 'RECOVER'];

    if (nistFunction && !validFunctions.includes(nistFunction)) {
      return res.status(400).json({
        error: '無効なNIST CSFファンクションです',
        valid_values: validFunctions
      });
    }

    const sql = `UPDATE vulnerabilities SET
      nist_csf_function = COALESCE(?, nist_csf_function),
      nist_csf_category = COALESCE(?, nist_csf_category),
      nist_csf_subcategory = COALESCE(?, nist_csf_subcategory)
      WHERE vulnerability_id = ?`;

    db.run(sql, [nistFunction, category, subcategory, req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '脆弱性が見つかりません' });
      }
      res.json({
        success: true,
        message: 'NIST CSF情報が更新されました',
        updated_by: req.user.username
      });
    });
  }
);

module.exports = router;
