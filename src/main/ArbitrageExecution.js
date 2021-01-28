const CONFIG = require('../../config/config');
const logger = require('./Loggers');
const BinanceApi = require('./BinanceApi');
const CalculationNode = require('./CalculationNode');
const Util = require('./Util');

const ArbitrageExecution = {

    inProgressIds: new Set(),
    inProgressSymbols: new Set(),
    attemptedPositions: {},

    executeCalculatedPosition(calculated) {
        const startTime = Date.now();

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

        return ArbitrageExecution.getExecutionStrategy()(calculated)
            .then((actual) => {
                logger.execution.info(`${CONFIG.EXECUTION.ENABLED ? 'Executed' : 'Test: Executed'} ${calculated.id} position in ${Util.millisecondsSince(startTime)} ms`);

                // Results are only collected when a trade is executed
                if (!CONFIG.EXECUTION.ENABLED) return;

                const price = {
                    ab: {
                        expected: calculated.trade.ab.method === 'BUY' ? calculated.a.spent / calculated.b.earned : calculated.b.earned / calculated.a.spent,
                        actual: calculated.trade.ab.method === 'BUY' ? actual.a.spent / actual.b.earned : actual.b.earned / actual.a.spent
                    },
                    bc: {
                        expected: calculated.trade.bc.method === 'BUY' ? calculated.b.spent / calculated.c.earned : calculated.c.earned / calculated.b.spent,
                        actual: calculated.trade.bc.method === 'BUY' ? actual.b.spent / actual.c.earned : actual.c.earned / actual.b.spent
                    },
                    ca: {
                        expected: calculated.trade.ca.method === 'BUY' ? calculated.c.spent / calculated.a.earned : calculated.a.earned / calculated.c.spent,
                        actual: calculated.trade.ca.method === 'BUY' ? actual.c.spent / actual.a.earned : actual.a.earned / actual.c.spent
                    }
                };

                logger.execution.debug(`${calculated.trade.ab.ticker} Stats:`);
                logger.execution.debug(`Expected Conversion:  ${calculated.a.spent.toFixed(8)} ${symbol.a} into ${calculated.b.earned.toFixed(8)} ${symbol.b} @ ${price.ab.expected.toFixed(8)}`);
                logger.execution.debug(`Observed Conversion:  ${actual.a.spent.toFixed(8)} ${symbol.a} into ${actual.b.earned.toFixed(8)} ${symbol.b} @ ${price.ab.actual.toFixed(8)}`);
                logger.execution.debug(`Price Change:         ${((price.ab.actual - price.ab.expected) / price.ab.expected * 100).toFixed(8)}%`);
                logger.execution.debug();
                logger.execution.debug(`${calculated.trade.bc.ticker} Stats:`);
                logger.execution.debug(`Expected Conversion:  ${calculated.b.spent.toFixed(8)} ${symbol.b} into ${calculated.c.earned.toFixed(8)} ${symbol.c} @ ${price.bc.expected.toFixed(8)}`);
                logger.execution.debug(`Observed Conversion:  ${actual.b.spent.toFixed(8)} ${symbol.b} into ${actual.c.earned.toFixed(8)} ${symbol.c} @ ${price.bc.actual.toFixed(8)}`);
                logger.execution.debug(`Price Change:         ${((price.bc.actual - price.bc.expected) / price.bc.expected * 100).toFixed(8)}%`);
                logger.execution.debug();
                logger.execution.debug(`${calculated.trade.ca.ticker} Stats:`);
                logger.execution.debug(`Expected Conversion:  ${calculated.c.spent.toFixed(8)} ${symbol.c} into ${calculated.a.earned.toFixed(8)} ${symbol.a} @ ${price.ca.expected.toFixed(8)}`);
                logger.execution.debug(`Observed Conversion:  ${actual.c.spent.toFixed(8)} ${symbol.c} into ${actual.a.earned.toFixed(8)} ${symbol.a} @ ${price.ca.actual.toFixed(8)}`);
                logger.execution.debug(`Price Change:         ${((price.ca.actual - price.ca.expected) / price.ca.expected * 100).toFixed(8)}%`);

                const prunedDepthSnapshot = {
                    ab: Util.pruneSnapshot(calculated.depth.ab, calculated.ab.depth + 2),
                    bc: Util.pruneSnapshot(calculated.depth.bc, calculated.bc.depth + 2),
                    ca: Util.pruneSnapshot(calculated.depth.ca, calculated.ca.depth + 2)
                };

                logger.execution.trace(`Pruned depth cache used for calculation:`);
                logger.execution.trace(prunedDepthSnapshot);

                const percent = {
                    a: actual.a.delta / actual.a.spent * 100,
                    b: actual.b.delta / actual.b.spent * 100,
                    c: actual.c.delta / actual.c.spent * 100
                };

                logger.execution.info();
                logger.execution.info(`${symbol.a} delta:\t  ${actual.a.delta < 0 ? '' : ' '}${actual.a.delta.toFixed(8)} (${percent.a < 0 ? '' : ' '}${percent.a.toFixed(4)}%)`);
                logger.execution.info(`${symbol.b} delta:\t  ${actual.b.delta < 0 ? '' : ' '}${actual.b.delta.toFixed(8)} (${percent.b < 0 ? '' : ' '}${percent.b.toFixed(4)}%)`);
                logger.execution.info(`${symbol.c} delta:\t  ${actual.c.delta < 0 ? '' : ' '}${actual.c.delta.toFixed(8)} (${percent.c < 0 ? '' : ' '}${percent.c.toFixed(4)}%)`);
                logger.execution.info(`BNB fees: \t  ${(-1 * actual.fees).toFixed(8)}`);
                logger.execution.info();
            })
            .catch((err) => logger.execution.error(err.message))
            .then(() => {
                ArbitrageExecution.inProgressIds.delete(calculated.id);
                ArbitrageExecution.inProgressSymbols.delete(symbol.a);
                ArbitrageExecution.inProgressSymbols.delete(symbol.b);
                ArbitrageExecution.inProgressSymbols.delete(symbol.c);

                if (CONFIG.EXECUTION.CAP && ArbitrageExecution.inProgressIds.size === 0 && ArbitrageExecution.getAttemptedPositionsCount() >= CONFIG.EXECUTION.CAP) {
                    logger.execution.info(`Cannot exceed user defined execution cap of ${CONFIG.EXECUTION.CAP} executions`);
                    process.exit(0);
                }
            });
    },

    isSafeToExecute(calculated) {
        // Profit Threshold is Not Satisfied
        if (calculated.percent < CONFIG.EXECUTION.THRESHOLD.PROFIT) return false;

        // Age Threshold is Not Satisfied
        const ageInMilliseconds = Date.now() - Math.min(calculated.depth.ab.eventTime, calculated.depth.bc.eventTime, calculated.depth.ca.eventTime);
        if (isNaN(ageInMilliseconds) || ageInMilliseconds > CONFIG.EXECUTION.THRESHOLD.AGE) return false;

        const { symbol } = calculated.trade;
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

        if (Object.entries(ArbitrageExecution.attemptedPositions).find(([executionTime, id]) => id === calculated.id && executionTime > Util.millisecondsSince(CONFIG.EXECUTION.THRESHOLD.AGE))) {
            logger.execution.trace(`Blocking execution to avoid double executing the same position`);
            return false;
        }
        if (ArbitrageExecution.getAttemptedPositionsCountInLastSecond() > 1) {
            logger.execution.trace(`Blocking execution because ${ArbitrageExecution.getAttemptedPositionsCountInLastSecond()} positions have already been attempted in the last second`);
            return false;
        }
        if (CONFIG.EXECUTION.CAP && ArbitrageExecution.getAttemptedPositionsCount() >= CONFIG.EXECUTION.CAP) {
            logger.execution.trace(`Blocking execution because ${ArbitrageExecution.getAttemptedPositionsCount()} executions have been attempted`);
            return false;
        }

        return true;
    },

    getAttemptedPositionsCount() {
        return Object.keys(ArbitrageExecution.attemptedPositions).length;
    },

    getAttemptedPositionsCountInLastSecond() {
        const timeFloor = Date.now() - 1000;
        return Object.keys(ArbitrageExecution.attemptedPositions).filter(time => time > timeFloor).length;
    },

    getExecutionStrategy() {
        switch (CONFIG.EXECUTION.STRATEGY) {
            case 'parallel':
                return ArbitrageExecution.parallelExecutionStrategy;
            default:
                return ArbitrageExecution.linearExecutionStrategy;
        }
    },

    parallelExecutionStrategy(calculated) {
        return Promise.all([
            BinanceApi.marketBuyOrSell(calculated.trade.ab.method)(calculated.trade.ab.ticker, calculated.ab.quantity),
            BinanceApi.marketBuyOrSell(calculated.trade.bc.method)(calculated.trade.bc.ticker, calculated.bc.quantity),
            BinanceApi.marketBuyOrSell(calculated.trade.ca.method)(calculated.trade.ca.ticker, calculated.ca.quantity)
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
                    fees: 0
                };

                if (resultsAB.orderId && resultsBC.orderId && resultsCA.orderId) {
                    [actual.a.spent, actual.b.earned, fees] = ArbitrageExecution.parseActualResults(calculated.trade.ab.method, resultsAB);
                    actual.fees += fees;

                    [actual.b.spent, actual.c.earned, fees] = ArbitrageExecution.parseActualResults(calculated.trade.bc.method, resultsBC);
                    actual.fees += fees;

                    [actual.c.spent, actual.a.earned, fees] = ArbitrageExecution.parseActualResults(calculated.trade.ca.method, resultsCA);
                    actual.fees += fees;

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
            fees: 0
        };
        let recalculated = {
            bc: calculated.bc.quantity,
            ca: calculated.ca.quantity
        };

        return BinanceApi.marketBuyOrSell(calculated.trade.ab.method)(calculated.trade.ab.ticker, calculated.ab.quantity)
            .then((results) => {
                if (results.orderId) {
                    [actual.a.spent, actual.b.earned, fees] = ArbitrageExecution.parseActualResults(calculated.trade.ab.method, results);
                    actual.fees += fees;
                    recalculated.bc = CalculationNode.recalculateTradeLeg(calculated.trade.bc, actual.b.earned, BinanceApi.getDepthCacheSorted(calculated.trade.bc.ticker));
                }
                return BinanceApi.marketBuyOrSell(calculated.trade.bc.method)(calculated.trade.bc.ticker, recalculated.bc);
            })
            .then((results) => {
                if (results.orderId) {
                    [actual.b.spent, actual.c.earned, fees] = ArbitrageExecution.parseActualResults(calculated.trade.bc.method, results);
                    actual.fees += fees;
                    recalculated.ca = CalculationNode.recalculateTradeLeg(calculated.trade.ca, actual.c.earned, BinanceApi.getDepthCacheSorted(calculated.trade.ca.ticker));
                }
                return BinanceApi.marketBuyOrSell(calculated.trade.ca.method)(calculated.trade.ca.ticker, recalculated.ca);
            })
            .then((results) => {
                if (results.orderId) {
                    [actual.c.spent, actual.a.earned, fees] = ArbitrageExecution.parseActualResults(calculated.trade.ca.method, results);
                    actual.fees += fees;
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

    parseActualResults(method, { executedQty, cummulativeQuoteQty, fills }) {
        const spent = method === 'BUY' ? parseFloat(cummulativeQuoteQty) : parseFloat(executedQty);
        const earned = method === 'SELL' ? parseFloat(cummulativeQuoteQty) : parseFloat(executedQty);
        const fees = fills
            .filter(fill => fill.commissionAsset === 'BNB')
            .reduce((total, fill) => total + parseFloat(fill.commission), 0);
        return [spent, earned, fees];
    }

};

module.exports = ArbitrageExecution;
