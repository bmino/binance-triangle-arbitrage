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

    $scope.percentRequestWeightRemaining = 100;
    $scope.trades = [];
    $scope.currentTrade = null;

    function init() {
        trackRequests();
    }

    $scope.findArbitrage = function() {
        if (binanceService.getSymbols().length === 0) return;
        $scope.LOADING.ARBITRAGE = true;

        binanceService.refreshAllOrderBooks()
            .then(binanceService.getSymbols)
            .then(analyzeSymbolsForArbitrage)
            .then(function(trades) {
                return $scope.trades = trades;
            })
            .catch(console.error)
            .finally(function() {
                $scope.LOADING.ARBITRAGE = false;
            });
    };

    function analyzeSymbolsForArbitrage(symbols) {
        console.log('Optimizing...');
        var relationships = [];
        symbols.forEach(function(symbol1) {
            symbols.forEach(function(symbol2) {
                symbols.forEach(function(symbol3) {
                    var relationship = binanceService.relationships(symbol1, symbol2, symbol3);
                    if (relationship) {
                        var calculated = binanceService.optimizeAndCalculate(relationship, $scope.CONFIG.INVESTMENT.MAX);
                        relationship.margin = calculated.percent;
                        relationships.push(relationship);
                    }
                });
            });
        });
        console.log('Done optimizing');
        return relationships;
    }

    $scope.setCurrentTrade = function(trade) {
        $scope.currentTrade = trade;
    };

    function trackRequests() {
        var tick = function() {
            $scope.percentRequestWeightRemaining = $scope.RATE_LIMIT.TYPE.REQUEST.REMAINING() / $scope.RATE_LIMIT.TYPE.REQUEST.MINUTE_LIMIT * 100;
        };
        tick();
        $interval(tick, 500);
    }
    
    init();

}
