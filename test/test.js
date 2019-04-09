var assert = require('chai').assert;
var calculationNode = require('../src/main/CalculationNode');

describe('CalculationNode', function() {
  describe('calculateDustless', function() {
    context('with an integer', function() {
      it('should return an integer', function() {
        assert.equal(calculationNode.calculateDustless('SOMETICKER', 1), 1)
      });
    });
  });
});