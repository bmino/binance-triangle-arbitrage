const CONFIG = require('../../config/config');
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
const ArbitrageExecution = require('./ArbitrageExecution');

if (CONFIG.TRADING.ENABLED) console.log(`WARNING! Order execution is enabled!`);
else console.log(`Running in research mode.`);

// Populate initial balances
BinanceApi.getBalances()
    .then(balances => {
        // Initialize balances
        ArbitrageExecution.balances = balances;
    })
    .then(BinanceApi.exchangeInfo)
    .then((exchangeInfo) => {
        let symbols = new Set();
        let tickers = [];
        let tradingSymbolObjects = exchangeInfo.symbols.filter(symbolObj => symbolObj.status === 'TRADING');

        console.log(`Found ${tradingSymbolObjects.length}/${exchangeInfo.symbols.length} currently trading tickers.`);

        // Extract Symbols and Tickers
        tradingSymbolObjects.forEach(symbolObj => {
            if (CONFIG.TRADING.WHITELIST.length > 0 && !CONFIG.TRADING.WHITELIST.includes(symbolObj.baseAsset)) return;
            symbols.add(symbolObj.baseAsset);
            symbolObj.dustDecimals = Math.max(symbolObj.filters.filter(f => f.filterType === 'LOT_SIZE')[0].minQty.indexOf('1') - 1, 0);
            tickers[symbolObj.symbol] = symbolObj;
        });

        // Initialize market cache
        MarketCache.symbols = symbols;
        MarketCache.tickers = tickers;
        MarketCache.relationships = MarketCalculation.getRelationshipsFromSymbol(CONFIG.INVESTMENT.BASE);

        // Ensure enough information is being watched
        if (MarketCache.relationships.length < 3) {
            const msg = `Watching ${MarketCache.relationships.length} relationship(s) is not sufficient to engage in triangle arbitrage`;
            logger.execution.info(msg);
            throw new Error(msg);
        }
        if (MarketCache.symbols.length < 3) {
            const msg = `Watching ${MarketCache.symbols.length} symbol(s) is not sufficient to engage in triangle arbitrage`;
            logger.execution.info(msg);
            throw new Error(msg);
        }
        if (CONFIG.TRADING.WHITELIST.length > 0 && !CONFIG.TRADING.WHITELIST.includes(CONFIG.INVESTMENT.BASE)) {
            const msg = `Whitelist must include the base symbol of ${CONFIG.INVESTMENT.BASE}`;
            logger.execution.info(msg);
            throw new Error(msg);
        }

        // Listen for depth updates
        console.log(`Opening ${MarketCache.getTickerArray().length} depth websockets ...`);
        return BinanceApi.depthCache(MarketCache.getTickerArray(), CONFIG.DEPTH_SIZE, CONFIG.DEPTH_OPEN_INTERVAL);
    })
    .then(() => {
        console.log();
        console.log(`Running on ${os.type()} with ${os.cpus().length} cores @ [${os.cpus().map(cpu => cpu.speed)}] MHz`);
        console.log(`Investing up to ${CONFIG.INVESTMENT.MAX} ${CONFIG.INVESTMENT.BASE}`);
        console.log(`Execution criteria:\n\tProfit > ${CONFIG.TRADING.PROFIT_THRESHOLD}%\n\tAge < ${CONFIG.TRADING.AGE_THRESHOLD} ms`);
        console.log(`Will not exceed ${CONFIG.TRADING.EXECUTION_CAP} execution(s)`);
        console.log(`Using ${CONFIG.TRADING.EXECUTION_STRATEGY} strategy`);
        console.log();

        // Allow time to read output before starting calculation cycles
        setTimeout(() => {
            calculateArbitrage();
            CONFIG.HUD_REFRESH_INTERVAL && setInterval(refreshDisplay, CONFIG.HUD_REFRESH_INTERVAL);
        }, 3000);
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
    ArbitrageExecution.executeCalculatedPosition(calculated);
}

function refreshDisplay() {
    const arbsToDisplay = MarketCache.getTopProfitableArbs(CONFIG.HUD_ARB_COUNT);
    ArbDisplay.displayArbs(arbsToDisplay);
}
