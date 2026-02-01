#!/usr/bin/env python3
"""
ヘルスモニタリングシステム
ITSM-Sec Nexus用のシステムヘルスチェックとメトリクス収集

Copyright (c) 2026 Mirai Knowledge Systems
License: ISC
"""

import os
import sys
import json
import time
import socket
import sqlite3
import logging
import subprocess
import requests
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

# プロジェクトルートディレクトリを基準にパスを設定
PROJECT_ROOT = Path(__file__).parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / 'backend'


class HealthMonitor:
    """システムヘルスチェックとメトリクス収集"""

    def __init__(self, config: Optional[Dict] = None):
        """
        初期化

        Args:
            config: ヘルスチェック設定
        """
        self.config = config or {}
        self.logger = logging.getLogger('HealthMonitor')

        # デフォルト設定
        self.default_checks = {
            'database_connection': {
                'type': 'sqlite',
                'path': str(BACKEND_DIR / 'itsm_nexus.db'),
                'timeout': 5,
                'critical': True
            },
            'http_endpoint': {
                'type': 'http',
                'url': 'http://localhost:5100/api/health',
                'timeout': 10,
                'critical': True
            },
            'disk_space': {
                'type': 'disk',
                'threshold': 90,  # 90%以上で警告
                'critical': True
            },
            'memory_usage': {
                'type': 'memory',
                'threshold': 85,  # 85%以上で警告
                'critical': False
            }
        }

    def check_sqlite_connection(
        self,
        db_path: str,
        timeout: int = 5
    ) -> Dict:
        """
        SQLite接続チェック

        Args:
            db_path: データベースファイルパス
            timeout: タイムアウト秒数

        Returns:
            チェック結果
        """
        try:
            path = Path(db_path)

            # ファイル存在確認
            if not path.exists():
                return {
                    'status': 'unhealthy',
                    'message': f'Database file not found: {db_path}',
                    'critical': True
                }

            # 接続テスト
            conn = sqlite3.connect(str(path), timeout=timeout)
            cursor = conn.cursor()

            # クエリ実行テスト
            cursor.execute("SELECT 1")
            result = cursor.fetchone()

            # テーブル数取得
            cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
            table_count = cursor.fetchone()[0]

            conn.close()

            return {
                'status': 'healthy',
                'message': f'Connection successful ({table_count} tables)',
                'critical': True,
                'details': {
                    'database_path': db_path,
                    'table_count': table_count,
                    'file_size_mb': round(path.stat().st_size / (1024 * 1024), 2)
                }
            }

        except sqlite3.OperationalError as e:
            return {
                'status': 'unhealthy',
                'message': f'SQLite error: {str(e)}',
                'critical': True
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'message': f'Connection failed: {str(e)}',
                'critical': True
            }

    def check_http_endpoint(
        self,
        url: str,
        timeout: int = 10
    ) -> Dict:
        """
        HTTPエンドポイントチェック

        Args:
            url: チェック対象URL
            timeout: タイムアウト秒数

        Returns:
            チェック結果
        """
        try:
            start_time = time.time()
            response = requests.get(url, timeout=timeout)
            response_time = round((time.time() - start_time) * 1000, 2)  # ミリ秒

            if response.status_code == 200:
                return {
                    'status': 'healthy',
                    'message': f'HTTP 200 OK (response_time: {response_time}ms)',
                    'critical': True,
                    'details': {
                        'url': url,
                        'status_code': response.status_code,
                        'response_time_ms': response_time
                    }
                }
            else:
                return {
                    'status': 'unhealthy',
                    'message': f'HTTP {response.status_code}',
                    'critical': True,
                    'details': {
                        'url': url,
                        'status_code': response.status_code,
                        'response_time_ms': response_time
                    }
                }

        except requests.exceptions.Timeout:
            return {
                'status': 'unhealthy',
                'message': f'Timeout after {timeout}s',
                'critical': True
            }
        except requests.exceptions.ConnectionError:
            return {
                'status': 'unhealthy',
                'message': 'Connection refused',
                'critical': True
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'message': f'Request failed: {str(e)}',
                'critical': True
            }

    def check_disk_space(self, threshold: int = 90) -> Dict:
        """
        ディスク容量チェック

        Args:
            threshold: 警告閾値（パーセンテージ）

        Returns:
            チェック結果
        """
        try:
            # df コマンドでディスク使用量を取得
            result = subprocess.run(
                ['df', '-h', '/'],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode != 0:
                return {
                    'status': 'unhealthy',
                    'message': 'Failed to get disk usage',
                    'critical': True
                }

            # 出力を解析（2行目がルートパーティション）
            lines = result.stdout.strip().split('\n')
            if len(lines) < 2:
                return {
                    'status': 'unhealthy',
                    'message': 'Invalid df output',
                    'critical': True
                }

            # Use% の値を抽出
            parts = lines[1].split()
            usage_str = parts[4].replace('%', '')
            usage_percent = int(usage_str)

            # ステータス判定
            if usage_percent >= threshold:
                status = 'unhealthy'
                message = f'Disk usage high: {usage_percent}%'
            else:
                status = 'healthy'
                message = f'Disk usage normal: {usage_percent}%'

            return {
                'status': status,
                'usage_percent': usage_percent,
                'message': message,
                'critical': True,
                'details': {
                    'filesystem': parts[0],
                    'size': parts[1],
                    'used': parts[2],
                    'available': parts[3],
                    'use_percent': usage_percent,
                    'mounted_on': parts[5]
                }
            }

        except Exception as e:
            return {
                'status': 'unhealthy',
                'message': f'Disk check failed: {str(e)}',
                'critical': True
            }

    def check_memory_usage(self, threshold: int = 85) -> Dict:
        """
        メモリ使用量チェック

        Args:
            threshold: 警告閾値（パーセンテージ）

        Returns:
            チェック結果
        """
        try:
            # free コマンドでメモリ使用量を取得
            result = subprocess.run(
                ['free', '-m'],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode != 0:
                return {
                    'status': 'unhealthy',
                    'message': 'Failed to get memory usage',
                    'critical': False
                }

            # 出力を解析
            lines = result.stdout.strip().split('\n')
            mem_line = lines[1].split()

            total_mb = int(mem_line[1])
            used_mb = int(mem_line[2])
            available_mb = int(mem_line[6])

            usage_percent = round((used_mb / total_mb) * 100, 1)

            # ステータス判定
            if usage_percent >= threshold:
                status = 'unhealthy'
                message = f'Memory usage high: {usage_percent}%'
            else:
                status = 'healthy'
                message = f'Memory usage normal: {usage_percent}%'

            return {
                'status': status,
                'usage_percent': usage_percent,
                'message': message,
                'critical': False,
                'details': {
                    'total_mb': total_mb,
                    'used_mb': used_mb,
                    'available_mb': available_mb,
                    'total_gb': round(total_mb / 1024, 1),
                    'used_gb': round(used_mb / 1024, 1),
                    'available_gb': round(available_mb / 1024, 1)
                }
            }

        except Exception as e:
            return {
                'status': 'unhealthy',
                'message': f'Memory check failed: {str(e)}',
                'critical': False
            }

    def check_port_in_use(self, port: int) -> Dict:
        """
        ポート使用状況チェック

        Args:
            port: チェック対象ポート

        Returns:
            チェック結果
        """
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)

            result = sock.connect_ex(('localhost', port))
            sock.close()

            if result == 0:
                return {
                    'status': 'healthy',
                    'message': f'Port {port} is in use',
                    'port': port,
                    'in_use': True
                }
            else:
                return {
                    'status': 'unhealthy',
                    'message': f'Port {port} is not in use',
                    'port': port,
                    'in_use': False
                }

        except Exception as e:
            return {
                'status': 'unhealthy',
                'message': f'Port check failed: {str(e)}',
                'port': port
            }

    def collect_system_metrics(self) -> Dict:
        """
        システムメトリクス収集

        Returns:
            システムメトリクス
        """
        metrics = {}

        try:
            # CPU使用率
            result = subprocess.run(
                ['top', '-bn1'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                # %Cpu(s) の行を探す
                for line in result.stdout.split('\n'):
                    if '%Cpu(s)' in line:
                        # idle値を抽出
                        parts = line.split(',')
                        for part in parts:
                            if 'id' in part:
                                idle = float(part.strip().split()[0])
                                metrics['cpu'] = {
                                    'usage_percent': round(100 - idle, 1),
                                    'idle_percent': round(idle, 1)
                                }
                        break

            # プロセス数
            result = subprocess.run(
                ['ps', 'aux'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                process_count = len(result.stdout.strip().split('\n')) - 1  # ヘッダー除く
                metrics['processes'] = {
                    'count': process_count
                }

            # ネットワーク統計
            net_stats_path = Path('/proc/net/dev')
            if net_stats_path.exists():
                with open(net_stats_path, 'r') as f:
                    lines = f.readlines()[2:]  # 最初の2行はヘッダー

                    total_rx = 0
                    total_tx = 0

                    for line in lines:
                        parts = line.split(':')
                        if len(parts) == 2:
                            values = parts[1].split()
                            total_rx += int(values[0])
                            total_tx += int(values[8])

                    metrics['network'] = {
                        'bytes_received': total_rx,
                        'bytes_sent': total_tx,
                        'bytes_received_mb': round(total_rx / (1024 * 1024), 2),
                        'bytes_sent_mb': round(total_tx / (1024 * 1024), 2)
                    }

        except Exception as e:
            self.logger.error(f"メトリクス収集エラー: {e}")

        return metrics

    def run_all_checks(self) -> Dict:
        """
        すべてのヘルスチェックを実行

        Returns:
            総合ヘルスチェック結果
        """
        timestamp = datetime.now().isoformat()
        checks = {}

        # 各チェックを実行
        for check_name, check_config in self.default_checks.items():
            check_type = check_config['type']

            if check_type == 'sqlite':
                checks[check_name] = self.check_sqlite_connection(
                    db_path=check_config['path'],
                    timeout=check_config.get('timeout', 5)
                )

            elif check_type == 'http':
                checks[check_name] = self.check_http_endpoint(
                    url=check_config['url'],
                    timeout=check_config.get('timeout', 10)
                )

            elif check_type == 'disk':
                checks[check_name] = self.check_disk_space(
                    threshold=check_config.get('threshold', 90)
                )

            elif check_type == 'memory':
                checks[check_name] = self.check_memory_usage(
                    threshold=check_config.get('threshold', 85)
                )

        # 総合ステータス判定
        overall_status = 'healthy'

        for check_name, result in checks.items():
            if result['status'] == 'unhealthy':
                if result.get('critical', False):
                    overall_status = 'critical'
                    break
                else:
                    overall_status = 'degraded'

        # メトリクス収集
        metrics = self.collect_system_metrics()

        return {
            'timestamp': timestamp,
            'checks': checks,
            'overall_status': overall_status,
            'metrics': metrics
        }


def main():
    """メイン関数（テスト用）"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - [%(levelname)s] - %(message)s'
    )

    monitor = HealthMonitor()

    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("🏥 ヘルスチェック実行")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    result = monitor.run_all_checks()

    print(json.dumps(result, indent=2, ensure_ascii=False))

    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"総合ステータス: {result['overall_status']}")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")


if __name__ == '__main__':
    main()
