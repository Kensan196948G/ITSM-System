/**
 * CVSS Calculator Utility Unit Tests
 */

const cvssCalculator = require('../../../utils/cvssCalculator');

describe('CVSS Calculator Utility Unit Tests', () => {
  describe('CVSS v3.1 Base Score Calculation', () => {
    it('should calculate CVSS score for critical vulnerability', () => {
      const vector = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';
      const score = cvssCalculator.calculateCVSSScore(vector);

      expect(score).toBeGreaterThan(9.0);
      expect(score).toBe(10.0);
    });

    it('should calculate CVSS score for high vulnerability', () => {
      const vector = 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N';
      const score = cvssCalculator.calculateCVSSScore(vector);

      expect(score).toBeGreaterThanOrEqual(7.0);
      expect(score).toBeLessThan(9.0);
    });

    it('should calculate CVSS score for medium vulnerability', () => {
      const vector = 'CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:U/C:L/I:L/A:N';
      const score = cvssCalculator.calculateCVSSScore(vector);

      expect(score).toBeGreaterThanOrEqual(4.0);
      expect(score).toBeLessThan(7.0);
    });

    it('should calculate CVSS score for low vulnerability', () => {
      const vector = 'CVSS:3.1/AV:L/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N';
      const score = cvssCalculator.calculateCVSSScore(vector);

      expect(score).toBeGreaterThanOrEqual(0.1);
      expect(score).toBeLessThan(4.0);
    });

    it('should calculate CVSS score for none vulnerability', () => {
      const vector = 'CVSS:3.1/AV:L/AC:H/PR:H/UI:R/S:U/C:N/I:N/A:N';
      const score = cvssCalculator.calculateCVSSScore(vector);

      expect(score).toBe(0.0);
    });
  });

  describe('CVSS Vector Parsing', () => {
    it('should parse valid CVSS vector correctly', () => {
      const vector = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';
      const parsed = cvssCalculator.parseCVSSVector(vector);

      expect(parsed).toEqual({
        AV: 'N',
        AC: 'L',
        PR: 'N',
        UI: 'N',
        S: 'U',
        C: 'H',
        I: 'H',
        A: 'H'
      });
    });

    it('should handle invalid CVSS vector', () => {
      const invalidVector = 'INVALID_VECTOR';
      const parsed = cvssCalculator.parseCVSSVector(invalidVector);

      expect(parsed).toBeNull();
    });

    it('should handle CVSS v3.0 vector', () => {
      const vector = 'CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';
      const parsed = cvssCalculator.parseCVSSVector(vector);

      expect(parsed).toBeDefined();
      expect(parsed.AV).toBe('N');
    });
  });

  describe('CVSS Score Validation', () => {
    it('should validate CVSS score range', () => {
      expect(cvssCalculator.isValidCVSSScore(0.0)).toBe(true);
      expect(cvssCalculator.isValidCVSSScore(5.5)).toBe(true);
      expect(cvssCalculator.isValidCVSSScore(10.0)).toBe(true);
      expect(cvssCalculator.isValidCVSSScore(-1.0)).toBe(false);
      expect(cvssCalculator.isValidCVSSScore(11.0)).toBe(false);
    });

    it('should classify CVSS scores correctly', () => {
      expect(cvssCalculator.getSeverityFromScore(0.0)).toBe('None');
      expect(cvssCalculator.getSeverityFromScore(2.5)).toBe('Low');
      expect(cvssCalculator.getSeverityFromScore(5.5)).toBe('Medium');
      expect(cvssCalculator.getSeverityFromScore(7.5)).toBe('High');
      expect(cvssCalculator.getSeverityFromScore(9.5)).toBe('Critical');
    });
  });

  describe('CVSS Vector Components', () => {
    it('should provide attack vector descriptions', () => {
      const descriptions = cvssCalculator.getAttackVectorDescriptions();

      expect(descriptions.AV.N).toContain('Network');
      expect(descriptions.AV.A).toContain('Adjacent');
      expect(descriptions.AV.L).toContain('Local');
      expect(descriptions.AV.P).toContain('Physical');
    });

    it('should provide attack complexity descriptions', () => {
      const descriptions = cvssCalculator.getAttackComplexityDescriptions();

      expect(descriptions.AC.L).toContain('Low');
      expect(descriptions.AC.H).toContain('High');
    });

    it('should provide privilege required descriptions', () => {
      const descriptions = cvssCalculator.getPrivilegeRequiredDescriptions();

      expect(descriptions.PR.N).toContain('None');
      expect(descriptions.PR.L).toContain('Low');
      expect(descriptions.PR.H).toContain('High');
    });

    it('should provide user interaction descriptions', () => {
      const descriptions = cvssCalculator.getUserInteractionDescriptions();

      expect(descriptions.UI.N).toContain('None');
      expect(descriptions.UI.R).toContain('Required');
    });

    it('should provide scope descriptions', () => {
      const descriptions = cvssCalculator.getScopeDescriptions();

      expect(descriptions.S.U).toContain('Unchanged');
      expect(descriptions.S.C).toContain('Changed');
    });

    it('should provide confidentiality descriptions', () => {
      const descriptions = cvssCalculator.getConfidentialityDescriptions();

      expect(descriptions.C.H).toContain('High');
      expect(descriptions.C.L).toContain('Low');
      expect(descriptions.C.N).toContain('None');
    });

    it('should provide integrity descriptions', () => {
      const descriptions = cvssCalculator.getIntegrityDescriptions();

      expect(descriptions.I.H).toContain('High');
      expect(descriptions.I.L).toContain('Low');
      expect(descriptions.I.N).toContain('None');
    });

    it('should provide availability descriptions', () => {
      const descriptions = cvssCalculator.getAvailabilityDescriptions();

      expect(descriptions.A.H).toContain('High');
      expect(descriptions.A.L).toContain('Low');
      expect(descriptions.A.N).toContain('None');
    });
  });

  describe('CVSS Vector Generation', () => {
    it('should generate CVSS vector from components', () => {
      const components = {
        AV: 'N',
        AC: 'L',
        PR: 'N',
        UI: 'N',
        S: 'U',
        C: 'H',
        I: 'H',
        A: 'H'
      };

      const vector = cvssCalculator.generateCVSSVector(components);

      expect(vector).toBe('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H');
    });

    it('should handle invalid components', () => {
      const invalidComponents = {
        AV: 'X', // Invalid value
        AC: 'L',
        PR: 'N',
        UI: 'N',
        S: 'U',
        C: 'H',
        I: 'H',
        A: 'H'
      };

      expect(() => {
        cvssCalculator.generateCVSSVector(invalidComponents);
      }).toThrow();
    });
  });

  describe('CVSS Score Comparison', () => {
    it('should compare CVSS scores correctly', () => {
      expect(cvssCalculator.compareCVSSScores(8.5, 7.2)).toBe(1); // 8.5 > 7.2
      expect(cvssCalculator.compareCVSSScores(6.0, 8.1)).toBe(-1); // 6.0 < 8.1
      expect(cvssCalculator.compareCVSSScores(7.5, 7.5)).toBe(0); // 7.5 = 7.5
    });

    it('should find highest CVSS score', () => {
      const scores = [3.2, 8.7, 6.1, 9.8, 2.1];
      const highest = cvssCalculator.getHighestCVSSScore(scores);

      expect(highest).toBe(9.8);
    });

    it('should find lowest CVSS score', () => {
      const scores = [3.2, 8.7, 6.1, 9.8, 2.1];
      const lowest = cvssCalculator.getLowestCVSSScore(scores);

      expect(lowest).toBe(2.1);
    });

    it('should calculate average CVSS score', () => {
      const scores = [3.0, 6.0, 9.0];
      const average = cvssCalculator.getAverageCVSSScore(scores);

      expect(average).toBe(6.0);
    });
  });

  describe('CVSS Score Formatting', () => {
    it('should format CVSS score with proper precision', () => {
      expect(cvssCalculator.formatCVSSScore(8.5)).toBe('8.5');
      expect(cvssCalculator.formatCVSSScore(7.25)).toBe('7.3');
      expect(cvssCalculator.formatCVSSScore(0)).toBe('0.0');
    });

    it('should format CVSS vector for display', () => {
      const vector = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';
      const formatted = cvssCalculator.formatCVSSVectorForDisplay(vector);

      expect(formatted).toContain('CVSS 3.1');
      expect(formatted).toContain('Attack Vector: Network');
      expect(formatted).toContain('Attack Complexity: Low');
    });
  });

  describe('CVSS Score Statistics', () => {
    it('should calculate score distribution', () => {
      const scores = [2.1, 4.5, 6.7, 8.2, 9.8, 3.1, 7.4];

      const distribution = cvssCalculator.getCVSSScoreDistribution(scores);

      expect(distribution.None).toBe(0);
      expect(distribution.Low).toBeGreaterThan(0);
      expect(distribution.Medium).toBeGreaterThan(0);
      expect(distribution.High).toBeGreaterThan(0);
      expect(distribution.Critical).toBeGreaterThan(0);
    });

    it('should calculate severity percentages', () => {
      const scores = [2.1, 4.5, 6.7, 8.2, 9.8]; // 1 Low, 1 Medium, 1 High, 2 Critical

      const percentages = cvssCalculator.getCVSSSeverityPercentages(scores);

      expect(percentages.Low).toBe(20);
      expect(percentages.Medium).toBe(20);
      expect(percentages.High).toBe(20);
      expect(percentages.Critical).toBe(40);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid CVSS vectors gracefully', () => {
      expect(() => {
        cvssCalculator.calculateCVSSScore('INVALID');
      }).toThrow();

      expect(() => {
        cvssCalculator.calculateCVSSScore(null);
      }).toThrow();

      expect(() => {
        cvssCalculator.calculateCVSSScore('');
      }).toThrow();
    });

    it('should handle invalid scores gracefully', () => {
      expect(cvssCalculator.isValidCVSSScore('invalid')).toBe(false);
      expect(cvssCalculator.isValidCVSSScore(null)).toBe(false);
      expect(cvssCalculator.isValidCVSSScore(undefined)).toBe(false);
      expect(cvssCalculator.getSeverityFromScore('invalid')).toBe('Unknown');
    });

    it('should handle empty arrays gracefully', () => {
      expect(cvssCalculator.getHighestCVSSScore([])).toBeNull();
      expect(cvssCalculator.getLowestCVSSScore([])).toBeNull();
      expect(cvssCalculator.getAverageCVSSScore([])).toBeNull();
    });
  });
});
