const CONFIG = require('../../config/config.json');
const binance = require('node-binance-api')();

const MarketCache = {

    symbols: [],
    tickers: {},
    relationships: [],

    initialize(exchangeInfo, whitelistSymbols, baseSymbol) {
        let tickers = [];
        let tradingSymbolObjects = exchangeInfo.symbols.filter(symbolObj => symbolObj.status === 'TRADING');
        let symbols = new Set();

        console.log(`Found ${tradingSymbolObjects.length}/${exchangeInfo.symbols.length} currently trading tickers`);

        // Extract Symbols and Tickers
        tradingSymbolObjects.forEach(symbolObj => {
            if (whitelistSymbols.length > 0) {
                if (!whitelistSymbols.includes(symbolObj.baseAsset)) return;
                if (!whitelistSymbols.includes(symbolObj.quoteAsset)) return;
            }
            symbols.add(symbolObj.baseAsset);
            symbols.add(symbolObj.quoteAsset);
            symbolObj.dustDecimals = Math.max(symbolObj.filters.filter(f => f.filterType === 'LOT_SIZE')[0].minQty.indexOf('1') - 1, 0);
            tickers[symbolObj.symbol] = symbolObj;
        });

        // Initialize market cache
        MarketCache.symbols = symbols;
        MarketCache.tickers = tickers;
        MarketCache.relationships = MarketCache.getTradesFromSymbol(baseSymbol);

        console.log(`Found ${MarketCache.relationships.length} triangular relationships`);
    },

    getTickerArray() {
        return Object.keys(MarketCache.tickers);
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
        MarketCache.getTickerArray().forEach(ticker => {
            let depth = binance.depthCache(ticker);
            depth.bids = prune(depth.bids, threshold);
            depth.asks = prune(depth.asks, threshold);
        });
    },

    getAggregateDepthSizes(tickers=MarketCache.getTickerArray()) {
        let bidCounts = [];
        let askCounts = [];

        tickers.forEach(ticker => {
            const depth = binance.depthCache(ticker);
            bidCounts.push(Object.values(depth.bids).length);
            askCounts.push(Object.values(depth.asks).length);
        });

        return { bidCounts, askCounts };
    },

    getTradesFromSymbol(symbol1) {
        let trades = [];
        MarketCache.symbols.forEach(symbol2 => {
            MarketCache.symbols.forEach(symbol3 => {
                const trade = MarketCache.createTrade(symbol1, symbol2, symbol3);
                if (trade) trades.push(trade);
            });
        });
        return trades;
    },

    getTickersWithoutDepthCacheUpdate() {
        return MarketCache.getTickerArray().filter(ticker => !binance.depthCache(ticker).eventTime);
    },

    createTrade(a, b, c) {
        a = a.toUpperCase();
        b = b.toUpperCase();
        c = c.toUpperCase();

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
        if (MarketCache.tickers[a+b]) return {
            method: 'Sell',
            ticker: a+b,
            base: a,
            quote: b,
            dustDecimals: MarketCache.tickers[a+b].dustDecimals
        };
        if (MarketCache.tickers[b+a]) return {
            method: 'Buy',
            ticker: b+a,
            base: b,
            quote: a,
            dustDecimals: MarketCache.tickers[b+a].dustDecimals
        };
        return null;
    }

};

module.exports = MarketCache;
