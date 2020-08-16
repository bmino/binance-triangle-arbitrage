const CONFIG = require('../../config/config.json');
const BinanceApi = require('./BinanceApi');

const MarketCache = {

    symbols: new Set(),
    tickers: {
        trading: {},
        watching: []
    },
    relationships: [],

    initialize(exchangeInfo, whitelistSymbols, baseSymbol) {
        const tradingSymbolObjects = exchangeInfo.symbols.filter(symbolObj => symbolObj.status === 'TRADING');

        console.log(`Found ${tradingSymbolObjects.length}/${exchangeInfo.symbols.length} currently trading tickers`);

        // Extract All Symbols and Tickers
        tradingSymbolObjects.forEach(symbolObj => {
            MarketCache.symbols.add(symbolObj.baseAsset);
            MarketCache.symbols.add(symbolObj.quoteAsset);
            symbolObj.dustDecimals = Math.max(symbolObj.filters.filter(f => f.filterType === 'LOT_SIZE')[0].minQty.indexOf('1') - 1, 0);
            MarketCache.tickers.trading[symbolObj.symbol] = symbolObj;
        });

        MarketCache.relationships = MarketCache.getTradesFromSymbol(baseSymbol);

        console.log(`Found ${MarketCache.relationships.length} triangular relationships`);

        const uniqueTickers = new Set();
        MarketCache.relationships.forEach(relationship => {
            uniqueTickers.add(relationship.ab.ticker);
            uniqueTickers.add(relationship.bc.ticker);
            uniqueTickers.add(relationship.ca.ticker);
        });
        MarketCache.tickers.watching = Array.from(uniqueTickers);
    },

    pruneDepthsAboveThreshold(threshold=100) {
        const prune = (depthSnapshot, threshold) => {
            return Object.keys(depthSnapshot)
                .slice(0, threshold)
                .reduce((prunedDepthSnapshot, key) => {
                    prunedDepthSnapshot[key] = depthSnapshot[key];
                    return prunedDepthSnapshot;
                }, {});
        };
        MarketCache.tickers.watching.forEach(ticker => {
            const depth = BinanceApi.depthCache(ticker);
            depth.bids = prune(depth.bids, threshold);
            depth.asks = prune(depth.asks, threshold);
        });
    },

    getTradesFromSymbol(symbol1) {
        const trades = [];
        MarketCache.symbols.forEach(symbol2 => {
            MarketCache.symbols.forEach(symbol3 => {
                const trade = MarketCache.createTrade(symbol1, symbol2, symbol3);
                if (trade) trades.push(trade);
            });
        });
        return trades;
    },

    getWatchedTickersWithoutDepthCacheUpdate() {
        return MarketCache.tickers.watching.filter(ticker => !BinanceApi.depthCache(ticker).eventTime);
    },

    createTrade(a, b, c) {
        a = a.toUpperCase();
        b = b.toUpperCase();
        c = c.toUpperCase();

        if (CONFIG.TRADING.WHITELIST.length > 0) {
            if (!CONFIG.TRADING.WHITELIST.includes(a)) return;
            if (!CONFIG.TRADING.WHITELIST.includes(b)) return;
            if (!CONFIG.TRADING.WHITELIST.includes(c)) return;
        }

        const ab = MarketCache.getRelationship(a, b);
        if (!ab) return;
        if (CONFIG.TRADING.EXECUTION_TEMPLATE[0] && CONFIG.TRADING.EXECUTION_TEMPLATE[0].toUpperCase() !== ab.method.toUpperCase()) return;

        const bc = MarketCache.getRelationship(b, c);
        if (!bc) return;
        if (CONFIG.TRADING.EXECUTION_TEMPLATE[1] && CONFIG.TRADING.EXECUTION_TEMPLATE[1].toUpperCase() !== bc.method.toUpperCase()) return;

        const ca = MarketCache.getRelationship(c, a);
        if (!ca) return;
        if (CONFIG.TRADING.EXECUTION_TEMPLATE[2] && CONFIG.TRADING.EXECUTION_TEMPLATE[2].toUpperCase() !== ca.method.toUpperCase()) return;

        return {
            ab,
            bc,
            ca,
            symbol: { a, b, c }
        };
    },

    getRelationship(a, b) {
        if (MarketCache.tickers.trading[a+b]) return {
            method: 'Sell',
            ticker: a+b,
            base: a,
            quote: b,
            dustDecimals: MarketCache.tickers.trading[a+b].dustDecimals
        };
        if (MarketCache.tickers.trading[b+a]) return {
            method: 'Buy',
            ticker: b+a,
            base: b,
            quote: a,
            dustDecimals: MarketCache.tickers.trading[b+a].dustDecimals
        };
        return null;
    }

};

module.exports = MarketCache;
