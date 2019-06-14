const CONFIG = require('../../config/config.json');
const binance = require('node-binance-api')();

const MarketCache = {

    symbols: [],
    tickers: {},
    relationships: [],

    initialize(exchangeInfo, whitelistSymbols, baseSymbol, tradeFees) {
        let tickers = [];
        let tradingSymbolObjects = exchangeInfo.symbols.filter(symbolObj => symbolObj.status === 'TRADING');
        let symbols = new Set();
        let fees = [];

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

        // Extract fees
        tradeFees.tradeFee.forEach(fee => {
            fees[fee.symbol] = fee;
        });

        // Initialize market cache
        MarketCache.symbols = symbols;
        MarketCache.tickers = tickers;
        MarketCache.relationships = MarketCache.getTradesFromSymbol(baseSymbol);
        MarketCache.fees = fees;

        console.log(`Found ${MarketCache.relationships.length} triangular relationships`);
    },

    getTickerArray() {
        return Object.keys(MarketCache.tickers);
    },

    pruneDepthsAboveThreshold(threshold=100) {
        MarketCache.getTickerArray().forEach(ticker => {
            let depth = binance.depthCache(ticker);
            Object.keys(depth.bids).forEach((bid, index) => {
                index >= threshold && delete depth.bids[bid];
            });
            Object.keys(depth.asks).forEach((ask, index) => {
                index >= threshold && delete depth.asks[ask];
            });
        });
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
            ab: ab,
            bc: bc,
            ca: ca,
            symbol: {
                a: a.toUpperCase(),
                b: b.toUpperCase(),
                c: c.toUpperCase()
            }
        };
    },

    getRelationship(a, b) {
        a = a.toUpperCase();
        b = b.toUpperCase();

        if (MarketCache.tickers[a+b]) return {
            method: 'Sell',
            ticker: a+b,
            base: a,
            quote: b
        };
        if (MarketCache.tickers[b+a]) return {
            method: 'Buy',
            ticker: b+a,
            base: b,
            quote: a
        };
        return null;
    }

};

module.exports = MarketCache;
