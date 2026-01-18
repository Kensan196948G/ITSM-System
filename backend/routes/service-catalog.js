/**
 * Service Catalog API
 * Provides endpoints for ITIL-aligned service catalog management
 */

const express = require('express');
const { db } = require('../db');
const { authenticateJWT, authorize } = require('../middleware/auth');
const { cacheMiddleware, clearCache } = require('../middleware/cache');
const { auditLog } = require('../middleware/auditLog');

const router = express.Router();

// ===== API Endpoints =====

/**
 * GET /api/v1/service-catalog/categories
 * Get all service categories
 */
router.get('/categories', authenticateJWT, cacheMiddleware, (req, res) => {
  const { include_inactive = false } = req.query;

  let sql = `
    SELECT
      c.*,
      COUNT(s.id) as service_count
    FROM service_categories c
    LEFT JOIN service_catalog s ON s.category_id = c.id AND s.status = 'active'
    WHERE 1=1
  `;

  if (!include_inactive) {
    sql += " AND c.is_active = 1";
  }

  sql += ' GROUP BY c.id ORDER BY c.sort_order';

  db.all(sql, (err, rows) => {
    if (err) {
      console.error('Error fetching service categories:', err);
      return res.status(500).json({
        success: false,
        error: 'サービスカテゴリの取得に失敗しました'
      });
    }
    res.json({
      success: true,
      data: rows || [],
      count: (rows || []).length
    });
  });
});

/**
 * GET /api/v1/service-catalog/categories/:id
 * Get a specific category with its services
 */
router.get('/categories/:id', authenticateJWT, cacheMiddleware, (req, res) => {
  const categoryId = req.params.id;

  db.get('SELECT * FROM service_categories WHERE id = ?', [categoryId], (err, category) => {
    if (err) {
      console.error('Error fetching category:', err);
      return res.status(500).json({
        success: false,
        error: 'カテゴリの取得に失敗しました'
      });
    }
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'カテゴリが見つかりません'
      });
    }

    // Get services in this category
    db.all(
      `SELECT s.*, u.username as owner_name
       FROM service_catalog s
       LEFT JOIN users u ON u.id = s.owner_id
       WHERE s.category_id = ?
       ORDER BY s.sort_order`,
      [categoryId],
      (servicesErr, services) => {
        if (servicesErr) {
          console.error('Error fetching services:', servicesErr);
          return res.status(500).json({
            success: false,
            error: 'サービスの取得に失敗しました'
          });
        }

        res.json({
          success: true,
          data: {
            ...category,
            services: services || []
          }
        });
      }
    );
  });
});

/**
 * POST /api/v1/service-catalog/categories
 * Create a new service category
 */
router.post(
  '/categories',
  authenticateJWT,
  authorize(['admin']),
  auditLog,
  (req, res) => {
    const { name, description, icon, color, sort_order } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'カテゴリ名は必須です'
      });
    }

    const sql = `
      INSERT INTO service_categories (name, description, icon, color, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.run(sql, [name, description, icon, color, sort_order || 0], function (err) {
      if (err) {
        console.error('Error creating category:', err);
        return res.status(500).json({
          success: false,
          error: 'カテゴリの作成に失敗しました'
        });
      }

      clearCache();

      res.status(201).json({
        success: true,
        message: 'カテゴリを作成しました',
        data: { id: this.lastID }
      });
    });
  }
);

/**
 * PUT /api/v1/service-catalog/categories/:id
 * Update a service category
 */
router.put(
  '/categories/:id',
  authenticateJWT,
  authorize(['admin']),
  auditLog,
  (req, res) => {
    const categoryId = req.params.id;
    const { name, description, icon, color, sort_order, is_active } = req.body;

    const sql = `
      UPDATE service_categories SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        icon = COALESCE(?, icon),
        color = COALESCE(?, color),
        sort_order = COALESCE(?, sort_order),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    db.run(sql, [name, description, icon, color, sort_order, is_active, categoryId], function (err) {
      if (err) {
        console.error('Error updating category:', err);
        return res.status(500).json({
          success: false,
          error: 'カテゴリの更新に失敗しました'
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          success: false,
          error: 'カテゴリが見つかりません'
        });
      }

      clearCache();

      res.json({
        success: true,
        message: 'カテゴリを更新しました'
      });
    });
  }
);

