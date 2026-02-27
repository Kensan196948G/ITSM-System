/**
 * Excel Formatter Tests
 * Excel形式変換のユニットテスト
 */

const { jsonToExcel, getExcelHeaders } = require('../../../../services/formatters/excelFormatter');

describe('Excel Formatter', () => {
  describe('jsonToExcel', () => {
    it('should convert data to Excel buffer', async () => {
      const data = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ];
      const buffer = await jsonToExcel(data);
      expect(
        Buffer.isBuffer(buffer) || buffer instanceof ArrayBuffer || buffer instanceof Uint8Array
      ).toBe(true);
    });

    it('should throw for non-array input', async () => {
      await expect(jsonToExcel('not array')).rejects.toThrow('Data must be an array');
      await expect(jsonToExcel(null)).rejects.toThrow('Data must be an array');
      await expect(jsonToExcel({})).rejects.toThrow('Data must be an array');
    });

    it('should throw for empty array', async () => {
      await expect(jsonToExcel([])).rejects.toThrow('Data array is empty');
    });

    it('should use custom sheet name', async () => {
      const data = [{ id: 1, name: 'Test' }];
      const buffer = await jsonToExcel(data, { sheetName: 'Custom' });
      expect(buffer).toBeDefined();
    });

    it('should use default Sheet1 name when no option', async () => {
      const data = [{ id: 1 }];
      const buffer = await jsonToExcel(data);
      expect(buffer).toBeDefined();
    });
  });

  describe('getExcelHeaders', () => {
    it('should return correct content type', () => {
      const headers = getExcelHeaders('incidents');
      expect(headers.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    });

    it('should return content disposition with entity name', () => {
      const headers = getExcelHeaders('incidents');
      expect(headers.contentDisposition).toContain('incidents_');
      expect(headers.contentDisposition).toContain('.xlsx');
      expect(headers.contentDisposition).toContain('attachment');
    });
  });
});
