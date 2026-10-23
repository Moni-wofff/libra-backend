const express = require('express');
const router = express.Router();
const {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, authorize('admin'), getStudents)
  .post(protect, authorize('admin'), createStudent);

router.route('/:id')
  .get(protect, authorize('admin'), getStudentById)
  .put(protect, authorize('admin'), updateStudent)
  .delete(protect, authorize('admin'), deleteStudent);

module.exports = router;
