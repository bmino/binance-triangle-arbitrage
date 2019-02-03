const MarketCache = require('./MarketCache');

let MarketCalculation = {

    relationships(a, b, c) {
        const ab = MarketCalculation.relationship(a, b);
        if (!ab) return;

        const bc = MarketCalculation.relationship(b, c);
        if (!bc) return;

        const ca = MarketCalculation.relationship(c, a);
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
            ticker: a+b
        };
        if (MarketCache.tickers[b+a]) return {
            method: 'Buy',
            ticker: b+a
        };
        return null;
    },

    getRelationshipsFromSymbol(symbol1) {
        let relationships = [];
        MarketCache.symbols.forEach(function(symbol2) {
            MarketCache.symbols.forEach(function(symbol3) {
                const relationship = MarketCalculation.relationships(symbol1, symbol2, symbol3);
                if (relationship) relationships.push(relationship);
            });
        });
        return relationships;
    }

};

module.exports = MarketCalculation;
