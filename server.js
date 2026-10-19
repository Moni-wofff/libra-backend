const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware

const allowedOrigins = [
  'http://localhost:5173',
  'https://libra-frontend-ebon.vercel.app',
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Base health route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'Libra Library Management System API is running smoothly.',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/books', require('./routes/bookRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/issues', require('./routes/issueRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));

// Error Middleware
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`[Libra Server]: Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`[API Base URL]: http://localhost:${PORT}/api`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`[Unhandled Rejection]: ${err.message}`);
});

module.exports = server;
