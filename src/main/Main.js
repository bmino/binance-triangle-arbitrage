let MarketCache = require('./MarketCache');
let BinanceApi = require('./BinanceApi');
let MarketCalculation = require('./MarketCalculation');
let CONFIG = require('../../config/live.config');

// Set up symbols and tickers
BinanceApi.exchangeInfo().then((data) => {

    let symbols = new Set();
    let tickers = [];
    const CACHE_INIT_DELAY = 10000;

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

    // Listen for depth updates
    BinanceApi.listenForDepthCache(MarketCache.getTickerArray(), (ticker, depth) => {
        MarketCache.depths[ticker] = depth;
    }, 100);

    console.log(`\nWaiting ${CACHE_INIT_DELAY / 1000} seconds to populate market caches`);

    setTimeout(function() {
        console.log(`\nInitiated calculation cycle:
            \tCycle Interval: ${CONFIG.SCAN_INTERVAL / 1000} seconds
            \tBase Symbol: ${CONFIG.BASE_SYMBOL}
            \tInvestments: [${CONFIG.INVESTMENT.MIN} - ${CONFIG.INVESTMENT.MAX}] by ${CONFIG.INVESTMENT.STEP}
            \tProfit Logging: Above ${CONFIG.MIN_PROFIT_PERCENT}%`);
        setInterval(calculateArbitrage, CONFIG.SCAN_INTERVAL);
    }, CACHE_INIT_DELAY);
})
    .catch((error) => {
        console.error(error);
        console.log(error.message);
    });


function calculateArbitrage(baseSymbol = CONFIG.BASE_SYMBOL) {
    MarketCache.pruneDepthsAboveThreshold(100);
    //MarketCache.listDepthsBelowThreshold(60);

    let startTime = new Date();
    console.log(`\nCalculating arbitrage opportunities from ${baseSymbol}`);
    let relationships = [];
    MarketCache.symbols.forEach(function(symbol2) {
        MarketCache.symbols.forEach(function(symbol3) {
            let relationship = MarketCalculation.relationships(baseSymbol, symbol2, symbol3);
            if (relationship) {
                relationship.calculated = MarketCalculation.optimizeAndCalculate(relationship, CONFIG.INVESTMENT.MIN, CONFIG.INVESTMENT.MAX, CONFIG.INVESTMENT.STEP);
                if (relationship.calculated) {
                    relationships.push(relationship);
                    if (relationship.calculated.percent >= CONFIG.MIN_PROFIT_PERCENT) console.log(`\tProfit of ${relationship.calculated.percent.toFixed(5)}% on ${relationship.id}`);
                }
            }
        });
    });
    console.log(`Calculations took ${(new Date() - startTime)/1000} seconds`);
}