/**
 * DELETE /api/v1/service-catalog/categories/:id
 * Delete a service category
 */
router.delete(
  '/categories/:id',
  authenticateJWT,
  authorize(['admin']),
  auditLog,
  (req, res) => {
    const categoryId = req.params.id;

    db.run('DELETE FROM service_categories WHERE id = ?', [categoryId], function (err) {
      if (err) {
        console.error('Error deleting category:', err);
        return res.status(500).json({
          success: false,
          error: 'カテゴリの削除に失敗しました'
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          success: false,
          error: 'カテゴリが見つかりません'
        });
      }

      clearCache();

      res.json({
        success: true,
        message: 'カテゴリを削除しました'
      });
    });
  }
);

/**
 * GET /api/v1/service-catalog/services
 * Get all services with filtering
 */
router.get('/services', authenticateJWT, cacheMiddleware, (req, res) => {
  const { category_id, status, service_level, search } = req.query;

  let sql = `
    SELECT
      s.*,
      c.name as category_name,
      c.icon as category_icon,
      c.color as category_color,
      u.username as owner_name
    FROM service_catalog s
    LEFT JOIN service_categories c ON c.id = s.category_id
    LEFT JOIN users u ON u.id = s.owner_id
    WHERE 1=1
  `;
  const params = [];

  if (category_id) {
    sql += ' AND s.category_id = ?';
    params.push(category_id);
  }
  if (status) {
    sql += ' AND s.status = ?';
    params.push(status);
  }
  if (service_level) {
    sql += ' AND s.service_level = ?';
    params.push(service_level);
  }
  if (search) {
    sql += ' AND (s.name LIKE ? OR s.description LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
  }

  sql += ' ORDER BY c.sort_order, s.sort_order';

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error fetching services:', err);
      return res.status(500).json({
        success: false,
        error: 'サービスの取得に失敗しました'
      });
    }
    res.json({
      success: true,
      data: rows || [],
      count: (rows || []).length
    });
  });
});

/**
 * GET /api/v1/service-catalog/services/:id
 * Get a specific service
 */
router.get('/services/:id', authenticateJWT, cacheMiddleware, (req, res) => {
  const serviceId = req.params.id;

  const sql = `
    SELECT
      s.*,
      c.name as category_name,
      c.icon as category_icon,
      c.color as category_color,
      u.username as owner_name
    FROM service_catalog s
    LEFT JOIN service_categories c ON c.id = s.category_id
    LEFT JOIN users u ON u.id = s.owner_id
    WHERE s.id = ?
  `;

  db.get(sql, [serviceId], (err, row) => {
    if (err) {
      console.error('Error fetching service:', err);
      return res.status(500).json({
        success: false,
        error: 'サービスの取得に失敗しました'
      });
    }
    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'サービスが見つかりません'
      });
    }
    res.json({
      success: true,
      data: row
    });
  });
});

/**
 * POST /api/v1/service-catalog/services
 * Create a new service
 */
