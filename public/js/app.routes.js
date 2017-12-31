angular
	.module('mMADApp')
	.config(routes);

routes.$inject = ['$routeProvider'];

function routes($routeProvider) {

	$routeProvider
        .when('/binance', {
            templateUrl: '/html/binance.html',
			controller: 'binanceController'
        })
		
		.otherwise({
			redirectTo: '/binance'
		});

}