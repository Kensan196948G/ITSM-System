/**
 * NIST CSF 2.0 Mapper
 * ITSM-Sec Nexus - Vulnerability Management Integration with NIST Cybersecurity Framework 2.0
 *
 * Maps vulnerabilities to NIST CSF 2.0 functions and calculates compliance progress
 */

const { db } = require('../db');

/**
 * NIST CSF 2.0マッピングロジック
 */
class NistCsfMapper {
  /**
   * 脆弱性をNIST CSF機能にマッピング
   * @param {Object} vulnerability - 脆弱性オブジェクト
   * @returns {Object} CSFマッピング情報
   */
  static mapVulnerabilityToCSF(vulnerability) {
    const mapping = {
      function: null,
      category: null,
      impact: 0
    };

    // 重要度に基づく影響度計算
    const severityWeight = {
      Critical: 1.0,
      High: 0.7,
      Medium: 0.4,
      Low: 0.1
    };
    mapping.impact = severityWeight[vulnerability.severity] || 0;

    // ステータスに基づくCSF機能判定
    switch (vulnerability.status) {
      case 'Identified':
        mapping.function = 'IDENTIFY';
        mapping.category = 'ID.RA-1: Asset vulnerabilities are identified and documented';
        break;
      case 'In-Progress':
        mapping.function = 'RESPOND';
        mapping.category = 'RS.MI-2: Incidents are contained and mitigated';
        break;
      case 'Mitigated':
        mapping.function = 'PROTECT';
        mapping.category = 'PR.IP-12: A vulnerability management plan is developed and implemented';
        break;
      case 'Resolved':
        mapping.function = 'RECOVER';
        mapping.category = 'RC.RP-1: Recovery plan is executed during or after an event';
        break;
      default:
        mapping.function = 'IDENTIFY';
        mapping.category = 'ID.RA-1: Asset vulnerabilities are identified and documented';
    }

    return mapping;
  }

  /**
   * NIST CSF進捗を計算
   * @returns {Promise<Object>} 各CSF機能の進捗スコア
   */
  static async getCsfProgress() {
    return new Promise((resolve) => {
      const progress = {
        GOVERN: { score: 0, policies_count: 0, description: 'Governance and oversight' },
        IDENTIFY: {
          score: 0,
          vulnerabilities_identified: 0,
          description: 'Asset vulnerability identification'
        },
        PROTECT: {
          score: 0,
          mitigation_rate: 0,
          description: 'Protective controls implementation'
        },
        DETECT: {
          score: 0,
          avg_detection_time: 0,
          description: 'Anomaly and event detection'
        },
        RESPOND: {
          score: 0,
          avg_response_time: 0,
          description: 'Incident response activities'
        },
        RECOVER: {
          score: 0,
          recovery_rate: 0,
          description: 'Recovery and restoration'
        }
      };

      let completedQueries = 0;
      const totalQueries = 5;

      const checkComplete = () => {
        completedQueries += 1;
        if (completedQueries === totalQueries) {
          resolve(progress);
        }
      };

      // GOVERN: ポリシー数（complianceテーブルから）
      db.get('SELECT COUNT(*) as count FROM compliance', (err, row) => {
        if (!err && row) {
          progress.GOVERN.policies_count = row.count;
          progress.GOVERN.score = Math.min(100, row.count * 16.67); // 6機能で100点
        }
        checkComplete();
      });

      // IDENTIFY: 識別された脆弱性数
      db.get(
        `SELECT COUNT(*) as count FROM vulnerabilities
              WHERE nist_csf_function = 'IDENTIFY' OR status = 'Identified'`,
        (err, row) => {
          if (!err && row) {
            progress.IDENTIFY.vulnerabilities_identified = row.count;
            // 脆弱性数に応じてスコア計算（適度な数=高スコア）
            progress.IDENTIFY.score = row.count > 0 ? Math.min(100, 50 + row.count * 2) : 30;
          }
          checkComplete();
        }
      );

      // PROTECT: 緩和率（Mitigated + Resolved / Total）
      db.get(
        `SELECT
                COUNT(CASE WHEN status IN ('Mitigated', 'Resolved') THEN 1 END) * 100.0 /
                NULLIF(COUNT(*), 0) as rate
              FROM vulnerabilities`,
        (err, row) => {
          if (!err && row && row.rate !== null) {
            progress.PROTECT.mitigation_rate = row.rate / 100;
            progress.PROTECT.score = Math.round(row.rate);
          } else {
            progress.PROTECT.score = 100; // 脆弱性がない=完璧
          }
          checkComplete();
        }
      );

      // RESPOND: 平均対応時間（検知から対応開始まで、時間単位）
      db.get(
        `SELECT AVG(
                CAST((julianday(COALESCE(resolution_date, CURRENT_TIMESTAMP)) -
                      julianday(detection_date)) * 24 AS INTEGER)
              ) as avg_hours
              FROM vulnerabilities
              WHERE detection_date IS NOT NULL AND status != 'Identified'`,
        (err, row) => {
          if (!err && row && row.avg_hours !== null) {
            progress.RESPOND.avg_response_time = Math.round(row.avg_hours);
            // 24時間以内=100点、48時間=50点、72時間以上=0点
            const score = Math.max(0, 100 - (row.avg_hours / 24) * 50);
            progress.RESPOND.score = Math.round(score);
          } else {
            progress.RESPOND.score = 100; // データなし=デフォルト高スコア
          }
          checkComplete();
        }
      );

      // RECOVER: 復旧成功率（Resolved / (Total - Identified)）
      db.get(
        `SELECT
                COUNT(CASE WHEN status = 'Resolved' THEN 1 END) * 100.0 /
                NULLIF(COUNT(CASE WHEN status != 'Identified' THEN 1 END), 0) as rate
              FROM vulnerabilities`,
        (err, row) => {
          if (!err && row && row.rate !== null) {
            progress.RECOVER.recovery_rate = row.rate / 100;
            progress.RECOVER.score = Math.round(row.rate);
          } else {
            progress.RECOVER.score = 100; // データなし=デフォルト高スコア
          }
          checkComplete();
        }
      );
    });
  }

