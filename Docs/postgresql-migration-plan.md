# PostgreSQL移行計画書

**ドキュメントバージョン**: 1.0  
**作成日**: 2026-03-02  
**対象Issue**: #23 (P2-4 PostgreSQL移行計画策定)  
**現在のDB**: SQLite (better-sqlite3)  
**移行先DB**: PostgreSQL 16.x

---

## 1. 移行の目的と背景

### 現状の課題
| 項目 | SQLite（現在） | PostgreSQL（移行後） |
|------|---------------|---------------------|
| 同時接続 | 1ライター | 多数の同時R/W |
| データサイズ上限 | 281TB（理論値）/ 実用~1GB | 無制限 |
| 型安全性 | 動的型付け | 厳格な型チェック |
| レプリケーション | 非対応 | ストリーミングレプリケーション |
| バックアップ | ファイルコピー | pg_dump / PITR |
| 監査ログ | 限定的 | pgaudit拡張 |
| スケールアウト | 不可 | 読み取りレプリカ |

### 移行判断基準
PostgreSQL移行を実施する推奨トリガー:
- 同時接続ユーザー数 ≥ 50人
- データベースサイズ ≥ 500MB
- 高可用性（HA）要件の発生
- 読み取りパフォーマンス問題の頻発

---

## 2. 移行フェーズ設計

### フェーズ0: 準備（1週間）
- [ ] PostgreSQL 16.x サーバーセットアップ（ステージング環境）
- [ ] `pg`パッケージ導入・接続テスト
- [ ] knexfile.jsにpostgres設定追加
- [ ] スキーマ互換性チェック（SQLite固有構文の洗い出し）

### フェーズ1: スキーマ移行（1週間）
- [ ] 全マイグレーションファイルのPostgreSQL互換化
- [ ] SQLite固有構文の置換（下記「互換性対応」参照）
- [ ] PostgreSQLでのマイグレーション実行テスト
- [ ] インデックス・外部キー制約の検証

### フェーズ2: データ移行（2〜3日）
- [ ] pgloader または カスタムスクリプトでデータ移行
- [ ] データ整合性チェック（件数・ハッシュ比較）
- [ ] ダウンタイム計画（推定: 30分以内）

### フェーズ3: アプリケーション層更新（1週間）
- [ ] `better-sqlite3` → `pg` + knex PostgreSQLアダプタへ変更
- [ ] `backend/db.js` のPostgreSQL対応
- [ ] 非同期DB操作への統一（PostgreSQL APIは非同期）
- [ ] 全テストスイートのPostgreSQL対応確認

### フェーズ4: 本番移行（1日）
- [ ] ステージング環境での最終動作確認
- [ ] 本番DBのバックアップ（SQLite→最終スナップショット）
- [ ] ブルーグリーンデプロイで本番切り替え
- [ ] ロールバック手順の確認

---

## 3. SQLite固有構文の互換性対応

### 3.1 型変換

| SQLite型 | PostgreSQL型 | 対応方針 |
|---------|-------------|---------|
| `INTEGER` | `INTEGER` / `BIGSERIAL` | AUTO INCREMENTは`BIGSERIAL`に変換 |
| `TEXT` | `TEXT` / `VARCHAR` | そのまま使用可 |
| `REAL` | `DOUBLE PRECISION` | マイグレーションで修正 |
| `BLOB` | `BYTEA` | バックアップデータに影響 |
| `DATETIME` | `TIMESTAMPTZ` | タイムゾーン付きに変更 |

### 3.2 コード修正が必要な箇所

```javascript
// ❌ SQLite固有: useNullAsDefault
connection.useNullAsDefault = true; // PostgreSQLでは不要

// ❌ SQLite固有: PRAGMA
conn.run('PRAGMA journal_mode = WAL;'); // PostgreSQLでは削除

// ❌ SQLite固有: last_insert_rowid()
db.get('SELECT last_insert_rowid() as id'); 
// ✅ PostgreSQL: RETURNING id
db('table').insert(data).returning('id');

// ❌ SQLite: datetime('now')
// ✅ PostgreSQL: NOW() または CURRENT_TIMESTAMP
```

