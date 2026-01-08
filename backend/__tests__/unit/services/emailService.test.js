/**
 * Email Service Unit Tests
 */

const nodemailer = require('nodemailer');
const fs = require('fs');

const mockTransporter = {
  sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  verify: jest.fn((cb) => cb(null))
};

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => mockTransporter)
}));

jest.mock('fs');

describe('Email Service Unit Tests', () => {
  let emailService;

  beforeEach(() => {
    jest.clearAllMocks();
    fs.readFileSync.mockReturnValue('Template Content');
    // We don't reset modules here to keep the mock active
    emailService = require('../../../services/emailService');
  });

  it('should send email successfully', async () => {
    const result = await emailService.sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      text: 'Hello'
    });

    expect(result.success).toBe(true);
    expect(mockTransporter.sendMail).toHaveBeenCalled();
  });

  it('should send password reset email', async () => {
    const result = await emailService.sendPasswordResetEmail('test@example.com', 'user', 'token');
    expect(result.success).toBe(true);
    expect(mockTransporter.sendMail).toHaveBeenCalled();
  });

  it('should return null when template loading fails', async () => {
    fs.readFileSync.mockImplementationOnce(() => {
      throw new Error('File not found');
    });
    const result = await emailService.sendPasswordResetEmail('test@example.com', 'user', 'token');
    expect(result.success).toBe(true); // Still succeeds but with no HTML
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: null
      })
    );
  });

  it('should handle sendMail error', async () => {
    mockTransporter.sendMail.mockRejectedValueOnce(new Error('Send Error'));
    await expect(emailService.sendEmail({ to: 'a', subject: 'b', text: 'c' })).rejects.toThrow(
      'Send Error'
    );
  });
});
