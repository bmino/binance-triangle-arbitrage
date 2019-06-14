const CONFIG = require('../../config/config');
const BinanceApi = require('./BinanceApi');
const MarketCache = require('./MarketCache');

const CalculationNode = {

    optimize(trade) {
        let quantity, calculation;
        let bestCalculation = null;

        for (quantity = CONFIG.INVESTMENT.MIN || CONFIG.INVESTMENT.STEP; quantity <= CONFIG.INVESTMENT.MAX; quantity += CONFIG.INVESTMENT.STEP) {
            calculation = CalculationNode.calculate(quantity, trade);
            if (!bestCalculation || calculation.percent > bestCalculation.percent) {
                bestCalculation = calculation;
            }
        }

        return bestCalculation;
    },

    calculate(investmentA, trade) {
        let calculated = {
            id: `${trade.symbol.a}-${trade.symbol.b}-${trade.symbol.c}`,
            trade: trade,
            ab: 0,
            bc: 0,
            ca: 0,
            depth: {
                ab: BinanceApi.cloneDepth(trade.ab.ticker),
                bc: BinanceApi.cloneDepth(trade.bc.ticker),
                ca: BinanceApi.cloneDepth(trade.ca.ticker)
            },
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
            const dustedB = CalculationNode.orderBookConversion(investmentA, trade.symbol.a, trade.symbol.b, trade.ab.ticker);
            calculated.b.earned = calculated.ab = CalculationNode.calculateDustless(trade.ab.ticker, dustedB);
            calculated.a.spent = CalculationNode.orderBookReverseConversion(calculated.b.earned, trade.symbol.b, trade.symbol.a, trade.ab.ticker);
        } else {
            // Selling AB
            calculated.a.spent = calculated.ab = CalculationNode.calculateDustless(trade.ab.ticker, investmentA);
            calculated.b.earned = CalculationNode.orderBookConversion(calculated.a.spent, trade.symbol.a, trade.symbol.b, trade.ab.ticker);
        }

        if (trade.bc.method === 'Buy') {
            // Buying CB
            const dustedC = CalculationNode.orderBookConversion(calculated.b.earned, trade.symbol.b, trade.symbol.c, trade.bc.ticker);
            calculated.c.earned = calculated.bc = CalculationNode.calculateDustless(trade.bc.ticker, dustedC);
            calculated.b.spent = CalculationNode.orderBookReverseConversion(calculated.c.earned, trade.symbol.c, trade.symbol.b, trade.bc.ticker);
        } else {
            // Selling BC
            calculated.b.spent = calculated.bc = CalculationNode.calculateDustless(trade.bc.ticker, calculated.b.earned);
            calculated.c.earned = CalculationNode.orderBookConversion(calculated.b.spent, trade.symbol.b, trade.symbol.c, trade.bc.ticker);
        }

        if (trade.ca.method === 'Buy') {
            // Buying AC
            const dustedA = CalculationNode.orderBookConversion(calculated.c.earned, trade.symbol.c, trade.symbol.a, trade.ca.ticker);
            calculated.a.earned = calculated.ca = CalculationNode.calculateDustless(trade.ca.ticker, dustedA);
            calculated.c.spent = CalculationNode.orderBookReverseConversion(calculated.a.earned, trade.symbol.a, trade.symbol.c, trade.ca.ticker);
        } else {
            // Selling CA
            calculated.c.spent = calculated.ca = CalculationNode.calculateDustless(trade.ca.ticker, calculated.c.earned);
            calculated.a.earned = CalculationNode.orderBookConversion(calculated.c.spent, trade.symbol.c, trade.symbol.a, trade.ca.ticker);
        }

        // Calculate deltas
        calculated.a.delta = calculated.a.earned - calculated.a.spent;
        calculated.b.delta = calculated.b.earned - calculated.b.spent;
        calculated.c.delta = calculated.c.earned - calculated.c.spent;

        calculated.percent = (calculated.a.delta / calculated.a.spent * 100) - (CONFIG.TRADING.TAKER_FEE * 3);
        if (!calculated.percent) calculated.percent = 0;

        return calculated;
    },

    recalculateTradeLeg({ base, quote, method, ticker }, quantityEarned) {
        if (method.toUpperCase() === 'BUY') {
            const dustedQuantity = CalculationNode.orderBookConversion(quantityEarned, quote, base, ticker);
            return CalculationNode.calculateDustless(ticker, dustedQuantity);
        } else {
            return CalculationNode.calculateDustless(ticker, quantityEarned);
        }
    },

    orderBookConversion(amountFrom, symbolFrom, symbolTo, ticker) {
        if (amountFrom === 0) return 0;

        let amountTo = 0;
        let i, rate, quantity, exchangeableAmount;
        let orderBook = BinanceApi.cloneDepth(ticker) || {};
        const bidRates = Object.keys(orderBook.bids || {});
        const askRates = Object.keys(orderBook.asks || {});

        if (parseFloat(bidRates[0]) > parseFloat(askRates[0])) throw new Error(`Spread does not exist for ${ticker}`);

        if (ticker === symbolFrom + symbolTo) {
            for (i=0; i<bidRates.length; i++) {
                rate = parseFloat(bidRates[i]);
                quantity = orderBook.bids[bidRates[i]];
                exchangeableAmount = quantity * rate;
                if (quantity < amountFrom) {
                    amountFrom -= quantity;
                    amountTo += exchangeableAmount;
                } else {
                    // Last fill
                    return amountTo + (amountFrom * rate);
                }
            }
        } else {
            for (i=0; i<askRates.length; i++) {
                rate = parseFloat(askRates[i]);
                quantity = orderBook.asks[askRates[i]];
                exchangeableAmount = quantity * rate;
                if (exchangeableAmount < amountFrom) {
                    amountFrom -= exchangeableAmount;
                    amountTo += quantity;
                } else {
                    // Last fill
                    return amountTo + (amountFrom / rate);
                }
            }
        }

        throw new Error(`Bid depth (${bidRates.length}) or ask depth (${askRates.length}) too shallow to convert ${amountFrom} ${symbolFrom} to ${symbolTo} using ${ticker}`);
    },

    orderBookReverseConversion(amountFrom, symbolFrom, symbolTo, ticker) {
        if (amountFrom === 0) return 0;

        let amountTo = 0;
        let i, rate, quantity, exchangeableAmount;
        let orderBook = BinanceApi.cloneDepth(ticker) || {};
        const bidRates = Object.keys(orderBook.bids || {});
        const askRates = Object.keys(orderBook.asks || {});

        if (parseFloat(bidRates[0]) > parseFloat(askRates[0])) throw new Error(`Spread does not exist for ${ticker}`);

        if (ticker === symbolFrom + symbolTo) {
            for (i=0; i<askRates.length; i++) {
                rate = parseFloat(askRates[i]);
                quantity = orderBook.asks[askRates[i]];
                exchangeableAmount = quantity * rate;
                if (quantity < amountFrom) {
                    amountFrom -= quantity;
                    amountTo += exchangeableAmount;
                } else {
                    // Last fill
                    return amountTo + (amountFrom * rate);
                }
            }
        } else {
            for (i=0; i<bidRates.length; i++) {
                rate = parseFloat(bidRates[i]);
                quantity = orderBook.bids[bidRates[i]];
                exchangeableAmount = quantity * rate;
                if (exchangeableAmount < amountFrom) {
                    amountFrom -= exchangeableAmount;
                    amountTo += quantity;
                } else {
                    // Last fill
                    return amountTo + (amountFrom / rate);
                }
            }
        }

        throw new Error(`Bid depth (${bidRates.length}) or ask depth (${askRates.length}) too shallow to reverse convert ${amountFrom} ${symbolFrom} to ${symbolTo} using ${ticker}`);
    },

    calculateDustless(ticker, amount) {
        if (Number.isInteger(amount)) return amount;
        const amountString = amount.toFixed(12);
        const decimals = MarketCache.tickers[ticker].dustDecimals;
        const decimalIndex = amountString.indexOf('.');
        return parseFloat(amountString.slice(0, decimalIndex + decimals + 1));
    },

    average(array) {
        const sum = array.reduce((a, b) => a + b, 0);
        return sum / array.length;
    }

};

module.exports = CalculationNode;
