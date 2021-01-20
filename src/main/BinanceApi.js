const CONFIG = require('../../config/config');
const logger = require('./Loggers');
const Util = require('./Util');
const Binance = require('node-binance-api');
const binance = new Binance().options(Object.assign({
    APIKEY: CONFIG.KEYS.API,
    APISECRET: CONFIG.KEYS.SECRET,
    test: !CONFIG.EXECUTION.ENABLED,
    log: (...args) => logger.binance.info(args.length > 1 ? args : args[0]),
    verbose: true
}, CONFIG.BINANCE_OPTIONS));

const BinanceApi = {

    sortedDepthCache: {},

    exchangeInfo() {
        return binance.exchangeInfo(null);
    },

    getBalances() {
        return binance.balance(null)
            .then(balances => {
                Object.values(balances).forEach(balance => {
                    balance.available = parseFloat(balance.available);
                    balance.onOrder = parseFloat(balance.onOrder);
                });
                return balances;
            });
    },

    getDepthSnapshots(tickers, maxDepth=CONFIG.SCANNING.DEPTH) {
        const depthSnapshot = {};
        tickers.forEach(ticker => {
            if (BinanceApi.sortedDepthCache[ticker].eventTime === binance.depthCache(ticker).eventTime) {
                depthSnapshot[ticker] = {...BinanceApi.sortedDepthCache[ticker]};
            } else {
                depthSnapshot[ticker] = {...BinanceApi.sortedDepthCache[ticker]} = {...BinanceApi.getDepthCacheSorted(ticker, maxDepth)};
            }
        });
        return depthSnapshot;
    },

    marketBuy(ticker, quantity) {
        logger.execution.info(`${binance.getOption('test') ? 'Test: Buying' : 'Buying'} ${quantity} ${ticker} @ market price`);
        const before = Date.now();
        return binance.marketBuy(ticker, quantity, { type: 'MARKET' })
            .then(response => {
                if (binance.getOption('test')) {
                    logger.execution.info(`Test: Successfully bought ${ticker} @ market price`);
                } else {
                    logger.execution.info(`Successfully bought ${response.executedQty} ${ticker} @ a quote of ${response.cummulativeQuoteQty} in ${Util.millisecondsSince(before)} ms`);
                }
                return response;
            })
            .catch(BinanceApi.handleBuyOrSellError);
    },

    marketSell(ticker, quantity) {
        logger.execution.info(`${binance.getOption('test') ? 'Test: Selling' : 'Selling'} ${quantity} ${ticker} @ market price`);
        const before = Date.now();
        return binance.marketSell(ticker, quantity, { type: 'MARKET' })
            .then(response => {
                if (binance.getOption('test')) {
                    logger.execution.info(`Test: Successfully sold ${ticker} @ market price`);
                } else {
                    logger.execution.info(`Successfully sold ${response.executedQty} ${ticker} @ a quote of ${response.cummulativeQuoteQty} in ${Util.millisecondsSince(before)} ms`);
                }
                return response;
            })
            .catch(BinanceApi.handleBuyOrSellError);
    },

    marketBuyOrSell(method) {
        return method === 'BUY' ? BinanceApi.marketBuy : BinanceApi.marketSell;
    },

    handleBuyOrSellError(error) {
        try {
            return Promise.reject(new Error(JSON.parse(error.body).msg));
        } catch (e) {
            logger.execution.error(error);
            return Promise.reject(new Error(error.body));
        }
    },

    time() {
        return binance.time(null);
    },

    depthCacheStaggered(tickers, limit, stagger, cb) {
        tickers.forEach(ticker => BinanceApi.sortedDepthCache[ticker] = {eventTime: 0});
        return binance.websockets.depthCacheStaggered(tickers, BinanceApi.createDepthWSCallback(cb), limit, stagger);
    },

    depthCacheCombined(tickers, limit, groupSize, stagger, cb) {
        tickers.forEach(ticker => BinanceApi.sortedDepthCache[ticker] = {eventTime: 0});
        let chain = null;
        for (let i = 0; i < tickers.length; i += groupSize) {
            const tickerGroup = tickers.slice(i, i + groupSize);
            const promise = () => new Promise(resolve => {
                binance.websockets.depthCache(tickerGroup, BinanceApi.createDepthWSCallback(cb), limit);
                setTimeout(resolve, stagger);
            } );
            chain = chain ? chain.then(promise) : promise();
        }
        return chain;
    },

    createDepthWSCallback(cb) {
        // 'context' exists when processing a websocket update NOT when first populating via snapshot
        return (ticker, depth, context) => context && cb(ticker);
    },

    getDepthCacheSorted(ticker, max=CONFIG.SCANNING.DEPTH) {
        let depthCache = binance.depthCache(ticker);
        depthCache.bids = BinanceApi.sortBids(depthCache.bids, max);
        depthCache.asks = BinanceApi.sortAsks(depthCache.asks, max);
        return depthCache;
    },

    getDepthCacheUnsorted(ticker) {
        return binance.depthCache(ticker);
    },

    sortBids(cache, max = Infinity) {
        let depth = {};
        Object.keys(cache)
            .sort((a, b) => parseFloat(b) - parseFloat(a))
            .slice(0, max)
            .forEach(price => depth[price] = cache[price]);
        return depth;
    },

    sortAsks(cache, max = Infinity) {
        let depth = {};
        Object.keys(cache)
            .sort((a, b) => parseFloat(a) - parseFloat(b))
            .slice(0, max)
            .forEach(price => depth[price] = cache[price]);
        return depth;
    },

};

module.exports = BinanceApi;
