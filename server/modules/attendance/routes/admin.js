const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getEmployees,
  createEmployee,
  updateEmployee,
  toggleEmployeeStatus,
  deleteEmployee,
  getAttendanceRecords,
  getMonthlyReport,
  exportCSV,
  getEmployeeAttendance,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');
const { validateCreateEmployee } = require('../middleware/validation');

router.use(protect, adminOnly);

router.get('/dashboard', getDashboard);
router.get('/employees', getEmployees);
router.post('/employees', validateCreateEmployee, createEmployee);
router.put('/employees/:id', updateEmployee);
router.patch('/employees/:id/toggle', toggleEmployeeStatus);
router.delete('/employees/:id', deleteEmployee);
router.get('/employees/:id/attendance', getEmployeeAttendance);  // NEW
router.get('/attendance', getAttendanceRecords);
router.get('/attendance/export', exportCSV);
router.get('/reports/monthly', getMonthlyReport);

module.exports = router;
