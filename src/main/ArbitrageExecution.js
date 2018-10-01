const CONFIG = require('../../config/config');
const logger = require('./Loggers');
const BinanceApi = require('./BinanceApi');

let ArbitrageExecution = {
    inProgressIds: new Set(),
    orderHistory: {},
    balances: {},

    executeCalculatedPosition(calculated) {
        const ageInMilliseconds = new Date().getTime() - Math.min(calculated.times.ab, calculated.times.bc, calculated.times.ca);

        if (calculated.percent < CONFIG.TRADING.PROFIT_THRESHOLD) return false;
        if (ageInMilliseconds > CONFIG.TRADING.AGE_THRESHOLD) return false;
        if (ArbitrageExecution.inProgressIds.has(calculated.id)) return false;
        if (ArbitrageExecution.tradesInXSeconds(10) >= 3) return false;

        if (!CONFIG.TRADING.ENABLED) {
            // Would trade if switch was enabled
            logger.research.info(`${calculated.id}: ${calculated.percent.toFixed(3)}% - aged ${ageInMilliseconds.toFixed(2)} seconds`);
            return false;
        }

        ArbitrageExecution.inProgressIds.add(calculated.id);
        ArbitrageExecution.orderHistory[calculated.id] = new Date().getTime();

        let before = new Date().getTime();
        return Promise.all([
            marketBuyOrSell(calculated.trade.ab.method)(calculated.trade.ab.ticker, calculated.ab.market),
            marketBuyOrSell(calculated.trade.bc.method)(calculated.trade.bc.ticker, calculated.bc.market),
            marketBuyOrSell(calculated.trade.ca.method)(calculated.trade.ca.ticker, calculated.ca.market)
        ])
            .then(results => {
                // TODO: Calculate profit
                console.log(`Executed ${calculated.id} position in ${new Date().getTime() - before} ms`);
            })
            .catch(console.error)
            .then(() => {
                ArbitrageExecution.inProgressIds.delete(calculated.id);
                return ArbitrageExecution.refreshBalances();
            });
    },

    refreshBalances() {
        return BinanceApi.getBalances()
            .then(balances => {
                return ArbitrageExecution.balances = balances;
            })
            .catch(console.error);
    },

    mostRecentTradeTime() {
        return Object.values(ArbitrageExecution.orderHistory).reduce((a,b) => Math.max(a,b), 0);
    },

    tradesInXSeconds(seconds) {
        let timeFloor = new Date().getTime() - (seconds * 1000);
        return Object.values(ArbitrageExecution.orderHistory).filter(time => time > timeFloor).length;
    }

};

function marketBuyOrSell(method) {
    return method === 'Buy' ? BinanceApi.marketBuy : BinanceApi.marketSell;
}

module.exports = ArbitrageExecution;
