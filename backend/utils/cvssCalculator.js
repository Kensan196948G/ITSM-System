/**
 * CVSS 3.1 Calculator
 * ITSM-Sec Nexus - Common Vulnerability Scoring System v3.1
 *
 * Implements CVSS 3.1 specification from FIRST.org
 * Reference: https://www.first.org/cvss/v3.1/specification-document
 */

/**
 * Validate CVSS metrics
 * @param {Object} metrics - CVSS metrics
 * @throws {Error} If metrics are invalid
 */
function validateMetrics(metrics) {
  const validations = {
    attackVector: ['N', 'A', 'L', 'P'],
    attackComplexity: ['L', 'H'],
    privilegesRequired: ['N', 'L', 'H'],
    userInteraction: ['N', 'R'],
    scope: ['U', 'C'],
    confidentialityImpact: ['N', 'L', 'H'],
    integrityImpact: ['N', 'L', 'H'],
    availabilityImpact: ['N', 'L', 'H']
  };

  Object.entries(validations).forEach(([metric, validValues]) => {
    if (!metrics[metric]) {
      throw new Error(`Missing required metric: ${metric}`);
    }
    if (!validValues.includes(metrics[metric])) {
      throw new Error(
        `Invalid value for ${metric}: ${metrics[metric]}. Valid values: ${validValues.join(', ')}`
      );
    }
  });
}

/**
 * CVSS 3.1 Base Score Calculator
 * Calculates base score from 8 base metrics
 *
 * @param {Object} metrics - CVSS metrics
 * @param {string} metrics.attackVector - AV: N(Network)|A(Adjacent)|L(Local)|P(Physical)
 * @param {string} metrics.attackComplexity - AC: L(Low)|H(High)
 * @param {string} metrics.privilegesRequired - PR: N(None)|L(Low)|H(High)
 * @param {string} metrics.userInteraction - UI: N(None)|R(Required)
 * @param {string} metrics.scope - S: U(Unchanged)|C(Changed)
 * @param {string} metrics.confidentialityImpact - C: N(None)|L(Low)|H(High)
 * @param {string} metrics.integrityImpact - I: N(None)|L(Low)|H(High)
 * @param {string} metrics.availabilityImpact - A: N(None)|L(Low)|H(High)
 * @returns {number} Base score (0.0 - 10.0)
 */
function calculateBaseScore(metrics) {
  // Validate metrics
  validateMetrics(metrics);

  // Metric value mappings (CVSS 3.1 specification)
  const AV = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
  const AC = { L: 0.77, H: 0.44 };
  const PR = {
    U: { N: 0.85, L: 0.62, H: 0.27 }, // Scope Unchanged
    C: { N: 0.85, L: 0.68, H: 0.5 } // Scope Changed
  };
  const UI = { N: 0.85, R: 0.62 };
  const Impact = { N: 0, L: 0.22, H: 0.56 };

  // Get metric values
  const av = AV[metrics.attackVector];
  const ac = AC[metrics.attackComplexity];
  const pr = PR[metrics.scope][metrics.privilegesRequired];
  const ui = UI[metrics.userInteraction];
  const c = Impact[metrics.confidentialityImpact];
  const i = Impact[metrics.integrityImpact];
  const a = Impact[metrics.availabilityImpact];

  // Calculate Impact Sub-Score (ISS)
  const iss = 1 - (1 - c) * (1 - i) * (1 - a);

  // Calculate Impact Score
  let impact;
  if (metrics.scope === 'U') {
    // Scope Unchanged
    impact = 6.42 * iss;
  } else {
    // Scope Changed
    impact = 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15;
  }

  // Calculate Exploitability
  const exploitability = 8.22 * av * ac * pr * ui;

  // Calculate Base Score
  let baseScore;
  if (impact <= 0) {
    baseScore = 0;
  } else if (metrics.scope === 'U') {
    baseScore = Math.min(impact + exploitability, 10);
  } else {
    baseScore = Math.min(1.08 * (impact + exploitability), 10);
  }

  // Round up to one decimal
  return Math.ceil(baseScore * 10) / 10;
}

