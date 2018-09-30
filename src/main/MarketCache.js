const binance = require('node-binance-api')();

let MarketCache = {
    symbols: [],
    tickers: {},
    relationships: [],
    arbs: {},

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
