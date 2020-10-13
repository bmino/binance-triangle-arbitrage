const logger = require('./Loggers');

const Validation = {

    SCANNING: {
        DEPTH: [5, 10, 20, 50, 100, 500]
    },
    EXECUTION: {
        STRATEGY: ['linear', 'parallel'],
        TEMPLATE: ['BUY', 'SELL', null]
    },

    configuration(CONFIG) {
        console.log(`Checking configuration ...`);

        if (CONFIG.KEYS.API === '' && CONFIG.EXECUTION.ENABLED) {
            const msg = `Trade executions will fail without an api key (KEY.API)`;
            logger.execution.warn(msg);
        }
        if (CONFIG.KEYS.SECRET === '' && CONFIG.EXECUTION.ENABLED) {
            const msg = `Trade executions will fail without an api secret (KEY.SECRET)`;
            logger.execution.warn(msg);
        }

        if (isNaN(CONFIG.INVESTMENT.MIN) || CONFIG.INVESTMENT.MIN <= 0) {
            const msg = `Minimum investment quantity (INVESTMENT.MIN) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (isNaN(CONFIG.INVESTMENT.STEP) || CONFIG.INVESTMENT.STEP <= 0) {
            const msg = `Investment step size (INVESTMENT.STEP) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.INVESTMENT.MIN > CONFIG.INVESTMENT.MAX) {
            const msg = `Minimum investment quantity (INVESTMENT.MIN) cannot be greater than maximum investment quantity (INVESTMENT.MAX)`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.INVESTMENT.MIN !== CONFIG.INVESTMENT.MAX && (CONFIG.INVESTMENT.MIN + CONFIG.INVESTMENT.STEP) > CONFIG.INVESTMENT.MAX) {
            const msg = `Step size (INVESTMENT.STEP) is too large for calculation optimization`;
            logger.execution.warn(msg);
        }

        if (isNaN(CONFIG.SCANNING.TIMEOUT) || CONFIG.SCANNING.TIMEOUT < 0) {
            const msg = `Scanning timeout (SCANNING.TIMEOUT) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (!Validation.SCANNING.DEPTH.includes(CONFIG.SCANNING.DEPTH)) {
            const msg = `Depth size (SCANNING.DEPTH) must be one of the following values: ${Validation.SCANNING.DEPTH}`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.SCANNING.DEPTH > 100 && CONFIG.SCANNING.WHITELIST.length === 0) {
            const msg = `Using a depth size (SCANNING.DEPTH) higher than 100 requires defining a whitelist (SCANNING.WHITELIST)`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.SCANNING.WHITELIST.some(sym => sym !== sym.toUpperCase())) {
            const msg = `Whitelist symbols must all be uppercase`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.SCANNING.WHITELIST.length > 0 && !CONFIG.SCANNING.WHITELIST.includes(CONFIG.INVESTMENT.BASE)) {
            const msg = `Whitelist (SCANNING.WHITELIST) must include the base symbol of ${CONFIG.INVESTMENT.BASE}`;
            logger.execution.debug(`Whitelist: [${CONFIG.SCANNING.WHITELIST}]`);
            logger.execution.error(msg);
            throw new Error(msg);
        }

        if (isNaN(CONFIG.EXECUTION.CAP) || CONFIG.EXECUTION.CAP < 0) {
            const msg = `Execution cap (EXECUTION.CAP) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (!Validation.EXECUTION.STRATEGY.includes(CONFIG.EXECUTION.STRATEGY)) {
            const msg = `Execution strategy (EXECUTION.STRATEGY) must be one of the following values: ${Validation.EXECUTION.STRATEGY}`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.EXECUTION.STRATEGY === 'parallel' && CONFIG.SCANNING.WHITELIST.length === 0) {
            const msg = `Parallel execution requires defining a whitelist (SCANNING.WHITELIST)`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (!CONFIG.EXECUTION.TEMPLATE.every(template => Validation.EXECUTION.TEMPLATE.includes(template))) {
            const msg = `Execution template (EXECUTION.TEMPLATE) can only contain the following values: BUY,SELL,null`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (isNaN(CONFIG.EXECUTION.FEE) || CONFIG.EXECUTION.FEE < 0) {
            const msg = `Execution fee (EXECUTION.FEE) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.EXECUTION.FEE === 0) {
            const msg = `Execution fee (EXECUTION.FEE) of zero is likely incorrect`;
            logger.execution.warn(msg);
        }

        if (isNaN(CONFIG.HUD.ROWS) || CONFIG.HUD.ROWS <= 0) {
            const msg = `HUD row count (HUD.ROWS) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (isNaN(CONFIG.HUD.REFRESH_RATE) || CONFIG.HUD.REFRESH_RATE <= 0) {
            const msg = `HUD refresh rate (HUD.REFRESH_RATE) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.HUD.REFRESH_RATE < CONFIG.SCANNING.TIMEOUT) {
            const msg = `Refreshing the HUD (HUD.REFRESH_RATE) more frequently than the scanning timeout (SCANNING.TIMEOUT) is inefficient`;
            logger.execution.warn(msg);
        }

        if (isNaN(CONFIG.LOG.STATUS_UPDATE_INTERVAL) || CONFIG.LOG.STATUS_UPDATE_INTERVAL < 0) {
            const msg = `Status update interval (LOG.STATUS_UPDATE_INTERVAL) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }

        if (isNaN(CONFIG.WEBSOCKET.BUNDLE_SIZE) || CONFIG.WEBSOCKET.BUNDLE_SIZE <= 0) {
            const msg = `Websocket bundle size (WEBSOCKET.BUNDLE_SIZE) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (isNaN(CONFIG.WEBSOCKET.INITIALIZATION_INTERVAL) || CONFIG.WEBSOCKET.INITIALIZATION_INTERVAL < 0) {
            const msg = `Websocket initialization interval (WEBSOCKET.INITIALIZATION_INTERVAL) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }

        return true;
    }

};

module.exports = Validation;