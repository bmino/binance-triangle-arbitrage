const CONFIG = require('../../config/config');
const binance = require('node-binance-api')();
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
            start: investmentA,
            ab: 0,
            bc: 0,
            ca: 0,
            times: {
                ab: binance.depthCache(trade.ab.ticker).time,
                bc: binance.depthCache(trade.bc.ticker).time,
                ca: binance.depthCache(trade.ca.ticker).time
            },
            a: 0,
            b: 0,
            c: 0
        };
    
        if (trade.ab.method === 'Buy') {
            const dustedAB = CalculationNode.orderBookConversion(investmentA, trade.symbol.a, trade.symbol.b, trade.ab.ticker);
            calculated.b = calculated.ab = CalculationNode.calculateDustless(trade.ab.ticker, dustedAB);
        } else {
            calculated.start = calculated.ab = CalculationNode.calculateDustless(trade.ab.ticker, investmentA);
            calculated.b = CalculationNode.orderBookConversion(calculated.ab, trade.symbol.a, trade.symbol.b, trade.ab.ticker);
        }
    
        if (trade.bc.method === 'Buy') {
            const dustedBC = CalculationNode.orderBookConversion(calculated.b, trade.symbol.b, trade.symbol.c, trade.bc.ticker);
            calculated.c = calculated.bc = CalculationNode.calculateDustless(trade.bc.ticker, dustedBC);
        } else {
            calculated.bc = CalculationNode.calculateDustless(trade.bc.ticker, calculated.b);
            calculated.c = CalculationNode.orderBookConversion(calculated.bc, trade.symbol.b, trade.symbol.c, trade.bc.ticker);
        }
    
        if (trade.ca.method === 'Buy') {
            const dustedCA = CalculationNode.orderBookConversion(calculated.c, trade.symbol.c, trade.symbol.a, trade.ca.ticker);
            calculated.a = calculated.ca = CalculationNode.calculateDustless(trade.ca.ticker, dustedCA);
        } else {
            calculated.ca = CalculationNode.calculateDustless(trade.ca.ticker, calculated.c);
            calculated.a = CalculationNode.orderBookConversion(calculated.ca, trade.symbol.c, trade.symbol.a, trade.ca.ticker);
        }
    
        calculated.percent = (calculated.a - calculated.start) / calculated.start * 100;
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
        let i, j, rates, rate, quantity, exchangeableAmount;
        let orderBook = binance.depthCache(ticker) || {};
        let amountTo = 0;
    
        if (amountFrom === 0) return 0;
    
        if (ticker === symbolFrom + symbolTo) {
            rates = Object.keys(orderBook.bids || {});
            for (i=0; i<rates.length; i++) {
                rate = parseFloat(rates[i]);
                quantity = orderBook.bids[rates[i]];
                if (quantity < amountFrom) {
                    amountFrom -= quantity;
                    amountTo += quantity * rate;
                } else {
                    // Last fill
                    return amountTo + amountFrom * rate;
                }
            }
        } else {
            rates = Object.keys(orderBook.asks || {});
            for (j=0; j<rates.length; j++) {
                rate = parseFloat(rates[j]);
                quantity = orderBook.asks[rates[j]];
                exchangeableAmount = quantity * rate;
                if (exchangeableAmount < amountFrom) {
                    amountFrom -= quantity * rate;
                    amountTo += quantity;
                } else {
                    // Last fill
                    return amountTo + amountFrom / rate;
                }
            }
        }
    
        throw new Error(`Depth (${rates.length}) too shallow to convert ${amountFrom} ${symbolFrom} to ${symbolTo} using ${ticker}`);
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
