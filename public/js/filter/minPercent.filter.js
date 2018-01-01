angular
    .module('filters')
    .filter('minPercent', MinPercent);

MinPercent.$inject = [];

function MinPercent() {

    return function(trades, minPercent) {

        var desiredTrades = [];

        angular.forEach(trades, function(trade) {
            if (!trade.percent) return;
            if (trade.percent >= minPercent) desiredTrades.push(trade);
        });

        return desiredTrades;

    }

}
