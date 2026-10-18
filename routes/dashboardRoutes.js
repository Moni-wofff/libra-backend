const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getRecentIssues,
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

router.get('/stats', protect, getDashboardStats);
router.get('/recent-issues', protect, getRecentIssues);

module.exports = router;
