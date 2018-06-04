const MarketCache = require('./MarketCache');

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

    allRelationships() {
        let relationships = [];
        MarketCache.symbols.forEach(function(symbol1) {
            MarketCache.symbols.forEach(function(symbol2) {
                MarketCache.symbols.forEach(function(symbol3) {
                    let relationship = MarketCalculation.relationships(symbol1, symbol2, symbol3);
                    if (relationship) relationships.push(relationship);
                });
            });
        });
        return relationships;
    }

};

module.exports = MarketCalculation;
