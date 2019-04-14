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

        const { times } = calculated;
        const { symbol } = calculated.trade;

        if (!ArbitrageExecution.isSafeToExecute(calculated)) return false;

        // Register position as being attempted
        ArbitrageExecution.attemptedPositions[startTime] = calculated.id;
        ArbitrageExecution.inProgressIds.add(calculated.id);
        ArbitrageExecution.inProgressSymbols.add(symbol.a);
        ArbitrageExecution.inProgressSymbols.add(symbol.b);
        ArbitrageExecution.inProgressSymbols.add(symbol.c);

        logger.execution.info(`Attempting to execute ${calculated.id} with an age of ${(startTime - Math.min(times.ab, times.bc, times.ca)).toFixed(0)} ms and expected profit of ${calculated.percent.toFixed(4)}%`);

        return ArbitrageExecution.execute(calculated)
            .then((actual) => {
                logger.execution.info(`${CONFIG.TRADING.ENABLED ? 'Executed' : 'Test: Executed'} ${calculated.id} position in ${new Date().getTime() - startTime} ms`);

                // Results are only collected when a trade is executed
                if (!CONFIG.TRADING.ENABLED) return;

                logger.execution.debug();
                logger.execution.debug(`AB Expected Conversion:  ${calculated.start.toFixed(8)} ${symbol.a} into ${calculated.b.toFixed(8)} ${symbol.b}`);
                logger.execution.debug(`AB Observed Conversion:  ${actual.a.spent.toFixed(8)} ${symbol.a} into ${actual.b.earned.toFixed(8)} ${symbol.b}`);
                logger.execution.debug();
                logger.execution.debug(`BC Expected Conversion:  ${calculated.b.toFixed(8)} ${symbol.b} into ${calculated.c.toFixed(8)} ${symbol.c}`);
                logger.execution.debug(`BC Observed Conversion:  ${actual.b.spent.toFixed(8)} ${symbol.b} into ${actual.c.earned.toFixed(8)} ${symbol.c}`);
                logger.execution.debug();
                logger.execution.debug(`CA Expected Conversion:  ${calculated.c.toFixed(8)} ${symbol.c} into ${calculated.a.toFixed(8)} ${symbol.a}`);
                logger.execution.debug(`CA Observed Conversion:  ${actual.c.spent.toFixed(8)} ${symbol.c} into ${actual.a.earned.toFixed(8)} ${symbol.a}`);
                logger.execution.debug();

                const delta = {
                    a: actual.a.earned - actual.a.spent,
                    b: actual.b.earned - actual.b.spent,
                    c: actual.c.earned - actual.c.spent
                };
                const percent = {
                    a: delta.a / actual.a.spent * 100,
                    b: delta.b / actual.b.spent * 100,
                    c: delta.c / actual.c.spent * 100
                };

                logger.execution.info(`${symbol.a} delta:\t  ${delta.a < 0 ? '' : ' '}${delta.a.toFixed(8)} (${percent.a < 0 ? '' : ' '}${percent.a.toFixed(4)}%)`);
                logger.execution.info(`${symbol.b} delta:\t  ${delta.b < 0 ? '' : ' '}${delta.b.toFixed(8)} (${percent.b < 0 ? '' : ' '}${percent.b.toFixed(4)}%)`);
                logger.execution.info(`${symbol.c} delta:\t  ${delta.c < 0 ? '' : ' '}${delta.c.toFixed(8)} (${percent.c < 0 ? '' : ' '}${percent.c.toFixed(4)}%)`);
                logger.execution.info(`BNB commission: ${(-1 * actual.fees).toFixed(8)}`);
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
        // Profit Threshold is Not Satisfied
        if (calculated.percent < CONFIG.TRADING.PROFIT_THRESHOLD) return false;

        // Age Threshold is Not Satisfied
        const ageInMilliseconds = new Date().getTime() - Math.min(calculated.times.ab, calculated.times.bc, calculated.times.ca);
        if (ageInMilliseconds > CONFIG.TRADING.AGE_THRESHOLD) return false;

        if (CONFIG.TRADING.EXECUTION_CAP && ArbitrageExecution.getAttemptedPositionsCount() >= CONFIG.TRADING.EXECUTION_CAP) {
            logger.execution.trace(`Blocking execution because ${ArbitrageExecution.getAttemptedPositionsCount()} executions have been attempted`);
            return false;
        }
        if (ArbitrageExecution.inProgressSymbols.has(calculated.trade.symbol.a)) {
            logger.execution.trace(`Blocking execution because ${calculated.trade.symbol.a} is currently involved in an execution`);
            return false;
        }
        if (ArbitrageExecution.inProgressSymbols.has(calculated.trade.symbol.b)) {
            logger.execution.trace(`Blocking execution because ${calculated.trade.symbol.b} is currently involved in an execution`);
            return false;
        }
        if (ArbitrageExecution.inProgressSymbols.has(calculated.trade.symbol.c)) {
            logger.execution.trace(`Blocking execution because ${calculated.trade.symbol.c} is currently involved in an execution`);
            return false;
        }
        if (ArbitrageExecution.getAttemptedPositionsCountInLastSecond() > 1) {
            logger.execution.trace(`Blocking execution because ${ArbitrageExecution.getAttemptedPositionsCountInLastSecond()} position has already been attempted in the last second`);
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
                    fees: 0
                };

                if (resultsAB.orderId && resultsBC.orderId && resultsCA.orderId) {
                    actual.a.spent = calculated.trade.ab.method.toUpperCase() === 'BUY' ? parseFloat(resultsAB.cummulativeQuoteQty) : parseFloat(resultsAB.executedQty);
                    actual.b.earned = calculated.trade.ab.method.toUpperCase() === 'SELL' ? parseFloat(resultsAB.cummulativeQuoteQty) : parseFloat(resultsAB.executedQty);
                    actual.fees += ArbitrageExecution.aggregateFees(resultsAB.fills, 'BNB');

                    actual.b.spent = calculated.trade.bc.method.toUpperCase() === 'BUY' ? parseFloat(resultsBC.cummulativeQuoteQty) : parseFloat(resultsBC.executedQty);
                    actual.c.earned = calculated.trade.bc.method.toUpperCase() === 'SELL' ? parseFloat(resultsBC.cummulativeQuoteQty) : parseFloat(resultsBC.executedQty);
                    actual.fees += ArbitrageExecution.aggregateFees(resultsBC.fills, 'BNB');

                    actual.c.spent = calculated.trade.ca.method.toUpperCase() === 'BUY' ? parseFloat(resultsCA.cummulativeQuoteQty) : parseFloat(resultsCA.executedQty);
                    actual.a.earned = calculated.trade.ca.method.toUpperCase() === 'SELL' ? parseFloat(resultsCA.cummulativeQuoteQty) : parseFloat(resultsCA.executedQty);
                    actual.fees += ArbitrageExecution.aggregateFees(resultsCA.fills, 'BNB');
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
            .then(({ executedQty, cummulativeQuoteQty, fills, orderId }) => {
                if (orderId) {
                    actual.a.spent = calculated.trade.ab.method.toUpperCase() === 'BUY' ? parseFloat(cummulativeQuoteQty) : parseFloat(executedQty);
                    actual.b.earned = calculated.trade.ab.method.toUpperCase() === 'SELL' ? parseFloat(cummulativeQuoteQty) : parseFloat(executedQty);
                    actual.fees += ArbitrageExecution.aggregateFees(fills, 'BNB');
                    recalculated.bc = CalculationNode.recalculateTradeLeg(calculated.trade.bc, actual.b.earned);
                }
                return BinanceApi.marketBuyOrSell(calculated.trade.bc.method)(calculated.trade.bc.ticker, recalculated.bc);
            })
            .then(({ executedQty, cummulativeQuoteQty, fills, orderId }) => {
                if (orderId) {
                    actual.b.spent = calculated.trade.bc.method.toUpperCase() === 'BUY' ? parseFloat(cummulativeQuoteQty) : parseFloat(executedQty);
                    actual.c.earned = calculated.trade.bc.method.toUpperCase() === 'SELL' ? parseFloat(cummulativeQuoteQty) : parseFloat(executedQty);
                    actual.fees += ArbitrageExecution.aggregateFees(fills, 'BNB');
                    recalculated.ca = CalculationNode.recalculateTradeLeg(calculated.trade.ca, actual.c.earned);
                }
                return BinanceApi.marketBuyOrSell(calculated.trade.ca.method)(calculated.trade.ca.ticker, recalculated.ca);
            })
            .then(({ executedQty, cummulativeQuoteQty, fills, orderId }) => {
                if (orderId) {
                    actual.c.spent = calculated.trade.ca.method.toUpperCase() === 'BUY' ? parseFloat(cummulativeQuoteQty) : parseFloat(executedQty);
                    actual.a.earned = calculated.trade.ca.method.toUpperCase() === 'SELL' ? parseFloat(cummulativeQuoteQty) : parseFloat(executedQty);
                    actual.fees += ArbitrageExecution.aggregateFees(fills, 'BNB');
                }
                return actual;
            });
    },

    aggregateFees(fills, quoteAsset = 'BNB') {
        return fills.filter(f => f.commissionAsset === quoteAsset).map(f => parseFloat(f.commission)).reduce((total, fee) => total + fee, 0);
    }

};

module.exports = ArbitrageExecution;
