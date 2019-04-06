const logger = require('./Loggers');
const binance = require('node-binance-api')();

const BinanceApi = {

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
                logger.execution.info(`${binance.getOption('test') ? 'Test: Successfully bought' : 'Successfully bought'} ${response.executedQty} ${ticker} @ a quote of ${response.cummulativeQuoteQty}`);
                return resolve(response);
            })
        })
    },

    marketSell(ticker, quantity) {
        logger.execution.info(`${binance.getOption('test') ? 'Test: Selling' : 'Selling'} ${quantity} ${ticker} @ market price`);
        return new Promise((resolve, reject) => {
            binance.marketSell(ticker, quantity, (error, response) => {
                if (error) return reject(new Error(JSON.parse(error.body).msg));
                logger.execution.info(`${binance.getOption('test') ? 'Test: Successfully sold' : 'Successfully sold'} ${response.executedQty} ${ticker} @ a quote of ${response.cummulativeQuoteQty}`);
                return resolve(response);
            });
        });
    },

    marketBuyOrSell(method) {
        return method.toUpperCase() === 'BUY' ? BinanceApi.marketBuy : BinanceApi.marketSell;
    },

    depthCache(tickers, limit=100, stagger=200) {
        return binance.websockets.depthCacheStaggered(tickers, BinanceApi.processDepth, limit, stagger);
    },

    processDepth(ticker, depth) {
        depth.bids = binance.sortBids(depth.bids);
        depth.asks = binance.sortAsks(depth.asks);
        depth.time = new Date().getTime();
    }

};

module.exports = BinanceApi;