/**
 * Get severity rating from CVSS score
 * @param {number} score - CVSS score (0.0 - 10.0)
 * @returns {string} Severity rating
 */
function getSeverityRating(score) {
  if (score === 0) return 'None';
  if (score >= 0.1 && score <= 3.9) return 'Low';
  if (score >= 4.0 && score <= 6.9) return 'Medium';
  if (score >= 7.0 && score <= 8.9) return 'High';
  if (score >= 9.0 && score <= 10.0) return 'Critical';
  return 'Unknown';
}

/**
 * Generate CVSS 3.1 vector string
 * @param {Object} metrics - CVSS metrics
 * @returns {string} CVSS vector string
 */
function generateVectorString(metrics) {
  const parts = [
    'CVSS:3.1',
    `AV:${metrics.attackVector}`,
    `AC:${metrics.attackComplexity}`,
    `PR:${metrics.privilegesRequired}`,
    `UI:${metrics.userInteraction}`,
    `S:${metrics.scope}`,
    `C:${metrics.confidentialityImpact}`,
    `I:${metrics.integrityImpact}`,
    `A:${metrics.availabilityImpact}`
  ];

  return parts.join('/');
}

/**
 * Parse CVSS vector string to metrics object
 * @param {string} vectorString - CVSS vector (e.g., "CVSS:3.1/AV:N/AC:L/...")
 * @returns {Object} Metrics object
 */
function parseVectorString(vectorString) {
  if (!vectorString || !vectorString.startsWith('CVSS:3.1/')) {
    throw new Error('Invalid CVSS 3.1 vector string');
  }

  const parts = vectorString.split('/');
  const metrics = {};

  const mapping = {
    AV: 'attackVector',
    AC: 'attackComplexity',
    PR: 'privilegesRequired',
    UI: 'userInteraction',
    S: 'scope',
    C: 'confidentialityImpact',
    I: 'integrityImpact',
    A: 'availabilityImpact'
  };

  parts.slice(1).forEach((part) => {
    const [key, value] = part.split(':');
    if (mapping[key]) {
      metrics[mapping[key]] = value;
    }
  });

  return metrics;
}

/**
 * Validate CVSS metrics
 * @param {Object} metrics - CVSS metrics
 * @throws {Error} If metrics are invalid
 */

/**
 * Calculate complete CVSS 3.1 score with vector string
 * @param {Object} metrics - CVSS base metrics
 * @returns {Object} Complete CVSS result
 */
function calculateCvss(metrics) {
  const baseScore = calculateBaseScore(metrics);
  const severity = getSeverityRating(baseScore);
  const vectorString = generateVectorString(metrics);

  return {
    baseScore,
    severity,
    vectorString,
    metrics
  };
}

/**
 * Calculate CVSS score from a vector string
 * @param {string} vectorString - CVSS vector string
 * @returns {number} CVSS score
 * @throws {Error} If vector string is invalid
 */
function calculateCVSSScore(vectorString) {
  if (!vectorString || typeof vectorString !== 'string') {
    throw new Error('Invalid CVSS vector string');
  }
  const metrics = parseVectorString(vectorString);
  return calculateBaseScore(metrics);
}

/**
 * Format CVSS score to one decimal place
 * @param {number} score - CVSS score
 * @returns {string} Formatted score
 */
function formatCVSSScore(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return '0.0';
  return score.toFixed(1);
}

/**
 * Format CVSS vector for display
 * @param {string} vector - CVSS vector string
 * @returns {string} Human-readable format
 */
