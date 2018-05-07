let MarketCache = require('./MarketCache');
let BinanceApi = require('./BinanceApi');
let MarketCalculation = require('./MarketCalculation');
let CONFIG = require('../../config/live.config');

let relationships = [];

// Set up symbols and tickers
BinanceApi.exchangeInfo().then((data) => {

    let symbols = new Set();
    let tickers = [];
    const CACHE_INIT_DELAY = 15000;

    // Extract Symbols and Tickers
    data.symbols.forEach(function(symbolObj) {
        if (symbolObj.status !== 'TRADING') return;
        symbols.add(symbolObj.baseAsset);
        symbolObj.dustQty = parseFloat(symbolObj.filters[1].minQty);
        tickers[symbolObj.symbol] = symbolObj;
    });

    // Initialize market cache
    MarketCache.symbols = symbols;
    MarketCache.tickers = tickers;
    relationships = MarketCalculation.allRelationships().filter(relationship => relationship.symbol.a === CONFIG.BASE_SYMBOL.toUpperCase());

    // Listen for depth updates
    BinanceApi.listenForDepthCache(MarketCache.getTickerArray(), (ticker, depth) => {
        MarketCache.depths[ticker] = depth;
    }, CONFIG.DEPTH_SIZE);

    console.log(`\nWaiting ${CACHE_INIT_DELAY / 1000} seconds to populate market caches`);

    setTimeout(function() {
        console.log(`\nInitiated calculation cycle:
            Cycle Delay: ${CONFIG.SCAN_DELAY / 1000} seconds
            Base Symbol: ${CONFIG.BASE_SYMBOL}
            Relationships: ${relationships.length}
            Investments: [${CONFIG.INVESTMENT.MIN} - ${CONFIG.INVESTMENT.MAX}] by ${CONFIG.INVESTMENT.STEP}
            Profit Logging: Above ${CONFIG.MIN_PROFIT_PERCENT}%\n`);
        calculateArbitrage();
    }, CACHE_INIT_DELAY);
})
    .catch((error) => {
        console.error(error);
        console.log(error.message);
    });


function calculateArbitrage() {
    MarketCache.pruneDepthsAboveThreshold(CONFIG.DEPTH_SIZE);

    relationships.forEach(relationship => {
        relationship.calculated = MarketCalculation.optimizeAndCalculate(relationship, CONFIG.INVESTMENT.MIN, CONFIG.INVESTMENT.MAX, CONFIG.INVESTMENT.STEP);
        if (relationship.calculated) {
            if (relationship.calculated.percent >= CONFIG.MIN_PROFIT_PERCENT) console.log(`${new Date()}: Profit of ${relationship.calculated.percent.toFixed(5)}% on ${relationship.id}`);
        }
    });

    setTimeout(calculateArbitrage, CONFIG.SCAN_DELAY);
}
