const router = require('express').Router();
const { getReport } = require('../controllers/report.controller');
router.get('/', getReport);
module.exports = router;
