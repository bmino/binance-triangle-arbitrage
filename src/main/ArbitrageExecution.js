const CONFIG = require('../../config/live.config');
const logger = require('./Loggers');

let ArbitrageExecution = {

    executeCalculatedPosition(calculated) {
        const oldestUpdateTime = Math.min(calculated.times.ab, calculated.times.bc, calculated.times.ca);

        if (calculated.percent < CONFIG.TRADING.PROFIT_THRESHOLD) return false;
        if (oldestUpdateTime > CONFIG.TRADING.AGE_THRESHOLD) return false;

        if (!CONFIG.TRADING.ENABLED) {
            // Would trade if switch was enabled
            logger.research.info(`${calculated.id}: ${calculated.percent.toFixed(3)}% - aged ${((new Date().getTime() - oldestUpdateTime)/1000).toFixed(2)} seconds`);
            return false;
        }

        // TODO: Execute arbitrage position
        // TODO: Calculate profit
        // TODO: Log results

    }

};

module.exports = ArbitrageExecution;
