/**
 * JSON Formatter Tests
 * JSON形式変換のユニットテスト
 */

const { formatJson, getJsonHeaders } = require('../../../../services/formatters/jsonFormatter');

describe('JSON Formatter', () => {
  describe('formatJson', () => {
    it('should format array data with default indent', () => {
      const data = [{ id: 1, name: 'Test' }];
      const result = formatJson(data);
      expect(result).toBe(JSON.stringify(data, null, 2));
    });

    it('should format object data', () => {
      const data = { key: 'value', nested: { a: 1 } };
      const result = formatJson(data);
      expect(result).toBe(JSON.stringify(data, null, 2));
    });

    it('should use custom indent', () => {
      const data = { id: 1 };
      const result = formatJson(data, { indent: 4 });
      expect(result).toBe(JSON.stringify(data, null, 4));
    });

    it('should handle null data', () => {
      const result = formatJson(null);
      expect(result).toBe('null');
    });

    it('should handle empty array', () => {
      const result = formatJson([]);
      expect(result).toBe('[]');
    });

    it('should use default indent 2 when no options', () => {
      const data = { a: 1 };
      const result = formatJson(data);
      // Default indent is 2
      expect(result).toContain('  "a"');
    });
  });

  describe('getJsonHeaders', () => {
    it('should return correct content type', () => {
      const headers = getJsonHeaders('incidents');
      expect(headers.contentType).toBe('application/json; charset=utf-8');
    });

    it('should return content disposition with entity name', () => {
      const headers = getJsonHeaders('incidents');
      expect(headers.contentDisposition).toContain('incidents_');
      expect(headers.contentDisposition).toContain('.json');
      expect(headers.contentDisposition).toContain('attachment');
    });
  });
});
