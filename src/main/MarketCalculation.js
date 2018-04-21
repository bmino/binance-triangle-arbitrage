let MarketCache = require('./MarketCache');

let MarketCalculation = {

    relationships(a, b, c) {
        let ab = MarketCalculation.relationship(a, b);
        if (!ab) return;

        let bc = MarketCalculation.relationship(b, c);
        if (!bc) return;

        let ca = MarketCalculation.relationship(c, a);
        if (!ca) return;

        return {
            id: a + b + c,
            ab: ab,
            bc: bc,
            ca: ca,
            symbol: {
                a: a.toUpperCase(),
                b: b.toUpperCase(),
                c: c.toUpperCase()
            }
        };
    },

    relationship(a, b) {
        a = a.toUpperCase();
        b = b.toUpperCase();

        if (MarketCache.tickers[a+b]) return {
            method: 'Sell',
            ticker: a+b,
            volume: MarketCache.volumes[a+b]
        };
        if (MarketCache.tickers[b+a]) return {
            method: 'Buy',
            ticker: b+a,
            volume: MarketCache.volumes[b+a]
        };
        return null;
    },

    optimizeAndCalculate(trade, minInvestment, maxInvestment, stepSize) {
        console.log(`Optimizing ${trade.id}`);
        let quantity, calculation;
        let bestCalculation = null;

        try {
            for (quantity = minInvestment || stepSize; quantity<=maxInvestment; quantity+=stepSize) {
                calculation = MarketCalculation.calculate(quantity, trade);
                if (!bestCalculation || calculation.percent > bestCalculation.percent) {
                    bestCalculation = calculation;
                }
            }
        } catch (e) {
            console.log(`\t\tError: ${e.message}`);
        }

        return bestCalculation;
    },

    calculate(investmentA, trade) {
        let calculated = {
            start: {
                total: investmentA,
                market: 0,
                dust: 0
            },
            ab: {
                total: 0,
                market: 0,
                dust: 0
            },
            bc: {
                total: 0,
                market: 0,
                dust: 0
            },
            ca: {
                total: 0,
                market: 0,
                dust: 0
            },
            symbol: trade.symbol,
            //time: Math.min(MarketCache.depths[trade.ab.ticker].time, MarketCache.depths[trade.bc.ticker].time, MarketCache.depths[trade.ca.ticker].time),
            a: 0,
            b: 0,
            c: 0
        };

        if (trade.ab.method === 'Buy') {
            calculated.ab.total = MarketCalculation.orderBookConversion(calculated.start.total, trade.symbol.a, trade.symbol.b, trade.ab.ticker);
            calculated.ab.market = MarketCalculation.calculateDustless(trade.ab.ticker, calculated.ab.total);
            calculated.b = calculated.ab.market;
            calculated.start.market = MarketCalculation.orderBookConversion(calculated.ab.market, trade.symbol.b, trade.symbol.a, trade.ab.ticker);
        } else {
            calculated.ab.total = calculated.start.total;
            calculated.ab.market = MarketCalculation.calculateDustless(trade.ab.ticker, calculated.ab.total);
            calculated.b = MarketCalculation.orderBookConversion(calculated.ab.market, trade.symbol.a, trade.symbol.b, trade.ab.ticker);
            calculated.start.market = calculated.ab.market;
        }
        calculated.ab.dust = 0;
        calculated.ab.volume = calculated.ab.market / (trade.ab.volume / 24);

        if (trade.bc.method === 'Buy') {
            calculated.bc.total = MarketCalculation.orderBookConversion(calculated.b, trade.symbol.b, trade.symbol.c, trade.bc.ticker);
            calculated.bc.market = MarketCalculation.calculateDustless(trade.bc.ticker, calculated.bc.total);
            calculated.c = calculated.bc.market;
        } else {
            calculated.bc.total = calculated.b;
            calculated.bc.market = MarketCalculation.calculateDustless(trade.bc.ticker, calculated.bc.total);
            calculated.c = MarketCalculation.orderBookConversion(calculated.bc.market, trade.symbol.b, trade.symbol.c, trade.bc.ticker);
        }
        calculated.bc.dust = calculated.bc.total - calculated.bc.market;
        calculated.bc.volume = calculated.bc.market / (trade.bc.volume / 24);


        if (trade.ca.method === 'Buy') {
            calculated.ca.total = MarketCalculation.orderBookConversion(calculated.c, trade.symbol.c, trade.symbol.a, trade.ca.ticker);
            calculated.ca.market = MarketCalculation.calculateDustless(trade.ca.ticker, calculated.ca.total);
            calculated.a = calculated.ca.market;
        } else {
            calculated.ca.total = calculated.c;
            calculated.ca.market = MarketCalculation.calculateDustless(trade.ca.ticker, calculated.ca.total);
            calculated.a = MarketCalculation.orderBookConversion(calculated.ca.market, trade.symbol.c, trade.symbol.a, trade.ca.ticker);
        }
        calculated.ca.dust = calculated.ca.total - calculated.ca.market;
        calculated.ca.volume = calculated.ca.market / (trade.ca.volume / 24);

        calculated.volume = Math.max(calculated.ab.volume, calculated.bc.volume, calculated.ca.volume) * 100;

        calculated.percent = (calculated.a - calculated.start.total) / calculated.start.total * 100;
        if (!calculated.percent) calculated.percent = 0;

        return calculated;
    },

    orderBookConversion(amountFrom, symbolFrom, symbolTo, ticker) {
        let i, j, rates, rate, quantity, exchangeableAmount;
        let orderBook = MarketCache.depths[ticker] || {};
        let amountTo = 0;

        if (amountFrom === 0) return 0;

        if (ticker === symbolFrom + symbolTo) {
            rates = Object.keys(orderBook.bids || {});
            if (rates.length === 0) {
                throw new Error(`No bids available to convert ${amountFrom} ${symbolFrom} to ${symbolTo}`);
            }
            for (i=0; i<rates.length; i++) {
                rate = parseFloat(rates[i]);
                quantity = parseFloat(orderBook.bids[rates[i]]);
                if (quantity < amountFrom) {
                    amountFrom -= quantity;
                    amountTo += quantity * rate;
                } else {
                    // Last fill
                    amountTo += amountFrom * rate;
                    amountFrom = 0;
                    return amountTo;
                }
            }
        } else {
            rates = Object.keys(orderBook.asks || {});
            if (rates.length === 0) {
                throw new Error(`No asks available to convert ${amountFrom} ${symbolFrom} to ${symbolTo}`);
            }
            for (j=0; j<rates.length; j++) {
                rate = parseFloat(rates[j]);
                quantity = parseFloat(orderBook.asks[rates[j]]);
                exchangeableAmount = quantity * rate;
                if (exchangeableAmount < amountFrom) {
                    amountFrom -= quantity * rate;
                    amountTo += quantity;
                } else {
                    // Last fill
                    amountTo += amountFrom / rate;
                    amountFrom = 0;
                    return amountTo;
                }
            }
        }
        console.log(`Depth (${rates.length}) too shallow to convert ${amountFrom} ${symbolFrom} to ${symbolTo} using ${ticker}`);
        // console.log('Went through depths:', rates);
        return amountTo;
    },

    calculateDustless(ticker, amount) {
        let amountString = amount.toString();
        let dustQty = MarketCache.tickers[ticker].dustQty;
        let decimals = dustQty === 1 ? 0 : dustQty.toString().indexOf('1') - 1;
        let decimalIndex = amountString.indexOf('.');
        if (decimalIndex === -1) {
            // Integer
            return amount;
        } else {
            // Float
            return parseFloat(amountString.slice(0, decimalIndex + decimals + 1));
        }
    }
};

module.exports = MarketCalculation;
