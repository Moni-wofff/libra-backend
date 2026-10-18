const express = require('express');
const router = express.Router();
const {
  createIssue,
  getIssues,
  getIssueById,
  returnBook,
} = require('../controllers/issueController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getIssues)
  .post(protect, createIssue);

router.route('/:id')
  .get(protect, getIssueById);

router.route('/:id/return')
  .put(protect, returnBook);

module.exports = router;
