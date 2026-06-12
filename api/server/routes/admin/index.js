const express = require('express');
const auth = require('./auth');
const manage = require('./manage');

const router = express.Router();

router.use('/', auth);
router.use('/', manage);

module.exports = router;
