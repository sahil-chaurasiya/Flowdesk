const router = require('express').Router();
const { getDashboard } = require('../controllers/dashboard.controller');
router.get('/', getDashboard);
module.exports = router;
