/**
 * CSV Formatter Tests
 * CSV形式変換のユニットテスト
 */

const { jsonToCsv, getCsvHeaders } = require('../../../../services/formatters/csvFormatter');

describe('CSV Formatter', () => {
  describe('jsonToCsv', () => {
    it('should convert simple data to CSV with BOM', () => {
      const data = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ];
      const result = jsonToCsv(data);
      expect(result.startsWith('\uFEFF')).toBe(true);
      expect(result).toContain('id,name');
      expect(result).toContain('1,Alice');
      expect(result).toContain('2,Bob');
    });

    it('should convert data without BOM when includeBOM is false', () => {
      const data = [{ id: 1, name: 'Test' }];
      const result = jsonToCsv(data, { includeBOM: false });
      expect(result.startsWith('\uFEFF')).toBe(false);
      expect(result).toContain('id,name');
    });

    it('should throw for non-array input', () => {
      expect(() => jsonToCsv('not array')).toThrow('Data must be an array');
      expect(() => jsonToCsv(null)).toThrow('Data must be an array');
      expect(() => jsonToCsv({})).toThrow('Data must be an array');
    });

    it('should return BOM only for empty array with BOM', () => {
      const result = jsonToCsv([], { includeBOM: true });
      expect(result).toBe('\uFEFF');
    });

    it('should return empty string for empty array without BOM', () => {
      const result = jsonToCsv([], { includeBOM: false });
      expect(result).toBe('');
    });

    it('should handle null and undefined values', () => {
      const data = [{ id: 1, name: null, value: undefined }];
      const result = jsonToCsv(data, { includeBOM: false });
      expect(result).toContain('""');
    });

    it('should handle object values by JSON stringifying', () => {
      const data = [{ id: 1, meta: { key: 'val' } }];
      const result = jsonToCsv(data, { includeBOM: false });
      // Object should be JSON-stringified and quoted
      expect(result).toContain('id,meta');
    });

    it('should handle array values by JSON stringifying', () => {
      const data = [{ id: 1, tags: ['a', 'b'] }];
      const result = jsonToCsv(data, { includeBOM: false });
      expect(result).toContain('id,tags');
    });

    it('should escape values containing commas', () => {
      const data = [{ id: 1, desc: 'hello, world' }];
      const result = jsonToCsv(data, { includeBOM: false });
      expect(result).toContain('"hello, world"');
    });

    it('should escape values containing newlines', () => {
      const data = [{ id: 1, desc: 'line1\nline2' }];
      const result = jsonToCsv(data, { includeBOM: false });
      expect(result).toContain('"line1\nline2"');
    });

    it('should escape values containing double quotes', () => {
      const data = [{ id: 1, desc: 'say "hello"' }];
      const result = jsonToCsv(data, { includeBOM: false });
      expect(result).toContain('"say ""hello"""');
    });

    it('should handle numeric and boolean values', () => {
      const data = [{ id: 1, score: 95.5, active: true }];
      const result = jsonToCsv(data, { includeBOM: false });
      expect(result).toContain('95.5');
      expect(result).toContain('true');
    });

    it('should use default includeBOM true when no options', () => {
      const data = [{ id: 1 }];
      const result = jsonToCsv(data);
      expect(result.startsWith('\uFEFF')).toBe(true);
    });
  });

  describe('getCsvHeaders', () => {
    it('should return correct content type', () => {
      const headers = getCsvHeaders('incidents');
      expect(headers.contentType).toBe('text/csv; charset=utf-8');
    });

    it('should return content disposition with entity name', () => {
      const headers = getCsvHeaders('incidents');
      expect(headers.contentDisposition).toContain('incidents_');
      expect(headers.contentDisposition).toContain('.csv');
      expect(headers.contentDisposition).toContain('attachment');
    });
  });
});
