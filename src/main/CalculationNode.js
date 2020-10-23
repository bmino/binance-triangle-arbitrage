const CONFIG = require('../../config/config');

const CalculationNode = {

    analyze(trades, depthCacheClone, errorCallback, executionCheckCallback, executionCallback) {
        let results = {};

        for (const trade of trades) {
            try {
                const depthSnapshot = {
                    ab: depthCacheClone[trade.ab.ticker],
                    bc: depthCacheClone[trade.bc.ticker],
                    ca: depthCacheClone[trade.ca.ticker]
                };
                const calculated = CalculationNode.optimize(trade, depthSnapshot);
                if (CONFIG.HUD.ENABLED) results[calculated.id] = calculated;
                if (executionCheckCallback(calculated)) {
                    executionCallback(calculated);
                    break;
                }
            } catch (error) {
                errorCallback(error.message);
            }
        }

        return results;
    },

    optimize(trade, depthSnapshot) {
        let bestCalculation = null;

        for (let quantity = CONFIG.INVESTMENT.MIN; quantity <= CONFIG.INVESTMENT.MAX; quantity += CONFIG.INVESTMENT.STEP) {
            const calculation = CalculationNode.calculate(quantity, trade, depthSnapshot);
            if (!bestCalculation || calculation.percent > bestCalculation.percent) {
                bestCalculation = calculation;
            }
        }

        return bestCalculation;
    },

    calculate(investmentA, trade, depthSnapshot) {
        let calculated = {
            id: `${trade.symbol.a}-${trade.symbol.b}-${trade.symbol.c}`,
            trade: trade,
            ab: 0,
            bc: 0,
            ca: 0,
            depth: depthSnapshot,
            a: {
                spent: 0,
                earned: 0,
                delta: 0
            },
            b: {
                spent: 0,
                earned: 0,
                delta: 0
            },
            c: {
                spent: 0,
                earned: 0,
                delta: 0
            }
        };

        if (trade.ab.method === 'BUY') {
            // Buying BA
            const dustedB = CalculationNode.orderBookConversion(investmentA, trade.symbol.a, trade.symbol.b, trade.ab.ticker, depthSnapshot.ab);
            calculated.b.earned = calculated.ab = CalculationNode.calculateDustless(dustedB, trade.ab.dustDecimals);
            calculated.a.spent = CalculationNode.orderBookReverseConversion(calculated.b.earned, trade.symbol.b, trade.symbol.a, trade.ab.ticker, depthSnapshot.ab);
        } else {
            // Selling AB
            calculated.a.spent = calculated.ab = CalculationNode.calculateDustless(investmentA, trade.ab.dustDecimals);
            calculated.b.earned = CalculationNode.orderBookConversion(calculated.a.spent, trade.symbol.a, trade.symbol.b, trade.ab.ticker, depthSnapshot.ab);
        }

        if (trade.bc.method === 'BUY') {
            // Buying CB
            const dustedC = CalculationNode.orderBookConversion(calculated.b.earned, trade.symbol.b, trade.symbol.c, trade.bc.ticker, depthSnapshot.bc);
            calculated.c.earned = calculated.bc = CalculationNode.calculateDustless(dustedC, trade.bc.dustDecimals);
            calculated.b.spent = CalculationNode.orderBookReverseConversion(calculated.c.earned, trade.symbol.c, trade.symbol.b, trade.bc.ticker, depthSnapshot.bc);
        } else {
            // Selling BC
            calculated.b.spent = calculated.bc = CalculationNode.calculateDustless(calculated.b.earned, trade.bc.dustDecimals);
            calculated.c.earned = CalculationNode.orderBookConversion(calculated.b.spent, trade.symbol.b, trade.symbol.c, trade.bc.ticker, depthSnapshot.bc);
        }

        if (trade.ca.method === 'BUY') {
            // Buying AC
            const dustedA = CalculationNode.orderBookConversion(calculated.c.earned, trade.symbol.c, trade.symbol.a, trade.ca.ticker, depthSnapshot.ca);
            calculated.a.earned = calculated.ca = CalculationNode.calculateDustless(dustedA, trade.ca.dustDecimals);
            calculated.c.spent = CalculationNode.orderBookReverseConversion(calculated.a.earned, trade.symbol.a, trade.symbol.c, trade.ca.ticker, depthSnapshot.ca);
        } else {
            // Selling CA
            calculated.c.spent = calculated.ca = CalculationNode.calculateDustless(calculated.c.earned, trade.ca.dustDecimals);
            calculated.a.earned = CalculationNode.orderBookConversion(calculated.c.spent, trade.symbol.c, trade.symbol.a, trade.ca.ticker, depthSnapshot.ca);
        }

        // Calculate deltas
        calculated.a.delta = calculated.a.earned - calculated.a.spent;
        calculated.b.delta = calculated.b.earned - calculated.b.spent;
        calculated.c.delta = calculated.c.earned - calculated.c.spent;

        calculated.percent = (calculated.a.delta / calculated.a.spent * 100) - (CONFIG.EXECUTION.FEE * 3);
        if (!calculated.percent) calculated.percent = -100;

        return calculated;
    },

    recalculateTradeLeg({ base, quote, method, ticker, dustDecimals }, quantityEarned, depthSnapshot) {
        if (method === 'BUY') {
            const dustedQuantity = CalculationNode.orderBookConversion(quantityEarned, quote, base, ticker, depthSnapshot);
            return CalculationNode.calculateDustless(dustedQuantity, dustDecimals);
        } else {
            return CalculationNode.calculateDustless(quantityEarned, dustDecimals);
        }
    },

    orderBookConversion(amountFrom, symbolFrom, symbolTo, ticker, depthSnapshot) {
        if (amountFrom === 0) return 0;

        let amountTo = 0;

        if (ticker === symbolFrom + symbolTo) {
            const bidRates = Object.keys(depthSnapshot.bids || {});
            for (let i=0; i<bidRates.length; i++) {
                const rate = parseFloat(bidRates[i]);
                const quantity = depthSnapshot.bids[bidRates[i]];
                const exchangeableAmount = quantity * rate;
                if (quantity < amountFrom) {
                    amountFrom -= quantity;
                    amountTo += exchangeableAmount;
                } else {
                    // Last fill
                    return amountTo + (amountFrom * rate);
                }
            }
            throw new Error(`Bid depth (${bidRates.length}) too shallow to convert ${amountFrom} ${symbolFrom} to ${symbolTo} using ${ticker}`);
        } else {
            const askRates = Object.keys(depthSnapshot.asks || {});
            for (let i=0; i<askRates.length; i++) {
                const rate = parseFloat(askRates[i]);
                const quantity = depthSnapshot.asks[askRates[i]];
                const exchangeableAmount = quantity * rate;
                if (exchangeableAmount < amountFrom) {
                    amountFrom -= exchangeableAmount;
                    amountTo += quantity;
                } else {
                    // Last fill
                    return amountTo + (amountFrom / rate);
                }
            }
            throw new Error(`Ask depth (${askRates.length}) too shallow to convert ${amountFrom} ${symbolFrom} to ${symbolTo} using ${ticker}`);
        }
    },

    orderBookReverseConversion(amountFrom, symbolFrom, symbolTo, ticker, depthSnapshot) {
        if (amountFrom === 0) return 0;

        let amountTo = 0;

        if (ticker === symbolFrom + symbolTo) {
            const askRates = Object.keys(depthSnapshot.asks || {});
            for (let i=0; i<askRates.length; i++) {
                const rate = parseFloat(askRates[i]);
                const quantity = depthSnapshot.asks[askRates[i]];
                const exchangeableAmount = quantity * rate;
                if (quantity < amountFrom) {
                    amountFrom -= quantity;
                    amountTo += exchangeableAmount;
                } else {
                    // Last fill
                    return amountTo + (amountFrom * rate);
                }
            }
            throw new Error(`Ask depth (${askRates.length}) too shallow to reverse convert ${amountFrom} ${symbolFrom} to ${symbolTo} using ${ticker}`);
        } else {
            const bidRates = Object.keys(depthSnapshot.bids || {});
            for (let i=0; i<bidRates.length; i++) {
                const rate = parseFloat(bidRates[i]);
                const quantity = depthSnapshot.bids[bidRates[i]];
                const exchangeableAmount = quantity * rate;
                if (exchangeableAmount < amountFrom) {
                    amountFrom -= exchangeableAmount;
                    amountTo += quantity;
                } else {
                    // Last fill
                    return amountTo + (amountFrom / rate);
                }
            }
            throw new Error(`Bid depth (${bidRates.length}) too shallow to reverse convert ${amountFrom} ${symbolFrom} to ${symbolTo} using ${ticker}`);
        }
    },

    getOrderBookDepthRequirement(method, quantity, depthSnapshot) {
        let i;
        let exchanged = 0;

        if (method === 'SELL') {
            const bidRates = Object.keys(depthSnapshot.bids || {});
            for (i=0; i<bidRates.length; i++) {
                exchanged += depthSnapshot.bids[bidRates[i]];
                if (exchanged >= quantity) {
                    return i+1;
                }
            }
        } else if (method === 'BUY') {
            const askRates = Object.keys(depthSnapshot.asks || {});
            for (i=0; i<askRates.length; i++) {
                exchanged += depthSnapshot.asks[askRates[i]];
                if (exchanged >= quantity) {
                    return i+1;
                }
            }
        } else {
            throw new Error(`Unknown method: ${method}`);
        }
        return i;
    },

    calculateDustless(amount, dustDecimals) {
        if (Number.isInteger(amount)) return amount;
        const amountString = amount.toFixed(12);
        const decimalIndex = amountString.indexOf('.');
        return parseFloat(amountString.slice(0, decimalIndex + dustDecimals + 1));
    }

};

module.exports = CalculationNode;
