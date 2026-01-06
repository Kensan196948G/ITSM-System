const {
  register,
  metricsEndpoint,
  trackDbQuery,
  trackIncident,
  updateActiveUsers,
  updateSlaCompliance,
  updateOpenIncidents
} = require('../../../middleware/metrics');

describe('Metrics Middleware Helpers', () => {
  it('updates custom metrics without errors', async () => {
    trackDbQuery('select', 'incidents');
    trackIncident('High', true);
    updateActiveUsers(3);
    updateSlaCompliance('Email', 98.5);
    updateOpenIncidents('High', 2);

    const output = await register.metrics();
    expect(output).toContain('itsm_database_queries_total');
    expect(output).toContain('itsm_incidents_total');
    expect(output).toContain('itsm_active_users_total');
  });

  it('metricsEndpoint returns Prometheus payload', async () => {
    const res = {
      set: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    await metricsEndpoint({}, res);

    expect(res.set).toHaveBeenCalledWith('Content-Type', register.contentType);
    expect(res.send).toHaveBeenCalled();
  });
});
