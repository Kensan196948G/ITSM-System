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

  it('should send SLA violation alert email', async () => {
    const result = await emailService.sendSlaViolationAlert({
      service_name: 'Test Service',
      violation_type: 'Response Time',
      violation_time: new Date().toISOString(),
      target_time: '1 hour',
      actual_time: '2 hours'
    });

    expect(result.success).toBe(true);
    expect(mockTransporter.sendMail).toHaveBeenCalled();
    expect(mockTransporter.sendMail.mock.calls[0][0].subject).toContain('SLA Violation');
  });

  it('should send incident notification email', async () => {
    const result = await emailService.sendIncidentNotification({
      ticket_id: 'INC-123456',
      title: 'Test Incident',
      priority: 'High',
      status: 'New',
      description: 'Test description'
    });

    expect(result.success).toBe(true);
    expect(mockTransporter.sendMail).toHaveBeenCalled();
    expect(mockTransporter.sendMail.mock.calls[0][0].subject).toContain('Incident');
  });

  it('should send security alert email', async () => {
    const result = await emailService.sendSecurityAlert({
      alert_type: 'Unauthorized Access',
      severity: 'High',
      description: 'Test security alert',
      timestamp: new Date().toISOString()
    });

    expect(result.success).toBe(true);
    expect(mockTransporter.sendMail).toHaveBeenCalled();
    expect(mockTransporter.sendMail.mock.calls[0][0].subject).toContain('Security Alert');
  });

  it('should handle transporter verification error', async () => {
    mockTransporter.verify.mockImplementationOnce((cb) => cb(new Error('Verification Error')));

    // Re-require to trigger verification
    jest.resetModules();
    const nodemailer = require('nodemailer');
    const mockTransporterNew = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
      verify: jest.fn((cb) => cb(new Error('Verification Error')))
    };
    nodemailer.createTransport.mockReturnValue(mockTransporterNew);

    const emailServiceNew = require('../../../services/emailService');
    const result = await emailServiceNew.sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      text: 'Hello'
    });

    expect(result.success).toBe(true); // Should still succeed despite verification error
  });

  it('should use environment variables for configuration', () => {
    // Test that environment variables are used
    process.env.SMTP_HOST = 'test.smtp.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASS = 'password';

    jest.resetModules();
    const nodemailer = require('nodemailer');
    const emailServiceNew = require('../../../services/emailService');

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'test.smtp.com',
        port: 587,
        auth: {
          user: 'test@example.com',
          pass: 'password'
        }
      })
    );
  });
});
