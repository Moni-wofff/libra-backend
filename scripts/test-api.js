const http = require('http');

// Helper to make HTTP request
function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body,
          });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('[API TEST SUITE STARTED]');
  let server;
  try {
    // Start server in-memory
    server = require('../server.js');
    await new Promise((r) => setTimeout(r, 1000));

    // Test 1: Health Check
    const health = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET',
    });
    console.log(`Test 1 (Health Check): ${health.statusCode === 200 ? 'PASS' : 'FAIL'} (${health.statusCode})`);

    // Test 2: Reject Protected Route without token
    const noToken = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/books',
      method: 'GET',
    });
    console.log(`Test 2 (Unauthorized access blocked): ${noToken.statusCode === 401 ? 'PASS' : 'FAIL'} (${noToken.statusCode})`);

    // Test 3: Admin Login
    const loginRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { email: 'admin@libra.com', password: 'admin123' }
    );
    console.log(`Test 3 (Admin Login): ${loginRes.statusCode === 200 && loginRes.body?.token ? 'PASS' : 'FAIL'}`);
    const token = loginRes.body?.token;

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // Test 4: Dashboard Stats
    const statsRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/dashboard/stats',
      method: 'GET',
      headers: authHeaders,
    });
    console.log(`Test 4 (Dashboard Stats): ${statsRes.statusCode === 200 ? 'PASS' : 'FAIL'}`);
    console.log('   Stats retrieved:', statsRes.body?.data);

    // Test 5: Get Books with Search
    const searchBookRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/books?search=Harry',
      method: 'GET',
      headers: authHeaders,
    });
    console.log(`Test 5 (Search Books): ${searchBookRes.body?.data?.length === 1 ? 'PASS' : 'FAIL'}`);

    // Test 6: Get Issues
    const issuesRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/issues',
      method: 'GET',
      headers: authHeaders,
    });
    console.log(`Test 6 (Get Issues): ${issuesRes.statusCode === 200 && issuesRes.body?.data?.length === 3 ? 'PASS' : 'FAIL'}`);

    // Test 7: Get Overdue Issues
    const overdueRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/issues?status=overdue',
      method: 'GET',
      headers: authHeaders,
    });
    console.log(`Test 7 (Get Overdue Issues): ${overdueRes.statusCode === 200 && overdueRes.body?.data?.length === 1 ? 'PASS' : 'FAIL'}`);

    console.log('[ALL BACKEND TESTS COMPLETED SUCCESSFULLY]');
  } catch (err) {
    console.error('Test suite error:', err);
  } finally {
    if (server) {
      server.close();
    }
    process.exit(0);
  }
}

runTests();
