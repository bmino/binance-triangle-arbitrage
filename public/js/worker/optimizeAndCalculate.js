var tickers = {};

onmessage = function(event) {
    if (event.data.tickers) return tickers = event.data.tickers;

    var relationship = event.data.relationship;
    var minInvestment = event.data.minInvestment;
    var maxInvestment = event.data.maxInvestment;
    var stepSize = event.data.stepSize;
    var orderBookMap = event.data.orderBookMap;

    var trade = optimizeAndCalculate(relationship, minInvestment, maxInvestment, stepSize, orderBookMap);
    return postMessage(trade);
};

function optimizeAndCalculate(relationship, minInvestment, maxInvestment, stepSize, orderBookMap) {
    var quantity, calculation;
    var bestCalculation = null;

    for (quantity=minInvestment; quantity<=maxInvestment; quantity+=stepSize) {
        calculation = calculate(quantity, relationship, orderBookMap);
        if (!bestCalculation || calculation.percent > bestCalculation.percent) {
            bestCalculation = calculation;
        }
    }

    relationship.calculated = calculation;
    return relationship;
}

function calculate(investmentA, trade, orderBookMap) {
    var calculated = {
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
        time: Math.min(orderBookMap[trade.ab.ticker].time, orderBookMap[trade.bc.ticker].time, orderBookMap[trade.ca.ticker].time),
        a: 0,
        b: 0,
        c: 0
    };

    if (trade.ab.method === 'Buy') {
        calculated.ab.total = orderBookConversion(calculated.start.total, trade.symbol.a, trade.symbol.b, trade.ab.ticker, orderBookMap[trade.ab.ticker]);
        calculated.ab.market = calculateDustless(trade.ab.ticker, calculated.ab.total, tickers);
        calculated.b = calculated.ab.market;
        calculated.start.market = orderBookConversion(calculated.ab.market, trade.symbol.b, trade.symbol.a, trade.ab.ticker, orderBookMap[trade.ab.ticker]);
    } else {
        calculated.ab.total = calculated.start.total;
        calculated.ab.market = calculateDustless(trade.ab.ticker, calculated.ab.total, tickers);
        calculated.b = orderBookConversion(calculated.ab.market, trade.symbol.a, trade.symbol.b, trade.ab.ticker, orderBookMap[trade.ab.ticker]);
        calculated.start.market = calculated.ab.market;
    }
    calculated.ab.dust = 0;
    calculated.ab.volume = calculated.ab.market / (trade.ab.volume / 24);


    if (trade.bc.method === 'Buy') {
        calculated.bc.total = orderBookConversion(calculated.b, trade.symbol.b, trade.symbol.c, trade.bc.ticker, orderBookMap[trade.bc.ticker]);
        calculated.bc.market = calculateDustless(trade.bc.ticker, calculated.bc.total, tickers);
        calculated.c = calculated.bc.market;
    } else {
        calculated.bc.total = calculated.b;
        calculated.bc.market = calculateDustless(trade.bc.ticker, calculated.bc.total, tickers);
        calculated.c = orderBookConversion(calculated.bc.market, trade.symbol.b, trade.symbol.c, trade.bc.ticker, orderBookMap[trade.bc.ticker]);
    }
    calculated.bc.dust = calculated.bc.total - calculated.bc.market;
    calculated.bc.volume = calculated.bc.market / (trade.bc.volume / 24);


    if (trade.ca.method === 'Buy') {
        calculated.ca.total = orderBookConversion(calculated.c, trade.symbol.c, trade.symbol.a, trade.ca.ticker, orderBookMap[trade.ca.ticker]);
        calculated.ca.market = calculateDustless(trade.ca.ticker, calculated.ca.total, tickers);
        calculated.a = calculated.ca.market;
    } else {
        calculated.ca.total = calculated.c;
        calculated.ca.market = calculateDustless(trade.ca.ticker, calculated.ca.total, tickers);
        calculated.a = orderBookConversion(calculated.ca.market, trade.symbol.c, trade.symbol.a, trade.ca.ticker, orderBookMap[trade.ca.ticker]);
    }
    calculated.ca.dust = calculated.ca.total - calculated.ca.market;
    calculated.ca.volume = calculated.ca.market / (trade.ca.volume / 24);

    calculated.volume = Math.max(calculated.ab.volume, calculated.bc.volume, calculated.ca.volume) * 100;

    calculated.percent = (calculated.a - calculated.start.total) / calculated.start.total * 100;
    if (!calculated.percent) calculated.percent = 0;

    return calculated;
}

function orderBookConversion(amountFrom, symbolFrom, symbolTo, ticker, orderBook) {
    var i,j;
    var amountTo = 0;
    var rates, rate, quantity, exchangeableAmount;

    if (amountFrom === 0) return 0;

    if (ticker === symbolFrom + symbolTo) {
        rates = Object.keys(orderBook.bid);
        if (rates.length === 0) {
            //console.error('No bids available to convert ' + amountFrom + ' ' + symbolFrom + ' to ' + symbolTo);
            return amountTo;
        }
        for (i=0; i<rates.length; i++) {
            rate = parseFloat(rates[i]);
            quantity = parseFloat(orderBook.bid[rates[i]]);
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
        rates = Object.keys(orderBook.ask);
        if (rates.length === 0) {
            //console.error('No asks available to convert ' + amountFrom + ' ' + symbolFrom + ' to ' + symbolTo);
            return amountTo;
        }
        for (j=0; j<rates.length; j++) {
            rate = parseFloat(rates[j]);
            quantity = parseFloat(orderBook.ask[rates[j]]);
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
    //console.error('Depth (' + rates.length + ') too shallow to convert ' + amountFrom + ' ' + symbolFrom + ' to ' + symbolTo + ' using ' + ticker);
    //console.error('Went through depths:', rates);
    return amountTo;
}

function calculateDustless(tickerName, amount, tickers) {
    var amountString = amount.toString();
    var dustQty = tickers[tickerName].dustQty;
    var decimals = dustQty === 1 ? 0 : dustQty.toString().indexOf('1') - 1;
    var decimalIndex = amountString.indexOf('.');
    if (decimalIndex === -1) {
        // Integer
        return amount;
    } else {
        // Float
        return parseFloat(amountString.slice(0, decimalIndex + decimals + 1));
    }
}
