angular
    .module('services')
    .service('bridgeService', BridgeService);

BridgeService.$inject = ['$http'];

function BridgeService($http) {

    var service = this;

    service.getApiVariables = function() {
        return $http.get('/bridge/api')
            .then(function(response) {
                return response.data;
            })
            .catch(function(response) {
                throw response;
            });
    };

}
