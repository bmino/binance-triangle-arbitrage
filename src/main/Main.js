const threads = require('threads');
threads.config.set({
    basepath: {
        node: __dirname
    }
});
const MarketCache = require('./MarketCache');
const ArbDisplay = require('./ArbDisplay');
const BinanceApi = require('./BinanceApi');
const MarketCalculation = require('./MarketCalculation');
const CONFIG = require('../../config/live.config');


// Set up symbols and tickers
BinanceApi.exchangeInfo().then((data) => {

    let symbols = new Set();
    let tickers = [];
    const CACHE_INIT_DELAY = 20000;

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
    MarketCache.relationships = MarketCalculation.getRelationshipsFromSymbol(CONFIG.BASE_SYMBOL);

    // Listen for depth updates
    BinanceApi.listenForDepthCache(MarketCache.getTickerArray(), (ticker, depth) => {}, CONFIG.DEPTH_SIZE);

    // Delay before beginning calculation cycle
    console.log(`\nWaiting ${CACHE_INIT_DELAY / 1000} seconds to populate market caches`);
    setTimeout(calculateArbitrage, CACHE_INIT_DELAY);
})
    .catch(console.error);



function calculateArbitrage() {
    MarketCache.pruneDepthsAboveThreshold(CONFIG.DEPTH_SIZE);

    const pool = new threads.Pool();
    const job = pool
        .run('CalculationNode.js')
        .on('error',  console.error)
        .on('done', (job, calculated) => {
            if (calculated) {
                let id = calculated.trade.id;
                MarketCache.arbs[id] = calculated;
            }
        });

    MarketCache.relationships.forEach(relationship => {
        job.send({
            trade: relationship,
            minInvestment: CONFIG.INVESTMENT.MIN,
            maxInvestment: CONFIG.INVESTMENT.MAX,
            stepSize: CONFIG.INVESTMENT.STEP,
            MarketCache: MarketCache.getSubsetFromTickers([relationship.ab.ticker, relationship.bc.ticker, relationship.ca.ticker])
        })
    });

    pool.on('finished', () => {
        pool.killAll();
        let arbsToDisplay = MarketCache.getArbsAboveProfitPercent(CONFIG.MIN_PROFIT_PERCENT);
        ArbDisplay.displayArbs(arbsToDisplay);
        setTimeout(calculateArbitrage, CONFIG.SCAN_DELAY);
    });
}
