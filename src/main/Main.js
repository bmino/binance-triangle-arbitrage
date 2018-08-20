const threads = require('threads');
threads.config.set({
    basepath: {
        node: __dirname
    }
});
const logger = require('./Loggers');
const MarketCache = require('./MarketCache');
const ArbDisplay = require('./ArbDisplay');
const BinanceApi = require('./BinanceApi');
const MarketCalculation = require('./MarketCalculation');
const CONFIG = require('../../config/live.config');

// Set up symbols and tickers
BinanceApi.exchangeInfo()
    .then((data) => {
        let symbols = new Set();
        let tickers = [];

        // Extract Symbols and Tickers
        data.symbols.forEach(function (symbolObj) {
            if (symbolObj.status !== 'TRADING') return;
            symbols.add(symbolObj.baseAsset);
            symbolObj.dustDecimals = Math.max(symbolObj.filters[1].minQty.indexOf('1') - 1, 0);
            tickers[symbolObj.symbol] = symbolObj;
        });

        // Initialize market cache
        MarketCache.symbols = symbols;
        MarketCache.tickers = tickers;
        MarketCache.relationships = MarketCalculation.getRelationshipsFromSymbol(CONFIG.BASE_SYMBOL);

        // Listen for depth updates
        return BinanceApi.depthCache(MarketCache.getTickerArray(), CONFIG.DEPTH_SIZE, CONFIG.DEPTH_OPEN_INTERVAL);
    })
    .then(() => {
        calculateArbitrage();
        CONFIG.HUD_REFRESH_INTERVAL && setInterval(refreshDisplay, CONFIG.HUD_REFRESH_INTERVAL);
    })
    .catch(console.error);


function calculateArbitrage() {
    const before = new Date().getTime();
    const pool = new threads.Pool();
    const job = pool.run('CalculationNode.js');

    let errorCount = 0;

    MarketCache.pruneDepthsAboveThreshold(CONFIG.DEPTH_SIZE);

    MarketCache.relationships.forEach(relationship => {
        job.send({
            trade: relationship,
            minInvestment: CONFIG.INVESTMENT.MIN,
            maxInvestment: CONFIG.INVESTMENT.MAX,
            stepSize: CONFIG.INVESTMENT.STEP,
            MarketCache: MarketCache.getSubsetFromTickers([relationship.ab.ticker, relationship.bc.ticker, relationship.ca.ticker])
        })
            .on('error', (job, error) => errorCount++)
            .on('done', handleDone);
    });

    pool.on('finished', () => {
        let total = MarketCache.relationships.length;
        let completed = total - errorCount;
        logger.performance.info(`Completed ${completed}/${total} (${((completed/total)*100).toFixed(0)}%) calculations in ${((new Date().getTime() - before)/1000).toFixed(2)} seconds`);
        pool.killAll();
        setTimeout(calculateArbitrage, CONFIG.SCAN_DELAY);
    });
}

function handleDone(job, calculated) {
    if (!calculated) return;
    MarketCache.arbs[calculated.id] = calculated;
    if (!CONFIG.LOGGING || CONFIG.LOGGING.PROFIT_THRESHOLD === undefined) return;
    if (calculated.percent < CONFIG.LOGGING.PROFIT_THRESHOLD) return;
    logger.research.info(`${calculated.id}: ${calculated.percent.toFixed(3)}% on ${new Date(calculated.time).toLocaleString()} - aged ${((new Date() - calculated.time)/1000).toFixed(2)} seconds`)
}

function refreshDisplay() {
    const arbsToDisplay = MarketCache.getTopProfitableArbs(CONFIG.HUD_ARB_COUNT);
    ArbDisplay.displayArbs(arbsToDisplay);
}
