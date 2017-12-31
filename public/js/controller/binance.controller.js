angular
    .module('controllers')
    .controller('binanceController', BinanceController);

BinanceController.$inject = ['$scope', 'binanceService'];

function BinanceController($scope, binanceService) {

    $scope.CONFIG = {
        DECIMALS: 8,
        INVESTMENT: 100,
        PROFIT: {
            MIN: 1.00
        }
    };

    $scope.symbols = [];
    $scope.priceMap = {};
    $scope.results = [];

    $scope.trade = null;

    function init() {
        binanceService.getSymbols()
            .then(function(symbols) {
                $scope.symbols = symbols;
            })
            .catch(console.error);
    }

    $scope.findArbitrage = function() {
        if ($scope.symbols.length === 0) return;
        $scope.findingArbitrage = true;

        binanceService.refreshPriceMap()
            .then(function(priceMap) {
                $scope.priceMap = priceMap;

                var result = {};
                var results = [];
                angular.forEach($scope.symbols, function(symbol1) {
                    angular.forEach($scope.symbols, function(symbol2) {
                        angular.forEach($scope.symbols, function(symbol3) {
                            result = binanceService.relationships(symbol1, symbol2, symbol3, $scope.CONFIG.INVESTMENT);
                            if (!result) return;
                            if (result.percent < $scope.CONFIG.PROFIT.MIN) return;
                            results.push(result);
                        });
                    });
                });
                $scope.results = results.sort(function(a,b) {
                    if (a.percent < b.percent) return 1;
                    if (a.percent > b.percent) return -1;
                    return 0;
                });
            })
            .catch(console.error)
            .finally(function() {
                $scope.findingArbitrage = false;
            });
    };

    $scope.generateLink = function(a, b) {
        if ($scope.priceMap[a+b]) return binanceService.URL.replace('{a}', a).replace('{b}', b);
        else return binanceService.URL.replace('{a}', b).replace('{b}', a);
    };

    $scope.setTrade = function(result) {
        $scope.trade = result;
    };
    
    init();

}
