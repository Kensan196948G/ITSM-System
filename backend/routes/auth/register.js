const express = require('express');
const authService = require('../../services/authService');
const { registerLimiter } = require('../../middleware/rateLimiter');
const { validate, authValidation } = require('../../middleware/validation');

const router = express.Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: ユーザー登録
 *     description: 新規ユーザーを登録します
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *               full_name:
 *                 type: string
 *     responses:
 *       201:
 *         description: ユーザー作成成功
 *       400:
 *         description: バリデーションエラー
 *       409:
 *         description: ユーザー名またはメールアドレスが既に使用されています
 */
router.post('/register', registerLimiter, authValidation.register, validate, async (req, res) => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({
      message: 'ユーザーが正常に作成されました',
      user
    });
  } catch (error) {
    if (error.message === 'Username or email already exists') {
      return res
        .status(409)
        .json({ error: 'ユーザー名またはメールアドレスが既に使用されています' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: '内部サーバーエラー' });
  }
});

module.exports = router;
