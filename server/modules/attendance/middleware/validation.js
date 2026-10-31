const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
};

const validateLogin = [
  // Use toLowerCase only — normalizeEmail() strips dots in gmail addresses
  // which breaks lookups when the stored email has dots (e.g. john.doe@gmail.com)
  body('email').isEmail().withMessage('Please provide a valid email').customSanitizer(v => v?.toLowerCase().trim()),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

const validateRegister = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Please provide a valid email').customSanitizer(v => v?.toLowerCase().trim()),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['employee', 'admin']).withMessage('Invalid role'),
  handleValidationErrors,
];

const validateAttendance = [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  handleValidationErrors,
];

// For admin creating employees — password is optional (defaults to Welcome@123 in controller)
const validateCreateEmployee = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Please provide a valid email').customSanitizer(v => v?.toLowerCase().trim()),
  body('password').optional({ checkFalsy: true }).isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['employee', 'admin']).withMessage('Invalid role'),
  handleValidationErrors,
];

module.exports = { validateLogin, validateRegister, validateCreateEmployee, validateAttendance, handleValidationErrors };