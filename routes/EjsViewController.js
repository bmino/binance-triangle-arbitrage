var express = require('express');
var router = express.Router();
var version = require('../package.json').version;

/**
 * Get home page
 */
router.get('/', function(req, res, next) {
	res.render('index', {
		version: version
	});
});

module.exports = router;
