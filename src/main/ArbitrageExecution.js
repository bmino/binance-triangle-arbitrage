const CONFIG = require('../../config/config');
const logger = require('./Loggers');
const BinanceApi = require('./BinanceApi');

let ArbitrageExecution = {
    inProgressIds: new Set(),
    orderHistory: {},
    balances: {},

    executeCalculatedPosition(calculated) {
        const ageInMilliseconds = new Date().getTime() - Math.min(calculated.times.ab, calculated.times.bc, calculated.times.ca);

        if (Object.keys(ArbitrageExecution.orderHistory).length >= CONFIG.TRADING.EXECUTION_CAP &&
            ArbitrageExecution.inProgressIds.size === 0) {
            const msg = `Cannot exceed execution cap of ${CONFIG.TRADING.EXECUTION_CAP} execution`;
            logger.execution.error(msg);
            process.exit();
        }

        if (Object.keys(ArbitrageExecution.orderHistory).length >= CONFIG.TRADING.EXECUTION_CAP) return false;
        if (calculated.percent < CONFIG.TRADING.PROFIT_THRESHOLD) return false;
        if (ageInMilliseconds > CONFIG.TRADING.AGE_THRESHOLD) return false;
        if (ArbitrageExecution.inProgressIds.has(calculated.id)) return false;
        if (ArbitrageExecution.tradesInXSeconds(10) >= 3) return false;

        // Register trade id as being executed
        ArbitrageExecution.inProgressIds.add(calculated.id);
        ArbitrageExecution.orderHistory[calculated.id] = new Date().getTime();

        const before = new Date().getTime();
        return ArbitrageExecution.getExecutionStrategy()(calculated)
            .then(results => {
                logger.execution.info(`${CONFIG.TRADING.ENABLED ? 'Executed' : 'Test: Executed'} ${calculated.id} position in ${new Date().getTime() - before} ms`);
                logger.execution.debug({trade: calculated});
            })
            .catch(err => {
                logger.execution.error(err.message);
            })
            .then(BinanceApi.getBalances)
            .then(balances => {
                const differences = ArbitrageExecution.compareBalances(ArbitrageExecution.balances, balances);
                Object.keys(differences).forEach(symbol => {
                    logger.execution.info(`${symbol} delta: ${differences[symbol]}`);
                });
                ArbitrageExecution.balances = balances;
            })
            .then(() => {
                ArbitrageExecution.inProgressIds.delete(calculated.id);
            });
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

    mostRecentTradeTime() {
        return Object.values(ArbitrageExecution.orderHistory).reduce((a,b) => Math.max(a,b), 0);
    },

    tradesInXSeconds(seconds) {
        const timeFloor = new Date().getTime() - (seconds * 1000);
        return Object.values(ArbitrageExecution.orderHistory).filter(time => time > timeFloor).length;
    },

    getExecutionStrategy() {
        switch (CONFIG.TRADING.EXECUTION_STRATEGY.toUpperCase()) {
            case 'LINEAR':
                return ArbitrageExecution.linearExecutionStrategy;
            default:
                return ArbitrageExecution.parallelExecutionStrategy;
        }
    },

    parallelExecutionStrategy(calculated) {
        return Promise.all([
            BinanceApi.marketBuyOrSell(calculated.trade.ab.method)(calculated.trade.ab.ticker, calculated.ab.market),
            BinanceApi.marketBuyOrSell(calculated.trade.bc.method)(calculated.trade.bc.ticker, calculated.bc.market),
            BinanceApi.marketBuyOrSell(calculated.trade.ca.method)(calculated.trade.ca.ticker, calculated.ca.market)
        ]);
    },

    linearExecutionStrategy(calculated) {
        return BinanceApi.marketBuyOrSell(calculated.trade.ab.method)(calculated.trade.ab.ticker, calculated.ab.market)
            .then(() => {
                return BinanceApi.marketBuyOrSell(calculated.trade.bc.method)(calculated.trade.bc.ticker, calculated.bc.market);
            })
            .then(() => {
                return BinanceApi.marketBuyOrSell(calculated.trade.ca.method)(calculated.trade.ca.ticker, calculated.ca.market);
            });
    }

};

module.exports = ArbitrageExecution;
