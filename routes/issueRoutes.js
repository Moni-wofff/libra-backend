const express = require('express');
const router = express.Router();
const {
  createIssue,
  getIssues,
  getIssueById,
  returnBook,
  getMyIssues,
} = require('../controllers/issueController');
const { protect, authorize } = require('../middleware/authMiddleware');

// User personal issued books route
router.get('/my', protect, getMyIssues);

// Admin circulation routes
router.route('/')
  .get(protect, authorize('admin'), getIssues)
  .post(protect, authorize('admin'), createIssue);

router.route('/:id')
  .get(protect, authorize('admin'), getIssueById);

router.route('/:id/return')
  .put(protect, authorize('admin'), returnBook);

module.exports = router;
