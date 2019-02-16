const binance = require('node-binance-api')();

const MarketCache = {

    symbols: [],
    tickers: {},
    relationships: [],

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
                if (!trade) return;
                if (MarketCache.isTradeMirrored(trade, trades)) return;
                trades.push(trade);
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

    isTradeMirrored(trade, trades) {
        return trades
            .map(t => `${t.symbol.b}-${t.symbol.c}`)
            .includes(`${trade.symbol.c}-${trade.symbol.b}`);
    }

};

module.exports = MarketCache;
