const CONFIG = require('../../config/config');
const logger = require('./Loggers');
const binance = require('node-binance-api')();
binance.options({
    APIKEY: CONFIG.KEYS.API,
    APISECRET: CONFIG.KEYS.SECRET,
    test: !CONFIG.TRADING.ENABLED
});

module.exports = {

    exchangeInfo() {
        return new Promise((resolve, reject) => {
            binance.exchangeInfo((error, data) => {
                if (error) return reject(error);
                return resolve(data);
            });
        });
    },

    getBalances() {
        return new Promise((resolve, reject) => {
            binance.balance((error, balances) => {
                if (error) return reject(error);
                Object.values(balances).forEach(balance => {
                    balance.available = parseFloat(balance.available);
                    balance.onOrder = parseFloat(balance.onOrder);
                });
                return resolve(balances);
            });
        });
    },

    marketBuy(ticker, quantity) {
        logger.execution.info(`${binance.getOption('test') ? 'Test: Buying' : 'Buying'} ${quantity} ${ticker} @ market price`);
        return new Promise((resolve, reject) => {
            binance.marketBuy(ticker, quantity, (error, response) => {
                if (error) return reject(new Error(JSON.parse(error.body).msg));
                return resolve(response);
            })
        })
    },

    marketSell(ticker, quantity) {
        logger.execution.info(`${binance.getOption('test') ? 'Test: Selling' : 'Selling'} ${quantity} ${ticker} @ market price`);
        return new Promise((resolve, reject) => {
            binance.marketSell(ticker, quantity, (error, response) => {
                if (error) return reject(new Error(JSON.parse(error.body).msg));
                return resolve(response);
            });
        });
    },

    marketBuyOrSell(method) {
        return method.toUpperCase() === 'BUY' ? this.marketBuy : this.marketSell;
    },

    listenForUserData(balanceCallback, executionCallback) {
        return binance.websockets.userData(balanceCallback, executionCallback);
    },

    depthCache(tickers, limit=100, stagger=200) {
        console.log(`Opening ${tickers.length} depth websockets ...`);
        return binance.websockets.depthCacheStaggered(tickers, this.processDepth, limit, stagger);
    },

    processDepth(ticker, depth) {
        depth.bids = binance.sortBids(depth.bids);
        depth.asks = binance.sortAsks(depth.asks);
        depth.time = new Date().getTime();
    }

};
