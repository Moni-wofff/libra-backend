const Book = require('../models/Book');
const Student = require('../models/Student');
const Issue = require('../models/Issue');

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
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
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recent library issues/activity
// @route   GET /api/dashboard/recent-issues
// @access  Private
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

module.exports = {
  getDashboardStats,
  getRecentIssues,
};
