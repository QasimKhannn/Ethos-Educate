const express = require('express');
const auth = require('./auth');
const manage = require('./manage');
const sso = require('./sso');

const router = express.Router();

router.use('/', auth);
router.use('/', manage);
router.use('/sso', sso);

module.exports = router;
