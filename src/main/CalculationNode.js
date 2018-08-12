module.exports = function(inputs, done) {
    const {trade, minInvestment, maxInvestment, stepSize, MarketCache} = inputs;
    let quantity, calculation;
    let bestCalculation = null;

    try {
        for (quantity = minInvestment || stepSize; quantity <= maxInvestment; quantity += stepSize) {
            calculation = calculate(quantity, trade, MarketCache);
            if (!bestCalculation || calculation.percent > bestCalculation.percent) {
                bestCalculation = calculation;
            }
        }
    } catch(e) {
        //console.error(e.message);
    }

    done(bestCalculation);
};

function calculate(investmentA, trade, MarketCache) {
    let calculated = {
        id: `${trade.symbol.a}-${trade.symbol.b}-${trade.symbol.c}`,
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
        time: Math.min(MarketCache.depths[trade.ab.ticker].time, MarketCache.depths[trade.bc.ticker].time, MarketCache.depths[trade.ca.ticker].time),
        times: {
            ab: MarketCache.depths[trade.ab.ticker].time,
            bc: MarketCache.depths[trade.bc.ticker].time,
            ca: MarketCache.depths[trade.ca.ticker].time
        },
        a: 0,
        b: 0,
        c: 0
    };

    if (trade.ab.method === 'Buy') {
        calculated.ab.total = orderBookConversion(calculated.start.total, trade.symbol.a, trade.symbol.b, trade.ab.ticker, MarketCache);
        calculated.ab.market = calculateDustless(trade.ab.ticker, calculated.ab.total, MarketCache);
        calculated.b = calculated.ab.market;
        calculated.start.market = orderBookConversion(calculated.ab.market, trade.symbol.b, trade.symbol.a, trade.ab.ticker, MarketCache);
    } else {
        calculated.ab.total = calculated.start.total;
        calculated.ab.market = calculateDustless(trade.ab.ticker, calculated.ab.total, MarketCache);
        calculated.b = orderBookConversion(calculated.ab.market, trade.symbol.a, trade.symbol.b, trade.ab.ticker, MarketCache);
        calculated.start.market = calculated.ab.market;
    }
    calculated.ab.dust = 0;
    calculated.ab.volume = calculated.ab.market / (trade.ab.volume / 24);

    if (trade.bc.method === 'Buy') {
        calculated.bc.total = orderBookConversion(calculated.b, trade.symbol.b, trade.symbol.c, trade.bc.ticker, MarketCache);
        calculated.bc.market = calculateDustless(trade.bc.ticker, calculated.bc.total, MarketCache);
        calculated.c = calculated.bc.market;
    } else {
        calculated.bc.total = calculated.b;
        calculated.bc.market = calculateDustless(trade.bc.ticker, calculated.bc.total, MarketCache);
        calculated.c = orderBookConversion(calculated.bc.market, trade.symbol.b, trade.symbol.c, trade.bc.ticker, MarketCache);
    }
    calculated.bc.dust = calculated.bc.total - calculated.bc.market;
    calculated.bc.volume = calculated.bc.market / (trade.bc.volume / 24);


    if (trade.ca.method === 'Buy') {
        calculated.ca.total = orderBookConversion(calculated.c, trade.symbol.c, trade.symbol.a, trade.ca.ticker, MarketCache);
        calculated.ca.market = calculateDustless(trade.ca.ticker, calculated.ca.total, MarketCache);
        calculated.a = calculated.ca.market;
    } else {
        calculated.ca.total = calculated.c;
        calculated.ca.market = calculateDustless(trade.ca.ticker, calculated.ca.total, MarketCache);
        calculated.a = orderBookConversion(calculated.ca.market, trade.symbol.c, trade.symbol.a, trade.ca.ticker, MarketCache);
    }
    calculated.ca.dust = calculated.ca.total - calculated.ca.market;
    calculated.ca.volume = calculated.ca.market / (trade.ca.volume / 24);

    calculated.volume = Math.max(calculated.ab.volume, calculated.bc.volume, calculated.ca.volume) * 100;

    calculated.percent = (calculated.a - calculated.start.total) / calculated.start.total * 100;
    if (!calculated.percent) calculated.percent = 0;

    return calculated;
}

function orderBookConversion(amountFrom, symbolFrom, symbolTo, ticker, MarketCache) {
    let i, j, rates, rate, quantity, exchangeableAmount;
    let orderBook = MarketCache.depths[ticker] || {};
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
                amountTo += amountFrom * rate;
                amountFrom = 0;
                return amountTo;
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
                amountTo += amountFrom / rate;
                amountFrom = 0;
                return amountTo;
            }
        }
    }

    let error = new Error(`Depth (${rates.length}) too shallow to convert ${amountFrom} ${symbolFrom} to ${symbolTo} using ${ticker}`);
    error.ticker = ticker;
    throw error;
}

function calculateDustless(ticker, amount, MarketCache) {
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