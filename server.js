const fs = require('fs');
const path = require('path');

// Register custom compiler for extensionless files (like 'controllers' and 'middleware')
require.extensions[''] = function (module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  module._compile(content, filename);
};

// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Import configuration instances
require('./config/db');

// Import extensionless modules
const middleware = require('./middleware');

// Import BD-01 routes
const authRoutes = require('./routes/authRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const patientRoutes = require('./routes/patientRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security and utility middleware
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

// Mount BD-01 API Routes
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);

app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use(middleware.errorHandler);

app.listen(PORT, () => {
  console.log(`Server Status: Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

module.exports = app;
