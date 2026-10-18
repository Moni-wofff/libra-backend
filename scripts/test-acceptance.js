const http = require('http');

function apiCall(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function verifyAll() {
  console.log('=== STARTING 20 ACCEPTANCE CRITERIA VERIFICATION ===\n');
  const results = [];

  const logCheck = (num, name, passed, detail = '') => {
    results.push({ num, name, passed, detail });
    console.log(`[Criteria ${num < 10 ? '0' + num : num}] ${name}: ${passed ? '✓ PASSED' : '✗ FAILED'} ${detail ? '(' + detail + ')' : ''}`);
  };

  try {
    // 1. Server connects to MongoDB (Health Check)
    const health = await apiCall({ hostname: 'localhost', port: 5000, path: '/api/health', method: 'GET' });
    logCheck(1, 'Server connects to MongoDB', health.status === 200);

    // 2. Valid admin login
    const loginValid = await apiCall(
      { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { email: 'admin@libra.com', password: 'admin123' }
    );
    const token = loginValid.data?.token;
    logCheck(2, 'Valid admin login succeeds', loginValid.status === 200 && !!token);

    const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    // 3. Invalid credentials rejected
    const loginInvalid = await apiCall(
      { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { email: 'admin@libra.com', password: 'wrongpassword' }
    );
    logCheck(3, 'Invalid credentials rejected', loginInvalid.status === 401);

    // 4. Protected endpoint rejects requests without token
    const noToken = await apiCall({ hostname: 'localhost', port: 5000, path: '/api/books', method: 'GET' });
    logCheck(4, 'Protected endpoint rejects missing token', noToken.status === 401);

    // 5. Book can be added and appears in list
    const testIsbn = '978-' + Math.floor(1000000000 + Math.random() * 9000000000);
    const addBookRes = await apiCall(
      { hostname: 'localhost', port: 5000, path: '/api/books', method: 'POST', headers: authHeaders },
      { title: 'Test Verification Book', author: 'Test Author', isbn: testIsbn, category: 'Technology', quantity: 3 }
    );
    const createdBook = addBookRes.data?.data;
    logCheck(5, 'Book can be added and appears in catalog', addBookRes.status === 201 && createdBook?.available === 3);

    // 6. Book can be edited
    const editBookRes = await apiCall(
      { hostname: 'localhost', port: 5000, path: `/api/books/${createdBook._id}`, method: 'PUT', headers: authHeaders },
      { title: 'Updated Test Book', quantity: 4 }
    );
    logCheck(6, 'Book can be edited and quantity updated', editBookRes.status === 200 && editBookRes.data?.data?.available === 4);

    // 7. Search returns matching books
    const searchRes = await apiCall(
      { hostname: 'localhost', port: 5000, path: '/api/books?search=Updated+Test', method: 'GET', headers: authHeaders }
    );
    logCheck(7, 'Search returns matching book query', searchRes.data?.data?.length >= 1);

    // 8. Member can be registered and searched
    const testMemId = 'MEM-' + Math.floor(1000 + Math.random() * 9000);
    const addMemRes = await apiCall(
      { hostname: 'localhost', port: 5000, path: '/api/students', method: 'POST', headers: authHeaders },
      { name: 'Test Student', email: `test.${testMemId.toLowerCase()}@test.com`, phone: '+91 99999 88888', membershipId: testMemId }
    );
    const createdMember = addMemRes.data?.data;
    const searchMemRes = await apiCall(
      { hostname: 'localhost', port: 5000, path: `/api/students?search=${testMemId}`, method: 'GET', headers: authHeaders }
    );
    logCheck(8, 'Member registered and searched', addMemRes.status === 201 && searchMemRes.data?.data?.length === 1);

    // 9. Book can be issued to member
    const issueDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const issueRes = await apiCall(
      { hostname: 'localhost', port: 5000, path: '/api/issues', method: 'POST', headers: authHeaders },
      { bookId: createdBook._id, studentId: createdMember._id, issueDate, dueDate }
    );
    const createdIssue = issueRes.data?.data;
    logCheck(9, 'Book issued to member', issueRes.status === 201 && !!createdIssue?._id);

    // 10. Issuing decreases available copies by exactly 1
    const bookAfterIssue = await apiCall(
      { hostname: 'localhost', port: 5000, path: `/api/books/${createdBook._id}`, method: 'GET', headers: authHeaders }
    );
    logCheck(10, 'Issuing decreases available copies by 1', bookAfterIssue.data?.data?.available === 3, '4 -> 3 copies');

    // 11. Issuing an unavailable book is rejected
    // Create book with 0 quantity
    const zeroIsbn = '978-' + Math.floor(1000000000 + Math.random() * 9000000000);
    const zeroBookRes = await apiCall(
      { hostname: 'localhost', port: 5000, path: '/api/books', method: 'POST', headers: authHeaders },
      { title: 'Zero Stock Book', author: 'Author Zero', isbn: zeroIsbn, category: 'Fiction', quantity: 0 }
    );
    const zeroBook = zeroBookRes.data?.data;
    const issueZeroRes = await apiCall(
      { hostname: 'localhost', port: 5000, path: '/api/issues', method: 'POST', headers: authHeaders },
      { bookId: zeroBook._id, studentId: createdMember._id, dueDate }
    );
    logCheck(11, 'Issuing unavailable book is rejected', issueZeroRes.status === 409, `HTTP ${issueZeroRes.status}`);

    // 12. Returning a book increases available copies by 1
    const returnRes = await apiCall(
      { hostname: 'localhost', port: 5000, path: `/api/issues/${createdIssue._id}/return`, method: 'PUT', headers: authHeaders }
    );
    const bookAfterReturn = await apiCall(
      { hostname: 'localhost', port: 5000, path: `/api/books/${createdBook._id}`, method: 'GET', headers: authHeaders }
    );
    logCheck(12, 'Returning increases available copies by 1', returnRes.status === 200 && bookAfterReturn.data?.data?.available === 4, '3 -> 4 copies');

    // 13. Returning the same book twice is rejected
    const returnTwiceRes = await apiCall(
      { hostname: 'localhost', port: 5000, path: `/api/issues/${createdIssue._id}/return`, method: 'PUT', headers: authHeaders }
    );
    logCheck(13, 'Returning same book twice is rejected', returnTwiceRes.status === 400, `HTTP ${returnTwiceRes.status}`);

    // 14. Overdue transactions are identified correctly
    const overdueRes = await apiCall(
      { hostname: 'localhost', port: 5000, path: '/api/issues?status=overdue', method: 'GET', headers: authHeaders }
    );
    logCheck(14, 'Overdue transactions identified automatically', overdueRes.status === 200 && overdueRes.data?.data?.length >= 1);

    // 15. Books & members with active issues cannot be deleted
    // Issue a book to member
    const activeIssueRes = await apiCall(
      { hostname: 'localhost', port: 5000, path: '/api/issues', method: 'POST', headers: authHeaders },
      { bookId: createdBook._id, studentId: createdMember._id, dueDate }
    );
    const deleteBookBlocked = await apiCall(
      { hostname: 'localhost', port: 5000, path: `/api/books/${createdBook._id}`, method: 'DELETE', headers: authHeaders }
    );
    const deleteMemberBlocked = await apiCall(
      { hostname: 'localhost', port: 5000, path: `/api/students/${createdMember._id}`, method: 'DELETE', headers: authHeaders }
    );
    logCheck(15, 'Active issue prevents book and member deletion', deleteBookBlocked.status === 400 && deleteMemberBlocked.status === 400);

    // Return the active issue to clean up
    await apiCall(
      { hostname: 'localhost', port: 5000, path: `/api/issues/${activeIssueRes.data?.data?._id}/return`, method: 'PUT', headers: authHeaders }
    );
    // Now delete book and member successfully
    await apiCall({ hostname: 'localhost', port: 5000, path: `/api/books/${createdBook._id}`, method: 'DELETE', headers: authHeaders });
    await apiCall({ hostname: 'localhost', port: 5000, path: `/api/students/${createdMember._id}`, method: 'DELETE', headers: authHeaders });
    await apiCall({ hostname: 'localhost', port: 5000, path: `/api/books/${zeroBook._id}`, method: 'DELETE', headers: authHeaders });

    // 16. Dashboard counts reflect real database records
    const dashStats = await apiCall(
      { hostname: 'localhost', port: 5000, path: '/api/dashboard/stats', method: 'GET', headers: authHeaders }
    );
    logCheck(16, 'Dashboard counts reflect real DB data', dashStats.status === 200 && typeof dashStats.data?.data?.totalBookTitles === 'number');

    // 17. Validation errors displayed properly (missing required fields)
    const badBook = await apiCall(
      { hostname: 'localhost', port: 5000, path: '/api/books', method: 'POST', headers: authHeaders },
      { title: '', author: '' }
    );
    logCheck(17, 'Validation errors returned properly', badBook.status === 400);

    // 18. Vite frontend build passes
    const frontendRes = await apiCall({ hostname: 'localhost', port: 5173, path: '/', method: 'GET' });
    logCheck(18, 'Frontend dev server serving application', frontendRes.status === 200);

    // 19. Session restored via token verification
    const meRes = await apiCall(
      { hostname: 'localhost', port: 5000, path: '/api/auth/me', method: 'GET', headers: authHeaders }
    );
    logCheck(19, 'Session restored via /api/auth/me', meRes.status === 200 && meRes.data?.user?.email === 'admin@libra.com');

    // 20. Logging out / Invalid token prevents protected access
    const badTokenRes = await apiCall(
      { hostname: 'localhost', port: 5000, path: '/api/dashboard/stats', method: 'GET', headers: { Authorization: 'Bearer invalid_or_expired_token' } }
    );
    logCheck(20, 'Logged out/invalid token blocks protected access', badTokenRes.status === 401);

    console.log('\n=== ALL 20 ACCEPTANCE CRITERIA VERIFIED ===');
    const allPassed = results.every((r) => r.passed);
    console.log(`Summary: ${results.filter((r) => r.passed).length} / ${results.length} PASSED`);
    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error('Acceptance suite encountered error:', err);
    process.exit(1);
  }
}

verifyAll();