function formatCVSSVectorForDisplay(vector) {
  if (!vector || typeof vector !== 'string') return '';

  const nameMap = {
    AV: 'Attack Vector',
    AC: 'Attack Complexity',
    PR: 'Privileges Required',
    UI: 'User Interaction',
    S: 'Scope',
    C: 'Confidentiality Impact',
    I: 'Integrity Impact',
    A: 'Availability Impact'
  };

  const valueMap = {
    AV: { N: 'Network', A: 'Adjacent', L: 'Local', P: 'Physical' },
    AC: { L: 'Low', H: 'High' },
    PR: { N: 'None', L: 'Low', H: 'High' },
    UI: { N: 'None', R: 'Required' },
    S: { U: 'Unchanged', C: 'Changed' },
    C: { N: 'None', L: 'Low', H: 'High' },
    I: { N: 'None', L: 'Low', H: 'High' },
    A: { N: 'None', L: 'Low', H: 'High' }
  };

  const parts = vector.split('/');
  const version = parts[0].replace('CVSS:', 'CVSS ');
  const details = parts.slice(1).map((part) => {
    const [key, value] = part.split(':');
    const name = nameMap[key] || key;
    const displayValue = valueMap[key]?.[value] || value;
    return `${name}: ${displayValue}`;
  });

  return [version, ...details].join(', ');
}

/**
 * Calculate CVSS score distribution
 * @param {number[]} scores - Array of CVSS scores
 * @returns {Object} Distribution by severity
 */
function getCVSSScoreDistribution(scores) {
  const distribution = { None: 0, Low: 0, Medium: 0, High: 0, Critical: 0 };

  if (!Array.isArray(scores)) return distribution;

  scores.forEach((score) => {
    const severity = getSeverityRating(score);
    if (distribution[severity] !== undefined) {
      distribution[severity] += 1;
    }
  });

  return distribution;
}

/**
 * Calculate severity percentages from scores
 * @param {number[]} scores - Array of CVSS scores
 * @returns {Object} Percentages by severity
 */
function getCVSSSeverityPercentages(scores) {
  const distribution = getCVSSScoreDistribution(scores);
  const total = scores.length || 1;

  return {
    None: Math.round((distribution.None / total) * 100),
    Low: Math.round((distribution.Low / total) * 100),
    Medium: Math.round((distribution.Medium / total) * 100),
    High: Math.round((distribution.High / total) * 100),
    Critical: Math.round((distribution.Critical / total) * 100)
  };
}

/**
 * Validate if a score is a valid CVSS score
 * @param {*} score - Value to validate
 * @returns {boolean} True if valid
 */
function isValidCVSSScore(score) {
  return typeof score === 'number' && !Number.isNaN(score) && score >= 0 && score <= 10;
}

/**
 * Get severity from score (alias for getSeverityRating)
 * @param {*} score - CVSS score
 * @returns {string} Severity rating
 */
function getSeverityFromScore(score) {
  if (!isValidCVSSScore(score)) return 'Unknown';
  return getSeverityRating(score);
}

/**
 * Get highest CVSS score from array
 * @param {number[]} scores - Array of scores
 * @returns {number|null} Highest score or null if empty
 */
function getHighestCVSSScore(scores) {
  if (!Array.isArray(scores) || scores.length === 0) return null;
  return Math.max(...scores.filter(isValidCVSSScore));
}

/**
 * Get lowest CVSS score from array
 * @param {number[]} scores - Array of scores
 * @returns {number|null} Lowest score or null if empty
 */
function getLowestCVSSScore(scores) {
  if (!Array.isArray(scores) || scores.length === 0) return null;
  return Math.min(...scores.filter(isValidCVSSScore));
}

/**
 * Get average CVSS score from array
 * @param {number[]} scores - Array of scores
 * @returns {number|null} Average score or null if empty
 */
function getAverageCVSSScore(scores) {
  if (!Array.isArray(scores) || scores.length === 0) return null;
  const validScores = scores.filter(isValidCVSSScore);
  if (validScores.length === 0) return null;
  const sum = validScores.reduce((acc, score) => acc + score, 0);
  return Math.round((sum / validScores.length) * 10) / 10;
}

module.exports = {
  calculateBaseScore,
  getSeverityRating,
  generateVectorString,
  parseVectorString,
  validateMetrics,
  calculateCvss,
  calculateCVSSScore,
  formatCVSSScore,
  formatCVSSVectorForDisplay,
  getCVSSScoreDistribution,
  getCVSSSeverityPercentages,
  isValidCVSSScore,
  getSeverityFromScore,
  getHighestCVSSScore,
  getLowestCVSSScore,
  getAverageCVSSScore
};
