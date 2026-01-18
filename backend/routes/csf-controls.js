/**
 * NIST CSF 2.0 Controls API
 * Provides endpoints for CSF compliance management
 */

const express = require('express');
const { db } = require('../db');
const { authenticateJWT, authorize } = require('../middleware/auth');
const { cacheMiddleware, clearAllCache: clearCache } = require('../middleware/cache');
const auditLog = require('../middleware/auditLog');

const router = express.Router();

// ===== Helper Functions =====

/**
 * Get all CSF functions with their statistics
 */
function getCSFFunctions() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        f.*,
        COUNT(DISTINCT cat.id) as category_count,
        COUNT(DISTINCT ctrl.id) as control_count,
        AVG(ctrl.score) as avg_score,
        AVG(ctrl.maturity_level) as avg_maturity
      FROM csf_functions f
      LEFT JOIN csf_categories cat ON cat.function_id = f.id
      LEFT JOIN csf_controls ctrl ON ctrl.category_id = cat.id
      GROUP BY f.id
      ORDER BY f.sort_order
    `;

    db.all(sql, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

/**
 * Get categories for a specific function
 */
function getCategoriesByFunction(functionId) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        cat.*,
        COUNT(ctrl.id) as control_count,
        AVG(ctrl.score) as avg_score
      FROM csf_categories cat
      LEFT JOIN csf_controls ctrl ON ctrl.category_id = cat.id
      WHERE cat.function_id = ?
      GROUP BY cat.id
      ORDER BY cat.sort_order
    `;

    db.all(sql, [functionId], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

/**
 * Get controls by category
 */
function getControlsByCategory(categoryId) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT ctrl.*, u.username as assigned_to_name
      FROM csf_controls ctrl
      LEFT JOIN users u ON u.id = ctrl.assigned_to
      WHERE ctrl.category_id = ?
      ORDER BY ctrl.control_id
    `;

    db.all(sql, [categoryId], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

/**
 * Calculate overall CSF progress
 */
function calculateCSFProgress() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        f.code,
        f.name,
        f.name_en,
        f.color,
        COALESCE(AVG(ctrl.score), 0) as progress
      FROM csf_functions f
      LEFT JOIN csf_categories cat ON cat.function_id = f.id
      LEFT JOIN csf_controls ctrl ON ctrl.category_id = cat.id
      GROUP BY f.id
      ORDER BY f.sort_order
    `;

    db.all(sql, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      const progress = {};
      (rows || []).forEach((row) => {
        progress[row.code.toLowerCase()] = Math.round(row.progress || 0);
      });

      // Ensure all 6 functions are present (even if tables are empty)
      const defaults = { gv: 0, id: 0, pr: 0, de: 0, rs: 0, rc: 0 };
      resolve({ ...defaults, ...progress });
    });
  });
}

// ===== API Endpoints =====

/**
 * GET /api/v1/csf/functions
 * Get all CSF functions with statistics
 */
router.get('/functions', authenticateJWT, cacheMiddleware, async (req, res) => {
  try {
    const functions = await getCSFFunctions();
    res.json({
      success: true,
      data: functions,
      count: functions.length
    });
  } catch (error) {
    console.error('Error fetching CSF functions:', error);
    res.status(500).json({
      success: false,
      error: 'CSF関数の取得に失敗しました'
    });
  }
});

/**
 * GET /api/v1/csf/progress
 * Get overall CSF progress for dashboard
 */
router.get('/progress', authenticateJWT, cacheMiddleware, async (req, res) => {
  try {
    const progress = await calculateCSFProgress();
    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    console.error('Error calculating CSF progress:', error);
    res.status(500).json({
      success: false,
      error: 'CSF進捗の計算に失敗しました'
    });
  }
});

/**
 * GET /api/v1/csf/functions/:id/categories
 * Get categories for a specific function
 */
