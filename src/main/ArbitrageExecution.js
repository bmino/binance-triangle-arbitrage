const CONFIG = require('../../config/config');
const logger = require('./Loggers');
const BinanceApi = require('./BinanceApi');
const CalculationNode = require('./CalculationNode');

const ArbitrageExecution = {

    inProgressIds: new Set(),
    inProgressSymbols: new Set(),
    attemptedPositions: {},

    executeCalculatedPosition(calculated) {
        const startTime = Date.now();

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

        return ArbitrageExecution.getExecutionStrategy()(calculated)
            .then((actual) => {
                logger.execution.info(`${CONFIG.TRADING.ENABLED ? 'Executed' : 'Test: Executed'} ${calculated.id} position in ${Date.now() - startTime} ms`);

                // Results are only collected when a trade is executed
                if (!CONFIG.TRADING.ENABLED) return;

                const calculateVariation = (calculatedFrom, calculatedTo, actualFrom, actualTo) => {
                    const calculatedPrice = calculatedFrom.spent / calculatedTo.earned;
                    const actualPrice = actualFrom.spent / actualTo.earned;
                    return (actualPrice - calculatedPrice) / calculatedPrice * 100;
                };

                const variation = {
                    ab: calculateVariation(calculated.a, calculated.b, actual.a, actual.b),
                    bc: calculateVariation(calculated.b, calculated.c, actual.b, actual.c),
                    ca: calculateVariation(calculated.c, calculated.a, actual.c, actual.a)
                };

                logger.execution.debug(`${calculated.trade.ab.ticker} Stats:`);
                logger.execution.debug(`Expected Conversion:  ${calculated.a.spent.toFixed(8)} ${symbol.a} into ${calculated.b.earned.toFixed(8)} ${symbol.b}`);
                logger.execution.debug(`Observed Conversion:  ${actual.a.spent.toFixed(8)} ${symbol.a} into ${actual.b.earned.toFixed(8)} ${symbol.b}`);
                logger.execution.debug(`Price Error:          ${variation.ab.toFixed(8)}%`);
                logger.execution.debug();
                logger.execution.debug(`${calculated.trade.bc.ticker} Stats:`);
                logger.execution.debug(`BC Expected Conversion:  ${calculated.b.spent.toFixed(8)} ${symbol.b} into ${calculated.c.earned.toFixed(8)} ${symbol.c}`);
                logger.execution.debug(`BC Observed Conversion:  ${actual.b.spent.toFixed(8)} ${symbol.b} into ${actual.c.earned.toFixed(8)} ${symbol.c}`);
                logger.execution.debug(`BC Price Error:          ${variation.bc.toFixed(8)}%`);
                logger.execution.debug();
                logger.execution.debug(`${calculated.trade.ca.ticker} Stats:`);
                logger.execution.debug(`Expected Conversion:  ${calculated.c.spent.toFixed(8)} ${symbol.c} into ${calculated.a.earned.toFixed(8)} ${symbol.a}`);
                logger.execution.debug(`Observed Conversion:  ${actual.c.spent.toFixed(8)} ${symbol.c} into ${actual.a.earned.toFixed(8)} ${symbol.a}`);
                logger.execution.debug(`Price Error:          ${variation.ca.toFixed(8)}%`);

                logger.execution.trace(`Depth cache used for calculation:`);
                logger.execution.trace(calculated.depth);

                const percent = {
                    a: actual.a.delta / actual.a.spent * 100,
                    b: actual.b.delta / actual.b.spent * 100,
                    c: actual.c.delta / actual.c.spent * 100
                };

                logger.execution.info();
                logger.execution.info(`${symbol.a} delta:\t  ${actual.a.delta < 0 ? '' : ' '}${actual.a.delta.toFixed(8)} (${percent.a < 0 ? '' : ' '}${percent.a.toFixed(4)}%)`);
                logger.execution.info(`${symbol.b} delta:\t  ${actual.b.delta < 0 ? '' : ' '}${actual.b.delta.toFixed(8)} (${percent.b < 0 ? '' : ' '}${percent.b.toFixed(4)}%)`);
                logger.execution.info(`${symbol.c} delta:\t  ${actual.c.delta < 0 ? '' : ' '}${actual.c.delta.toFixed(8)} (${percent.c < 0 ? '' : ' '}${percent.c.toFixed(4)}%)`);
                logger.execution.info(`BNB commission:  ${(-1 * actual.fees).toFixed(8)}`);
                logger.execution.info();
            })
            .catch((err) => logger.execution.error(err.message))
            .then(() => {
                ArbitrageExecution.inProgressIds.delete(calculated.id);
                ArbitrageExecution.inProgressSymbols.delete(symbol.a);
                ArbitrageExecution.inProgressSymbols.delete(symbol.b);
                ArbitrageExecution.inProgressSymbols.delete(symbol.c);

                if (CONFIG.TRADING.EXECUTION_CAP && ArbitrageExecution.inProgressIds.size === 0 && ArbitrageExecution.getAttemptedPositionsCount() >= CONFIG.TRADING.EXECUTION_CAP) {
                    logger.execution.info(`Cannot exceed user defined execution cap of ${CONFIG.TRADING.EXECUTION_CAP} executions`);
                    process.exit();
                }
            });
    },

    isSafeToExecute(calculated) {
        const now = Date.now();
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

    getAttemptedPositionsCount() {
        return Object.keys(ArbitrageExecution.attemptedPositions).length;
    },

    getAttemptedPositionsCountInLastSecond() {
        const timeFloor = Date.now() - 1000;
        return Object.keys(ArbitrageExecution.attemptedPositions).filter(time => time > timeFloor).length;
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
            bc: calculated.bc,
            ca: calculated.ca
        };

        return BinanceApi.marketBuyOrSell(calculated.trade.ab.method)(calculated.trade.ab.ticker, calculated.ab)
            .then((results) => {
                if (results.orderId) {
                    [actual.a.spent, actual.b.earned, fees] = ArbitrageExecution.parseActualResults(calculated.trade.ab.method, results);
                    actual.fees += fees;
                    recalculated.bc = CalculationNode.recalculateTradeLeg(calculated.trade.bc, actual.b.earned, BinanceApi.depthCache(calculated.trade.bc.ticker));
                }
                return BinanceApi.marketBuyOrSell(calculated.trade.bc.method)(calculated.trade.bc.ticker, recalculated.bc);
            })
            .then((results) => {
                if (results.orderId) {
                    [actual.b.spent, actual.c.earned, fees] = ArbitrageExecution.parseActualResults(calculated.trade.bc.method, results);
                    actual.fees += fees;
                    recalculated.ca = CalculationNode.recalculateTradeLeg(calculated.trade.ca, actual.c.earned, BinanceApi.depthCache(calculated.trade.ca.ticker));
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
        const spent = method.toUpperCase() === 'BUY' ? parseFloat(cummulativeQuoteQty) : parseFloat(executedQty);
        const earned = method.toUpperCase() === 'SELL' ? parseFloat(cummulativeQuoteQty) : parseFloat(executedQty);
        const fees = fills
            .filter(fill => fill.commissionAsset === 'BNB')
            .map(fill => parseFloat(fill.commission))
            .reduce((total, fee) => total + fee, 0);
        return [spent, earned, fees];
    }

};

module.exports = ArbitrageExecution;
