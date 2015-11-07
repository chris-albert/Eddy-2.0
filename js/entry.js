var DomReady  = require('domready');
var Swagger   = require('./swagger');
var _         = require('underscore');

function bindSemanticJquery() {
  window.jQuery = require('jquery');
  require('../semantic/dist/components/accordion');
}

DomReady(function() {
  bindSemanticJquery();
  //new Swagger.ApiInfo();
  new Swagger.ApiTemplateView();
});
