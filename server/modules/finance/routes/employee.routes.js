const router = require('express').Router();
const { getEmployees, createEmployee, updateEmployee, deleteEmployee } = require('../controllers/employee.controller');
router.get('/', getEmployees);
router.post('/', createEmployee);
router.put('/:id', updateEmployee);
router.delete('/:id', deleteEmployee);
module.exports = router;
