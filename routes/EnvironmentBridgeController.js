var express = require('express');
var router = express.Router();

router.get('/api', function(req, res, next) {
	res.json({
		BINANCE: {
			KEY: process.env.BINANCE_API_KEY,
			SECRET: process.env.BINANCE_API_SECRET
		}
	});
});

module.exports = router;