router.post(
  '/services',
  authenticateJWT,
  authorize(['admin', 'manager']),
  auditLog,
  (req, res) => {
    const {
      category_id,
      name,
      description,
      details,
      icon,
      color,
      status = 'active',
      service_level,
      cost_per_unit,
      cost_unit,
      estimated_hours,
      sort_order,
      requirements,
      deliverables,
      owner_id
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'サービス名は必須です'
      });
    }

    const sql = `
      INSERT INTO service_catalog (
        category_id, name, description, details, icon, color, status,
        service_level, cost_per_unit, cost_unit, estimated_hours,
        sort_order, requirements, deliverables, owner_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      category_id,
      name,
      description,
      details,
      icon,
      color,
      status,
      service_level,
      cost_per_unit,
      cost_unit,
      estimated_hours,
      sort_order || 0,
      requirements,
      deliverables,
      owner_id
    ];

    db.run(sql, params, function (err) {
      if (err) {
        console.error('Error creating service:', err);
        return res.status(500).json({
          success: false,
          error: 'サービスの作成に失敗しました'
        });
      }

      clearCache();

      res.status(201).json({
        success: true,
        message: 'サービスを作成しました',
        data: { id: this.lastID }
      });
    });
  }
);

/**
 * PUT /api/v1/service-catalog/services/:id
 * Update a service
 */
router.put(
  '/services/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  auditLog,
  (req, res) => {
    const serviceId = req.params.id;
    const {
      category_id,
      name,
      description,
      details,
      icon,
      color,
      status,
      service_level,
      cost_per_unit,
      cost_unit,
      estimated_hours,
      sort_order,
      requirements,
      deliverables,
      owner_id
    } = req.body;

    const sql = `
      UPDATE service_catalog SET
        category_id = COALESCE(?, category_id),
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        details = COALESCE(?, details),
        icon = COALESCE(?, icon),
        color = COALESCE(?, color),
        status = COALESCE(?, status),
        service_level = COALESCE(?, service_level),
        cost_per_unit = COALESCE(?, cost_per_unit),
        cost_unit = COALESCE(?, cost_unit),
        estimated_hours = COALESCE(?, estimated_hours),
        sort_order = COALESCE(?, sort_order),
        requirements = COALESCE(?, requirements),
        deliverables = COALESCE(?, deliverables),
        owner_id = COALESCE(?, owner_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const params = [
      category_id,
      name,
      description,
      details,
      icon,
      color,
      status,
      service_level,
      cost_per_unit,
      cost_unit,
      estimated_hours,
      sort_order,
      requirements,
      deliverables,
      owner_id,
      serviceId
    ];

    db.run(sql, params, function (err) {
      if (err) {
        console.error('Error updating service:', err);
        return res.status(500).json({
          success: false,
          error: 'サービスの更新に失敗しました'
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          success: false,
          error: 'サービスが見つかりません'
        });
      }

      clearCache();

      res.json({
        success: true,
        message: 'サービスを更新しました'
      });
    });
  }
);

/**
 * DELETE /api/v1/service-catalog/services/:id
 * Delete a service
 */
router.delete(
  '/services/:id',
  authenticateJWT,
  authorize(['admin']),
  auditLog,
  (req, res) => {
    const serviceId = req.params.id;

    db.run('DELETE FROM service_catalog WHERE id = ?', [serviceId], function (err) {
      if (err) {
        console.error('Error deleting service:', err);
        return res.status(500).json({
          success: false,
          error: 'サービスの削除に失敗しました'
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          success: false,
          error: 'サービスが見つかりません'
        });
      }

      clearCache();

      res.json({
        success: true,
        message: 'サービスを削除しました'
      });
    });
  }
);

/**
 * GET /api/v1/service-catalog/statistics
 * Get service catalog statistics
 */
router.get('/statistics', authenticateJWT, cacheMiddleware, (req, res) => {
  const stats = {};

  // Get category stats
  db.all(
    `SELECT
      c.id, c.name, c.icon, c.color,
      COUNT(s.id) as service_count
    FROM service_categories c
    LEFT JOIN service_catalog s ON s.category_id = c.id AND s.status = 'active'
    WHERE c.is_active = 1
    GROUP BY c.id
    ORDER BY c.sort_order`,
    (err, categories) => {
      if (err) {
        console.error('Error fetching category stats:', err);
        return res.status(500).json({
          success: false,
          error: '統計の取得に失敗しました'
        });
      }
      stats.categories = categories || [];

      // Get overall stats
      db.get(
        `SELECT
          COUNT(*) as total_services,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_services,
          COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_services,
          COUNT(CASE WHEN status = 'planned' THEN 1 END) as planned_services
        FROM service_catalog`,
        (overallErr, overall) => {
          if (overallErr) {
            console.error('Error fetching overall stats:', overallErr);
            return res.status(500).json({
              success: false,
              error: '統計の取得に失敗しました'
            });
          }
          stats.overall = overall;

          // Get service level distribution
          db.all(
            `SELECT service_level, COUNT(*) as count
            FROM service_catalog
            WHERE status = 'active'
            GROUP BY service_level`,
            (slErr, serviceLevels) => {
              if (slErr) {
                console.error('Error fetching service level stats:', slErr);
                return res.status(500).json({
                  success: false,
                  error: '統計の取得に失敗しました'
                });
              }
              stats.service_levels = serviceLevels || [];

              res.json({
                success: true,
                data: stats
              });
            }
          );
        }
      );
    }
  );
});

module.exports = router;
