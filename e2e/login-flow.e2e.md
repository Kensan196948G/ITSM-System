# E2Eテストシナリオ: ログインフロー

**テスト環境**: http://192.168.0.187:5050/index.html
**実行方法**: claude-in-chrome MCP または手動テスト

---

## テストケース 1: 正常ログインフロー

### 前提条件
- システムが起動している（Backend: 5000, Frontend: 5050）
- ブラウザでログイン画面が表示される

### テスト手順

1. **ログイン画面表示確認**
   - URL: http://192.168.0.187:5050/index.html
   - 期待結果: ログインフォームが表示される
   - 確認項目:
     - [ ] "ITSM-Sec Nexus" タイトル表示
     - [ ] ユーザー名入力フィールド
     - [ ] パスワード入力フィールド
     - [ ] ログインボタン

2. **認証情報入力**
   - ユーザー名: `admin`
   - パスワード: `admin123`
   - 操作: フォームに入力

3. **ログインボタンクリック**
   - 操作: "ログイン"ボタンをクリック
   - 期待結果: ログイン成功

4. **ダッシュボード表示確認**
   - 期待結果:
     - [ ] ログイン画面が非表示になる
     - [ ] メインアプリケーション画面が表示される
     - [ ] サイドバーが表示される
     - [ ] ダッシュボードタイトル表示: "ダッシュボード"
     - [ ] KPIカードが4つ表示される
     - [ ] ユーザー情報表示: "admin (admin)"

5. **KPIデータ確認**
   - 期待結果:
     - [ ] 有効なインシデント数が表示される
     - [ ] SLA達成率が表示される
     - [ ] 脆弱性情報が表示される
     - [ ] GOVERN進捗率が表示される

6. **NIST CSF進捗バー確認**
   - 期待結果:
     - [ ] GOVERN（統治）進捗バー表示
     - [ ] IDENTIFY（識別）進捗バー表示
     - [ ] PROTECT（保護）進捗バー表示
     - [ ] DETECT（検知）進捗バー表示
     - [ ] RESPOND（対応）進捗バー表示
     - [ ] RECOVER（復旧）進捗バー表示

### 成功基準
- 全ての確認項目がチェック済み
- エラーメッセージが表示されない
- コンソールエラーがない

---

## テストケース 2: ログイン失敗フロー

### テスト手順

1. ログイン画面表示
2. 間違ったパスワード入力
   - ユーザー名: `admin`
   - パスワード: `wrongpassword`
3. ログインボタンクリック

### 期待結果
- [ ] ログイン画面のまま（画面遷移しない）
- [ ] エラーメッセージ表示: "ログインに失敗しました"
- [ ] エラーメッセージの色: 赤色背景
- [ ] フォームがリセットされない（ユーザー名は残る）

---

## テストケース 3: ナビゲーション操作

### 前提条件
- ログイン済み

### テスト手順

1. **インシデント管理へ移動**
   - 操作: サイドバーの"インシデント管理"をクリック
   - 期待結果:
     - [ ] タイトル変更: "インシデント管理"
     - [ ] インシデント一覧テーブル表示
     - [ ] "新規インシデント作成"ボタン表示

2. **変更管理へ移動**
   - 操作: サイドバーの"変更管理"をクリック
   - 期待結果:
     - [ ] タイトル変更: "変更管理"
     - [ ] RFC一覧テーブル表示
     - [ ] "新規RFC作成"ボタン表示

3. **構成管理（CMDB）へ移動**
   - 操作: サイドバーの"構成管理 (CMDB)"をクリック
   - 期待結果:
     - [ ] タイトル変更: "構成管理 (CMDB)"
     - [ ] 資産一覧テーブル表示
     - [ ] 6件の資産が表示される

4. **ダッシュボードに戻る**
   - 操作: サイドバーの"ダッシュボード"をクリック
   - 期待結果: KPIカード表示

---

## テストケース 4: ログアウトフロー

### テスト手順

1. ログイン済み状態
2. ログアウトボタンクリック
   - 操作: サイドバー下部の"ログアウト"ボタンをクリック
3. 確認ダイアログで"OK"

### 期待結果
- [ ] ログイン画面に戻る
- [ ] localStorageからトークン削除
- [ ] メインアプリケーションが非表示

---

## テストケース 5: セッションタイムアウト

### テスト手順

1. ログイン済み状態
2. 24時間以上待機（またはトークンを手動削除）
3. API呼び出し操作（ページ遷移など）

### 期待結果
- [ ] 401エラー検出
- [ ] 自動的にログアウト
- [ ] ログイン画面にリダイレクト

---

## テストケース 6: RBAC（権限制御）

### テスト手順

1. analystユーザーでログイン
   - ユーザー名: `analyst`
   - パスワード: `analyst123`

2. RFC承認を試みる
   - 操作: 変更管理画面で既存RFCを承認しようとする

### 期待結果
- [ ] ユーザー情報表示: "analyst (analyst)"
- [ ] RFC一覧は表示される
- [ ] 承認ボタンがグレーアウト（または403エラー）

---

## 自動E2Eテスト実装（Playwright代替）

### シンプルなHTTPベースE2Eテスト

**ファイル**: `backend/__tests__/e2e/user-journey.test.js`

```javascript
const request = require('supertest');
const app = require('../../server');

describe('E2E: ユーザージャーニーテスト', () => {
  it('完全なログイン→データ取得→更新フロー', async () => {
    // 1. ログイン
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.statusCode).toEqual(200);
    const token = loginRes.body.token;

    // 2. ダッシュボードKPI取得
    const kpiRes = await request(app)
      .get('/api/v1/dashboard/kpi')
      .set('Authorization', `Bearer ${token}`);
    expect(kpiRes.statusCode).toEqual(200);

    // 3. インシデント一覧取得
    const incidentsRes = await request(app)
      .get('/api/v1/incidents')
      .set('Authorization', `Bearer ${token}`);
    expect(incidentsRes.statusCode).toEqual(200);

    // 4. 新規インシデント作成
    const createRes = await request(app)
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'E2E Test Incident',
        priority: 'High',
        description: 'Created from E2E test'
      });
    expect(createRes.statusCode).toEqual(201);
    const newIncidentId = createRes.body.id;

    // 5. 作成したインシデントを取得
    const getRes = await request(app)
      .get(`/api/v1/incidents/${newIncidentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.statusCode).toEqual(200);
    expect(getRes.body.title).toBe('E2E Test Incident');

    // 6. インシデント更新
    const updateRes = await request(app)
      .put(`/api/v1/incidents/${newIncidentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'Resolved' });
    expect(updateRes.statusCode).toEqual(200);

    // 7. ユーザー情報取得
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meRes.statusCode).toEqual(200);
    expect(meRes.body.username).toBe('admin');
  });

  it('権限制御フロー（analyst→RFC承認失敗）', async () => {
    // 1. analystでログイン
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'analyst', password: 'analyst123' });
    const analystToken = loginRes.body.token;

    // 2. RFC承認を試みる（失敗するはず）
    const approveRes = await request(app)
      .put('/api/v1/changes/RFC-2025-001')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ status: 'Approved', approver: 'Analyst' });

    expect(approveRes.statusCode).toEqual(403);
    expect(approveRes.body.error).toContain('権限');
  });
});
```

---

## ブラウザベースE2Eテスト（手動実行）

claude-in-chrome MCPを使用する場合の手順書
