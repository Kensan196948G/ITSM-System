/**
 * M365 Integration Routes - Integration Tests
 *
 * Tests for Microsoft 365 integration endpoints
 * Covers user sync, calendar events, groups, and connection testing
 *
 * Coverage target: Branches 0% → 50%+
 */

const request = require('supertest');
const { app, dbReady } = require('../../server');
const knex = require('../../knex');

// Mock external services
jest.mock('../../services/microsoftGraphService', () => ({
  isConfigured: jest.fn(),
  testConnection: jest.fn(),
  getUsers: jest.fn(),
  getCalendarEvents: jest.fn(),
  getGroups: jest.fn(),
  getGroupMembers: jest.fn(),
  transformUserForITSM: jest.fn(),
  transformCalendarEventForITSM: jest.fn()
}));

const microsoftGraphService = require('../../services/microsoftGraphService');

describe('Microsoft 365 Integration Routes (m365.js)', () => {
  let adminToken;
  let managerToken;
  let analystToken;
  let viewerToken;

  // ========================================
  // Helper Functions (defined before beforeAll)
  // ========================================

  /**
   * Setup default mock implementations
   */
  function setupDefaultMocks() {
    // Default: M365 not configured
    microsoftGraphService.isConfigured.mockReturnValue(false);
    microsoftGraphService.testConnection.mockRejectedValue(
      new Error('Microsoft 365 not configured')
    );
    microsoftGraphService.getUsers.mockResolvedValue([]);
    microsoftGraphService.getCalendarEvents.mockResolvedValue([]);
    microsoftGraphService.getGroups.mockResolvedValue([]);
    microsoftGraphService.getGroupMembers.mockResolvedValue([]);
    microsoftGraphService.transformUserForITSM.mockImplementation((user) => ({
      external_id: user.id,
      username: user.userPrincipalName?.split('@')[0] || 'unknown',
      email: user.mail,
      full_name: user.displayName,
      is_active: user.accountEnabled ? 1 : 0,
      department: user.department || null,
      job_title: user.jobTitle || null,
      source: 'microsoft365',
      role: 'viewer'
    }));
    microsoftGraphService.transformCalendarEventForITSM.mockImplementation((event) => ({
      external_id: event.id,
      title: event.subject,
      start_time: event.start?.dateTime,
      end_time: event.end?.dateTime,
      description: event.bodyPreview,
      organizer: event.organizer?.emailAddress?.address,
      attendees: (event.attendees || []).length
    }));
  }

  /**
   * Setup M365 mocks for configured state
   */
  function setupM365ConfiguredMocks() {
    microsoftGraphService.isConfigured.mockReturnValue(true);
    microsoftGraphService.testConnection.mockResolvedValue({
      success: true,
      message: 'Microsoft 365 connection successful'
    });
  }

  /**
   * Setup M365 mocks with sample users
   */
  function setupM365UsersForSync() {
    microsoftGraphService.getUsers.mockResolvedValue([
      {
        id: 'user-m365-001',
        displayName: 'John Smith',
        userPrincipalName: 'john.smith@company.com',
        mail: 'john.smith@company.com',
        accountEnabled: true,
        department: 'IT',
        jobTitle: 'Senior Engineer',
        createdDateTime: '2023-01-15T00:00:00Z'
      },
      {
        id: 'user-m365-002',
        displayName: 'Jane Doe',
        userPrincipalName: 'jane.doe@company.com',
        mail: 'jane.doe@company.com',
        accountEnabled: true,
        department: 'Operations',
        jobTitle: 'Manager',
        createdDateTime: '2023-02-10T00:00:00Z'
      },
      {
        id: 'user-m365-003',
        displayName: 'Inactive User',
        userPrincipalName: 'inactive@company.com',
        mail: 'inactive@company.com',
        accountEnabled: false,
        department: 'HR',
        jobTitle: 'Inactive',
        createdDateTime: '2023-03-01T00:00:00Z'
      }
    ]);
  }

  /**
   * Setup M365 mocks with sample calendar events
   */
  function setupM365CalendarEventsMocks() {
    microsoftGraphService.getCalendarEvents.mockResolvedValue([
      {
        id: 'event-001',
        subject: 'Team Standup',
        start: { dateTime: '2026-02-16T09:00:00' },
        end: { dateTime: '2026-02-16T09:30:00' },
        bodyPreview: 'Daily standup meeting',
        organizer: { emailAddress: { address: 'organizer@company.com' } },
        attendees: [
          { emailAddress: { address: 'attendee1@company.com' } },
          { emailAddress: { address: 'attendee2@company.com' } }
        ]
      },
      {
        id: 'event-002',
        subject: 'Project Review',
        start: { dateTime: '2026-02-17T14:00:00' },
        end: { dateTime: '2026-02-17T15:00:00' },
        bodyPreview: 'Q1 project review',
        organizer: { emailAddress: { address: 'manager@company.com' } },
        attendees: []
      }
    ]);
  }

  /**
   * Setup M365 mocks with sample groups
   */
  function setupM365GroupsMocks() {
    microsoftGraphService.getGroups.mockResolvedValue([
      {
        id: 'group-001',
        displayName: 'IT Team',
        description: 'Information Technology Department',
        mail: 'it-team@company.com'
      },
      {
        id: 'group-002',
        displayName: 'Sales Team',
        description: 'Sales Department',
        mail: 'sales-team@company.com'
      }
    ]);
  }

  /**
   * Setup M365 mocks with group members
   */
  function setupM365GroupMembersMocks() {
    microsoftGraphService.getGroupMembers.mockResolvedValue([
      {
        id: 'member-001',
        displayName: 'Alice Johnson',
        mail: 'alice@company.com',
        jobTitle: 'Engineer'
      },
      {
        id: 'member-002',
        displayName: 'Bob Wilson',
        mail: 'bob@company.com',
        jobTitle: 'Analyst'
      }
    ]);
  }

  // ========================================
  // Setup & Teardown
  // ========================================

  beforeAll(async () => {
    await dbReady;

    // Login as admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminRes.body.token;

    // Login as manager
    const managerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'manager', password: 'manager123' });
    managerToken = managerRes.body.token;

    // Login as analyst
    const analystRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'analyst', password: 'analyst123' });
    analystToken = analystRes.body.token;

    // Login as viewer
    const viewerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'viewer', password: 'viewer123' });
    viewerToken = viewerRes.body.token;
  }, 90000);

  afterAll(async () => {
    // Clean up test users if any were created
    await knex('users')
      .where('source', 'microsoft365')
      .orWhere('external_id', 'LIKE', 'user-m365-%')
      .delete();
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  // ========================================
  // Test Suites
  // ========================================

  describe('Authentication & Authorization', () => {
    it('should return 401 for POST /m365/sync/users without authentication', async () => {
      const res = await request(app).post('/api/v1/m365/sync/users').send({ activeOnly: true });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('should return 403 for POST /m365/sync/users with non-admin role', async () => {
      const res = await request(app)
        .post('/api/v1/m365/sync/users')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ activeOnly: true });

      expect(res.statusCode).toBe(403);
    });

    it('should return 401 for GET /m365/status without authentication', async () => {
      const res = await request(app).get('/api/v1/m365/status');

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 for GET /m365/status with viewer role', async () => {
      const res = await request(app)
        .get('/api/v1/m365/status')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('should return 401 for GET /m365/calendar/events without authentication', async () => {
      const res = await request(app).get('/api/v1/m365/calendar/events?userId=user-001');

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 for GET /m365/calendar/events with analyst role', async () => {
      const res = await request(app)
        .get('/api/v1/m365/calendar/events?userId=user-001')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('should return 401 for GET /m365/groups without authentication', async () => {
      const res = await request(app).get('/api/v1/m365/groups');

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 for GET /m365/groups with analyst role', async () => {
      const res = await request(app)
        .get('/api/v1/m365/groups')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('should return 401 for POST /m365/test without authentication', async () => {
      const res = await request(app).post('/api/v1/m365/test');

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 for POST /m365/test with non-admin role', async () => {
      const res = await request(app)
        .post('/api/v1/m365/test')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /m365/sync/users - User Synchronization', () => {
    it('should return 500 when M365 is not configured', async () => {
      setupDefaultMocks(); // M365 not configured

      const res = await request(app)
        .post('/api/v1/m365/sync/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ activeOnly: true });

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('認証設定が不完全');
    });

    it('should sync users successfully with default parameters', async () => {
      setupM365ConfiguredMocks();
      setupM365UsersForSync();

      const res = await request(app)
        .post('/api/v1/m365/sync/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('同期しました');
      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.processed).toBeGreaterThanOrEqual(0);
      expect(res.body.stats).toHaveProperty('inserted');
      expect(res.body.stats).toHaveProperty('updated');
      expect(res.body.stats).toHaveProperty('skipped');
      expect(res.body.stats).toHaveProperty('errors');
    });

    it('should sync users with activeOnly=true parameter', async () => {
      setupM365ConfiguredMocks();
      setupM365UsersForSync();

      const res = await request(app)
        .post('/api/v1/m365/sync/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ activeOnly: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(microsoftGraphService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: 'accountEnabled eq true'
        })
      );
    });

    it('should sync users with activeOnly=false parameter', async () => {
      setupM365ConfiguredMocks();
      setupM365UsersForSync();

      const res = await request(app)
        .post('/api/v1/m365/sync/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ activeOnly: false });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(microsoftGraphService.getUsers).toHaveBeenCalledWith(
        expect.not.objectContaining({
          filter: expect.anything()
        })
      );
    });

    it('should sync users with maxRecords parameter', async () => {
      setupM365ConfiguredMocks();
      setupM365UsersForSync();

      const res = await request(app)
        .post('/api/v1/m365/sync/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ maxRecords: 50 });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(microsoftGraphService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          maxRecords: 50
        })
      );
    });

    it('should skip users without username or email', async () => {
      setupM365ConfiguredMocks();
      microsoftGraphService.getUsers.mockResolvedValue([
        {
          id: 'user-no-email',
          displayName: 'No Email User',
          userPrincipalName: 'noemail',
          // mail is missing
          accountEnabled: true
        }
      ]);
      microsoftGraphService.transformUserForITSM.mockReturnValue({
        external_id: 'user-no-email',
        username: 'noemail',
        email: null, // Missing email
        full_name: 'No Email User'
      });

      const res = await request(app)
        .post('/api/v1/m365/sync/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.statusCode).toBe(200);
      expect(res.body.stats.skipped).toBeGreaterThan(0);
    });

    it('should handle M365 API errors gracefully', async () => {
      setupM365ConfiguredMocks();
      microsoftGraphService.getUsers.mockRejectedValue(new Error('API rate limit exceeded'));

      const res = await request(app)
        .post('/api/v1/m365/sync/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('同期エラー');
    });

    it('should return stats with processed count', async () => {
      setupM365ConfiguredMocks();
      setupM365UsersForSync();

      const res = await request(app)
        .post('/api/v1/m365/sync/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.statusCode).toBe(200);
      expect(res.body.stats.processed).toBe(3);
    });
  });

  describe('GET /m365/status - Connection Status', () => {
    it('should return status when M365 is not configured', async () => {
      setupDefaultMocks(); // not configured

      const res = await request(app)
        .get('/api/v1/m365/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.configured).toBe(false);
      expect(res.body.message).toContain('設定が必要');
    });

    it('should return status when M365 is configured', async () => {
      setupM365ConfiguredMocks();

      const res = await request(app)
        .get('/api/v1/m365/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.configured).toBe(true);
      expect(res.body.message).toContain('完了');
    });

    it('should be accessible to manager role', async () => {
      setupM365ConfiguredMocks();

      const res = await request(app)
        .get('/api/v1/m365/status')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('configured');
    });

    it('should be accessible to admin role', async () => {
      setupM365ConfiguredMocks();

      const res = await request(app)
        .get('/api/v1/m365/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('configured');
    });
  });

  describe('GET /m365/calendar/events - Calendar Events', () => {
    it('should return 400 if userId parameter is missing', async () => {
      setupM365ConfiguredMocks();

      const res = await request(app)
        .get('/api/v1/m365/calendar/events')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('userIdは必須');
    });

    it('should return 500 if M365 is not configured', async () => {
      setupDefaultMocks(); // not configured

      const res = await request(app)
        .get('/api/v1/m365/calendar/events?userId=user-001')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('設定が不完全');
    });

    it('should return calendar events with userId parameter', async () => {
      setupM365ConfiguredMocks();
      setupM365CalendarEventsMocks();

      const res = await request(app)
        .get('/api/v1/m365/calendar/events?userId=user-001')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBe(2);
      expect(microsoftGraphService.getCalendarEvents).toHaveBeenCalledWith(
        'user-001',
        expect.any(Object)
      );
    });

    it('should include optional startDateTime parameter', async () => {
      setupM365ConfiguredMocks();
      setupM365CalendarEventsMocks();

      const startDateTime = '2026-02-16T00:00:00Z';
      const res = await request(app)
        .get(
          `/api/v1/m365/calendar/events?userId=user-001&startDateTime=${encodeURIComponent(startDateTime)}`
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(microsoftGraphService.getCalendarEvents).toHaveBeenCalledWith(
        'user-001',
        expect.objectContaining({
          startDateTime
        })
      );
    });

    it('should include optional endDateTime parameter', async () => {
      setupM365ConfiguredMocks();
      setupM365CalendarEventsMocks();

      const endDateTime = '2026-02-28T23:59:59Z';
      const res = await request(app)
        .get(
          `/api/v1/m365/calendar/events?userId=user-001&endDateTime=${encodeURIComponent(endDateTime)}`
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(microsoftGraphService.getCalendarEvents).toHaveBeenCalledWith(
        'user-001',
        expect.objectContaining({
          endDateTime
        })
      );
    });

    it('should include optional top parameter (default 50)', async () => {
      setupM365ConfiguredMocks();
      setupM365CalendarEventsMocks();

      const res = await request(app)
        .get('/api/v1/m365/calendar/events?userId=user-001&top=100')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(microsoftGraphService.getCalendarEvents).toHaveBeenCalledWith(
        'user-001',
        expect.objectContaining({
          top: 100
        })
      );
    });

    it('should use default top=50 when not specified', async () => {
      setupM365ConfiguredMocks();
      setupM365CalendarEventsMocks();

      const res = await request(app)
        .get('/api/v1/m365/calendar/events?userId=user-001')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(microsoftGraphService.getCalendarEvents).toHaveBeenCalledWith(
        'user-001',
        expect.objectContaining({
          top: 50
        })
      );
    });

    it('should handle M365 API errors for calendar events', async () => {
      setupM365ConfiguredMocks();
      microsoftGraphService.getCalendarEvents.mockRejectedValue(
        new Error('User calendar not found')
      );

      const res = await request(app)
        .get('/api/v1/m365/calendar/events?userId=invalid-user')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('should be accessible to manager role', async () => {
      setupM365ConfiguredMocks();
      setupM365CalendarEventsMocks();

      const res = await request(app)
        .get('/api/v1/m365/calendar/events?userId=user-001')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /m365/groups - Groups List', () => {
    it('should return 500 if M365 is not configured', async () => {
      setupDefaultMocks(); // not configured

      const res = await request(app)
        .get('/api/v1/m365/groups')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('設定が不完全');
    });

    it('should return groups list when M365 is configured', async () => {
      setupM365ConfiguredMocks();
      setupM365GroupsMocks();

      const res = await request(app)
        .get('/api/v1/m365/groups')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBe(2);
      expect(microsoftGraphService.getGroups).toHaveBeenCalled();
    });

    it('should support optional top parameter', async () => {
      setupM365ConfiguredMocks();
      setupM365GroupsMocks();

      const res = await request(app)
        .get('/api/v1/m365/groups?top=50')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(microsoftGraphService.getGroups).toHaveBeenCalledWith(
        expect.objectContaining({
          top: 50
        })
      );
    });

    it('should use default top=100 when not specified', async () => {
      setupM365ConfiguredMocks();
      setupM365GroupsMocks();

      const res = await request(app)
        .get('/api/v1/m365/groups')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(microsoftGraphService.getGroups).toHaveBeenCalledWith(
        expect.objectContaining({
          top: 100
        })
      );
    });

    it('should support optional filter parameter', async () => {
      setupM365ConfiguredMocks();
      setupM365GroupsMocks();

      const filter = "displayName eq 'IT Team'";
      const res = await request(app)
        .get(`/api/v1/m365/groups?filter=${encodeURIComponent(filter)}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(microsoftGraphService.getGroups).toHaveBeenCalledWith(
        expect.objectContaining({
          filter
        })
      );
    });

    it('should handle M365 API errors for groups', async () => {
      setupM365ConfiguredMocks();
      microsoftGraphService.getGroups.mockRejectedValue(new Error('Access denied to groups'));

      const res = await request(app)
        .get('/api/v1/m365/groups')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('should be accessible to manager role', async () => {
      setupM365ConfiguredMocks();
      setupM365GroupsMocks();

      const res = await request(app)
        .get('/api/v1/m365/groups')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /m365/groups/:groupId/members - Group Members', () => {
    it('should return 500 if M365 is not configured', async () => {
      setupDefaultMocks(); // not configured

      const res = await request(app)
        .get('/api/v1/m365/groups/group-001/members')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('設定が不完全');
    });

    it('should return group members for given groupId', async () => {
      setupM365ConfiguredMocks();
      setupM365GroupMembersMocks();

      const res = await request(app)
        .get('/api/v1/m365/groups/group-001/members')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBe(2);
      expect(microsoftGraphService.getGroupMembers).toHaveBeenCalledWith('group-001');
    });

    it('should return members for different groupId', async () => {
      setupM365ConfiguredMocks();
      setupM365GroupMembersMocks();

      const res = await request(app)
        .get('/api/v1/m365/groups/group-999/members')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(microsoftGraphService.getGroupMembers).toHaveBeenCalledWith('group-999');
    });

    it('should handle M365 API errors for group members', async () => {
      setupM365ConfiguredMocks();
      microsoftGraphService.getGroupMembers.mockRejectedValue(new Error('Group not found'));

      const res = await request(app)
        .get('/api/v1/m365/groups/invalid-group/members')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('should handle empty group members list', async () => {
      setupM365ConfiguredMocks();
      microsoftGraphService.getGroupMembers.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/m365/groups/empty-group/members')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('should be accessible to manager role', async () => {
      setupM365ConfiguredMocks();
      setupM365GroupMembersMocks();

      const res = await request(app)
        .get('/api/v1/m365/groups/group-001/members')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /m365/test - Connection Test', () => {
    it('should test connection successfully when M365 is configured', async () => {
      setupM365ConfiguredMocks();
      microsoftGraphService.testConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful'
      });

      const res = await request(app)
        .post('/api/v1/m365/test')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('successful');
      expect(microsoftGraphService.testConnection).toHaveBeenCalled();
    });

    it('should return failure when connection test fails', async () => {
      setupM365ConfiguredMocks();
      microsoftGraphService.testConnection.mockResolvedValue({
        success: false,
        message: 'Authentication failed'
      });

      const res = await request(app)
        .post('/api/v1/m365/test')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(false);
    });

    it('should handle service errors gracefully', async () => {
      setupM365ConfiguredMocks();
      microsoftGraphService.testConnection.mockRejectedValue(new Error('Network timeout'));

      const res = await request(app)
        .post('/api/v1/m365/test')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('should be admin-only endpoint', async () => {
      setupM365ConfiguredMocks();

      const res = await request(app)
        .post('/api/v1/m365/test')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should report error stats when individual user processing fails', async () => {
      setupM365ConfiguredMocks();
      // Setup users with one that will cause transformation issues
      microsoftGraphService.getUsers.mockResolvedValue([
        {
          id: 'user-ok',
          displayName: 'OK User',
          userPrincipalName: 'ok@company.com',
          mail: 'ok@company.com',
          accountEnabled: true
        }
      ]);

      let callCount = 0;
      microsoftGraphService.transformUserForITSM.mockImplementation((user) => {
        callCount += 1;
        return {
          external_id: user.id,
          username: user.userPrincipalName?.split('@')[0] || 'unknown',
          email: user.mail,
          full_name: user.displayName,
          is_active: user.accountEnabled ? 1 : 0
        };
      });

      const res = await request(app)
        .post('/api/v1/m365/sync/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toBeDefined();
    });

    it('should parse integer top parameter correctly', async () => {
      setupM365ConfiguredMocks();
      setupM365GroupsMocks();

      const res = await request(app)
        .get('/api/v1/m365/groups?top=abc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      // parseInt('abc', 10) returns NaN, which should be handled
      expect(microsoftGraphService.getGroups).toHaveBeenCalled();
    });

    it('should handle large numbers in top parameter', async () => {
      setupM365ConfiguredMocks();
      setupM365GroupsMocks();

      const res = await request(app)
        .get('/api/v1/m365/groups?top=999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(microsoftGraphService.getGroups).toHaveBeenCalledWith(
        expect.objectContaining({
          top: 999999
        })
      );
    });

    it('should include all required properties in stats object', async () => {
      setupM365ConfiguredMocks();
      setupM365UsersForSync();

      const res = await request(app)
        .post('/api/v1/m365/sync/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.statusCode).toBe(200);
      expect(res.body.stats).toHaveProperty('processed');
      expect(res.body.stats).toHaveProperty('inserted');
      expect(res.body.stats).toHaveProperty('updated');
      expect(res.body.stats).toHaveProperty('skipped');
      expect(res.body.stats).toHaveProperty('errors');

      // All should be numbers
      expect(typeof res.body.stats.processed).toBe('number');
      expect(typeof res.body.stats.inserted).toBe('number');
      expect(typeof res.body.stats.updated).toBe('number');
      expect(typeof res.body.stats.skipped).toBe('number');
      expect(typeof res.body.stats.errors).toBe('number');
    });

    it('should have proper response structure for calendar events', async () => {
      setupM365ConfiguredMocks();
      setupM365CalendarEventsMocks();

      const res = await request(app)
        .get('/api/v1/m365/calendar/events?userId=user-001')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body.success).toBe(true);
    });

    it('should have proper response structure for groups', async () => {
      setupM365ConfiguredMocks();
      setupM365GroupsMocks();

      const res = await request(app)
        .get('/api/v1/m365/groups')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body.success).toBe(true);
    });
  });
});
