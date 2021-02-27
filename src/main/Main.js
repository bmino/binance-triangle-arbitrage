const CONFIG = require('../../config/config');
const logger = require('./Loggers');
const Util = require('./Util');
const BinanceApi = require('./BinanceApi');
const MarketCache = require('./MarketCache');
const HUD = require('./HUD');
const ArbitrageExecution = require('./ArbitrageExecution');
const CalculationNode = require('./CalculationNode');
const SpeedTest = require('./SpeedTest');
const Validation = require('./Validation');

let recentCalculations = {};
let initialized = null;

let statusUpdate = {
    cycleTimes: [],
};

// Helps identify application startup
logger.binance.info(logger.LINE);
logger.execution.info(logger.LINE);
logger.performance.info(logger.LINE);

if (CONFIG.EXECUTION.ENABLED) console.log(`WARNING! Order execution is enabled!\n`);

Validation.configuration(CONFIG);

process.on('uncaughtException', handleError);

console.log(`Checking latency ...`);
SpeedTest.multiPing(5)
    .then((pings) => {
        const msg = `Experiencing ${Util.average(pings).toFixed(0)} ms of latency`;
        console.log(msg);
        logger.performance.info(msg);
    })
    .then(MarketCache.initialize)
    .then(checkBalances)
    .then(checkMarket)
    .then(() => {
        // Listen for depth updates
        const tickers = MarketCache.tickers.watching;
        const validDepth = [5, 10, 20, 50, 100, 500, 1000, 5000].find(d => d >= CONFIG.SCANNING.DEPTH);
        console.log(`Opening ${Math.ceil(tickers.length / CONFIG.WEBSOCKET.BUNDLE_SIZE)} depth websockets for ${tickers.length} tickers ...`);
        if (CONFIG.WEBSOCKET.BUNDLE_SIZE === 1) {
            return BinanceApi.depthCacheStaggered(tickers, validDepth, CONFIG.WEBSOCKET.INITIALIZATION_INTERVAL, arbitrageCycleCallback);
        } else {
            return BinanceApi.depthCacheCombined(tickers, validDepth, CONFIG.WEBSOCKET.BUNDLE_SIZE, CONFIG.WEBSOCKET.INITIALIZATION_INTERVAL, arbitrageCycleCallback);
        }
    })
    .then(() => {
        console.log(`Waiting for all tickers to receive initial depth snapshot ...`);
        return MarketCache.waitForAllTickersToUpdate(10000);
    })
    .then(() => {
        const msg = `Initialized`;
        console.log(msg);
        logger.execution.info(msg);
        initialized = Date.now();

        console.log();
        console.log(`Execution Limit:        ${CONFIG.EXECUTION.CAP} execution(s)`);
        console.log(`Profit Threshold:       ${CONFIG.EXECUTION.THRESHOLD.PROFIT.toFixed(2)}%`);
        console.log(`Age Threshold:          ${CONFIG.EXECUTION.THRESHOLD.AGE} ms`);
        console.log();

        if (CONFIG.HUD.ENABLED) setInterval(() => HUD.displayTopCalculations(recentCalculations, CONFIG.HUD.ROWS), CONFIG.HUD.REFRESH_RATE);
        if (CONFIG.LOG.STATUS_UPDATE_INTERVAL > 0) setInterval(displayStatusUpdate, CONFIG.LOG.STATUS_UPDATE_INTERVAL * 1000 * 60);
    })
    .catch(handleError);

function arbitrageCycleCallback(ticker) {
    if (!isSafeToCalculateArbitrage()) return;
    const startTime = Date.now();
    const depthSnapshots = BinanceApi.getDepthSnapshots(MarketCache.related.tickers[ticker]);

    const results = CalculationNode.analyze(
        MarketCache.related.trades[ticker],
        depthSnapshots,
        (e) => logger.performance.warn(e),
        ArbitrageExecution.isSafeToExecute,
        ArbitrageExecution.executeCalculatedPosition
    );

    if (CONFIG.HUD.ENABLED) Object.assign(recentCalculations, results);
    statusUpdate.cycleTimes.push(Util.millisecondsSince(startTime));
}

function isSafeToCalculateArbitrage() {
    if (ArbitrageExecution.inProgressIds.size > 0) return false;
    if (!initialized) return false;
    return true;
}

function displayStatusUpdate() {
    const statusUpdateIntervalMS = CONFIG.LOG.STATUS_UPDATE_INTERVAL * 1000 * 60;

    const tickersWithoutRecentDepthUpdate = MarketCache.getTickersWithoutDepthCacheUpdate(statusUpdateIntervalMS);
    if (tickersWithoutRecentDepthUpdate.length > 0) {
        logger.performance.debug(`Tickers without recent depth cache update: [${tickersWithoutRecentDepthUpdate.sort()}]`);
    }

    const cyclesPerSecond = statusUpdate.cycleTimes.length / (statusUpdateIntervalMS / 1000);
    logger.performance.debug(`Depth cache updates per second:  ${cyclesPerSecond.toFixed(2)}`);

    const clockUsagePerCycle = Util.sum(statusUpdate.cycleTimes) / statusUpdateIntervalMS * 100;
    if (clockUsagePerCycle > 50) {
        logger.performance.warn(`CPU clock usage for calculations:  ${clockUsagePerCycle.toFixed(2)}%`);
    } else {
        logger.performance.debug(`CPU clock usage for calculations:  ${clockUsagePerCycle.toFixed(2)}%`);
    }

    statusUpdate.cycleTimes = [];

    SpeedTest.ping()
        .then((latency) => {
            logger.performance.debug(`API Latency: ${latency} ms`);
        })
        .catch(err => logger.performance.warn(err.message));
}

function handleError(err) {
    console.error(err);
    logger.binance.error(err);
    process.exit(1);
}

function checkBalances() {
    if (!CONFIG.EXECUTION.ENABLED) return;

    console.log(`Checking balances ...`);

    return BinanceApi.getBalances()
        .then(balances => {
            Object.keys(CONFIG.INVESTMENT).forEach(BASE => {
                if (balances[BASE].available < CONFIG.INVESTMENT[BASE].MIN) {
                    const msg = `Only detected ${balances[BASE].available} ${BASE}, but ${CONFIG.INVESTMENT[BASE].MIN} ${BASE} is required to satisfy your INVESTMENT.${BASE}.MIN configuration`;
                    logger.execution.error(msg);
                    throw new Error(msg);
                }
                if (balances[BASE].available < CONFIG.INVESTMENT[BASE].MAX) {
                    const msg = `Only detected ${balances[BASE].available} ${BASE}, but ${CONFIG.INVESTMENT[BASE].MAX} ${BASE} is required to satisfy your INVESTMENT.${BASE}.MAX configuration`;
                    logger.execution.error(msg);
                    throw new Error(msg);
                }
            });
            if (balances['BNB'].available <= 0.001) {
                const msg = `Only detected ${balances['BNB'].available} BNB which is not sufficient to pay for trading fees via BNB`;
                logger.execution.error(msg);
                throw new Error(msg);
            }
        });
}

function checkMarket() {
    console.log(`Checking market conditions ...`);

    if (MarketCache.trades.length === 0) {
        const msg = `No triangular trades were identified`;
        logger.execution.error(msg);
        throw new Error(msg);
    }

    return Promise.resolve();
}
