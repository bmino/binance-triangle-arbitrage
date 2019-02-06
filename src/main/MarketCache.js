const binance = require('node-binance-api')();

let MarketCache = {
    symbols: [],
    tickers: {},
    relationships: [],
    arbs: {},

    initialize(exchangeInfo, whitelistSymbols, baseSymbol) {
        let symbols = new Set();
        let tickers = [];
        let tradingSymbolObjects = exchangeInfo.symbols.filter(symbolObj => symbolObj.status === 'TRADING');

        console.log(`Found ${tradingSymbolObjects.length}/${exchangeInfo.symbols.length} currently trading tickers.`);

        // Extract Symbols and Tickers
        tradingSymbolObjects.forEach(symbolObj => {
            if (whitelistSymbols.length > 0 && !whitelistSymbols.includes(symbolObj.baseAsset)) return;
            symbols.add(symbolObj.baseAsset);
            symbolObj.dustDecimals = Math.max(symbolObj.filters.filter(f => f.filterType === 'LOT_SIZE')[0].minQty.indexOf('1') - 1, 0);
            tickers[symbolObj.symbol] = symbolObj;
        });

        // Initialize market cache
        MarketCache.symbols = symbols;
        MarketCache.tickers = tickers;
        MarketCache.relationships = MarketCache.getTradesFromSymbol(baseSymbol);
    },

    getTickerArray() {
        return Object.keys(MarketCache.tickers);
    },

    getDepthCache() {
        return MarketCache.getTickerArray()
            .map(ticker => {
                let depth = binance.depthCache(ticker);
                depth.ticker = ticker;
                return depth;
            });
    },

    getSubsetFromTickers(tickers) {
        let tickersPartial = {};
        let depthsPartial = {};

        tickers.forEach(ticker => {
            tickersPartial[ticker] = MarketCache.tickers[ticker];
            depthsPartial[ticker] = binance.depthCache(ticker);
        });

        return {
            tickers: tickersPartial,
            depths: depthsPartial
        };
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
        MarketCache.symbols.forEach(function(symbol2) {
            MarketCache.symbols.forEach(function(symbol3) {
                const trade = MarketCache.createTrade(symbol1, symbol2, symbol3);
                if (trade) trades.push(trade);
            });
        });
        return trades;
    },

    createTrade(a, b, c) {
        const ab = MarketCache.getRelationship(a, b);
        if (!ab) return;

        const bc = MarketCache.getRelationship(b, c);
        if (!bc) return;

        const ca = MarketCache.getRelationship(c, a);
        if (!ca) return;

        return {
            id: a + b + c,
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
            ticker: a+b
        };
        if (MarketCache.tickers[b+a]) return {
            method: 'Buy',
            ticker: b+a
        };
        return null;
    },

    getDepthsBelowThreshold(threshold) {
        let outputBuffer = [];
        MarketCache.getTickerArray().forEach(ticker => {
            const depth = binance.depthCache(ticker);
            const bidCount = Object.keys(depth.bids).length;
            const askCount = Object.keys(depth.asks).length;
            if (bidCount < threshold || askCount < threshold) outputBuffer.push(`${ticker}: ${bidCount}/${askCount}`);
        });
        return outputBuffer;
    },

    getDepthsAboveThreshold(threshold) {
        let outputBuffer = [];
        MarketCache.getTickerArray().forEach(ticker => {
            const depth = binance.depthCache(ticker);
            const bidCount = Object.keys(depth.bids).length;
            const askCount = Object.keys(depth.asks).length;
            if (bidCount > threshold || askCount > threshold) outputBuffer.push(`${ticker}: ${bidCount}/${askCount}`);
        });
        return outputBuffer;
    },

    getArbsAboveProfitPercent(profit) {
        return Object.values(MarketCache.arbs)
            .filter(arb => arb.percent > profit)
            .sort((a, b) => a.percent > b.percent ? -1 : 1);
    },

    getTopProfitableArbs(count) {
        return Object.values(MarketCache.arbs)
            .sort((a, b) => a.percent > b.percent ? -1 : 1)
            .slice(0, count);
    }

};

module.exports = MarketCache;
