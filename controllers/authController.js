const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');

// Helper to generate JWT token
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'libra_super_secret_jwt_key_2026_secure',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};

// @desc    User & Admin Login
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: trimmedEmail }).populate('student');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Auto-link student card if not yet linked
    if (!user.student && user.role === 'user') {
      const existingStudent = await Student.findOne({ email: user.email });
      if (existingStudent) {
        user.student = existingStudent._id;
        await user.save();
        existingStudent.user = user._id;
        await existingStudent.save();
      }
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        student: user.student,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register a new library user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: trimmedEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.',
      });
    }

    // Public registration ALWAYS receives the 'user' role
    // Any role supplied in req.body is strictly ignored.
    const sanitizedRole = 'user';

    // Check if an existing Student card exists with this email
    let student = await Student.findOne({ email: trimmedEmail });

    if (!student) {
      // Generate unique Membership ID
      const year = new Date().getFullYear();
      let uniqueMembershipId = '';
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        attempts++;
        const randNum = Math.floor(1000 + Math.random() * 9000);
        const testId = `LIB-${year}-${randNum}`;
        const found = await Student.findOne({ membershipId: testId });
        if (!found) {
          uniqueMembershipId = testId;
          isUnique = true;
        }
      }

      if (!uniqueMembershipId) {
        uniqueMembershipId = `LIB-${year}-${Date.now().toString().slice(-4)}`;
      }

      student = await Student.create({
        name: name.trim(),
        email: trimmedEmail,
        phone: phone ? phone.trim() : 'N/A',
        membershipId: uniqueMembershipId,
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: trimmedEmail,
      password,
      role: sanitizedRole,
      phone: phone ? phone.trim() : '',
      student: student._id,
    });

    student.user = user._id;
    await student.save();

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully. Welcome to Libra!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        student: {
          _id: student._id,
          name: student.name,
          email: student.email,
          membershipId: student.membershipId,
          phone: student.phone,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current authenticated User/Admin info
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('student');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        student: user.student,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  register,
  getMe,
};
