const express = require('express');
const { db } = require('../db');
const { authenticateJWT, authorize } = require('../middleware/auth');
const {
  parsePaginationParams,
  buildPaginationSQL,
  createPaginationMeta
} = require('../middleware/pagination');

const router = express.Router();

// 有効なステータス値
const VALID_STATUSES = ['Draft', 'Pending', 'Approved', 'Rejected', 'Implemented', 'Closed'];

// RFC ID生成（UUID形式: RFC-XXXXXXXX）
function generateRfcId() {
  const hex = Math.random().toString(16).substring(2, 10).toUpperCase();
  return `RFC-${hex}`;
}

/**
 * @swagger
 * /changes:
 *   get:
 *     summary: 変更リクエスト一覧を取得
 *     tags: [Changes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 変更リクエスト一覧
 */
router.get('/', authenticateJWT, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM changes', (err, countRow) => {
    if (err) {
      console.error('Changes count error:', err);
      return res.status(500).json({ error: '変更リクエストの取得に失敗しました' });
    }

    const sql = buildPaginationSQL(
      `SELECT id, rfc_id, title, description, asset_tag, status, requester, approver,
              is_security_change, impact_level, created_at, external_id, source
       FROM changes ORDER BY created_at DESC`,
      { limit, offset }
    );

    db.all(sql, (dbErr, rows) => {
      if (dbErr) {
        console.error('Changes fetch error:', dbErr);
        return res.status(500).json({ error: '変更リクエストの取得に失敗しました' });
      }
      res.json({
        data: rows || [],
        pagination: createPaginationMeta(countRow.total, page, limit)
      });
    });
  });
});

/**
 * @swagger
 * /changes/{id}:
 *   get:
 *     summary: 変更リクエスト詳細を取得
 *     tags: [Changes]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticateJWT, (req, res) => {
  const idParam = req.params.id;
  const whereClause = idParam.startsWith('RFC-') ? 'rfc_id = ?' : 'id = ?';

  db.get(`SELECT * FROM changes WHERE ${whereClause}`, [idParam], (err, row) => {
    if (err) {
      console.error('Change fetch error:', err);
      return res.status(500).json({ error: '変更リクエストの取得に失敗しました' });
    }
    if (!row) {
      return res.status(404).json({ error: '変更リクエストが見つかりません' });
    }
    res.json(row);
  });
});

/**
 * @swagger
 * /changes:
 *   post:
 *     summary: 変更リクエストを作成
 *     tags: [Changes]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticateJWT, (req, res) => {
  const {
    title,
    description,
    asset_tag,
    status,
    requester,
    approver,
    is_security_change,
    impact_level
  } = req.body;

  // バリデーション: タイトルは必須
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: '無効なリクエスト: タイトルは必須です' });
  }

  // バリデーション: requesterは必須
  if (!requester || requester.trim() === '') {
    return res.status(400).json({ error: '無効なリクエスト: 申請者は必須です' });
  }

  const rfcId = generateRfcId();

  db.run(
    `INSERT INTO changes (rfc_id, title, description, asset_tag, status, requester, approver, is_security_change, impact_level, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      rfcId,
      title,
      description,
      asset_tag,
      status || 'Draft',
      requester,
      approver,
      is_security_change ? 1 : 0,
      impact_level || 'low'
    ],
    function (err) {
      if (err) {
        console.error('Change create error:', err);
        return res.status(500).json({ error: '変更リクエストの作成に失敗しました' });
      }
      res.status(201).json({
        id: rfcId,
        rfc_id: rfcId,
        message: '変更リクエストが正常に作成されました'
      });
    }
  );
});

/**
 * @swagger
 * /changes/{id}:
 *   put:
 *     summary: 変更リクエストを更新
 *     tags: [Changes]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', authenticateJWT, authorize(['admin', 'manager']), (req, res) => {
  const {
    title,
    description,
    asset_tag,
    status,
    requester,
    approver,
    is_security_change,
    impact_level
  } = req.body;

  // ステータスバリデーション
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: '無効なステータスです' });
  }

  // rfc_id または id で検索
  const idParam = req.params.id;
  const whereClause = idParam.startsWith('RFC-') ? 'rfc_id = ?' : 'id = ?';

  db.run(
    `UPDATE changes SET
     title = COALESCE(?, title),
     description = COALESCE(?, description),
     asset_tag = COALESCE(?, asset_tag),
     status = COALESCE(?, status),
     requester = COALESCE(?, requester),
     approver = COALESCE(?, approver),
     is_security_change = COALESCE(?, is_security_change),
     impact_level = COALESCE(?, impact_level)
     WHERE ${whereClause}`,
    [
      title,
      description,
      asset_tag,
      status,
      requester,
      approver,
      is_security_change !== undefined ? (is_security_change ? 1 : 0) : null,
      impact_level,
      idParam
    ],
    function (err) {
      if (err) {
        console.error('Change update error:', err);
        return res.status(500).json({ error: '変更リクエストの更新に失敗しました' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '変更リクエストが見つかりません' });
      }
      res.json({ message: '変更リクエストが正常に更新されました' });
    }
  );
});

/**
 * @swagger
 * /changes/{id}:
 *   delete:
 *     summary: 変更リクエストを削除
 *     tags: [Changes]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authenticateJWT, authorize(['admin', 'manager']), (req, res) => {
  const idParam = req.params.id;
  const whereClause = idParam.startsWith('RFC-') ? 'rfc_id = ?' : 'id = ?';

  db.run(`DELETE FROM changes WHERE ${whereClause}`, [idParam], function (err) {
    if (err) {
      console.error('Change delete error:', err);
      return res.status(500).json({ error: '変更リクエストの削除に失敗しました' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '変更リクエストが見つかりません' });
    }
    res.json({ message: '変更リクエストが正常に削除されました' });
  });
});

module.exports = router;
