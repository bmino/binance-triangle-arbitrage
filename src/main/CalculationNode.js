module.exports = function(inputs, done, progress) {
    const {trade, minInvestment, maxInvestment, stepSize, marketCache} = inputs;
    let quantity, calculation;
    let bestCalculation = null;

    for (quantity = minInvestment || stepSize; quantity <= maxInvestment; quantity += stepSize) {
        calculation = calculate(quantity, trade, marketCache);
        if (!bestCalculation || calculation.percent > bestCalculation.percent) {
            bestCalculation = calculation;
        }
    }

    done(bestCalculation);
};

function calculate(investmentA, trade, marketCache) {
    let calculated = {
        id: `${trade.symbol.a}-${trade.symbol.b}-${trade.symbol.c}`,
        trade: trade,
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
        times: {
            ab: marketCache.depths[trade.ab.ticker].time,
            bc: marketCache.depths[trade.bc.ticker].time,
            ca: marketCache.depths[trade.ca.ticker].time
        },
        a: 0,
        b: 0,
        c: 0
    };

    if (trade.ab.method === 'Buy') {
        calculated.ab.total = orderBookConversion(calculated.start.total, trade.symbol.a, trade.symbol.b, trade.ab.ticker, marketCache);
        calculated.ab.market = calculateDustless(trade.ab.ticker, calculated.ab.total, marketCache);
        calculated.b = calculated.ab.market;
        calculated.start.market = orderBookConversion(calculated.ab.market, trade.symbol.b, trade.symbol.a, trade.ab.ticker, marketCache);
    } else {
        calculated.ab.total = calculated.start.total;
        calculated.ab.market = calculateDustless(trade.ab.ticker, calculated.ab.total, marketCache);
        calculated.b = orderBookConversion(calculated.ab.market, trade.symbol.a, trade.symbol.b, trade.ab.ticker, marketCache);
        calculated.start.market = calculated.ab.market;
    }
    calculated.ab.dust = 0;

    if (trade.bc.method === 'Buy') {
        calculated.bc.total = orderBookConversion(calculated.b, trade.symbol.b, trade.symbol.c, trade.bc.ticker, marketCache);
        calculated.bc.market = calculateDustless(trade.bc.ticker, calculated.bc.total, marketCache);
        calculated.c = calculated.bc.market;
    } else {
        calculated.bc.total = calculated.b;
        calculated.bc.market = calculateDustless(trade.bc.ticker, calculated.bc.total, marketCache);
        calculated.c = orderBookConversion(calculated.bc.market, trade.symbol.b, trade.symbol.c, trade.bc.ticker, marketCache);
    }
    calculated.bc.dust = calculated.bc.total - calculated.bc.market;

    if (trade.ca.method === 'Buy') {
        calculated.ca.total = orderBookConversion(calculated.c, trade.symbol.c, trade.symbol.a, trade.ca.ticker, marketCache);
        calculated.ca.market = calculateDustless(trade.ca.ticker, calculated.ca.total, marketCache);
        calculated.a = calculated.ca.market;
    } else {
        calculated.ca.total = calculated.c;
        calculated.ca.market = calculateDustless(trade.ca.ticker, calculated.ca.total, marketCache);
        calculated.a = orderBookConversion(calculated.ca.market, trade.symbol.c, trade.symbol.a, trade.ca.ticker, marketCache);
    }
    calculated.ca.dust = calculated.ca.total - calculated.ca.market;

    calculated.percent = (calculated.a - calculated.start.total) / calculated.start.total * 100;
    if (!calculated.percent) calculated.percent = 0;

    return calculated;
}

function orderBookConversion(amountFrom, symbolFrom, symbolTo, ticker, marketCache) {
    let i, j, rates, rate, quantity, exchangeableAmount;
    let orderBook = marketCache.depths[ticker] || {};
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

    let error = new Error(`Depth (${rates.length}) too shallow to convert ${amountFrom} ${symbolFrom} to ${symbolTo} using ${ticker}`);
    error.ticker = ticker;
    throw error;
}

function calculateDustless(ticker, amount, marketCache) {
    if (Number.isInteger(amount)) return amount;
    const amountString = amount.toFixed(12);
    const decimals = marketCache.tickers[ticker].dustDecimals;
    const decimalIndex = amountString.indexOf('.');
    return parseFloat(amountString.slice(0, decimalIndex + decimals + 1));
}