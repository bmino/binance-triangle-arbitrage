const CONFIG = require('../../config/config');
const logger = require('./Loggers');
const binance = require('node-binance-api')();
const os = require('os');
const MarketCache = require('./MarketCache');
const HUD = require('./HUD');
const BinanceApi = require('./BinanceApi');
const ArbitrageExecution = require('./ArbitrageExecution');
const CalculationNode = require('./CalculationNode');

binance.options({
    APIKEY: CONFIG.KEYS.API,
    APISECRET: CONFIG.KEYS.SECRET,
    test: !CONFIG.TRADING.ENABLED
});

if (CONFIG.TRADING.ENABLED) console.log(`WARNING! Order execution is enabled!`);
else console.log(`Running in research mode.`);

ArbitrageExecution.refreshBalances()
    .then(BinanceApi.exchangeInfo)
    .then(exchangeInfo => MarketCache.initialize(exchangeInfo, CONFIG.TRADING.WHITELIST, CONFIG.INVESTMENT.BASE))
    .then(checkConfig)
    .then(() => {
        // Listen for depth updates
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
        setTimeout(calculateArbitrage, 3000);
    })
    .catch(console.error);


function calculateArbitrage() {
    const before = new Date().getTime();

    let errorCount = 0;
    let results = {};

    MarketCache.pruneDepthsAboveThreshold(CONFIG.DEPTH_SIZE);

    MarketCache.relationships.forEach(relationship => {
        try {
            let calculated = CalculationNode.optimize(relationship);
            if (calculated) {
                if (CONFIG.HUD.ENABLED) results[calculated.id] = calculated;
                if (ArbitrageExecution.isSafeToExecute(calculated)) ArbitrageExecution.executeCalculatedPosition(calculated);
            }
        } catch (error) {
            logger.performance.debug(error.message);
            errorCount++;
        }
    });

    const total = MarketCache.relationships.length;
    const completed = total - errorCount;
    logger.performance.info(`Completed ${completed}/${total} (${((completed/total)*100).toFixed(0)}%) calculations in ${new Date().getTime() - before} ms`);
    if (CONFIG.HUD.ENABLED) refreshHUD(results);
    setTimeout(calculateArbitrage, CONFIG.SCAN_DELAY);
}

function checkConfig() {
    // Ensure enough information is being watched
    if (MarketCache.relationships.length < 3) {
        const msg = `Watching ${MarketCache.relationships.length} relationship(s) is not sufficient to engage in triangle arbitrage`;
        logger.execution.error(msg);
        throw new Error(msg);
    }
    if (MarketCache.symbols.length < 3) {
        const msg = `Watching ${MarketCache.symbols.length} symbol(s) is not sufficient to engage in triangle arbitrage`;
        logger.execution.error(msg);
        throw new Error(msg);
    }
    if (CONFIG.TRADING.WHITELIST.length > 0 && !CONFIG.TRADING.WHITELIST.includes(CONFIG.INVESTMENT.BASE)) {
        const msg = `Whitelist must include the base symbol of ${CONFIG.INVESTMENT.BASE}`;
        logger.execution.error(msg);
        throw new Error(msg);
    }
    if (CONFIG.TRADING.EXECUTION_STRATEGY.toUpperCase() === 'PARALLEL' && CONFIG.TRADING.WHITELIST.length === 0) {
        const msg = `Parallel execution requires defining a whitelist`;
        logger.execution.error(msg);
        throw new Error(msg);
    }
}

function refreshHUD(arbs) {
    const arbsToDisplay = Object.values(arbs)
        .sort((a, b) => a.percent > b.percent ? -1 : 1)
        .slice(0, CONFIG.HUD.ARB_COUNT);
    HUD.displayArbs(arbsToDisplay);
}
