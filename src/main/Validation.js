const logger = require('./Loggers');

const Validation = {

    configuration(CONFIG) {
        console.log(`Checking configuration ...`);

        const VALID_VALUES = {
            TRADING: {
                EXECUTION_STRATEGY: ['linear', 'parallel'],
                EXECUTION_TEMPLATE: ['BUY', 'SELL', null],
                SCAN_METHOD: ['schedule', 'callback']
            },
            DEPTH: {
                SIZE: [5, 10, 20, 50, 100, 500]
            },
            LOG: {
                LEVEL: ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']
            }
        };

        if (CONFIG.INVESTMENT.MIN <= 0) {
            const msg = `INVESTMENT.MIN must be a positive value`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.INVESTMENT.STEP <= 0) {
            const msg = `INVESTMENT.STEP must be a positive value`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.INVESTMENT.MIN > CONFIG.INVESTMENT.MAX) {
            const msg = `INVESTMENT.MIN cannot be greater than INVESTMENT.MAX`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if ((CONFIG.INVESTMENT.MIN !== CONFIG.INVESTMENT.MAX) && (CONFIG.INVESTMENT.MAX - CONFIG.INVESTMENT.MIN) / CONFIG.INVESTMENT.STEP < 1) {
            const msg = `Not enough steps between INVESTMENT.MIN and INVESTMENT.MAX using step size of ${CONFIG.INVESTMENT.STEP}`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.TRADING.WHITELIST.some(sym => sym !== sym.toUpperCase())) {
            const msg = `Whitelist symbols must all be uppercase`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.TRADING.WHITELIST.length > 0 && !CONFIG.TRADING.WHITELIST.includes(CONFIG.INVESTMENT.BASE)) {
            const msg = `Whitelist must include the base symbol of ${CONFIG.INVESTMENT.BASE}`;
            logger.execution.debug(`Whitelist: [${CONFIG.TRADING.WHITELIST}]`);
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.TRADING.EXECUTION_STRATEGY === 'parallel' && CONFIG.TRADING.WHITELIST.length === 0) {
            const msg = `Parallel execution requires defining a whitelist`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (!VALID_VALUES.TRADING.EXECUTION_STRATEGY.includes(CONFIG.TRADING.EXECUTION_STRATEGY)) {
            const msg = `${CONFIG.TRADING.EXECUTION_STRATEGY} is an invalid execution strategy`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (!CONFIG.TRADING.EXECUTION_TEMPLATE.every(template => VALID_VALUES.TRADING.EXECUTION_TEMPLATE.includes(template))) {
            const msg = `${CONFIG.TRADING.EXECUTION_TEMPLATE} is an invalid execution template`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (!VALID_VALUES.TRADING.SCAN_METHOD.includes(CONFIG.TRADING.SCAN_METHOD)) {
            const msg = `Scan method can only contain one of the following values: ${VALID_VALUES.TRADING.SCAN_METHOD}`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.TRADING.TAKER_FEE < 0) {
            const msg = `Taker fee (${CONFIG.TRADING.TAKER_FEE}) must be a positive value`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.HUD.REFRESH_RATE <= 0) {
            const msg = `HUD refresh rate (${CONFIG.HUD.REFRESH_RATE}) must be a positive value`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.DEPTH.SIZE > 100 && CONFIG.TRADING.WHITELIST.length === 0) {
            const msg = `Using a depth size higher than 100 requires defining a whitelist`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (!VALID_VALUES.DEPTH.SIZE.includes(CONFIG.DEPTH.SIZE)) {
            const msg = `Depth size can only contain one of the following values: ${VALID_VALUES.DEPTH.SIZE}`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (!VALID_VALUES.LOG.LEVEL.includes(CONFIG.LOG.LEVEL)) {
            const msg = `Log level can only contain one of the following values: ${VALID_VALUES.LOG.LEVEL}`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (isNaN(CONFIG.WEBSOCKETS.BUNDLE_SIZE) || CONFIG.WEBSOCKETS.BUNDLE_SIZE <= 0) {
            const msg = `Websocket bundle size (${CONFIG.WEBSOCKETS.BUNDLE_SIZE}) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (isNaN(CONFIG.WEBSOCKETS.INITIALIZATION_INTERVAL) || CONFIG.WEBSOCKETS.INITIALIZATION_INTERVAL < 0) {
            const msg = `Websocket initialization interval (${CONFIG.WEBSOCKETS.INITIALIZATION_INTERVAL}) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.TIMING.RECEIVE_WINDOW > 60000) {
            const msg = `Receive window (${CONFIG.TIMING.RECEIVE_WINDOW}) must be less than 60000`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.TIMING.RECEIVE_WINDOW <= 0) {
            const msg = `Receive window (${CONFIG.TIMING.RECEIVE_WINDOW}) must be a positive value`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.TIMING.CALCULATION_COOLDOWN <= 0) {
            const msg = `Calculation cooldown (${CONFIG.TIMING.CALCULATION_COOLDOWN}) must be a positive value`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.TIMING.STATUS_UPDATE_INTERVAL <= 0) {
            const msg = `Status update interval (${CONFIG.TIMING.STATUS_UPDATE_INTERVAL}) must be a positive value`;
            logger.execution.error(msg);
            throw new Error(msg);
        }

        return Promise.resolve();
    }

};

module.exports = Validation;