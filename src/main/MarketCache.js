const binance = require('node-binance-api');

let MarketCache = {
    symbols: [],
    tickers: {},
    volumes: {},
    relationships: [],
    arbs: {},

    getTickerArray() {
        return Object.keys(MarketCache.tickers);
    },

    getSubsetFromTickers(tickers) {
        let tickersPartial = {};
        let depthsPartial = {};
        let volumesPartial = {};

        tickers.forEach(ticker => {
            tickersPartial[ticker] = MarketCache.tickers[ticker];
            depthsPartial[ticker] = binance.depthCache(ticker);
            volumesPartial[ticker] = MarketCache.volumes[ticker];
        });

        return {
            tickers: tickersPartial,
            depths: depthsPartial
        };
    },

    pruneDepthsAboveThreshold(threshold=100) {
        Object.keys(MarketCache.tickers).forEach(ticker => {
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
        Object.keys(MarketCache.tickers).forEach(ticker => {
            let depth = binance.depthCache(ticker);
            let bidCount = Object.keys(depth.bids).length;
            let askCount = Object.keys(depth.asks).length;
            if (bidCount < threshold || askCount < threshold) outputBuffer.push(`${ticker}: ${bidCount}/${askCount}`);
        });
        return outputBuffer;
    },

    getDepthsAboveThreshold(threshold) {
        let outputBuffer = [];
        Object.keys(MarketCache.tickers).forEach(ticker => {
            let depth = binance.depthCache(ticker);
            let bidCount = Object.keys(depth.bids).length;
            let askCount = Object.keys(depth.asks).length;
            if (bidCount > threshold || askCount > threshold) outputBuffer.push(`${ticker}: ${bidCount}/${askCount}`);
        });
        return outputBuffer;
    },

    getArbsAboveProfitPercent(profit) {
        return Object.values(MarketCache.arbs)
            .filter(arb => arb.percent > profit)
            .sort((a, b) => a.percent > b.percent ? -1 : 1);
    }

};

module.exports = MarketCache;
