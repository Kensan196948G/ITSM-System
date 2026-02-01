/**
 * Performance Test Suite
 * Tests system performance under various loads
 */

const { performance } = require('perf_hooks');
const request = require('supertest');
const express = require('express');

// Mock database
jest.mock('../../../backend/db', () => ({
  db: {
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn()
  },
  initDb: jest.fn()
}));

const { db } = require('../../db');

// Create test app
const app = express();
app.use(express.json());

// Mock routes
app.get('/api/v1/test', (req, res) => {
  res.json({ message: 'Test response' });
});

app.post('/api/v1/test', (req, res) => {
  // Simulate processing time
  setTimeout(() => {
    res.json({ message: 'Created', id: Date.now() });
  }, Math.random() * 100);
});

describe('Performance Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Response Time Performance', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = performance.now();

      const response = await request(app).get('/api/v1/test');

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // 1 second max
      console.log(`Response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should handle multiple concurrent requests efficiently', async () => {
      const numRequests = 50;
      const startTime = performance.now();

      const promises = Array.from({ length: numRequests }, () => request(app).get('/api/v1/test'));

      const responses = await Promise.all(promises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / numRequests;

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      expect(avgResponseTime).toBeLessThan(500); // 500ms average max
      console.log(
        `Concurrent requests: ${numRequests}, Total time: ${totalTime.toFixed(2)}ms, Avg: ${avgResponseTime.toFixed(2)}ms`
      );
    });

    it('should maintain performance under sustained load', async () => {
      const numRequests = 100;
      const responseTimes = [];

      for (let i = 0; i < numRequests; i++) {
        const startTime = performance.now();

        await request(app)
          .post('/api/v1/test')
          .send({ data: `Request ${i}` });

        const endTime = performance.now();
        responseTimes.push(endTime - startTime);

        // Small delay to prevent overwhelming
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      console.log(`Load test results:`);
      console.log(`- Average: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`- Max: ${maxResponseTime.toFixed(2)}ms`);
      console.log(`- Min: ${minResponseTime.toFixed(2)}ms`);

      expect(avgResponseTime).toBeLessThan(200); // 200ms average max
      expect(maxResponseTime).toBeLessThan(1000); // 1s max
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not have memory leaks during sustained operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many operations
      const operations = 1000;
      for (let i = 0; i < operations; i++) {
        await request(app).get('/api/v1/test');

        if (i % 100 === 0) {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory usage:`);
      console.log(`- Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Allow some memory increase but not excessive
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB max increase
    });
  });

  describe('Database Query Performance', () => {
    it('should execute database queries efficiently', async () => {
      // Mock database operations
      db.get.mockResolvedValue({ id: 1, name: 'Test' });
      db.all.mockResolvedValue(
        Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }))
      );
      db.run.mockResolvedValue({ changes: 1 });

      const operations = [
        { type: 'get', mock: () => db.get('SELECT * FROM test') },
        { type: 'all', mock: () => db.all('SELECT * FROM test') },
        { type: 'run', mock: () => db.run('INSERT INTO test VALUES (?)', ['value']) }
      ];

      for (const op of operations) {
        const startTime = performance.now();
        await op.mock();
        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log(`${op.type} query time: ${duration.toFixed(2)}ms`);
        expect(duration).toBeLessThan(100); // 100ms max per query
      }
    });

    it('should handle database connection pooling efficiently', async () => {
      // Simulate connection pooling stress test
      const concurrentQueries = 20;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentQueries }, () =>
        db.get('SELECT * FROM test WHERE id = ?', [Math.floor(Math.random() * 100)])
      );

      await Promise.all(promises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const avgTime = totalTime / concurrentQueries;

      console.log(
        `Concurrent DB queries: ${concurrentQueries}, Total: ${totalTime.toFixed(2)}ms, Avg: ${avgTime.toFixed(2)}ms`
      );
      expect(avgTime).toBeLessThan(50); // 50ms average max
    });
  });

  describe('Cache Performance', () => {
    it('should demonstrate cache performance benefits', async () => {
      const cache = require('../../middleware/cache');

      // Clear cache
      cache.clearAllCache();

      const testData = { message: 'Cached data' };
      const cacheKey = '/api/v1/cached-test';

      // First access (cache miss)
      const missStart = performance.now();
      cache.setCache(cacheKey, testData, 300);
      const missEnd = performance.now();
      const missTime = missEnd - missStart;

      // Second access (cache hit)
      const hitStart = performance.now();
      const cachedData = cache.getCache(cacheKey);
      const hitEnd = performance.now();
      const hitTime = hitEnd - hitStart;

      console.log(`Cache performance:`);
      console.log(`- Cache miss time: ${missTime.toFixed(2)}ms`);
      console.log(`- Cache hit time: ${hitTime.toFixed(2)}ms`);
      console.log(`- Performance improvement: ${(missTime / hitTime).toFixed(2)}x faster`);

      expect(cachedData).toEqual(testData);
      expect(hitTime).toBeLessThan(missTime); // Cache hit should be faster
      expect(hitTime).toBeLessThan(1); // Sub-millisecond cache access
    });

    it('should handle cache invalidation efficiently', async () => {
      const cache = require('../../middleware/cache');

      // Fill cache with test data
      for (let i = 0; i < 100; i++) {
        cache.setCache(`/api/v1/test/${i}`, { data: i }, 300);
      }

      const startTime = performance.now();
      cache.invalidateCache('test');
      const endTime = performance.now();

      const invalidationTime = endTime - startTime;

      console.log(`Cache invalidation time for 100 entries: ${invalidationTime.toFixed(2)}ms`);

      // Verify cache is cleared
      for (let i = 0; i < 100; i++) {
        expect(cache.getCache(`/api/v1/test/${i}`)).toBeNull();
      }

      expect(invalidationTime).toBeLessThan(100); // 100ms max for invalidation
    });
  });

  describe('API Throughput', () => {
    it('should maintain throughput under load', async () => {
      const numRequests = 200;
      const startTime = performance.now();

      const promises = Array.from({ length: numRequests }, (_, i) =>
        request(app)
          .get('/api/v1/test')
          .then((response) => ({
            status: response.status,
            responseTime: performance.now() - startTime
          }))
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const throughput = (numRequests / totalTime) * 1000; // requests per second
      const avgResponseTime = totalTime / numRequests;

      const successfulRequests = results.filter((r) => r.status === 200).length;
      const successRate = (successfulRequests / numRequests) * 100;

      console.log(`Throughput test results:`);
      console.log(`- Total requests: ${numRequests}`);
      console.log(`- Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`- Throughput: ${throughput.toFixed(2)} req/sec`);
      console.log(`- Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`- Success rate: ${successRate.toFixed(2)}%`);

      expect(successRate).toBeGreaterThanOrEqual(99); // 99% success rate minimum
      expect(throughput).toBeGreaterThan(50); // 50 req/sec minimum
      expect(avgResponseTime).toBeLessThan(100); // 100ms average max
    });

    it('should handle burst traffic patterns', async () => {
      // Simulate burst traffic (high load followed by low load)
      const bursts = [
        { requests: 20, delay: 0 }, // Initial burst
        { requests: 5, delay: 100 }, // Low load period (reduced delay for test performance)
        { requests: 30, delay: 200 }, // Second burst
        { requests: 10, delay: 300 } // Final burst
      ];

      const allResults = [];
      let totalProcessingTime = 0; // Track only processing time, not delays

      for (const burst of bursts) {
        await new Promise((resolve) => setTimeout(resolve, burst.delay));

        const burstStartTime = performance.now();
        const promises = Array.from({ length: burst.requests }, () =>
          request(app).get('/api/v1/test')
        );

        const results = await Promise.all(promises);
        const burstEndTime = performance.now();

        const burstTime = burstEndTime - burstStartTime;
        totalProcessingTime += burstTime;
        const burstThroughput = (burst.requests / burstTime) * 1000;

        allResults.push({
          burst: burst.requests,
          time: burstTime,
          throughput: burstThroughput,
          successRate: (results.filter((r) => r.status === 200).length / burst.requests) * 100
        });

        console.log(
          `Burst ${burst.requests} requests: ${burstThroughput.toFixed(2)} req/sec, ${burstTime.toFixed(2)}ms`
        );
      }

      const totalRequests = bursts.reduce((sum, burst) => sum + burst.requests, 0);
      // Calculate throughput based on processing time only, excluding intentional delays
      const overallThroughput = (totalRequests / totalProcessingTime) * 1000;

      console.log(
        `Overall burst test: ${overallThroughput.toFixed(2)} req/sec (processing time only)`
      );

      // All bursts should maintain high success rates
      allResults.forEach((result) => {
        expect(result.successRate).toBeGreaterThanOrEqual(95);
      });

      expect(overallThroughput).toBeGreaterThan(30); // 30 req/sec overall minimum
    });
  });

  describe('Resource Usage Monitoring', () => {
    it('should monitor CPU usage during load', async () => {
      const initialCpu = process.cpuUsage();

      // Generate load
      const numRequests = 100;
      const promises = Array.from({ length: numRequests }, () =>
        request(app).post('/api/v1/test').send({ data: 'load test' })
      );

      await Promise.all(promises);

      const finalCpu = process.cpuUsage(initialCpu);
      const cpuTimeMs = (finalCpu.user + finalCpu.system) / 1000; // Convert to milliseconds

      console.log(`CPU usage for ${numRequests} requests: ${cpuTimeMs.toFixed(2)}ms`);

      // CPU time should be reasonable (not excessive)
      expect(cpuTimeMs).toBeLessThan(1000); // 1 second max CPU time
    });

    it('should handle long-running operations gracefully', async () => {
      // Test with simulated long-running operation
      app.get('/api/v1/long-operation', (req, res) => {
        setTimeout(() => {
          res.json({ message: 'Long operation completed' });
        }, 500); // 500ms delay
      });

      const startTime = performance.now();
      const response = await request(app).get('/api/v1/long-operation');

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeGreaterThan(450); // At least 450ms (allowing for some overhead)
      expect(responseTime).toBeLessThan(1000); // But not more than 1 second

      console.log(`Long operation response time: ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('Scalability Testing', () => {
    it('should scale with increasing load', async () => {
      const loadLevels = [10, 25, 50, 100];

      for (const load of loadLevels) {
        const startTime = performance.now();

        const promises = Array.from({ length: load }, () => request(app).get('/api/v1/test'));

        const responses = await Promise.all(promises);
        const endTime = performance.now();

        const totalTime = endTime - startTime;
        const throughput = (load / totalTime) * 1000;
        const successRate = (responses.filter((r) => r.status === 200).length / load) * 100;

        console.log(
          `Load ${load}: ${throughput.toFixed(2)} req/sec, ${successRate.toFixed(2)}% success`
        );

        expect(successRate).toBeGreaterThanOrEqual(99);
        expect(throughput).toBeGreaterThan(10); // Minimum acceptable throughput
      }
    });

    it('should handle memory-intensive operations', async () => {
      const initialMemory = process.memoryUsage();

      // Create memory-intensive operations
      const largeDataOperations = 50;
      for (let i = 0; i < largeDataOperations; i++) {
        const largeData = Array.from({ length: 1000 }, (_, idx) => ({
          id: idx,
          data: 'x'.repeat(100) // 100 characters per item
        }));

        await request(app).post('/api/v1/test').send({ data: largeData });

        // Force GC if available
        if (global.gc && i % 10 === 0) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory-intensive operations:`);
      console.log(`- Operations: ${largeDataOperations}`);
      console.log(`- Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB max increase
    });
  });
});
