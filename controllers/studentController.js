const Student = require('../models/Student');
const Issue = require('../models/Issue');

// @desc    Get all students (with search)
// @route   GET /api/students
// @access  Private
const getStudents = async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { membershipId: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    const students = await Student.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Private
const getStudentById = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Member not found.',
      });
    }

    res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register a new student/member
// @route   POST /api/students
// @access  Private
const createStudent = async (req, res, next) => {
  try {
    const { name, email, phone, membershipId } = req.body;

    if (!name || !email || !phone || !membershipId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, phone, and membership ID.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedMembershipId = membershipId.trim().toUpperCase();

    // Check duplicate email
    const emailExists = await Student.findOne({ email: trimmedEmail });
    if (emailExists) {
      return res.status(409).json({
        success: false,
        message: `Member with email "${trimmedEmail}" already exists.`,
      });
    }

    // Check duplicate membershipId
    const idExists = await Student.findOne({ membershipId: trimmedMembershipId });
    if (idExists) {
      return res.status(409).json({
        success: false,
        message: `Member with Membership ID "${trimmedMembershipId}" already exists.`,
      });
    }

    const student = await Student.create({
      name: name.trim(),
      email: trimmedEmail,
      phone: phone.trim(),
      membershipId: trimmedMembershipId,
    });

    res.status(201).json({
      success: true,
      message: 'Student member registered successfully.',
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update student/member
// @route   PUT /api/students/:id
// @access  Private
const updateStudent = async (req, res, next) => {
  try {
    const { name, email, phone, membershipId } = req.body;
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Member not found.',
      });
    }

    // Check email uniqueness if changed
    if (email && email.trim().toLowerCase() !== student.email) {
      const emailConflict = await Student.findOne({
        email: email.trim().toLowerCase(),
        _id: { $ne: student._id },
      });
      if (emailConflict) {
        return res.status(409).json({
          success: false,
          message: `Another member already uses email "${email.trim()}".`,
        });
      }
      student.email = email.trim().toLowerCase();
    }

    // Check membership ID uniqueness if changed
    if (membershipId && membershipId.trim().toUpperCase() !== student.membershipId) {
      const idConflict = await Student.findOne({
        membershipId: membershipId.trim().toUpperCase(),
        _id: { $ne: student._id },
      });
      if (idConflict) {
        return res.status(409).json({
          success: false,
          message: `Another member already uses Membership ID "${membershipId.trim().toUpperCase()}".`,
        });
      }
      student.membershipId = membershipId.trim().toUpperCase();
    }

    if (name) student.name = name.trim();
    if (phone) student.phone = phone.trim();

    await student.save();

    res.status(200).json({
      success: true,
      message: 'Member details updated successfully.',
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete student/member
// @route   DELETE /api/students/:id
// @access  Private
const deleteStudent = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Member not found.',
      });
    }

    // Check if student has active issued transactions
    const activeIssuesCount = await Issue.countDocuments({
      student: student._id,
      status: 'issued',
    });

    if (activeIssuesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete member "${student.name}". They have ${activeIssuesCount} book(s) currently issued. Please record book returns before deleting this member.`,
      });
    }

    // Clean up past returned history or delete student
    await Issue.deleteMany({ student: student._id });
    await Student.findByIdAndDelete(student._id);

    res.status(200).json({
      success: true,
      message: `Member "${student.name}" was successfully deleted.`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
};
