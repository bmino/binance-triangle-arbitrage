let MarketCache = {
    symbols: [],
    tickers: {},
    volumes: {},
    depths: {},

    getTickerArray() {
        return Object.keys(MarketCache.tickers);
    },

    listDepthsBelowThreshold(threshold) {
        let outputBuffer = [];
        Object.keys(MarketCache.depths).forEach(ticker => {
            let depth = MarketCache.depths[ticker];
            let bidCount = Object.keys(depth.bids).length;
            let askCount = Object.keys(depth.asks).length;
            if (bidCount < threshold || askCount < threshold) outputBuffer.push(`${ticker}: ${bidCount}/${askCount}`);
        });
        console.log(`Found ${outputBuffer.length} depths below a threshold of ${threshold}`);
        outputBuffer.forEach(output => console.log(output));
    }
};

module.exports = MarketCache;
