const CONFIG = require('../../config/config');

const CalculationNode = {

    cycleCount: 0,

    cycle(relationships, depthCacheClone, errorCallback, executionCallback) {
        const startTime = Date.now();

        let successCount = 0;
        let errorCount = 0;
        let results = {};

        relationships.forEach(relationship => {
            try {
                const depthSnapshot = {
                    ab: depthCacheClone[relationship.ab.ticker],
                    bc: depthCacheClone[relationship.bc.ticker],
                    ca: depthCacheClone[relationship.ca.ticker]
                };
                const calculated = CalculationNode.optimize(relationship, depthSnapshot);
                if (calculated) {
                    successCount++;
                    if (CONFIG.HUD.ENABLED) results[calculated.id] = calculated;
                    executionCallback(calculated);
                }
            } catch (error) {
                errorCount++;
                errorCallback(error.message);
            }
        });

        const calculationTime = Date.now() - startTime;

        CalculationNode.cycleCount++;

        return { calculationTime, successCount, errorCount, results };
    },

    optimize(trade, depthSnapshot) {
        let quantity, calculation;
        let bestCalculation = null;

        for (quantity = CONFIG.INVESTMENT.MIN; quantity <= CONFIG.INVESTMENT.MAX; quantity += CONFIG.INVESTMENT.STEP) {
            calculation = CalculationNode.calculate(quantity, trade, depthSnapshot);
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

        if (trade.ab.method === 'Buy') {
            // Buying BA
            const dustedB = CalculationNode.orderBookConversion(investmentA, trade.symbol.a, trade.symbol.b, trade.ab.ticker, depthSnapshot.ab);
            calculated.b.earned = calculated.ab = CalculationNode.calculateDustless(trade.ab, dustedB);
            calculated.a.spent = CalculationNode.orderBookReverseConversion(calculated.b.earned, trade.symbol.b, trade.symbol.a, trade.ab.ticker, depthSnapshot.ab);
        } else {
            // Selling AB
            calculated.a.spent = calculated.ab = CalculationNode.calculateDustless(trade.ab, investmentA);
            calculated.b.earned = CalculationNode.orderBookConversion(calculated.a.spent, trade.symbol.a, trade.symbol.b, trade.ab.ticker, depthSnapshot.ab);
        }

        if (trade.bc.method === 'Buy') {
            // Buying CB
            const dustedC = CalculationNode.orderBookConversion(calculated.b.earned, trade.symbol.b, trade.symbol.c, trade.bc.ticker, depthSnapshot.bc);
            calculated.c.earned = calculated.bc = CalculationNode.calculateDustless(trade.bc, dustedC);
            calculated.b.spent = CalculationNode.orderBookReverseConversion(calculated.c.earned, trade.symbol.c, trade.symbol.b, trade.bc.ticker, depthSnapshot.bc);
        } else {
            // Selling BC
            calculated.b.spent = calculated.bc = CalculationNode.calculateDustless(trade.bc, calculated.b.earned);
            calculated.c.earned = CalculationNode.orderBookConversion(calculated.b.spent, trade.symbol.b, trade.symbol.c, trade.bc.ticker, depthSnapshot.bc);
        }

        if (trade.ca.method === 'Buy') {
            // Buying AC
            const dustedA = CalculationNode.orderBookConversion(calculated.c.earned, trade.symbol.c, trade.symbol.a, trade.ca.ticker, depthSnapshot.ca);
            calculated.a.earned = calculated.ca = CalculationNode.calculateDustless(trade.ca, dustedA);
            calculated.c.spent = CalculationNode.orderBookReverseConversion(calculated.a.earned, trade.symbol.a, trade.symbol.c, trade.ca.ticker, depthSnapshot.ca);
        } else {
            // Selling CA
            calculated.c.spent = calculated.ca = CalculationNode.calculateDustless(trade.ca, calculated.c.earned);
            calculated.a.earned = CalculationNode.orderBookConversion(calculated.c.spent, trade.symbol.c, trade.symbol.a, trade.ca.ticker, depthSnapshot.ca);
        }

        // Calculate deltas
        calculated.a.delta = calculated.a.earned - calculated.a.spent;
        calculated.b.delta = calculated.b.earned - calculated.b.spent;
        calculated.c.delta = calculated.c.earned - calculated.c.spent;

        calculated.percent = (calculated.a.delta / calculated.a.spent * 100) - (CONFIG.TRADING.TAKER_FEE * 3);
        if (!calculated.percent) calculated.percent = -100;

        return calculated;
    },

    recalculateTradeLeg(trade, quantityEarned, depthSnapshot) {
        const { base, quote, method, ticker } = trade;
        if (method.toUpperCase() === 'BUY') {
            const dustedQuantity = CalculationNode.orderBookConversion(quantityEarned, quote, base, ticker, depthSnapshot);
            return CalculationNode.calculateDustless(trade, dustedQuantity);
        } else {
            return CalculationNode.calculateDustless(trade, quantityEarned);
        }
    },

    orderBookConversion(amountFrom, symbolFrom, symbolTo, ticker, depthSnapshot) {
        if (amountFrom === 0) return 0;

        let amountTo = 0;
        let i, rate, quantity, exchangeableAmount;
        const bidRates = Object.keys(depthSnapshot.bids || {});
        const askRates = Object.keys(depthSnapshot.asks || {});

        if (parseFloat(bidRates[0]) > parseFloat(askRates[0])) throw new Error(`Spread does not exist for ${ticker}`);

        if (ticker === symbolFrom + symbolTo) {
            for (i=0; i<bidRates.length; i++) {
                rate = parseFloat(bidRates[i]);
                quantity = depthSnapshot.bids[bidRates[i]];
                exchangeableAmount = quantity * rate;
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
            for (i=0; i<askRates.length; i++) {
                rate = parseFloat(askRates[i]);
                quantity = depthSnapshot.asks[askRates[i]];
                exchangeableAmount = quantity * rate;
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
        let i, rate, quantity, exchangeableAmount;
        const bidRates = Object.keys(depthSnapshot.bids || {});
        const askRates = Object.keys(depthSnapshot.asks || {});

        if (parseFloat(bidRates[0]) > parseFloat(askRates[0])) throw new Error(`Spread does not exist for ${ticker}`);

        if (ticker === symbolFrom + symbolTo) {
            for (i=0; i<askRates.length; i++) {
                rate = parseFloat(askRates[i]);
                quantity = depthSnapshot.asks[askRates[i]];
                exchangeableAmount = quantity * rate;
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
            for (i=0; i<bidRates.length; i++) {
                rate = parseFloat(bidRates[i]);
                quantity = depthSnapshot.bids[bidRates[i]];
                exchangeableAmount = quantity * rate;
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

    calculateDustless(trade, amount) {
        if (Number.isInteger(amount)) return amount;
        const amountString = amount.toFixed(12);
        const decimalIndex = amountString.indexOf('.');
        return parseFloat(amountString.slice(0, decimalIndex + trade.dustDecimals + 1));
    }

};

module.exports = CalculationNode;
