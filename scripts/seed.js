const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Book = require('../models/Book');
const Student = require('../models/Student');
const Issue = require('../models/Issue');

const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/library_management_system';
    console.log(`[Seed Script]: Connecting to ${mongoUri}...`);
    await mongoose.connect(mongoUri);

    console.log('[Seed Script]: Connected to MongoDB. Seeding initial data...');

    // 1. Seed or update Admin User
    const adminEmail = 'admin@libra.com';
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = new User({
        name: 'Chief Librarian',
        email: adminEmail,
        password: 'admin123', // Will be hashed by pre-save hook
        role: 'admin',
      });
      await admin.save();
      console.log(` -> Admin created: ${adminEmail} / admin123`);
    } else {
      console.log(` -> Admin already exists: ${adminEmail}`);
    }

    // 2. Clear existing sample books, students, and issues for a clean, consistent demo state
    await Issue.deleteMany({});
    await Book.deleteMany({});
    await Student.deleteMany({});

    // 3. Seed Sample Books
    const sampleBooks = [
      {
        title: 'Harry Potter and the Sorcerer\'s Stone',
        author: 'J. K. Rowling',
        isbn: '978-0747532743',
        category: 'Fiction',
        quantity: 5,
        available: 5,
      },
      {
        title: 'The Alchemist',
        author: 'Paulo Coelho',
        isbn: '978-0062315007',
        category: 'Fiction',
        quantity: 4,
        available: 4,
      },
      {
        title: 'Wings of Fire',
        author: 'A. P. J. Abdul Kalam',
        isbn: '978-8173711466',
        category: 'Biography',
        quantity: 6,
        available: 6,
      },
      {
        title: 'Ponniyin Selvan',
        author: 'Kalki Krishnamurthy',
        isbn: '978-9388144254',
        category: 'Historical Fiction',
        quantity: 4,
        available: 4,
      },
      {
        title: 'The Mahabharata',
        author: 'Vyasa',
        isbn: '978-0143063612',
        category: 'Epic',
        quantity: 3,
        available: 3,
      },
    ];

    const insertedBooks = await Book.insertMany(sampleBooks);
    console.log(` -> Seeded ${insertedBooks.length} sample books.`);

    // 4. Seed Sample Students / Members
    const sampleStudents = [
      {
        name: 'Rahul Sharma',
        email: 'rahul.sharma@example.com',
        phone: '+91 98765 43210',
        membershipId: 'LIB-2026-001',
      },
      {
        name: 'Monika Patel',
        email: 'monika.patel@example.com',
        phone: '+91 98123 45678',
        membershipId: 'LIB-2026-002',
      },
      {
        name: 'Ananya Roy',
        email: 'ananya.roy@example.com',
        phone: '+91 97654 32109',
        membershipId: 'LIB-2026-003',
      },
      {
        name: 'David Miller',
        email: 'david.miller@example.com',
        phone: '+1 555-019-2834',
        membershipId: 'LIB-2026-004',
      },
    ];

    const insertedStudents = await Student.insertMany(sampleStudents);
    console.log(` -> Seeded ${insertedStudents.length} sample members.`);

    // 5. Seed Realistic Issues (1 active normal, 1 returned, 1 overdue)
    const now = new Date();

    // Transaction A: Active issued book (due in 7 days)
    const activeDueDate = new Date();
    activeDueDate.setDate(now.getDate() + 7);

    const issueA = await Issue.create({
      book: insertedBooks[0]._id, // Harry Potter
      student: insertedStudents[0]._id, // Rahul
      issueDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // issued 2 days ago
      dueDate: activeDueDate,
      status: 'issued',
    });
    // Adjust Harry Potter available count
    insertedBooks[0].available -= 1;
    await insertedBooks[0].save();

    // Transaction B: Overdue book (issued 14 days ago, was due 4 days ago)
    const pastDueDate = new Date();
    pastDueDate.setDate(now.getDate() - 4);

    const issueB = await Issue.create({
      book: insertedBooks[1]._id, // The Alchemist
      student: insertedStudents[1]._id, // Monika
      issueDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      dueDate: pastDueDate,
      status: 'issued',
    });
    // Adjust The Alchemist available count
    insertedBooks[1].available -= 1;
    await insertedBooks[1].save();

    // Transaction C: Returned book (issued 20 days ago, returned 3 days ago)
    const returnedDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const issueC = await Issue.create({
      book: insertedBooks[2]._id, // Wings of Fire
      student: insertedStudents[2]._id, // Ananya
      issueDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      dueDate: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
      returnDate: returnedDate,
      status: 'returned',
    });
    // Wings of Fire available count remains 6 because it was returned

    console.log(' -> Seeded 3 sample issue transactions (1 active, 1 overdue, 1 returned).');
    console.log('\n[Seed Completed Successfully!]');
    console.log('--------------------------------------------------');
    console.log('Admin Credentials:');
    console.log(` Email:    ${adminEmail}`);
    console.log(' Password: admin123');
    console.log('--------------------------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
};

seedDatabase();
