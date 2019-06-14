const CONFIG = require('../../config/config');
const logger = require('./Loggers');
const BinanceApi = require('./BinanceApi');
const CalculationNode = require('./CalculationNode');

const ArbitrageExecution = {

    inProgressIds: new Set(),
    inProgressSymbols: new Set(),
    attemptedPositions: {},
    balances: {},

    executeCalculatedPosition(calculated) {
        const startTime = new Date().getTime();

        if (!ArbitrageExecution.isSafeToExecute(calculated)) return false;

        const { symbol } = calculated.trade;
        const age = {
            ab: startTime - calculated.depth.ab.eventTime,
            bc: startTime - calculated.depth.bc.eventTime,
            ca: startTime - calculated.depth.ca.eventTime
        };

        // Register position as being attempted
        ArbitrageExecution.attemptedPositions[startTime] = calculated.id;
        ArbitrageExecution.inProgressIds.add(calculated.id);
        ArbitrageExecution.inProgressSymbols.add(symbol.a);
        ArbitrageExecution.inProgressSymbols.add(symbol.b);
        ArbitrageExecution.inProgressSymbols.add(symbol.c);

        logger.execution.info(`Attempting to execute ${calculated.id} with an age of ${Math.max(age.ab, age.bc, age.ca).toFixed(0)} ms and expected profit of ${calculated.percent.toFixed(4)}%`);
        logger.execution.debug(`${calculated.trade.ab.ticker} depth cache age: ${age.ab.toFixed(0)} ms`);
        logger.execution.debug(`${calculated.trade.bc.ticker} depth cache age: ${age.bc.toFixed(0)} ms`);
        logger.execution.debug(`${calculated.trade.ca.ticker} depth cache age: ${age.ca.toFixed(0)} ms`);

        return ArbitrageExecution.execute(calculated)
            .then((actual) => {
                logger.execution.info(`${CONFIG.TRADING.ENABLED ? 'Executed' : 'Test: Executed'} ${calculated.id} position in ${new Date().getTime() - startTime} ms`);

                // Results are only collected when a trade is executed
                if (!CONFIG.TRADING.ENABLED) return;
                if ((CONFIG.DEMO != 'undefined') && CONFIG.DEMO) return;

                logger.execution.debug();
                logger.execution.debug(`AB Expected Conversion:  ${calculated.a.spent.toFixed(8)} ${symbol.a} into ${calculated.b.earned.toFixed(8)} ${symbol.b}`);
                logger.execution.debug(`AB Observed Conversion:  ${actual.a.spent.toFixed(8)} ${symbol.a} into ${actual.b.earned.toFixed(8)} ${symbol.b}`);
                logger.execution.debug();
                logger.execution.debug(`BC Expected Conversion:  ${calculated.b.spent.toFixed(8)} ${symbol.b} into ${calculated.c.earned.toFixed(8)} ${symbol.c}`);
                logger.execution.debug(`BC Observed Conversion:  ${actual.b.spent.toFixed(8)} ${symbol.b} into ${actual.c.earned.toFixed(8)} ${symbol.c}`);
                logger.execution.debug();
                logger.execution.debug(`CA Expected Conversion:  ${calculated.c.spent.toFixed(8)} ${symbol.c} into ${calculated.a.earned.toFixed(8)} ${symbol.a}`);
                logger.execution.debug(`CA Observed Conversion:  ${actual.c.spent.toFixed(8)} ${symbol.c} into ${actual.a.earned.toFixed(8)} ${symbol.a}`);
                logger.execution.debug();

                logger.execution.trace(`Depth cache used for calculation:`);
                logger.execution.trace(calculated.depth);

                const percent = {
                    a: actual.a.delta / actual.a.spent * 100,
                    b: actual.b.delta / actual.b.spent * 100,
                    c: actual.c.delta / actual.c.spent * 100
                };

                logger.execution.info(`${symbol.a} delta:\t  ${actual.a.delta < 0 ? '' : ' '}${actual.a.delta.toFixed(8)} (${percent.a < 0 ? '' : ' '}${percent.a.toFixed(4)}%)`);
                logger.execution.info(`${symbol.b} delta:\t  ${actual.b.delta < 0 ? '' : ' '}${actual.b.delta.toFixed(8)} (${percent.b < 0 ? '' : ' '}${percent.b.toFixed(4)}%)`);
                logger.execution.info(`${symbol.c} delta:\t  ${actual.c.delta < 0 ? '' : ' '}${actual.c.delta.toFixed(8)} (${percent.c < 0 ? '' : ' '}${percent.c.toFixed(4)}%)`);
                logger.execution.info(`BNB commission: ${(-1 * actual.fees).toFixed(8)}`);
                logger.execution.info(`${calculated.trade.symbol.a} commission: ${(-1 * actual.assetFees.a).toFixed(8)}`);
                logger.execution.info(`${calculated.trade.symbol.b} commission: ${(-1 * actual.assetFees.b).toFixed(8)}`);
                logger.execution.info(`${calculated.trade.symbol.c} commission: ${(-1 * actual.assetFees.c).toFixed(8)}`);
                logger.execution.info();
            })
            .catch((err) => logger.execution.error(err.message))
            .then(ArbitrageExecution.refreshBalances)
            .then(() => {
                ArbitrageExecution.inProgressIds.delete(calculated.id);
                ArbitrageExecution.inProgressSymbols.delete(symbol.a);
                ArbitrageExecution.inProgressSymbols.delete(symbol.b);
                ArbitrageExecution.inProgressSymbols.delete(symbol.c);

                if (CONFIG.TRADING.EXECUTION_CAP && ArbitrageExecution.inProgressIds.size === 0 && ArbitrageExecution.getAttemptedPositionsCount() >= CONFIG.TRADING.EXECUTION_CAP) {
                    logger.execution.error(`Cannot exceed user defined execution cap of ${CONFIG.TRADING.EXECUTION_CAP} executions`);
                    process.exit();
                }
            });
    },

    isSafeToExecute(calculated) {
        const now = new Date().getTime();
        const { symbol } = calculated.trade;

        // Profit Threshold is Not Satisfied
        if (calculated.percent < CONFIG.TRADING.PROFIT_THRESHOLD) return false;

        // Age Threshold is Not Satisfied
        const ageInMilliseconds = now - Math.min(calculated.depth.ab.eventTime, calculated.depth.bc.eventTime, calculated.depth.ca.eventTime);
        if (isNaN(ageInMilliseconds) || ageInMilliseconds > CONFIG.TRADING.AGE_THRESHOLD) return false;

        if (CONFIG.TRADING.EXECUTION_CAP && ArbitrageExecution.getAttemptedPositionsCount() >= CONFIG.TRADING.EXECUTION_CAP) {
            logger.execution.trace(`Blocking execution because ${ArbitrageExecution.getAttemptedPositionsCount()} executions have been attempted`);
            return false;
        }
        if (ArbitrageExecution.inProgressSymbols.has(symbol.a)) {
            logger.execution.trace(`Blocking execution because ${symbol.a} is currently involved in an execution`);
            return false;
        }
        if (ArbitrageExecution.inProgressSymbols.has(symbol.b)) {
            logger.execution.trace(`Blocking execution because ${symbol.b} is currently involved in an execution`);
            return false;
        }
        if (ArbitrageExecution.inProgressSymbols.has(symbol.c)) {
            logger.execution.trace(`Blocking execution because ${symbol.c} is currently involved in an execution`);
            return false;
        }
        if (ArbitrageExecution.getAttemptedPositionsCountInLastSecond() > 1) {
            logger.execution.trace(`Blocking execution because ${ArbitrageExecution.getAttemptedPositionsCountInLastSecond()} position has already been attempted in the last second`);
            return false;
        }
        if (Object.entries(ArbitrageExecution.attemptedPositions).find(([executionTime, id]) => id === calculated.id && executionTime > (now - CONFIG.TRADING.AGE_THRESHOLD))) {
            logger.execution.trace(`Blocking execution to avoid double executing the same position`);
            return false;
        }

        return true;
    },

    refreshBalances() {
        return BinanceApi.getBalances()
            .then(balances => ArbitrageExecution.balances = balances);
    },

    getAttemptedPositionsCount() {
        return Object.keys(ArbitrageExecution.attemptedPositions).length;
    },

    getAttemptedPositionsCountInLastSecond() {
        const timeFloor = new Date().getTime() - 1000;
        return Object.keys(ArbitrageExecution.attemptedPositions).filter(time => time > timeFloor).length;
    },

    execute(calculated) {
        return ArbitrageExecution.getExecutionStrategy()(calculated);
    },

    getExecutionStrategy() {
        switch (CONFIG.TRADING.EXECUTION_STRATEGY.toLowerCase()) {
            case 'parallel':
                return ArbitrageExecution.parallelExecutionStrategy;
            default:
                return ArbitrageExecution.linearExecutionStrategy;
        }
    },

    parallelExecutionStrategy(calculated) {
        return Promise.all([
            BinanceApi.marketBuyOrSell(calculated.trade.ab.method)(calculated.trade.ab.ticker, calculated.ab),
            BinanceApi.marketBuyOrSell(calculated.trade.bc.method)(calculated.trade.bc.ticker, calculated.bc),
            BinanceApi.marketBuyOrSell(calculated.trade.ca.method)(calculated.trade.ca.ticker, calculated.ca)
        ])
            .then(([resultsAB, resultsBC, resultsCA]) => {
                let actual = {
                    a: {
                        spent: 0,
                        earned: 0
                    },
                    b: {
                        spent: 0,
                        earned: 0
                    },
                    c: {
                        spent: 0,
                        earned: 0
                    },
                    fees: 0,
                    assetFees: {
                        a: 0,
                        b: 0,
                        c: 0
                    }
                };

                if (resultsAB.orderId && resultsBC.orderId && resultsCA.orderId) {
                    [actual.a.spent, actual.b.earned, fees] = ArbitrageExecution.parseActualResults(calculated.trade.ab.method, calculated.trade.symbol.b, resultsAB);
                    actual.fees += fees;
                    actual.assetFees.b += assetFees;

                    [actual.b.spent, actual.c.earned, fees] = ArbitrageExecution.parseActualResults(calculated.trade.bc.method, calculated.trade.symbol.c, resultsBC);
                    actual.fees += fees;
                    actual.assetFees.c += assetFees;

                    [actual.c.spent, actual.a.earned, fees] = ArbitrageExecution.parseActualResults(calculated.trade.ca.method, calculated.trade.symbol.a, resultsCA);
                    actual.fees += fees;
                    actual.assetFees.a += assetFees;

                    actual.a.delta = actual.a.earned - actual.a.spent;
                    actual.b.delta = actual.b.earned - actual.b.spent;
                    actual.c.delta = actual.c.earned - actual.c.spent;
                }

                return actual;
            });
    },

    linearExecutionStrategy(calculated) {
        let actual = {
            a: {
                spent: 0,
                earned: 0
            },
            b: {
                spent: 0,
                earned: 0
            },
            c: {
                spent: 0,
                earned: 0
            },
            fees: 0,
            assetFees: {
                a: 0,
                b: 0,
                c: 0
            }
        };
        let recalculated = {
            bc: calculated.bc,
            ca: calculated.ca
        };

        return BinanceApi.marketBuyOrSell(calculated.trade.ab.method)(calculated.trade.ab.ticker, calculated.ab)
            .then((results) => {
                if (results.orderId) {
                    [actual.a.spent, actual.b.earned, fees] = ArbitrageExecution.parseActualResults(calculated.trade.ab.method, calculated.trade.symbol.b, results);
                    actual.fees += fees;
                    actual.assetFees.b += assetFees;
                    recalculated.bc = CalculationNode.recalculateTradeLeg(calculated.trade.bc, actual.b.earned);
                }
                return BinanceApi.marketBuyOrSell(calculated.trade.bc.method)(calculated.trade.bc.ticker, recalculated.bc);
            })
            .then((results) => {
                if (results.orderId) {
                    [actual.b.spent, actual.c.earned, fees] = ArbitrageExecution.parseActualResults(calculated.trade.bc.method, calculated.trade.symbol.c, results);
                    actual.fees += fees;
                    actual.assetFees.c += assetFees;
                    recalculated.ca = CalculationNode.recalculateTradeLeg(calculated.trade.ca, actual.c.earned);
                }
                return BinanceApi.marketBuyOrSell(calculated.trade.ca.method)(calculated.trade.ca.ticker, recalculated.ca);
            })
            .then((results) => {
                if (results.orderId) {
                    [actual.c.spent, actual.a.earned, fees] = ArbitrageExecution.parseActualResults(calculated.trade.ca.method, calculated.trade.symbol.a, results);
                    actual.fees += fees;
                    actual.assetFees.a += assetFees;
                }
                return actual;
            })
            .then((actual) => {
                actual.a.delta = actual.a.earned - actual.a.spent;
                actual.b.delta = actual.b.earned - actual.b.spent;
                actual.c.delta = actual.c.earned - actual.c.spent;
                return actual;
            });
    },

    parseActualResults(method, ticker, { executedQty, cummulativeQuoteQty, fills }) {
        const spent = method.toUpperCase() === 'BUY' ? parseFloat(cummulativeQuoteQty) : parseFloat(executedQty);
        var earned = method.toUpperCase() === 'SELL' ? parseFloat(cummulativeQuoteQty) : parseFloat(executedQty);

        // Taking the fees from the asset first.
        const assetFees = fills.filter(f => (f.commissionAsset) === ticker).map(f => parseFloat(f.commission)).reduce((total, fee) => total + fee, 0);
        earned = earned - assetFees;

        // Now taking the BNB fees into account for logging, unless it's an asset fee in which case it's accounted for above.
        // A BNB trade *will* reduce your earned coins, so it needs to come into account above.
        const fees = fills.filter(f => (f.commissionAsset === 'BNB' && f.commissionAsset !== ticker)).map(f => parseFloat(f.commission)).reduce((total, fee) => total + fee, 0);

        if ((fees <= 0) || !fees) {
            logger.execution.warn(`Probably a failed trade from fee set as 0.  Which can happen when fills is null.`);
        }

        logger.execution.debug(`Method: ${method}`);
        logger.execution.debug(`Ticker: ${ticker}`);
        logger.execution.debug(`Fills: ${JSON.stringify(fills)}`);

        if (CONFIG.LOG.LEVEL == 'debug') {
            console.log(fills);
        }

        logger.execution.debug(`Spent: ${spent}`);
        logger.execution.debug(`Earned: ${earned}`);
        logger.execution.debug(`BNB Fees: ${fees}`);
        logger.execution.debug(`Asset Fees: ${assetFees}`);

        return [spent, earned, fees, assetFees];
    }

};

module.exports = ArbitrageExecution;
