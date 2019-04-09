const CONFIG = require('../../config/config');
const logger = require('./Loggers');
const BinanceApi = require('./BinanceApi');
const _ = require ('lodash');
const uuidv4 = require('uuid/v4');

const ArbitrageExecution = {

    inProgressIds: new Set(),
    inProgressSymbols: new Set(),
    orderHistory: {},
    balances: {},

    executeCalculatedPosition(calculated) {
        if (!ArbitrageExecution.isSafeToExecute(calculated)) return false;

        // Register trade id as being executed
        ArbitrageExecution.inProgressIds.add(calculated.id);
        ArbitrageExecution.inProgressSymbols.add(calculated.trade.symbol.a);
        ArbitrageExecution.inProgressSymbols.add(calculated.trade.symbol.b);
        ArbitrageExecution.inProgressSymbols.add(calculated.trade.symbol.c);

        const before = new Date().getTime();
        const initialBalances = _.cloneDeep(ArbitrageExecution.balances);

        return ArbitrageExecution.execute(calculated)
            .then(results => {
                logger.execution.info(`${CONFIG.TRADING.ENABLED ? 'Executed' : 'Test: Executed'} ${calculated.id} position in ${new Date().getTime() - before} ms`);
                logger.execution.trace({trade: calculated});
            })
            .catch(err => {
                logger.execution.error(err.message);
            })
            .then(ArbitrageExecution.refreshBalances)
            .then((newBalances) => {
                const deltas = ArbitrageExecution.compareBalances(initialBalances, newBalances);
                Object.entries(deltas).forEach(([symbol, delta]) => {
                    // Padding to horizontally align positive and negative deltas
                    const pad = delta > 0 ? ' ' : '';
                    logger.execution.info(`${symbol} delta: ${pad}${delta.toFixed(8)}`);
                });
            })
            .then(() => {
                ArbitrageExecution.inProgressIds.delete(calculated.id);
                ArbitrageExecution.inProgressSymbols.delete(calculated.trade.symbol.a);
                ArbitrageExecution.inProgressSymbols.delete(calculated.trade.symbol.b);
                ArbitrageExecution.inProgressSymbols.delete(calculated.trade.symbol.c);

                if (CONFIG.TRADING.EXECUTION_CAP && ArbitrageExecution.inProgressIds.size === 0 && ArbitrageExecution.getExecutionAttemptCount() >= CONFIG.TRADING.EXECUTION_CAP) {
                    logger.execution.error(`Cannot exceed user defined execution cap of ${CONFIG.TRADING.EXECUTION_CAP} executions`);
                    process.exit();
                }
            });
    },

    isSafeToExecute(calculated) {
        const SECONDS_IN_ONE_DAY = 60 * 60 * 24;

        // Profit Threshold is Not Satisfied
        if (calculated.percent < CONFIG.TRADING.PROFIT_THRESHOLD) return false;

        // Age Threshold is Not Satisfied
        const ageInMilliseconds = new Date().getTime() - Math.min(calculated.times.ab, calculated.times.bc, calculated.times.ca);
        if (ageInMilliseconds > CONFIG.TRADING.AGE_THRESHOLD) return false;

        if (CONFIG.TRADING.EXECUTION_CAP && ArbitrageExecution.getExecutionAttemptCount() >= CONFIG.TRADING.EXECUTION_CAP) {
            logger.execution.trace(`Blocking execution because ${ArbitrageExecution.getExecutionAttemptCount()} executions have been attempted`);
            return false;
        }
        if (ArbitrageExecution.inProgressIds.has(calculated.id)) {
            logger.execution.trace(`Blocking execution because ${calculated.id} is currently being executed`);
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
        if (ArbitrageExecution.executedTradesInLastXSeconds(SECONDS_IN_ONE_DAY) > 10000) {
            logger.execution.trace(`Blocking execution because ${ArbitrageExecution.executedTradesInLastXSeconds(SECONDS_IN_ONE_DAY)} trades have been completed in the past 24 hours`);
            return false;
        }
        if (ArbitrageExecution.executedTradesInLastXSeconds(10) >= 7) {
            logger.execution.trace(`Blocking execution because ${ArbitrageExecution.executedTradesInLastXSeconds(10)} trades have been completed in the last 10 seconds`);
            return false;
        }
        if (ArbitrageExecution.executedTradesInLastXSeconds(1) >= 9) {
            logger.execution.trace(`Blocking execution because ${ArbitrageExecution.executedTradesInLastXSeconds(1)} trades have been completed in the last 1 seconds`);
            return false;
        }

        return true;
    },

    refreshBalances() {
        return BinanceApi.getBalances()
            .then(balances => ArbitrageExecution.balances = balances);
    },

    compareBalances(b1, b2, symbols = [...Object.keys(b1), ...Object.keys(b2)]) {
        let differences = {};
        new Set(symbols).forEach(symbol => {
            const before = b1[symbol] ? b1[symbol].available : 0;
            const after = b2[symbol] ? b2[symbol].available : 0;
            const difference = after - before;
            if (difference === 0) return;
            differences[symbol] = difference;
        });
        return differences;
    },

    executedTradesInLastXSeconds(seconds) {
        const timeFloor = new Date().getTime() - (seconds * 1000);
        return Object.values(ArbitrageExecution.orderHistory).filter(time => time > timeFloor).length * 3;
    },

    getExecutionAttemptCount() {
        return Object.keys(ArbitrageExecution.orderHistory).length;
    },

    execute(calculated) {
        const uuid = uuidv4();
        ArbitrageExecution.orderHistory[uuid] = new Date().getTime();
        return ArbitrageExecution.getExecutionStrategy()(calculated)
            .then(() => ArbitrageExecution.orderHistory[uuid] = new Date().getTime());
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
        ]);
    },

    linearExecutionStrategy(calculated) {
        return BinanceApi.marketBuyOrSell(calculated.trade.ab.method)(calculated.trade.ab.ticker, calculated.ab)
            .then(() => BinanceApi.marketBuyOrSell(calculated.trade.bc.method)(calculated.trade.bc.ticker, calculated.bc))
            .then(() => BinanceApi.marketBuyOrSell(calculated.trade.ca.method)(calculated.trade.ca.ticker, calculated.ca));
    }

};

module.exports = ArbitrageExecution;
