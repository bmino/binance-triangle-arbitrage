angular
    .module('controllers')
    .controller('binanceController', BinanceController);

BinanceController.$inject = ['$scope', '$interval', 'binanceService'];

function BinanceController($scope, $interval, binanceService) {

    $scope.CONFIG = {
        BASE_SYMBOL: '',
        INVESTMENT: {
            MAX: 500
        },
        VOLUME: {
            MAX: 1.00
        },
        PROFIT: {
            MIN: 0.75
        }
    };

    $scope.LOADING = {
        API: binanceService.LOADING,
        ARBITRAGE: false
    };
    $scope.RATE_LIMIT = {
        TYPE: binanceService.QUERIES
    };

    $scope.timeSincePriceUpdate = null;
    $scope.trades = [];
    $scope.currentTrade = null;

    function init() {
        trackRequests();
    }

    $scope.findArbitrage = function() {
        if (binanceService.getSymbols().length === 0) return;
        $scope.LOADING.ARBITRAGE = true;

        binanceService.refreshPriceMap()
            .then(binanceService.refreshOrderBooks)
            .then(function() {
                var symbols = binanceService.getSymbols();
                $scope.trades = analyzeSymbolsForArbitrage(symbols).sort(sortByPercent);
            })
            .catch(console.error)
            .finally(function() {
                $scope.LOADING.ARBITRAGE = false;
            });
    };

    function analyzeSymbolsForArbitrage(symbols) {
        $scope.LOADING.OPTIMIZATION = true;
        var trades = [];
        angular.forEach(symbols, function(symbol1) {
            angular.forEach(symbols, function(symbol2) {
                angular.forEach(symbols, function(symbol3) {
                    var relationship = binanceService.relationships(symbol1, symbol2, symbol3);
                    if (!relationship) return;
                    var calculated = binanceService.optimizeAndCalculate(relationship, $scope.CONFIG.INVESTMENT.MAX);
                    relationship.margin = calculated.percent;
                    trades.push(relationship);
                });
            });
        });
        $scope.LOADING.OPTIMIZATION = false;
        return trades;
    }

    $scope.setCurrentTrade = function(trade) {
        $scope.currentTrade = trade;
    };

    function trackRequests() {
        var tick = function() {
            // TODO: calculate remaining requests per minute
        };
        tick();
        $interval(tick, 1000);
    }

    function sortByPercent(a, b) {
        if (a.percent < b.percent) return 1;
        if (a.percent > b.percent) return -1;
        return 0;
    }
    
    init();

}