router.get('/functions/:id/categories', authenticateJWT, cacheMiddleware, async (req, res) => {
  try {
    const functionId = req.params.id;
    const categories = await getCategoriesByFunction(functionId);
    res.json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (error) {
    console.error('Error fetching CSF categories:', error);
    res.status(500).json({
      success: false,
      error: 'CSFカテゴリの取得に失敗しました'
    });
  }
});

/**
 * GET /api/v1/csf/categories/:id/controls
 * Get controls for a specific category
 */
router.get('/categories/:id/controls', authenticateJWT, cacheMiddleware, async (req, res) => {
  try {
    const categoryId = req.params.id;
    const controls = await getControlsByCategory(categoryId);
    res.json({
      success: true,
      data: controls,
      count: controls.length
    });
  } catch (error) {
    console.error('Error fetching CSF controls:', error);
    res.status(500).json({
      success: false,
      error: 'CSFコントロールの取得に失敗しました'
    });
  }
});

/**
 * GET /api/v1/csf/controls
 * Get all controls with filtering
 */
router.get('/controls', authenticateJWT, cacheMiddleware, async (req, res) => {
  try {
    const { status, maturity_level, function_code } = req.query;

    let sql = `
      SELECT
        ctrl.*,
        cat.code as category_code,
        cat.name as category_name,
        f.code as function_code,
        f.name as function_name,
        f.color as function_color,
        u.username as assigned_to_name
      FROM csf_controls ctrl
      JOIN csf_categories cat ON cat.id = ctrl.category_id
      JOIN csf_functions f ON f.id = cat.function_id
      LEFT JOIN users u ON u.id = ctrl.assigned_to
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND ctrl.status = ?';
      params.push(status);
    }
    if (maturity_level) {
      sql += ' AND ctrl.maturity_level = ?';
      params.push(parseInt(maturity_level, 10));
    }
    if (function_code) {
      sql += ' AND f.code = ?';
      params.push(function_code.toUpperCase());
    }

    sql += ' ORDER BY f.sort_order, cat.sort_order, ctrl.control_id';

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Error fetching controls:', err);
        return res.status(500).json({
          success: false,
          error: 'コントロールの取得に失敗しました'
        });
      }
      res.json({
        success: true,
        data: rows || [],
        count: (rows || []).length
      });
    });
  } catch (error) {
    console.error('Error in controls endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'コントロールの取得に失敗しました'
    });
  }
});

/**
 * GET /api/v1/csf/controls/:id
 * Get a specific control
 */
router.get('/controls/:id', authenticateJWT, cacheMiddleware, (req, res) => {
  const controlId = req.params.id;

  const sql = `
    SELECT
      ctrl.*,
      cat.code as category_code,
      cat.name as category_name,
      f.code as function_code,
      f.name as function_name,
      f.color as function_color,
      u.username as assigned_to_name
    FROM csf_controls ctrl
    JOIN csf_categories cat ON cat.id = ctrl.category_id
    JOIN csf_functions f ON f.id = cat.function_id
    LEFT JOIN users u ON u.id = ctrl.assigned_to
    WHERE ctrl.id = ?
  `;

  db.get(sql, [controlId], (err, row) => {
    if (err) {
      console.error('Error fetching control:', err);
      return res.status(500).json({
        success: false,
        error: 'コントロールの取得に失敗しました'
      });
    }
    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'コントロールが見つかりません'
      });
    }
    res.json({
      success: true,
      data: row
    });
  });
});

/**
 * PUT /api/v1/csf/controls/:id
 * Update a control
 */
router.put(
  '/controls/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  auditLog,
  (req, res) => {
    const controlId = req.params.id;
    const {
      status,
      maturity_level,
      score,
      evidence,
      notes,
      last_assessment_date,
      next_assessment_date,
      assigned_to
    } = req.body;

    // First, get current control state for audit
    db.get('SELECT * FROM csf_controls WHERE id = ?', [controlId], (err, currentControl) => {
      if (err || !currentControl) {
        return res.status(404).json({
          success: false,
          error: 'コントロールが見つかりません'
        });
      }

      const updateSql = `
        UPDATE csf_controls SET
          status = COALESCE(?, status),
          maturity_level = COALESCE(?, maturity_level),
          score = COALESCE(?, score),
          evidence = COALESCE(?, evidence),
          notes = COALESCE(?, notes),
          last_assessment_date = COALESCE(?, last_assessment_date),
          next_assessment_date = COALESCE(?, next_assessment_date),
          assigned_to = COALESCE(?, assigned_to),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const params = [
        status,
        maturity_level,
        score,
        evidence,
        notes,
        last_assessment_date,
        next_assessment_date,
        assigned_to,
        controlId
      ];

      db.run(updateSql, params, function (updateErr) {
        if (updateErr) {
          console.error('Error updating control:', updateErr);
          return res.status(500).json({
            success: false,
            error: 'コントロールの更新に失敗しました'
          });
        }

        // Record assessment history if status or maturity changed
        if (
          status !== currentControl.status ||
          maturity_level !== currentControl.maturity_level ||
          score !== currentControl.score
        ) {
          const assessmentSql = `
            INSERT INTO csf_assessments (
              control_id, assessed_by, previous_status, new_status,
              previous_maturity, new_maturity, previous_score, new_score, comments
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          db.run(
            assessmentSql,
            [
              controlId,
              req.user.id,
              currentControl.status,
              status || currentControl.status,
              currentControl.maturity_level,
              maturity_level || currentControl.maturity_level,
              currentControl.score,
              score || currentControl.score,
              notes || ''
            ],
            () => {} // Ignore errors in assessment logging
          );
        }

        clearCache();

        res.json({
          success: true,
          message: 'コントロールを更新しました',
          data: { id: controlId, changes: this.changes }
        });
      });
    });
  }
);

/**
 * GET /api/v1/csf/statistics
 * Get overall CSF statistics for dashboard
 */
router.get('/statistics', authenticateJWT, cacheMiddleware, async (req, res) => {
  try {
    const progress = await calculateCSFProgress();
    const functions = await getCSFFunctions();

    // Calculate overall statistics
    const totalControls = functions.reduce((sum, f) => sum + (f.control_count || 0), 0);
    const overallScore =
      functions.length > 0
        ? Math.round(functions.reduce((sum, f) => sum + (f.avg_score || 0), 0) / functions.length)
        : 0;
    const overallMaturity =
      functions.length > 0
        ? Math.round(
            (functions.reduce((sum, f) => sum + (f.avg_maturity || 0), 0) / functions.length) * 10
          ) / 10
        : 0;

    res.json({
      success: true,
      data: {
        progress,
        functions: functions.map((f) => ({
          code: f.code,
          name: f.name,
          name_en: f.name_en,
          color: f.color,
          icon: f.icon,
          category_count: f.category_count || 0,
          control_count: f.control_count || 0,
          avg_score: Math.round(f.avg_score || 0),
          avg_maturity: Math.round((f.avg_maturity || 0) * 10) / 10
        })),
        summary: {
          total_controls: totalControls,
          overall_score: overallScore,
          overall_maturity: overallMaturity
        }
      }
    });
  } catch (error) {
    console.error('Error fetching CSF statistics:', error);
    res.status(500).json({
      success: false,
      error: 'CSF統計の取得に失敗しました'
    });
  }
});

/**
 * GET /api/v1/csf/assessments
 * Get assessment history
 */
router.get('/assessments', authenticateJWT, authorize(['admin', 'manager']), (req, res) => {
  const { control_id, limit = 50 } = req.query;

  let sql = `
    SELECT
      a.*,
      ctrl.control_id as control_code,
      ctrl.name as control_name,
      u.username as assessed_by_name
    FROM csf_assessments a
    JOIN csf_controls ctrl ON ctrl.id = a.control_id
    LEFT JOIN users u ON u.id = a.assessed_by
    WHERE 1=1
  `;
  const params = [];

  if (control_id) {
    sql += ' AND a.control_id = ?';
    params.push(control_id);
  }

  sql += ' ORDER BY a.assessed_at DESC LIMIT ?';
  params.push(parseInt(limit, 10));

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error fetching assessments:', err);
      return res.status(500).json({
        success: false,
        error: '評価履歴の取得に失敗しました'
      });
    }
    res.json({
      success: true,
      data: rows || [],
      count: (rows || []).length
    });
  });
});

module.exports = router;
