const Book = require('../models/Book');
const Student = require('../models/Student');
const Issue = require('../models/Issue');
const BorrowRequest = require('../models/BorrowRequest');

// @desc    Get dashboard statistics for Admin
// @route   GET /api/dashboard/stats
// @access  Private (Admin Only)
const getDashboardStats = async (req, res, next) => {
  try {
    const now = new Date();

    // Run aggregations and counts in parallel for optimal performance
    const [
      totalBookTitles,
      bookCopiesAggregation,
      totalMembers,
      currentlyIssued,
      overdueIssues,
      categoryStats,
      pendingBorrowRequests,
    ] = await Promise.all([
      Book.countDocuments(),
      Book.aggregate([
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: '$quantity' },
            totalAvailable: { $sum: '$available' },
          },
        },
      ]),
      Student.countDocuments(),
      Issue.countDocuments({ status: 'issued' }),
      Issue.countDocuments({ status: 'issued', dueDate: { $lt: now } }),
      Book.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalCopies: { $sum: '$quantity' },
          },
        },
        { $sort: { count: -1 } },
      ]),
      BorrowRequest.countDocuments({ status: 'pending' }),
    ]);

    const totalCopies = bookCopiesAggregation[0]?.totalQuantity || 0;
    const totalAvailable = bookCopiesAggregation[0]?.totalAvailable || 0;

    res.status(200).json({
      success: true,
      data: {
        totalBookTitles,
        totalCopies,
        totalAvailable,
        totalMembers,
        currentlyIssued,
        overdueIssues,
        categoryStats,
        pendingBorrowRequests,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recent library issues/activity for Admin
// @route   GET /api/dashboard/recent-issues
// @access  Private (Admin Only)
const getRecentIssues = async (req, res, next) => {
  try {
    const recentIssues = await Issue.find()
      .populate('book', 'title author isbn category')
      .populate('student', 'name email membershipId')
      .sort({ createdAt: -1 })
      .limit(6);

    res.status(200).json({
      success: true,
      count: recentIssues.length,
      data: recentIssues,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard statistics for regular user
// @route   GET /api/dashboard/user-stats
// @access  Private
const getUserDashboardStats = async (req, res, next) => {
  try {
    let studentId = req.user.student;
    if (!studentId) {
      const student = await Student.findOne({ email: req.user.email });
      if (student) studentId = student._id;
    }

    const now = new Date();
    let activeLoans = 0;
    let overdueLoans = 0;
    let totalReturned = 0;

    if (studentId) {
      [activeLoans, overdueLoans, totalReturned] = await Promise.all([
        Issue.countDocuments({ student: studentId, status: 'issued' }),
        Issue.countDocuments({ student: studentId, status: 'issued', dueDate: { $lt: now } }),
        Issue.countDocuments({ student: studentId, status: 'returned' }),
      ]);
    }

    const [pendingRequests, approvedRequests, totalAvailableBooks] = await Promise.all([
      BorrowRequest.countDocuments({ user: req.user._id, status: 'pending' }),
      BorrowRequest.countDocuments({ user: req.user._id, status: 'approved' }),
      Book.countDocuments({ available: { $gt: 0 } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        activeLoans,
        overdueLoans,
        totalReturned,
        pendingRequests,
        approvedRequests,
        totalAvailableBooks,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getRecentIssues,
  getUserDashboardStats,
};
