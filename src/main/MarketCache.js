const CONFIG = require('../../config/config.json');
const Util = require('./Util');
const BinanceApi = require('./BinanceApi');

const MarketCache = {

    tickers: {
        trading: {},
        watching: []
    },
    trades: [],
    related: {
        trades: {},
        tickers: {}
    },

    async initialize() {
        console.log(`Fetching exchange info ...`);
        const exchangeInfo = await BinanceApi.exchangeInfo();

        // Mapping and Filters
        const isTRADING = (symbolObj) => symbolObj.status === 'TRADING';
        const getLOT_SIZE = (symbolObj) => symbolObj.filterType === 'LOT_SIZE';

        const tradingSymbolObjects = exchangeInfo.symbols.filter(isTRADING)

        console.log(`Found ${tradingSymbolObjects.length}/${exchangeInfo.symbols.length} currently trading tickers`);

        // Extract All Symbols and Tickers
        const uniqueSymbols = new Set();
        tradingSymbolObjects.forEach(symbolObj => {
            uniqueSymbols.add(symbolObj.baseAsset);
            uniqueSymbols.add(symbolObj.quoteAsset);
            symbolObj.dustDecimals = Math.max(symbolObj.filters.filter(getLOT_SIZE)[0].minQty.indexOf('1') - 1, 0);
            MarketCache.tickers.trading[symbolObj.symbol] = symbolObj;
        });

        // Get trades from symbols
        Object.keys(CONFIG.INVESTMENT).forEach(symbol1 => {
            uniqueSymbols.forEach(symbol2 => {
                uniqueSymbols.forEach(symbol3 => {
                    const trade = MarketCache.createTrade(symbol1, symbol2, symbol3);
                    if (trade) MarketCache.trades.push(trade);
                });
            });
        });

        console.log(`Found ${MarketCache.trades.length} triangular trades`);

        MarketCache.trades.forEach(({ab, bc, ca}) => {
            if (!MarketCache.tickers.watching.includes(ab.ticker)) MarketCache.tickers.watching.push(ab.ticker);
            if (!MarketCache.tickers.watching.includes(bc.ticker)) MarketCache.tickers.watching.push(bc.ticker);
            if (!MarketCache.tickers.watching.includes(ca.ticker)) MarketCache.tickers.watching.push(ca.ticker);
        });

        MarketCache.tickers.watching.forEach(ticker => {
            MarketCache.related.tickers[ticker] = new Set();
            MarketCache.related.trades[ticker] = MarketCache.trades.filter(({ab,bc,ca}) => [ab.ticker,bc.ticker,ca.ticker].includes(ticker));
            MarketCache.related.trades[ticker].forEach(({ab,bc,ca}) => {
                MarketCache.related.tickers[ticker].add(ab.ticker);
                MarketCache.related.tickers[ticker].add(bc.ticker);
                MarketCache.related.tickers[ticker].add(ca.ticker);
            });
        });
    },

    getTickersWithoutDepthCacheUpdate(ms=Infinity) {
        return MarketCache.tickers.watching.filter(ticker => {
            const { eventTime } = BinanceApi.getDepthCacheUnsorted(ticker);
            if (!eventTime) return true;
            if (Util.millisecondsSince(eventTime) > ms) return true;
            return false;
        });
    },

    waitForAllTickersToUpdate(timeout=30000, tickers=MarketCache.tickers.watching) {
        const start = Date.now();
        const hasUpdate = (ticker) => {
            const {bids, asks} = BinanceApi.getDepthCacheUnsorted(ticker);
            return (Object.keys(bids).length > 0 || Object.keys(asks).length > 0);
        };
        const waitForUpdates = (resolve, reject) => {
            if (tickers.filter(hasUpdate).length === tickers.length) resolve(true);
            else if (Util.millisecondsSince(start) > timeout) reject(new Error(`Timed out waiting for all watched tickers to receive a depth update`));
            else setTimeout(waitForUpdates.bind(this, resolve, reject), 1000);
        };
        return new Promise(waitForUpdates);
    },

    createTrade(a, b, c) {
        a = a.toUpperCase();
        b = b.toUpperCase();
        c = c.toUpperCase();

        if (CONFIG.SCANNING.WHITELIST.length > 0) {
            if (!CONFIG.SCANNING.WHITELIST.includes(a)) return;
            if (!CONFIG.SCANNING.WHITELIST.includes(b)) return;
            if (!CONFIG.SCANNING.WHITELIST.includes(c)) return;
        }

        const ab = MarketCache.getRelationship(a, b);
        if (!ab) return;
        if (CONFIG.EXECUTION.TEMPLATE[0] !== '*' && CONFIG.EXECUTION.TEMPLATE[0] !== ab.method) return;

        const bc = MarketCache.getRelationship(b, c);
        if (!bc) return;
        if (CONFIG.EXECUTION.TEMPLATE[1] !== '*' && CONFIG.EXECUTION.TEMPLATE[1] !== bc.method) return;

        const ca = MarketCache.getRelationship(c, a);
        if (!ca) return;
        if (CONFIG.EXECUTION.TEMPLATE[2] !== '*' && CONFIG.EXECUTION.TEMPLATE[2] !== ca.method) return;

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
