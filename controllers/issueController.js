const Issue = require('../models/Issue');
const Book = require('../models/Book');
const Student = require('../models/Student');

// @desc    Issue a book to a student/member
// @route   POST /api/issues
// @access  Private
const createIssue = async (req, res, next) => {
  try {
    const { bookId, studentId, dueDate, issueDate } = req.body;

    if (!bookId || !studentId || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide book ID, member ID, and due date.',
      });
    }

    // Verify member exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Selected member was not found in database.',
      });
    }

    // Parse dates
    const parsedIssueDate = issueDate ? new Date(issueDate) : new Date();
    const parsedDueDate = new Date(dueDate);

    if (isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid due date format.',
      });
    }

    // Due date cannot be earlier than issue date (compare day start to avoid slight millisecond mismatches)
    const issueDateDay = new Date(parsedIssueDate).setHours(0, 0, 0, 0);
    const dueDateDay = new Date(parsedDueDate).setHours(0, 0, 0, 0);

    if (dueDateDay < issueDateDay) {
      return res.status(400).json({
        success: false,
        message: 'Due date cannot be earlier than the issue date.',
      });
    }

    // Atomically find book and decrement available copy by 1 if available > 0
    const updatedBook = await Book.findOneAndUpdate(
      { _id: bookId, available: { $gt: 0 } },
      { $inc: { available: -1 } },
      { new: true }
    );

    if (!updatedBook) {
      // Check if book doesn't exist or is out of stock
      const bookExists = await Book.findById(bookId);
      if (!bookExists) {
        return res.status(404).json({
          success: false,
          message: 'Selected book was not found in the library.',
        });
      }
      return res.status(409).json({
        success: false,
        message: `No available copies left for "${bookExists.title}". Current available count is 0.`,
      });
    }

    try {
      // Create issue transaction
      const issue = await Issue.create({
        book: updatedBook._id,
        student: student._id,
        issueDate: parsedIssueDate,
        dueDate: parsedDueDate,
        status: 'issued',
      });

      const populatedIssue = await Issue.findById(issue._id)
        .populate('book', 'title author isbn category quantity available')
        .populate('student', 'name email phone membershipId');

      return res.status(201).json({
        success: true,
        message: `Book "${updatedBook.title}" successfully issued to ${student.name}.`,
        data: populatedIssue,
      });
    } catch (createError) {
      // Rollback available count on book if issue creation failed
      await Book.findByIdAndUpdate(bookId, { $inc: { available: 1 } });
      throw createError;
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get all issues (with status filters: all, issued, returned, overdue)
// @route   GET /api/issues
// @access  Private
const getIssues = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    let query = {};
    const now = new Date();

    if (status === 'issued') {
      query.status = 'issued';
    } else if (status === 'returned') {
      query.status = 'returned';
    } else if (status === 'overdue') {
      // An issue is overdue if status is 'issued' and dueDate has passed
      query.status = 'issued';
      query.dueDate = { $lt: now };
    }

    const issues = await Issue.find(query)
      .populate('book', 'title author isbn category quantity available')
      .populate('student', 'name email phone membershipId')
      .sort({ createdAt: -1 });

    // Filter by search if provided (searches student name, membershipId, book title, or isbn)
    let filteredIssues = issues;
    if (search && search.trim() !== '') {
      const term = search.trim().toLowerCase();
      filteredIssues = issues.filter((issue) => {
        const studentName = issue.student?.name?.toLowerCase() || '';
        const membershipId = issue.student?.membershipId?.toLowerCase() || '';
        const bookTitle = issue.book?.title?.toLowerCase() || '';
        const isbn = issue.book?.isbn?.toLowerCase() || '';
        return (
          studentName.includes(term) ||
          membershipId.includes(term) ||
          bookTitle.includes(term) ||
          isbn.includes(term)
        );
      });
    }

    res.status(200).json({
      success: true,
      count: filteredIssues.length,
      data: filteredIssues,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single issue
// @route   GET /api/issues/:id
// @access  Private
const getIssueById = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('book', 'title author isbn category quantity available')
      .populate('student', 'name email phone membershipId');

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue transaction not found.',
      });
    }

    res.status(200).json({
      success: true,
      data: issue,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Return an issued book
// @route   PUT /api/issues/:id/return
// @access  Private
const returnBook = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue transaction not found.',
      });
    }

    // Check if already returned
    if (issue.status === 'returned') {
      const returnFormatted = issue.returnDate
        ? new Date(issue.returnDate).toLocaleDateString()
        : 'an earlier date';
      return res.status(400).json({
        success: false,
        message: `This book has already been recorded as returned on ${returnFormatted}.`,
      });
    }

    // Increment book's available count by exactly 1
    const book = await Book.findById(issue.book);
    if (book) {
      // Ensure available count doesn't exceed total quantity
      if (book.available < book.quantity) {
        book.available += 1;
        await book.save();
      }
    }

    // Update issue record
    issue.status = 'returned';
    issue.returnDate = new Date();
    await issue.save();

    const updatedIssue = await Issue.findById(issue._id)
      .populate('book', 'title author isbn category quantity available')
      .populate('student', 'name email phone membershipId');

    res.status(200).json({
      success: true,
      message: `Book "${updatedIssue.book?.title || 'Book'}" marked as returned successfully.`,
      data: updatedIssue,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get logged-in user's own issued books
// @route   GET /api/issues/my
// @access  Private
const getMyIssues = async (req, res, next) => {
  try {
    let studentId = req.user.student;
    if (!studentId) {
      const student = await Student.findOne({ email: req.user.email });
      if (student) {
        studentId = student._id;
      }
    }

    if (!studentId) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const { status } = req.query;
    let query = { student: studentId };
    const now = new Date();

    if (status === 'issued') {
      query.status = 'issued';
    } else if (status === 'returned') {
      query.status = 'returned';
    } else if (status === 'overdue') {
      query.status = 'issued';
      query.dueDate = { $lt: now };
    }

    const issues = await Issue.find(query)
      .populate('book', 'title author isbn category quantity available')
      .populate('student', 'name email phone membershipId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: issues.length,
      data: issues,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createIssue,
  getIssues,
  getIssueById,
  returnBook,
  getMyIssues,
};
