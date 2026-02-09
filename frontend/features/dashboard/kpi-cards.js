/**
 * KPI Cards Module
 * ダッシュボードのKPIカード表示
 */

import { createEl, setText } from '../../shared/ui/dom-utils.js';

/**
 * Render KPI Cards
 * @param {HTMLElement} container - Container element
 * @param {object} stats - Statistics data
 */
export function renderKpiCards(container, stats) {
  container.innerHTML = '';
  container.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
    margin-bottom: 32px;
  `;

  // KPI Card 1: Open Incidents
  const incidentsCard = createKpiCard(
    'fas fa-exclamation-circle',
    stats.open_incidents || 0,
    'オープンインシデント',
    'インシデント管理',
    '#ef4444'
  );
  container.appendChild(incidentsCard);

  // KPI Card 2: Pending Changes
  const changesCard = createKpiCard(
    'fas fa-sync-alt',
    stats.pending_changes || 0,
    '承認待ち変更',
    '変更管理',
    '#f59e0b'
  );
  container.appendChild(changesCard);

  // KPI Card 3: Active Vulnerabilities
  const vulnCard = createKpiCard(
    'fas fa-shield-alt',
    stats.active_vulnerabilities || 0,
    'アクティブな脆弱性',
    'セキュリティ管理',
    '#8b5cf6'
  );
  container.appendChild(vulnCard);

  // KPI Card 4: SLA Compliance Rate
  const slaCard = createKpiCard(
    'fas fa-chart-line',
    `${(stats.sla_compliance_rate || 0).toFixed(1)}%`,
    'SLA達成率',
    'サービスレベル管理',
    '#10b981'
  );
  container.appendChild(slaCard);

  // KPI Card 5: Knowledge Articles
  const kbCard = createKpiCard(
    'fas fa-book',
    stats.knowledge_articles || 0,
    'ナレッジ記事',
    'ナレッジベース',
    '#3b82f6'
  );
  container.appendChild(kbCard);

  // KPI Card 6: Active Assets
  const assetsCard = createKpiCard(
    'fas fa-server',
    stats.active_assets || 0,
    'アクティブ資産',
    'CMDB',
    '#06b6d4'
  );
  container.appendChild(assetsCard);
}

/**
 * Create KPI Card
 * @param {string} icon - FontAwesome icon class
 * @param {string|number} value - KPI value
 * @param {string} label - KPI label
 * @param {string} description - Description
 * @param {string} color - Card color
 * @returns {HTMLElement}
 */
function createKpiCard(icon, value, label, description, color) {
  const card = createEl('div', {
    className: 'kpi-card glass',
    style: `
      padding: 24px;
      border-radius: 16px;
      background: white;
      border-left: 4px solid ${color};
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
      cursor: pointer;
    `
  });

  // Hover effect
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-4px)';
    card.style.boxShadow = '0 8px 12px rgba(0, 0, 0, 0.15)';
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = 'translateY(0)';
    card.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
  });

  // Header with icon
  const header = createEl('div', {
    style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;'
  });

  const iconEl = createEl('i', {
    className: icon,
    style: `font-size: 32px; color: ${color};`
  });

  header.appendChild(iconEl);
  card.appendChild(header);

  // Value
  const valueEl = createEl('div', {
    textContent: value,
    style: `
      font-size: 36px;
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 8px;
    `
  });
  card.appendChild(valueEl);

  // Label
  const labelEl = createEl('div', {
    textContent: label,
    style: `
      font-size: 14px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 4px;
    `
  });
  card.appendChild(labelEl);

  // Description
  const descEl = createEl('div', {
    textContent: description,
    style: `
      font-size: 12px;
      color: #94a3b8;
    `
  });
  card.appendChild(descEl);

  return card;
}
