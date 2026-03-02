/**
 * ITSM-Sec Nexus - 認証ユーティリティ（ES Module）
 *
 * api-client.jsの401エラーハンドリングから動的インポートされます。
 * app.jsの認証ロジックとの橋渡しを担います。
 */

/**
 * 認証エラー発生時の処理（401 Unauthorized）
 * app.jsの既存ログアウト処理を呼び出すか、直接リダイレクトします。
 */
export function handleUnauthorized() {
  // app.jsにlogout関数がグローバル定義されていれば呼び出す
  if (typeof window.logout === 'function') {
    window.logout();
  } else {
    // フォールバック: ストレージクリアしてログインページへリダイレクト
    try {
      localStorage.removeItem('itsm_auth_token');
      localStorage.removeItem('itsm_user_info');
      localStorage.removeItem('itsm_token_expiry');
      sessionStorage.clear();
    } catch (e) {
      // ストレージアクセスエラーは無視
    }
    // ページリロードでログイン画面を表示（SPA設計のためリダイレクトは不要）
    window.dispatchEvent(new CustomEvent('itsm:unauthorized'));
  }
}
