var DomReady = require('domready');
var Swagger  = require('./swagger');

DomReady(function() {
  new Swagger.ApiInfo();
});
