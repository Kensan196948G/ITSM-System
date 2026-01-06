const { body, param, validationResult } = require('express-validator');

// バリデーション結果をチェックするミドルウェア
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: '入力データが無効です',
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// インシデント作成・更新のバリデーションルール
const incidentValidation = {
  create: [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('タイトルは必須です')
      .isLength({ max: 500 })
      .withMessage('タイトルは500文字以内で入力してください'),
    body('priority')
      .notEmpty()
      .withMessage('優先度は必須です')
      .isIn(['Critical', 'High', 'Medium', 'Low'])
      .withMessage('優先度が無効です'),
    body('status')
      .optional()
      .isIn(['New', 'Assigned', 'In-Progress', 'Resolved', 'Closed', 'Analyzing', 'Identified'])
      .withMessage('ステータスが無効です'),
    body('description')
      .optional()
      .isLength({ max: 5000 })
      .withMessage('説明は5000文字以内で入力してください'),
    body('is_security_incident')
      .optional()
      .isBoolean()
      .withMessage('セキュリティインシデントフラグはboolean値である必要があります')
  ],
  update: [
    param('id').notEmpty().withMessage('インシデントIDは必須です'),
    body('title')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('タイトルは500文字以内で入力してください'),
    body('priority')
      .optional()
      .isIn(['Critical', 'High', 'Medium', 'Low'])
      .withMessage('優先度が無効です'),
    body('status')
      .optional()
      .isIn(['New', 'Assigned', 'In-Progress', 'Resolved', 'Closed', 'Analyzing', 'Identified'])
      .withMessage('ステータスが無効です'),
    body('description')
      .optional()
      .isLength({ max: 5000 })
      .withMessage('説明は5000文字以内で入力してください')
  ]
};

// 変更管理のバリデーションルール
const changeValidation = {
  create: [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('タイトルは必須です')
      .isLength({ max: 500 })
      .withMessage('タイトルは500文字以内で入力してください'),
    body('description')
      .optional()
      .isLength({ max: 5000 })
      .withMessage('説明は5000文字以内で入力してください'),
    body('asset_tag')
      .optional()
      .isLength({ max: 50 })
      .withMessage('資産タグは50文字以内で入力してください'),
    body('requester').trim().notEmpty().withMessage('申請者は必須です'),
    body('impact_level').optional().isIn(['Low', 'Medium', 'High']).withMessage('影響度が無効です'),
    body('is_security_change')
      .optional()
      .isBoolean()
      .withMessage('セキュリティ変更フラグはboolean値である必要があります')
  ],
  update: [
    param('id').notEmpty().withMessage('RFC IDは必須です'),
    body('status')
      .optional()
      .isIn(['Pending', 'Approved', 'Rejected', 'Implemented'])
      .withMessage('ステータスが無効です'),
    body('approver')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('承認者は100文字以内で入力してください')
  ]
};

// 認証関連のバリデーションルール
const authValidation = {
  register: [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('ユーザー名は必須です')
      .isLength({ min: 3, max: 50 })
      .withMessage('ユーザー名は3〜50文字で入力してください')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('ユーザー名は英数字、ハイフン、アンダースコアのみ使用できます'),
    body('email')
      .trim()
      .notEmpty()
      .withMessage('メールアドレスは必須です')
      .isEmail()
      .withMessage('有効なメールアドレスを入力してください')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('パスワードは必須です')
      .isLength({ min: 8 })
      .withMessage('パスワードは8文字以上で入力してください')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('パスワードは大文字、小文字、数字を含む必要があります'),
    body('role')
      .optional()
      .isIn(['admin', 'manager', 'analyst', 'viewer'])
      .withMessage('ロールが無効です'),
    body('full_name')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('氏名は100文字以内で入力してください')
  ],
  login: [
    body('username').trim().notEmpty().withMessage('ユーザー名は必須です'),
    body('password').notEmpty().withMessage('パスワードは必須です')
  ],
  forgotPassword: [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('メールアドレスは必須です')
      .isEmail()
      .withMessage('有効なメールアドレスを入力してください')
      .normalizeEmail()
  ]
};

module.exports = {
  validate,
  incidentValidation,
  changeValidation,
  authValidation
};
