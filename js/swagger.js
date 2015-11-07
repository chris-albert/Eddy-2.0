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

var ApiData = Backbone.View.extend({
  el: 'api-info',
  initialize: function(opt) {
    this.model = opt.model;
  },
  render: function() {
    var data = [];
    data.push(this.model.get('host'));
    data.push(this.model.get('basePath'));
    data.push(this.model.get('info').title);
    data.push(this.model.get('info').version);
  }
});

var ApiDetailView = Template.TemplateView.extend({
  template: 'api-detail',
  onTemplateLoaded: function() {
    this.$el.hide();
  }
});

var ApiEndpointView = Template.NestedTemplateView.extend({
  template: 'api-endpoint',
  childView: ApiDetailView,
  childrenIterateKey: 'definitions',
  events: {
    'click .endpoint-header': 'onClick'
  },
  onClick: function() {
    this.$('.api-detail').slideToggle({duration: 1000});
  }
});

var ApiGroupView = Template.NestedTemplateView.extend({
  template : 'api-group',
  childView: ApiEndpointView,
  childrenIterateKey: 'paths',
  appendTo: '.endpoint',
  events: {
    'click .group-header': 'onClick'
  },
  onClick: function() {
    this.$('.group-content').slideToggle({duration: 1000});
  },
  onTemplateLoaded: function() {
    this.$('.group-content').hide();
  }
});

var ApiContainerView = Template.NestedTemplateView.extend({
  template : 'api-container',
  childView: ApiGroupView
});

/**
 * Loads the config json for the api, then asynchronously
 * renders the `api-container` view.
 */
var ApiTemplateView = Backbone.View.extend({
  el   : '.api-data',
  model: new ApiModel(),
  containerView: null,
  initialize: function() {
    this.listenTo(this.model,'sync',this.render);
    this.model.fetch();
  },
  render: function() {
    var self = this;
    this.containerView = new ApiContainerView({
      data: this.model.get('processed')
    });
    //When the container view is loaded we want to put template in
    //our html and remove the loading spinner
    this.listenTo(this.containerView,'loaded',function() {
      self.$el.html(this.containerView.$el);
      self.$el.parent().removeClass('loading');
    })
  }
});

module.exports = {
  ApiTemplateView: ApiTemplateView
};