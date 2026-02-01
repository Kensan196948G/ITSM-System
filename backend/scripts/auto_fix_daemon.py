#!/usr/bin/env python3
"""
自動エラー検知・修復デーモン
ITSM-Sec Nexus用の永続的な監視・自動修復システム

Copyright (c) 2026 Mirai Knowledge Systems
License: ISC
"""

import os
import sys
import re
import json
import time
import logging
import argparse
import shutil
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Optional

# プロジェクトルートディレクトリを基準にパスを設定
PROJECT_ROOT = Path(__file__).parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / 'backend'
LOGS_DIR = BACKEND_DIR / 'logs'

# ログディレクトリが存在しない場合は作成
LOGS_DIR.mkdir(exist_ok=True)


class AutoFixDaemon:
    """エラー自動検知・自動修復デーモン"""

    def __init__(
        self,
        config_path: str = None,
        log_file: str = None
    ):
        """
        初期化

        Args:
            config_path: 設定ファイルのパス
            log_file: ログファイルのパス
        """
        # デフォルトパスの設定
        if config_path is None:
            config_path = Path(__file__).parent / 'error_patterns.json'

        if log_file is None:
            log_file = LOGS_DIR / 'auto_fix.log'

        self.config_path = Path(config_path)
        self.log_file = Path(log_file)

        # ログ設定
        self._setup_logging()

        # 設定読み込み
        self.config = self._load_config()

        # ヘルスモニター初期化
        try:
            from health_monitor import HealthMonitor
            self.health_monitor = HealthMonitor()
        except ImportError:
            self.logger.warning("health_monitor.py が見つかりません。ヘルスチェックは無効です。")
            self.health_monitor = None

        # 修復履歴（クールダウン管理）
        self.fix_history: Dict[str, datetime] = {}

        # 統計情報
        self.stats = {
            'total_errors_detected': 0,
            'total_fixes_attempted': 0,
            'total_fixes_succeeded': 0,
            'total_fixes_failed': 0
        }

        self.logger.info("AutoFixDaemon 初期化完了")

    def _setup_logging(self):
        """ロギング設定"""
        # ログファイルが10MB超えたらローテーション
        if self.log_file.exists() and self.log_file.stat().st_size > 10 * 1024 * 1024:
            backup_path = self.log_file.with_suffix('.log.old')
            shutil.move(str(self.log_file), str(backup_path))

        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - [%(levelname)s] - %(message)s',
            handlers=[
                logging.FileHandler(str(self.log_file)),
                logging.StreamHandler(sys.stdout)
            ]
        )
        self.logger = logging.getLogger('AutoFixDaemon')

    def _load_config(self) -> Dict:
        """設定ファイル読み込み"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            self.logger.info(f"設定ファイル読み込み成功: {self.config_path}")
            return config
        except FileNotFoundError:
            self.logger.error(f"設定ファイルが見つかりません: {self.config_path}")
            return {
                'error_patterns': [],
                'health_checks': [],
                'auto_fix_config': {
                    'max_retries': 3,
                    'retry_delay': 60,
                    'cooldown_period': 300,
                    'enable_notifications': True,
                    'backup_before_fix': True
                }
            }
        except json.JSONDecodeError as e:
            self.logger.error(f"設定ファイルの解析エラー: {e}")
            return {'error_patterns': [], 'health_checks': [], 'auto_fix_config': {}}

    def scan_logs(self, log_paths: List[str]) -> List[Dict]:
        """
        ログファイルをスキャンしてエラーを検出

        Args:
            log_paths: スキャン対象のログファイルパスリスト

        Returns:
            検出されたエラーのリスト
        """
        detected_errors = []

        for log_path in log_paths:
            path = Path(log_path)

            if not path.exists():
                self.logger.debug(f"ログファイルが存在しません: {log_path}")
                continue

            try:
                # 最後の1000行を読み込み（メモリ節約）
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
                    lines = lines[-1000:]  # 最新1000行のみ

                # パターンマッチング
                for pattern_def in self.config.get('error_patterns', []):
                    pattern = pattern_def['pattern']
                    regex = re.compile(pattern, re.IGNORECASE)

                    for line in lines:
                        if regex.search(line):
                            error = {
                                'id': pattern_def['id'],
                                'name': pattern_def['name'],
                                'severity': pattern_def['severity'],
                                'log_file': str(path),
                                'matched_line': line.strip(),
                                'pattern': pattern_def,
                                'timestamp': datetime.now().isoformat()
                            }
                            detected_errors.append(error)
                            self.stats['total_errors_detected'] += 1
                            self.logger.warning(f"エラー検出: {pattern_def['name']} in {path.name}")
                            break  # 同じパターンは1ファイルにつき1回のみ報告

            except Exception as e:
                self.logger.error(f"ログスキャンエラー ({log_path}): {e}")

        return detected_errors

    def _is_in_cooldown(self, error_id: str) -> bool:
        """クールダウン期間中か確認"""
        if error_id not in self.fix_history:
            return False

        cooldown = self.config.get('auto_fix_config', {}).get('cooldown_period', 300)
        last_fix_time = self.fix_history[error_id]
        elapsed = (datetime.now() - last_fix_time).total_seconds()

        return elapsed < cooldown

    def execute_action(self, action: Dict) -> bool:
        """
        修復アクション実行

        Args:
            action: アクション定義

        Returns:
            成功: True, 失敗: False
        """
        action_type = action.get('type')
        description = action.get('description', '')

        self.logger.info(f"アクション実行: {action_type} - {description}")

        try:
            if action_type == 'service_restart':
                # サービス再起動
                service = action.get('service')
                if service:
                    result = subprocess.run(
                        ['sudo', 'systemctl', 'restart', service],
                        capture_output=True,
                        text=True,
                        timeout=30
                    )
                    return result.returncode == 0

            elif action_type == 'log_rotate':
                # ログローテーション（10MB超）
                log_files = action.get('log_files', [])
                for log_file in log_files:
                    path = Path(log_file)
                    if path.exists() and path.stat().st_size > 10 * 1024 * 1024:
                        backup = path.with_suffix('.log.old')
                        shutil.move(str(path), str(backup))
                        self.logger.info(f"ログローテーション: {log_file}")
                return True

            elif action_type == 'cache_clear':
                # キャッシュクリア
                cache_dirs = action.get('directories', [])
                for cache_dir in cache_dirs:
                    path = Path(cache_dir)
                    if path.exists():
                        shutil.rmtree(path)
                        path.mkdir(parents=True)
                        self.logger.info(f"キャッシュクリア: {cache_dir}")
                return True

            elif action_type == 'temp_file_cleanup':
                # 一時ファイル削除
                temp_dirs = action.get('directories', [])
                for temp_dir in temp_dirs:
                    path = Path(temp_dir)
                    if path.exists():
                        for item in path.glob('*'):
                            if item.is_file():
                                item.unlink()
                        self.logger.info(f"一時ファイル削除: {temp_dir}")
                return True

            elif action_type == 'create_missing_dirs':
                # ディレクトリ作成
                directories = action.get('directories', [])
                for directory in directories:
                    path = Path(directory)
                    path.mkdir(parents=True, exist_ok=True)
                    self.logger.info(f"ディレクトリ作成: {directory}")
                return True

            elif action_type == 'fix_permissions':
                # 権限修正
                paths = action.get('paths', [])
                owner = action.get('owner', 'www-data')
                mode = action.get('mode', '755')

                for path in paths:
                    # chown
                    subprocess.run(['sudo', 'chown', '-R', owner, path], check=False)
                    # chmod
                    subprocess.run(['sudo', 'chmod', '-R', mode, path], check=False)
                    self.logger.info(f"権限修正: {path} ({owner}:{mode})")
                return True

            elif action_type == 'check_port':
                # ポート確認
                port = action.get('port')
                result = subprocess.run(
                    ['lsof', '-i', f':{port}'],
                    capture_output=True,
                    text=True
                )
                is_in_use = result.returncode == 0
                self.logger.info(f"ポート{port}使用状況: {'使用中' if is_in_use else '空き'}")
                return True

            elif action_type == 'kill_process_on_port':
                # ポートのプロセス終了
                port = action.get('port')
                result = subprocess.run(
                    ['lsof', '-t', '-i', f':{port}'],
                    capture_output=True,
                    text=True
                )
                if result.stdout.strip():
                    pid = result.stdout.strip()
                    subprocess.run(['sudo', 'kill', '-9', pid], check=False)
                    self.logger.info(f"プロセス終了: PID={pid} (port={port})")
                return True

            elif action_type == 'old_file_cleanup':
                # 古いファイル削除
                directories = action.get('directories', [])
                days = action.get('days', 30)
                cutoff_time = time.time() - (days * 24 * 60 * 60)

                for directory in directories:
                    path = Path(directory)
                    if path.exists():
                        for item in path.rglob('*'):
                            if item.is_file() and item.stat().st_mtime < cutoff_time:
                                item.unlink()
                                self.logger.debug(f"古いファイル削除: {item}")
                return True

            elif action_type == 'alert':
                # アラート送信のみ
                alert_file = LOGS_DIR / 'alerts.log'
                with open(alert_file, 'a', encoding='utf-8') as f:
                    alert_data = {
                        'timestamp': datetime.now().isoformat(),
                        'action': action_type,
                        'description': description
                    }
                    f.write(json.dumps(alert_data, ensure_ascii=False) + '\n')
                self.logger.warning(f"アラート: {description}")
                return True

            elif action_type == 'log_analysis':
                # ログ分析（読み取りのみ）
                self.logger.info(f"ログ分析: {description}")
                return True

            else:
                self.logger.warning(f"不明なアクションタイプ: {action_type}")
                return False

        except Exception as e:
            self.logger.error(f"アクション実行エラー ({action_type}): {e}")
            return False

    def auto_fix_error(self, error: Dict) -> bool:
        """
        エラー修復のオーケストレーション

        Args:
            error: エラー情報

        Returns:
            成功: True, 失敗: False
        """
        error_id = error['id']
        pattern = error['pattern']

        # クールダウン確認
        if self._is_in_cooldown(error_id):
            self.logger.info(f"クールダウン期間中のためスキップ: {error['name']}")
            return False

        # 自動修復が無効な場合
        if not pattern.get('auto_fix', False):
            self.logger.info(f"自動修復が無効: {error['name']}")
            return False

        self.logger.info(f"=== エラー自動修復開始: {error['name']} ===")
        self.stats['total_fixes_attempted'] += 1

        # バックアップ作成
        if self.config.get('auto_fix_config', {}).get('backup_before_fix', False):
            self.logger.info("バックアップ作成中...")
            # TODO: バックアップロジック実装

        # アクション実行
        actions = pattern.get('actions', [])
        all_success = True

        for action in actions:
            success = self.execute_action(action)
            if not success:
                all_success = False
                self.logger.error(f"アクション失敗: {action.get('type')}")

        # 修復履歴に記録
        self.fix_history[error_id] = datetime.now()

        if all_success:
            self.stats['total_fixes_succeeded'] += 1
            self.logger.info(f"✅ 修復成功: {error['name']}")
        else:
            self.stats['total_fixes_failed'] += 1
            self.logger.error(f"❌ 修復失敗: {error['name']}")

        return all_success

    def run_detection_cycle(self, cycle_num: int):
        """
        1回の検知サイクル実行

        Args:
            cycle_num: サイクル番号
        """
        self.logger.info(f"=== 検知サイクル {cycle_num} 開始 ===")

        # 1. ヘルスチェック
        if self.health_monitor:
            self.logger.info("[1/3] ヘルスチェック実行中...")
            health_status = self.health_monitor.run_all_checks()

            if health_status.get('overall_status') != 'healthy':
                self.logger.warning(f"ヘルスチェック警告: {health_status.get('overall_status')}")
        else:
            self.logger.debug("ヘルスチェックスキップ（モニター未初期化）")

        # 2. ログスキャン
        self.logger.info("[2/3] ログファイルスキャン中...")
        log_paths = [
            str(LOGS_DIR / 'app.log'),
            str(LOGS_DIR / 'auto_fix.log'),
            str(LOGS_DIR / 'alerts.log'),
            '/var/log/syslog'
        ]

        detected_errors = self.scan_logs(log_paths)

        if detected_errors:
            self.logger.warning(f"{len(detected_errors)}件のエラーを検出")
        else:
            self.logger.info("エラーは検出されませんでした")

        # 3. 自動修復
        self.logger.info("[3/3] 自動修復実行中...")
        for error in detected_errors:
            self.auto_fix_error(error)

        self.logger.info(f"=== 検知サイクル {cycle_num} 完了 ===\n")

    def run_continuous(
        self,
        loop_count: int = 15,
        wait_minutes: int = 5
    ):
        """
        継続的監視（無限ループ）

        Args:
            loop_count: 1イテレーションあたりのループ回数
            wait_minutes: イテレーション間の待機時間（分）
        """
        self.logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        self.logger.info("🤖 自動エラー検知・修復デーモン起動（永続モード）")
        self.logger.info(f"   ループ回数: {loop_count}回/イテレーション")
        self.logger.info(f"   待機時間: {wait_minutes}分")
        self.logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

        iteration = 0

        try:
            while True:
                iteration += 1
                self.logger.info(f"▶ イテレーション {iteration} 開始")

                # loop_count回のサイクルを実行
                for cycle in range(1, loop_count + 1):
                    self.run_detection_cycle(cycle)

                    # 最後のサイクル以外は2秒待機
                    if cycle < loop_count:
                        time.sleep(2)

                # 統計情報出力
                self.logger.info("📊 統計情報:")
                self.logger.info(f"   検出エラー数: {self.stats['total_errors_detected']}")
                self.logger.info(f"   修復試行数: {self.stats['total_fixes_attempted']}")
                self.logger.info(f"   修復成功数: {self.stats['total_fixes_succeeded']}")
                self.logger.info(f"   修復失敗数: {self.stats['total_fixes_failed']}")

                # 次のイテレーションまで待機
                self.logger.info(f"⏳ 次のイテレーションまで{wait_minutes}分待機...\n")
                time.sleep(wait_minutes * 60)

        except KeyboardInterrupt:
            self.logger.info("\n🛑 ユーザーによる停止要求を受信")
        except Exception as e:
            self.logger.error(f"予期しないエラー: {e}", exc_info=True)
        finally:
            self.logger.info("🏁 自動エラー検知・修復デーモン終了")


def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(
        description='ITSM-Sec Nexus 自動エラー検知・修復デーモン'
    )

    parser.add_argument(
        '--continuous',
        action='store_true',
        help='継続的監視モード（無限ループ）'
    )

    parser.add_argument(
        '--config',
        type=str,
        default=None,
        help='設定ファイルパス（デフォルト: ./error_patterns.json）'
    )

    parser.add_argument(
        '--log-file',
        type=str,
        default=None,
        help='ログファイルパス（デフォルト: ../logs/auto_fix.log）'
    )

    parser.add_argument(
        '--loop-count',
        type=int,
        default=15,
        help='1イテレーションあたりのループ回数（デフォルト: 15）'
    )

    parser.add_argument(
        '--wait-minutes',
        type=int,
        default=5,
        help='イテレーション間の待機時間（分、デフォルト: 5）'
    )

    parser.add_argument(
        '--once',
        action='store_true',
        help='1回のみ実行'
    )

    args = parser.parse_args()

    # デーモン初期化
    daemon = AutoFixDaemon(
        config_path=args.config,
        log_file=args.log_file
    )

    # 実行モード
    if args.once:
        daemon.run_detection_cycle(1)
    elif args.continuous:
        daemon.run_continuous(
            loop_count=args.loop_count,
            wait_minutes=args.wait_minutes
        )
    else:
        # デフォルト: 1回のみ実行
        daemon.run_detection_cycle(1)


if __name__ == '__main__':
    main()
