const CONFIG = require('../../config/config.json');
const Util = require('./Util');
const BinanceApi = require('./BinanceApi');

const MarketCache = {

    tickers: {
        trading: {},
        watching: []
    },
    relationships: [],

    initialize(exchangeInfo, whitelistSymbols, baseSymbol) {
        const tradingSymbolObjects = exchangeInfo.symbols.filter(symbolObj => symbolObj.status === 'TRADING');
        const symbolSet = new Set();

        console.log(`Found ${tradingSymbolObjects.length}/${exchangeInfo.symbols.length} currently trading tickers`);

        // Extract All Symbols and Tickers
        tradingSymbolObjects.forEach(symbolObj => {
            symbolSet.add(symbolObj.baseAsset);
            symbolSet.add(symbolObj.quoteAsset);
            symbolObj.dustDecimals = Math.max(symbolObj.filters.filter(f => f.filterType === 'LOT_SIZE')[0].minQty.indexOf('1') - 1, 0);
            MarketCache.tickers.trading[symbolObj.symbol] = symbolObj;
        });

        MarketCache.relationships = MarketCache.getTradesFromSymbol(baseSymbol, symbolSet);

        console.log(`Found ${MarketCache.relationships.length} triangular relationships`);

        const uniqueTickers = new Set();
        MarketCache.relationships.forEach(relationship => {
            uniqueTickers.add(relationship.ab.ticker);
            uniqueTickers.add(relationship.bc.ticker);
            uniqueTickers.add(relationship.ca.ticker);
        });
        MarketCache.tickers.watching = Array.from(uniqueTickers);
    },

    pruneDepthCacheAboveThreshold(depthCache, threshold) {
        Object.values(depthCache).forEach(depth => {
            depth.bids = Util.prune(depth.bids, threshold);
            depth.asks = Util.prune(depth.asks, threshold);
        });
    },

    getWatchedTickersWithoutDepthCacheUpdate() {
        return MarketCache.tickers.watching.filter(ticker => !BinanceApi.getDepthCacheUnsorted(ticker).eventTime);
    },

    getTradesFromSymbol(symbol1, symbolSet) {
        const trades = [];
        symbolSet.forEach(symbol2 => {
            symbolSet.forEach(symbol3 => {
                const trade = MarketCache.createTrade(symbol1, symbol2, symbol3);
                if (trade) trades.push(trade);
            });
        });
        return trades;
    },

    getRelationshipsInvolvingTicker(ticker) {
        return MarketCache.relationships.filter(({ab,bc,ca}) => [ab.ticker,bc.ticker,ca.ticker].includes(ticker));
    },

    getTickersInvolvedInRelationships(relationships) {
        const tickers = new Set();
        relationships.forEach(({ab,bc,ca}) => {
            tickers.add(ab.ticker);
            tickers.add(bc.ticker);
            tickers.add(ca.ticker);
        });
        return tickers;
    },

    waitForAllTickersToUpdate(timeout=30000, tickers=MarketCache.tickers.watching) {
        const start = Date.now();
        const hasUpdate = (ticker) => {
            const {bids, asks} = BinanceApi.getDepthCacheUnsorted(ticker);
            return (Object.keys(bids).length > 0 || Object.keys(asks).length > 0);
        };
        const waitForUpdates = (resolve, reject) => {
            if (tickers.filter(hasUpdate).length === tickers.length) resolve(true);
            else if (Date.now() - start > timeout) reject(new Error(`Timed out waiting for all watched tickers to receive a depth update`));
            else setTimeout(waitForUpdates.bind(this, resolve, reject), 1000);
        };
        return new Promise(waitForUpdates);
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
        if (CONFIG.TRADING.EXECUTION_TEMPLATE[0] && CONFIG.TRADING.EXECUTION_TEMPLATE[0] !== ab.method) return;

        const bc = MarketCache.getRelationship(b, c);
        if (!bc) return;
        if (CONFIG.TRADING.EXECUTION_TEMPLATE[1] && CONFIG.TRADING.EXECUTION_TEMPLATE[1] !== bc.method) return;

        const ca = MarketCache.getRelationship(c, a);
        if (!ca) return;
        if (CONFIG.TRADING.EXECUTION_TEMPLATE[2] && CONFIG.TRADING.EXECUTION_TEMPLATE[2] !== ca.method) return;

        return {
            ab,
            bc,
            ca,
            symbol: { a, b, c }
        };
    },

    getRelationship(a, b) {
        if (MarketCache.tickers.trading[a+b]) return {
            method: 'SELL',
            ticker: a+b,
            base: a,
            quote: b,
            dustDecimals: MarketCache.tickers.trading[a+b].dustDecimals
        };
        if (MarketCache.tickers.trading[b+a]) return {
            method: 'BUY',
            ticker: b+a,
            base: b,
            quote: a,
            dustDecimals: MarketCache.tickers.trading[b+a].dustDecimals
        };
        return null;
    }

};

module.exports = MarketCache;
