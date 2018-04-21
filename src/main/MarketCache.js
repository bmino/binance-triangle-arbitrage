let MarketCache = {
    symbols: [],
    tickers: {},
    volumes: {},
    depths: {},

    getTickerArray() {
        return Object.keys(MarketCache.tickers);
    }
};

module.exports = MarketCache;
