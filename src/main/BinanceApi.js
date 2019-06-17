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

    cloneDepth(ticker, levels) {
        const tmp = binance.depthCache(ticker);
        const prune = (depthSnapshot, levels) => {
            if (!levels) return depthSnapshot;
            return Object.keys(depthSnapshot)
                .slice(0, levels)
                .reduce((prunedDepthSnapshot, key) => {
                    prunedDepthSnapshot[key] = depthSnapshot[key];
                    return prunedDepthSnapshot;
                }, {});
        };
        return {
            eventTime: tmp.eventTime,
            lastUpdateId: tmp.lastUpdateId,
            asks: prune({...tmp.asks}, levels),
            bids: prune({...tmp.bids}, levels)
        };
    },

    cloneDepths(abTicker, bcTicker, caTicker, levels) {
        return {
            ab: BinanceApi.cloneDepth(abTicker, levels),
            bc: BinanceApi.cloneDepth(bcTicker, levels),
            ca: BinanceApi.cloneDepth(caTicker, levels)
        };
    },

    marketBuy(ticker, quantity) {
        logger.execution.info(`${binance.getOption('test') ? 'Test: Buying' : 'Buying'} ${quantity} ${ticker} @ market price`);
        return new Promise((resolve, reject) => {
            binance.marketBuy(ticker, quantity, (error, response) => {
                if (error) return reject(new Error(JSON.parse(error.body).msg));
                if (binance.getOption('test')) {
                    logger.execution.info(`Test: Successfully bought ${ticker} @ market price`);
                } else {
                    logger.execution.info(`Successfully bought ${response.executedQty} ${ticker} @ a quote of ${response.cummulativeQuoteQty}`);
                }
                return resolve(response);
            })
        })
    },

    marketSell(ticker, quantity) {
        logger.execution.info(`${binance.getOption('test') ? 'Test: Selling' : 'Selling'} ${quantity} ${ticker} @ market price`);
        return new Promise((resolve, reject) => {
            binance.marketSell(ticker, quantity, (error, response) => {
                if (error) return reject(new Error(JSON.parse(error.body).msg));
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

    time() {
        return new Promise((resolve, reject) => {
            binance.time((error, response) => {
                if (error) return reject(error);
                return resolve(response);
            });
        });
    },

    depthCache(tickers, limit=100, stagger=200) {
        return binance.websockets.depthCacheStaggered(tickers, BinanceApi.sortDepthCache, limit, stagger);
    },

    sortDepthCache(ticker, depth) {
        depth.bids = binance.sortBids(depth.bids);
        depth.asks = binance.sortAsks(depth.asks);
    }

};

module.exports = BinanceApi;
