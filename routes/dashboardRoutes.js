const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getRecentIssues,
  getUserDashboardStats,
} = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/stats', protect, authorize('admin'), getDashboardStats);
router.get('/recent-issues', protect, authorize('admin'), getRecentIssues);
router.get('/user-stats', protect, getUserDashboardStats);

module.exports = router;