  /**
   * 脆弱性作成/更新時にCSF進捗を自動更新
   * @param {number} vulnerabilityId - 脆弱性ID
   * @returns {Promise<Object>} 更新後のCSFマッピング
   */
  static async updateCsfProgress(vulnerabilityId) {
    return new Promise((resolve, reject) => {
      // 脆弱性情報を取得
      db.get(
        'SELECT * FROM vulnerabilities WHERE id = ?',
        [vulnerabilityId],
        (err, vulnerability) => {
          if (err) {
            return reject(err);
          }
          if (!vulnerability) {
            return reject(new Error('Vulnerability not found'));
          }

          // CSFマッピング計算
          const mapping = this.mapVulnerabilityToCSF(vulnerability);

          // 脆弱性テーブルを更新
          db.run(
            `UPDATE vulnerabilities
            SET nist_csf_function = ?, nist_csf_category = ?
            WHERE id = ?`,
            [mapping.function, mapping.category, vulnerabilityId],
            (updateErr) => {
              if (updateErr) {
                return reject(updateErr);
              }

              // CSF進捗を再計算してcomplianceテーブルを更新
              this.getCsfProgress()
                .then((progress) => {
                  // 各機能のスコアをcomplianceテーブルに保存
                  const functions = Object.keys(progress);
                  let updated = 0;

                  functions.forEach((func) => {
                    db.run(
                      'UPDATE compliance SET progress = ? WHERE function = ?',
                      [progress[func].score, func],
                      (err2) => {
                        if (err2) {
                          console.error(`Failed to update compliance for ${func}:`, err2);
                        }
                        updated += 1;
                        if (updated === functions.length) {
                          resolve({
                            vulnerability_id: vulnerabilityId,
                            csf_mapping: mapping,
                            csf_progress: progress
                          });
                        }
                      }
                    );
                  });
                })
                .catch(reject);
            }
          );
        }
      );
    });
  }

  /**
   * コンプライアンスレポート生成
   * @returns {Promise<Object>} コンプライアンスレポート
   */
  static async generateComplianceReport() {
    const progress = await this.getCsfProgress();

    return new Promise((resolve, reject) => {
      // 脆弱性統計を取得
      db.all(
        `SELECT
          nist_csf_function as function,
          severity,
          status,
          COUNT(*) as count
        FROM vulnerabilities
        WHERE nist_csf_function IS NOT NULL
        GROUP BY nist_csf_function, severity, status
        ORDER BY nist_csf_function, severity`,
        (err, stats) => {
          if (err) {
            return reject(err);
          }

          const report = {
            timestamp: new Date().toISOString(),
            overall_compliance_score: 0,
            functions: progress,
            vulnerability_breakdown: stats || [],
            recommendations: []
          };

          // 総合スコア計算（6機能の平均）
          const scores = Object.values(progress).map((f) => f.score);
          report.overall_compliance_score = Math.round(
            scores.reduce((a, b) => a + b, 0) / scores.length
          );

          // 推奨事項生成
          Object.entries(progress).forEach(([func, data]) => {
            if (data.score < 70) {
              report.recommendations.push({
                function: func,
                current_score: data.score,
                recommendation: `Improve ${func} controls - current score ${data.score} is below 70%`,
                priority: data.score < 50 ? 'High' : 'Medium'
              });
            }
          });

          resolve(report);
        }
      );
    });
  }
}

module.exports = NistCsfMapper;
