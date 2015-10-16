var _          = require('underscore');
var Backbone   = require('backbone');
var Eddy       = require('./eddy');
var Template   = require('./template-loader');
var _String    = require("underscore.string");

var Parameters = Backbone.Model.extend({
  type: null,
  parameters: null,
  initialize: function(parameters,operation,definitions) {
    var self = this;
    this.parameters = [];
    this.definitions = definitions;
    this.operation = operation;
    _.each(parameters, function (parameter) {
      if (parameter.in && _.isFunction(self['build' + _String.capitalize(parameter.in)])) {
        self['build' + _String.capitalize(parameter.in)](parameter);
      }
    });
  },
  buildQuery: function(parameter) {
    console.log(parameter);
    var view = new (Eddy.ParameterView.extend({
      name       : parameter.name,
      type       : parameter.type,
      default    : parameter.default,
      example    : parameter.example,
      description: parameter.description,
      required   : parameter.required
    }));
    this.parameters.push(view);
  },
  buildBody: function(parameter) {
    var schema = this.getSchema(parameter.schema);
    this.buildParameters(schema);
  },
  getSchema: function(schema) {
    var defStart = '#/definitions/';
    if(schema && schema.$ref && schema.$ref.startsWith(defStart)) {
      var defName = schema.$ref.replace(defStart,'');
      if(this.definitions[defName]) {
        return this.definitions[defName];
      }
    } else if(schema) {
      return schema;
    }
    return {};
  },
  buildParameters: function(schema) {
    var self = this;
    _.each(schema.properties,function(property,key) {
      var view = new (Eddy.ParameterView.extend({
        name       : key,
        type       : property.type,
        default    : property.default,
        example    : property.example,
        description: property.description,
        required   : function() {
          return schema.required && schema.required.indexOf(key);
        }()
      }));
      self.parameters.push(view);
    });
  }
});

var ApiModel = Backbone.Model.extend({
  url: 'config/api.json',
  parse: function(d) {
    console.log(d);
    var tags = {},self = this;
    _.each(d.tags,function(tag) {
      tags[tag.name] = tag;
      tags[tag.name].paths = {};
    });
    _.each(d.paths,function(pathObj,path) {
      _.each(pathObj,function(opObj,op) {
        _.each(opObj.tags,function(tag) {
          opObj.operation = op;
          if(tags[tag].paths[path]) {
            tags[tag].paths[path].operations.push(op);
            tags[tag].paths[path].definitions.push(self.buildDefinition(opObj,d.definitions));
          } else {
            tags[tag].paths[path] = {
              path       : path,
              operations : [op],
              definitions: [self.buildDefinition(opObj, d.definitions)]
            };
          }
        });
      });
    });
    d.processed = tags;
    return d;
  },
  buildDefinition: function(def,definitions) {
    if(def.parameters) {
      var parameters = new Parameters(def.parameters,def,definitions);
      def.parameters = parameters.parameters;
    }
    return def;
  }
});

var ApiInfo = Backbone.View.extend({
  el: '.api-info',
  model: new ApiModel(),
  initialize: function() {
    this.listenTo(this.model,'sync',this.render);
    this.model.fetch();
  },
  render: function() {
    var data = [];
    console.log(this.model.attributes);
    data.push(this.model.get('host'));
    data.push(this.model.get('basePath'));
    data.push(this.model.get('info').title);
    data.push(this.model.get('info').version);
    this.$el.html(data.join(" - "));
    this.$el.parent().removeClass('loading');
    this.renderTemplate();
  },
  renderTemplate: function() {
    var tempView = new Template.TemplateView({
      template: 'test.hbs',
      el: '.api-data',
      data: this.model.get('processed')
    });
  }
});

module.exports = {
  ApiInfo: ApiInfo
};