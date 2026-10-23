const BorrowRequest = require('../models/BorrowRequest');
const Book = require('../models/Book');
const Student = require('../models/Student');
const Issue = require('../models/Issue');

// @desc    Submit a new borrow request
// @route   POST /api/borrow-requests
// @access  Private (User & Admin)
const createBorrowRequest = async (req, res, next) => {
  try {
    const { bookId } = req.body;

    if (!bookId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid book ID.',
      });
    }

    // Locate student record
    let studentId = req.user.student;
    if (!studentId) {
      let student = await Student.findOne({ email: req.user.email });
      if (!student) {
        const year = new Date().getFullYear();
        student = await Student.create({
          name: req.user.name,
          email: req.user.email,
          phone: req.user.phone || 'N/A',
          membershipId: `LIB-${year}-${Math.floor(1000 + Math.random() * 9000)}`,
          user: req.user._id,
        });
      }
      studentId = student._id;
      req.user.student = studentId;
      await req.user.save();
    }

    // Find the book
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found in library catalog.',
      });
    }

    if (book.available <= 0) {
      return res.status(400).json({
        success: false,
        message: `"${book.title}" is currently out of stock. Available copies: 0.`,
      });
    }

    // Check for duplicate pending request
    const existingPending = await BorrowRequest.findOne({
      user: req.user._id,
      book: bookId,
      status: 'pending',
    });

    if (existingPending) {
      return res.status(409).json({
        success: false,
        message: `You already have an active pending borrow request for "${book.title}".`,
      });
    }

    // Check if user already has an active issued copy of this book
    const existingIssue = await Issue.findOne({
      student: studentId,
      book: bookId,
      status: 'issued',
    });

    if (existingIssue) {
      return res.status(409).json({
        success: false,
        message: `You currently already have an active issued copy of "${book.title}". Please return your current copy first.`,
      });
    }

    const borrowRequest = await BorrowRequest.create({
      user: req.user._id,
      student: studentId,
      book: book._id,
      status: 'pending',
      requestDate: new Date(),
    });

    const populatedRequest = await BorrowRequest.findById(borrowRequest._id)
      .populate('book', 'title author isbn category available quantity')
      .populate('student', 'name email membershipId');

    res.status(201).json({
      success: true,
      message: `Borrow request for "${book.title}" submitted successfully! Awaiting administrator approval.`,
      data: populatedRequest,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get logged-in user's own borrow requests
// @route   GET /api/borrow-requests/my
// @access  Private
const getMyBorrowRequests = async (req, res, next) => {
  try {
    const requests = await BorrowRequest.find({ user: req.user._id })
      .populate('book', 'title author isbn category available quantity')
      .populate('issue', 'dueDate issueDate returnDate status')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all borrow requests (with status filtering)
// @route   GET /api/borrow-requests
// @access  Private (Admin Only)
const getAllBorrowRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = {};

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

    const requests = await BorrowRequest.find(query)
      .populate('book', 'title author isbn category available quantity')
      .populate('student', 'name email phone membershipId')
      .populate('user', 'name email phone')
      .populate('issue', 'dueDate issueDate returnDate status')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve a pending borrow request
// @route   PUT /api/borrow-requests/:id/approve
// @access  Private (Admin Only)
const approveBorrowRequest = async (req, res, next) => {
  try {
    const { dueDate, adminNotes } = req.body;
    const request = await BorrowRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Borrow request not found.',
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${request.status}. Only pending requests can be approved.`,
      });
    }

    // Atomically find book and decrement available copy by 1 if available > 0
    const updatedBook = await Book.findOneAndUpdate(
      { _id: request.book, available: { $gt: 0 } },
      { $inc: { available: -1 } },
      { new: true }
    );

    if (!updatedBook) {
      const bookInfo = await Book.findById(request.book);
      return res.status(409).json({
        success: false,
        message: `Cannot approve request: "${bookInfo?.title || 'This book'}" has 0 available copies left in the library catalog.`,
      });
    }

    // Determine due date (defaults to 14 days from today)
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 14);
    const parsedDueDate = dueDate ? new Date(dueDate) : defaultDueDate;

    try {
      // Create issue transaction
      const issue = await Issue.create({
        book: updatedBook._id,
        student: request.student,
        issueDate: new Date(),
        dueDate: parsedDueDate,
        status: 'issued',
      });

      // Update borrow request
      request.status = 'approved';
      request.decisionDate = new Date();
      request.issue = issue._id;
      if (adminNotes && adminNotes.trim()) {
        request.adminNotes = adminNotes.trim();
      }
      await request.save();

      const populatedRequest = await BorrowRequest.findById(request._id)
        .populate('book', 'title author isbn category available quantity')
        .populate('student', 'name email phone membershipId')
        .populate('issue', 'dueDate issueDate returnDate status');

      res.status(200).json({
        success: true,
        message: `Borrow request approved! Book "${updatedBook.title}" issued to student.`,
        data: populatedRequest,
      });
    } catch (createError) {
      // Rollback stock decrement on failure
      await Book.findByIdAndUpdate(request.book, { $inc: { available: 1 } });
      throw createError;
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reject a pending borrow request
// @route   PUT /api/borrow-requests/:id/reject
// @access  Private (Admin Only)
const rejectBorrowRequest = async (req, res, next) => {
  try {
    const { adminNotes } = req.body;
    const request = await BorrowRequest.findById(req.params.id).populate('book', 'title');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Borrow request not found.',
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${request.status}. Only pending requests can be rejected.`,
      });
    }

    // No stock reduction on rejection
    request.status = 'rejected';
    request.decisionDate = new Date();
    request.adminNotes = adminNotes && adminNotes.trim() ? adminNotes.trim() : 'Request declined by administrator.';
    await request.save();

    res.status(200).json({
      success: true,
      message: `Borrow request for "${request.book?.title || 'Book'}" has been rejected.`,
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBorrowRequest,
  getMyBorrowRequests,
  getAllBorrowRequests,
  approveBorrowRequest,
  rejectBorrowRequest,
};