### 3.3 マイグレーションファイルの修正例

```javascript
// 現在のSQLite用マイグレーション
exports.up = function(knex) {
  return knex.schema.createTable('incidents', (table) => {
    table.increments('id');  // SQLite: INTEGER PRIMARY KEY AUTOINCREMENT
    table.string('incident_id').notNullable();
    table.datetime('created_at').defaultTo(knex.fn.now());
  });
};

// PostgreSQL対応後（knexが自動処理するため変更不要な箇所が多い）
// knexの抽象化レイヤーにより、大部分は変更不要
// 要注意: raw SQL文字列を使っている箇所のみ修正
```

---

## 4. データ移行手順（詳細）

### 4.1 pgloaderを使用した移行

```bash
# pgloaderインストール
sudo apt-get install pgloader

# 移行設定ファイル作成
cat > migrate.load << 'EOF'
LOAD DATABASE
  FROM sqlite:///opt/itsm-system/backend/itsm_nexus.db
  INTO postgresql://itsm_user:password@localhost/itsm_nexus
WITH include drop, create tables, create indexes,
     reset sequences
SET work_mem to '64 MB', maintenance_work_mem to '512 MB';
EOF

# 移行実行（ダウンタイム中）
pgloader migrate.load
```

### 4.2 整合性チェックスクリプト（概要）

```javascript
// backend/scripts/verify-migration.js
// 各テーブルの件数をSQLiteとPostgreSQLで比較
const tables = ['users', 'incidents', 'changes', 'assets', ...];
for (const table of tables) {
  const sqliteCount = await sqliteDb(table).count();
  const pgCount = await pgDb(table).count();
  console.assert(sqliteCount === pgCount, `${table}: 件数不一致`);
}
```

---

## 5. knexfile.js 更新計画

```javascript
// 移行後のknexfile.js（本番環境のみPostgreSQL）
module.exports = {
  development: {
    client: 'sqlite3',  // 開発環境はSQLite維持（軽量）
    // ...（現在と同じ）
  },

  test: {
    client: 'sqlite3',  // テスト環境もSQLite維持（速度優先）
    // ...（現在と同じ）
  },

  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'itsm_nexus',
      user: process.env.DB_USER || 'itsm_user',
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './backend/migrations',
      tableName: 'knex_migrations'
    }
  }
};
```

---

## 6. 必要な依存関係変更

```bash
# 追加
npm install pg  # PostgreSQLクライアント

# 将来的に削除（移行完了後）
# npm uninstall better-sqlite3
```

---

## 7. リスクと対策

| リスク | 影響度 | 対策 |
|--------|-------|------|
| データ損失 | 高 | 移行前の完全バックアップ必須 |
| ダウンタイム延長 | 中 | ステージングでリハーサル実施 |
| 非同期API差異 | 中 | コードレビュー徹底 |
| テスト環境影響 | 低 | テストはSQLiteのまま維持 |
| パフォーマンス劣化 | 低 | インデックス最適化・クエリ改善 |

---

## 8. ロールバック手順

1. PostgreSQL本番への切り替えをリバート（環境変数 `DB_CLIENT=sqlite3` に変更）
2. 最終SQLiteスナップショットを本番に復元
3. アプリケーション再起動（SQLite接続確認）
4. 推定ロールバック時間: 15分以内

---

## 9. 実装開始の判断基準

現時点（v1.0.x）では以下の理由から**移行を延期**します:

- 現在の同時接続ユーザー数: 少数（SQLiteで十分）
- テストスイートのPostgreSQL対応工数: 大
- SQLite→PostgreSQL非同期化によるバグリスク: 要慎重対応

**推奨移行タイミング**: v2.0.0のメジャーバージョンアップ時、またはユーザー数50人超過時

---

## 10. 参考資料

- [Knex.js PostgreSQL設定](https://knexjs.org/guide/#postgresql)
- [pgloader ドキュメント](https://pgloader.io/)
- [PostgreSQL 16 リリースノート](https://www.postgresql.org/docs/16/release-16.html)
- [SQLite → PostgreSQL 移行ガイド](https://wiki.postgresql.org/wiki/Converting_from_other_Databases_to_PostgreSQL)
