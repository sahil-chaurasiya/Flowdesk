const router = require('express').Router();
const c = require('../controllers/freelancer.controller');

// Summary / jobs / payments must be declared before '/:id' so they aren't mistaken for an id.
router.get('/summary/:month/:year', c.getMonthlySummary);

router.get('/jobs', c.getJobs);
router.post('/jobs', c.createJob);
router.put('/jobs/:id', c.updateJob);
router.delete('/jobs/:id', c.deleteJob);

router.get('/payments', c.getPayments);
router.post('/payments', c.createPayment);
router.put('/payments/:id', c.updatePayment);
router.delete('/payments/:id', c.deletePayment);

router.get('/', c.getFreelancers);
router.post('/', c.createFreelancer);
router.get('/:id', c.getFreelancer);
router.put('/:id', c.updateFreelancer);
router.delete('/:id', c.deleteFreelancer);
module.exports = router;