const Book = require('../models/Book');
const Issue = require('../models/Issue');

// @desc    Get all books (with search & category filter)
// @route   GET /api/books
// @access  Private
const getBooks = async (req, res, next) => {
  try {
    const { search, category } = req.query;
    let query = {};

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { author: searchRegex },
        { isbn: searchRegex },
      ];
    }

    if (category && category.trim() !== '' && category !== 'All') {
      query.category = category.trim();
    }

    const books = await Book.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: books.length,
      data: books,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single book
// @route   GET /api/books/:id
// @access  Private
const getBookById = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found.',
      });
    }

    res.status(200).json({
      success: true,
      data: book,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new book
// @route   POST /api/books
// @access  Private
const createBook = async (req, res, next) => {
  try {
    const { title, author, isbn, category, quantity } = req.body;

    if (!title || !author || !isbn || !category || quantity === undefined || quantity === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: title, author, ISBN, category, and quantity.',
      });
    }

    const parsedQuantity = parseInt(quantity, 10);
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Total quantity must be a non-negative number.',
      });
    }

    // Check if ISBN already exists
    const existingBook = await Book.findOne({ isbn: isbn.trim() });
    if (existingBook) {
      return res.status(409).json({
        success: false,
        message: `A book with ISBN "${isbn.trim()}" already exists.`,
      });
    }

    // On creation, all copies are initially available
    const book = await Book.create({
      title: title.trim(),
      author: author.trim(),
      isbn: isbn.trim(),
      category: category.trim(),
      quantity: parsedQuantity,
      available: parsedQuantity,
    });

    res.status(201).json({
      success: true,
      message: 'Book added successfully.',
      data: book,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update book details
// @route   PUT /api/books/:id
// @access  Private
const updateBook = async (req, res, next) => {
  try {
    const { title, author, isbn, category, quantity } = req.body;
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found.',
      });
    }

    // If ISBN changed, check uniqueness
    if (isbn && isbn.trim() !== book.isbn) {
      const isbnConflict = await Book.findOne({
        isbn: isbn.trim(),
        _id: { $ne: book._id },
      });
      if (isbnConflict) {
        return res.status(409).json({
          success: false,
          message: `Another book already uses ISBN "${isbn.trim()}".`,
        });
      }
      book.isbn = isbn.trim();
    }

    if (title) book.title = title.trim();
    if (author) book.author = author.trim();
    if (category) book.category = category.trim();

    // Check quantity updates against currently issued copies
    if (quantity !== undefined && quantity !== '') {
      const newQuantity = parseInt(quantity, 10);
      if (isNaN(newQuantity) || newQuantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Total quantity must be a non-negative number.',
        });
      }

      // Calculate currently issued copies from existing book state
      const currentlyIssued = book.quantity - book.available;

      if (newQuantity < currentlyIssued) {
        return res.status(400).json({
          success: false,
          message: `Cannot reduce total quantity to ${newQuantity}. There are currently ${currentlyIssued} copies issued to students.`,
        });
      }

      // Adjust available copies based on the change in total quantity
      const newAvailable = newQuantity - currentlyIssued;
      book.quantity = newQuantity;
      book.available = newAvailable;
    }

    await book.save();

    res.status(200).json({
      success: true,
      message: 'Book updated successfully.',
      data: book,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete book
// @route   DELETE /api/books/:id
// @access  Private
const deleteBook = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found.',
      });
    }

    // Check if book has active issued transactions
    const activeIssuesCount = await Issue.countDocuments({
      book: book._id,
      status: 'issued',
    });

    if (activeIssuesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete "${book.title}". There are currently ${activeIssuesCount} active issued copies. Please record all returns before deleting.`,
      });
    }

    // Also remove associated historical issue records or keep them clean
    await Issue.deleteMany({ book: book._id });
    await Book.findByIdAndDelete(book._id);

    res.status(200).json({
      success: true,
      message: `Book "${book.title}" was successfully deleted.`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
};
