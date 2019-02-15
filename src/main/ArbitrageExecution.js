const CONFIG = require('../../config/config');
const logger = require('./Loggers');
const BinanceApi = require('./BinanceApi');
const _ = require ('lodash');

module.exports = {

    inProgressIds: new Set(),
    orderHistory: {},
    balances: {},

    executeCalculatedPosition(calculated) {
        // Register trade id as being executed
        this.inProgressIds.add(calculated.id);
        this.orderHistory[calculated.id] = new Date().getTime();

        const before = new Date().getTime();
        const initialBalances = _.cloneDeep(this.balances);

        return this.execute(calculated)
            .then(results => {
                logger.execution.info(`${CONFIG.TRADING.ENABLED ? 'Executed' : 'Test: Executed'} ${calculated.id} position in ${new Date().getTime() - before} ms`);
                logger.execution.debug({trade: calculated});
            })
            .catch(err => {
                logger.execution.error(err.message);
            })
            .then(this.refreshBalances)
            .then((newBalances) => {
                const deltas = this.compareBalances(initialBalances, newBalances);
                Object.entries(deltas).forEach(([symbol, delta]) => {
                    logger.execution.info(`${symbol} delta: ${delta}`);
                });
            })
            .then(() => {
                this.inProgressIds.delete(calculated.id);
            });
    },

    isSafeToExecute(calculated) {
        if (calculated.percent < CONFIG.TRADING.PROFIT_THRESHOLD) return false;

        const ageInMilliseconds = new Date().getTime() - Math.min(calculated.times.ab, calculated.times.bc, calculated.times.ca);
        if (ageInMilliseconds > CONFIG.TRADING.AGE_THRESHOLD) return false;

        if (CONFIG.TRADING.EXECUTION_CAP && Object.keys(this.orderHistory).length >= CONFIG.TRADING.EXECUTION_CAP && this.inProgressIds.size === 0) {
            const msg = `Cannot exceed execution cap of ${CONFIG.TRADING.EXECUTION_CAP} execution`;
            logger.execution.error(msg);
            process.exit();
        }
        if (CONFIG.TRADING.EXECUTION_CAP && Object.keys(this.orderHistory).length >= CONFIG.TRADING.EXECUTION_CAP) {
            logger.execution.trace(`Blocking execution because ${Object.keys(this.orderHistory).length}/${CONFIG.TRADING.EXECUTION_CAP} executions have been attempted`);
            return false;
        }
        if (this.inProgressIds.has(calculated.id)) {
            logger.execution.trace(`Blocking execution because ${calculated.id} is already being executed`);
            return false;
        }
        if (this.tradesInXSeconds(10) >= 3) {
            logger.execution.trace(`Blocking execution because ${this.tradesInXSeconds(10)} trades have already been executed in the last 10 seconds`);
            return false;
        }

        return true;
    },

    refreshBalances() {
        return BinanceApi.getBalances()
            .then(balances => this.balances = balances);
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

    tradesInXSeconds(seconds) {
        const timeFloor = new Date().getTime() - (seconds * 1000);
        return Object.values(this.orderHistory).filter(time => time > timeFloor).length;
    },

    execute(calculated) {
        return this.getExecutionStrategy()(calculated);
    },

    getExecutionStrategy() {
        switch (CONFIG.TRADING.EXECUTION_STRATEGY.toLowerCase()) {
            case 'parallel':
                return this.parallelExecutionStrategy;
            default:
                return this.linearExecutionStrategy;
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
