var DomReady = require('domready');
var Swagger  = require('./swagger');

DomReady(function() {
  console.log('im loaded in dom ready');
  new Swagger.ApiInfo();
});
