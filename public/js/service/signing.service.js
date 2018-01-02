angular
    .module('services')
    .service('signingService', SigningService);

SigningService.$inject = [];

function SigningService() {

    var service = this;

    service.encrypt = function(message, key) {
        if (typeof message === 'object') message = JSON.stringify(message);
        return CryptoJS.HmacSHA256(message, key).toString();
    };

}
