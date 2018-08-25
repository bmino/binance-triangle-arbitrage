const threads = require('threads');
threads.config.set({
    basepath: {
        node: __dirname
    }
});
const logger = require('./Loggers');
const os = require('os');
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
        logger.performance.info(`\nRunning on ${os.type()} with ${os.cpus().length} cores @ [${os.cpus().map(cpu => cpu.speed)}] MHz`);
        if (CONFIG.LOGGING && CONFIG.LOGGING.PROFIT_THRESHOLD !== undefined) logger.research.info(`\nLogging profits > ${CONFIG.LOGGING.PROFIT_THRESHOLD}%`);
        calculateArbitrage();
        CONFIG.HUD_REFRESH_INTERVAL && setInterval(refreshDisplay, CONFIG.HUD_REFRESH_INTERVAL);
    })
    .catch(console.error);


function calculateArbitrage() {
    const before = new Date().getTime();
    const pool = new threads.Pool(CONFIG.CALCULATION_POOL_WORKERS);
    const job = pool.run('CalculationNode.js');

    let errorCount = 0;

    MarketCache.pruneDepthsAboveThreshold(CONFIG.DEPTH_SIZE);

    MarketCache.relationships.forEach(relationship => {
        job.send({
            trade: relationship,
            minInvestment: CONFIG.INVESTMENT.MIN,
            maxInvestment: CONFIG.INVESTMENT.MAX,
            stepSize: CONFIG.INVESTMENT.STEP,
            marketCache: MarketCache.getSubsetFromTickers([relationship.ab.ticker, relationship.bc.ticker, relationship.ca.ticker])
        })
            .on('error', error => errorCount++)
            .on('done', handleDone);
    });

    pool.on('finished', () => {
        const total = MarketCache.relationships.length;
        const completed = total - errorCount;
        logger.performance.info(`Completed ${completed}/${total} (${((completed/total)*100).toFixed(0)}%) calculations in ${new Date().getTime() - before} ms`);
        pool.killAll();
        setTimeout(calculateArbitrage, CONFIG.SCAN_DELAY);
    });
}

function handleDone(calculated) {
    if (!calculated) return;
    MarketCache.arbs[calculated.id] = calculated;
    if (!CONFIG.LOGGING || CONFIG.LOGGING.PROFIT_THRESHOLD === undefined) return;
    if (calculated.percent < CONFIG.LOGGING.PROFIT_THRESHOLD) return;
    const oldestUpdateTime = Math.min(calculated.times.ab, calculated.times.bc, calculated.times.ca);
    logger.research.info(`${calculated.id}: ${calculated.percent.toFixed(3)}% - aged ${((new Date().getTime() - oldestUpdateTime)/1000).toFixed(2)} seconds`)
}

function refreshDisplay() {
    const arbsToDisplay = MarketCache.getTopProfitableArbs(CONFIG.HUD_ARB_COUNT);
    ArbDisplay.displayArbs(arbsToDisplay);
}
