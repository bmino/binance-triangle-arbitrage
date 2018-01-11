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
        PROFIT: {
            MIN: 3.00
        }
    };

    $scope.LOADING = {
        API: false,
        ARBITRAGE: false
    };

    $scope.symbols = [];
    $scope.timeSincePriceUpdate = null;
    $scope.trades = [];
    $scope.currentTrade = null;

    function init() {
        $scope.LOADING.API = true;
        binanceService.getSymbols()
            .then(function(symbols) {
                $scope.symbols = symbols;
            })
            .catch(console.error)
            .finally(function() {
                $scope.LOADING.API = false;
            });
        maintainTimeSinceLastPriceCheck();
    }

    $scope.findArbitrage = function() {
        if ($scope.symbols.length === 0) return;
        $scope.LOADING.ARBITRAGE = true;

        binanceService.refreshPriceMap()
            .then(function() {
                $scope.trades = analyzeSymbolsForArbitrage($scope.symbols)
                    .sort(sortByPercent);
            })
            .catch(console.error)
            .finally(function() {
                $scope.LOADING.ARBITRAGE = false;
            });
    };

    function analyzeSymbolsForArbitrage(symbols) {
        var trades = [];
        angular.forEach(symbols, function(symbol1) {
            angular.forEach(symbols, function(symbol2) {
                angular.forEach(symbols, function(symbol3) {
                    var relationship = binanceService.relationships(symbol1, symbol2, symbol3);
                    if (!relationship || relationship.percent <= 0) return;
                    relationship.symbol = {
                        a: symbol1,
                        b: symbol2,
                        c: symbol3
                    };
                    trades.push(relationship);
                });
            });
        });
        return trades;
    }

    $scope.setCurrentTrade = function(trade) {
        $scope.currentTrade = trade;
    };

    $scope.execute = function(trade, calculated) {
        binanceService.performMarketOrder(trade.ab.method, calculated.ab.market, trade.ab.ticker)
            .then(function() {
                return binanceService.performMarketOrder(trade.bc.method, calculated.bc.market, trade.bc.ticker);
            })
            .then(function() {
                return binanceService.performMarketOrder(trade.ca.method, calculated.ca.market, trade.ca.ticker);
            })
            .then(function() {
                console.log('Completed');
            })
            .catch(function(error) {
                throw error;
            });
    };

    function maintainTimeSinceLastPriceCheck() {
        var tick = function() {
            var lastUpdatedTime = binanceService.getPriceMapLastUpdatedTime();
            if (!lastUpdatedTime) return;
            $scope.timeSincePriceUpdate = new Date() - lastUpdatedTime;
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
