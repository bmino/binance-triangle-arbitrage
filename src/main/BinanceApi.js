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

    getDepthSnapshots(tickers) {
        const depthSnapshot = {};
        tickers.forEach((ticker) => {
            depthSnapshot[ticker] = binance.depthCache(ticker);
        });
        return depthSnapshot;
    },

    marketBuy(ticker, quantity) {
        logger.execution.info(`${binance.getOption('test') ? 'Test: Buying' : 'Buying'} ${quantity} ${ticker} @ market price`);
        return new Promise((resolve, reject) => {
            binance.marketBuy(ticker, quantity, (error, response) => {
                if (error) return BinanceApi.handleBuyOrSellError(error, reject);
                if (binance.getOption('test')) {
                    logger.execution.info(`Test: Successfully bought ${ticker} @ market price`);
                } else {
                    logger.execution.info(`Successfully bought ${response.executedQty} ${ticker} @ a quote of ${response.cummulativeQuoteQty}`);
                }
                return resolve(response);
            });
        });
    },

    marketSell(ticker, quantity) {
        logger.execution.info(`${binance.getOption('test') ? 'Test: Selling' : 'Selling'} ${quantity} ${ticker} @ market price`);
        return new Promise((resolve, reject) => {
            binance.marketSell(ticker, quantity, (error, response) => {
                if (error) return BinanceApi.handleBuyOrSellError(error, reject);
                if (binance.getOption('test')) {
                    logger.execution.info(`Test: Successfully sold ${ticker} @ market price`);
                } else {
                    logger.execution.info(`Successfully sold ${response.executedQty} ${ticker} @ a quote of ${response.cummulativeQuoteQty}`);
                }
                return resolve(response);
            });
        });
    },

    marketBuyOrSell(method) {
        return method.toUpperCase() === 'BUY' ? BinanceApi.marketBuy : BinanceApi.marketSell;
    },

    handleBuyOrSellError(error, reject) {
        try {
            return reject(new Error(JSON.parse(error.body).msg));
        } catch (e) {
            logger.execution.error(error);
            return reject(new Error(error.body));
        }
    },

    time() {
        return new Promise((resolve, reject) => {
            binance.time((error, response) => {
                if (error) return reject(error);
                return resolve(response);
            });
        });
    },

    depthCacheStaggered(tickers, limit, stagger) {
        return binance.websockets.depthCacheStaggered(tickers, BinanceApi.sortDepthCache, limit, stagger);
    },

    sortDepthCache(ticker, depth) {
        depth.bids = binance.sortBids(depth.bids);
        depth.asks = binance.sortAsks(depth.asks);
    }

};

module.exports = BinanceApi;
