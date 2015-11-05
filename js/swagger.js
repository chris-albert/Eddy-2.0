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

var ApiDetail = Backbone.View.extend({
  data: null,
  initialize: function(opt) {
    this.model = opt.data;
    this.renderTemplate();
  },
  renderTemplate: function() {
    this.templateView = new Template.TemplateView({
      template: 'api-detail',
      el      : '.api-detail',
      data    : this.model
    });
  }
});

var ApiEndpoint = Backbone.View.extend({
  data: null,
  events: {
    'click .endpoint-header': 'onClick'
  },
  initialize: function(opt) {
    this.model = opt.data;
    this.renderTemplate();
  },
  renderTemplate: function() {
    this.templateView = new Template.TemplateView({
      template: 'api-endpoint',
      el      : '.api-endpoint',
      data    : this.model
    });
    this.listenTo(this.templateView,'loaded',this.templateLoaded);
  },
  templateLoaded: function() {
    var self = this;
    _.each(this.model.definitions,function(definition) {
      var apiDetail = new ApiDetail({
          data: definition
      });
      self.listenTo(apiDetail.templateView,'loaded',function() {
        self.templateView.$el.append(apiDetail.templateView.$el);
        self.$('.api-detail').hide();
      });
    });
    this.$el = this.templateView.$el;
    this.delegateEvents(this.events);

  },
  onClick: function() {
    this.$('.api-detail').slideToggle({duration: 1000});
  }
});

var ApiGroup = Backbone.View.extend({
  data: null,
  appendTo: null,
  events: {
    'click .group-header': 'onClick'
  },
  initialize: function(opt) {
    this.model = opt.data;
    this.renderTemplate();
  },
  renderTemplate: function() {
    this.templateView = new Template.TemplateView({
      template: 'api-group',
      el      : '.api-group',
      data    : this.model
    });
    this.listenTo(this.templateView,'loaded',this.templateLoaded);
  },
  templateLoaded: function() {
    this.children = [];
    var self = this;
    _.each(this.model.paths,function(path) {
      var apiEndpoint = new ApiEndpoint({
        data: path
      });
      self.children.push(apiEndpoint);
      self.listenTo(apiEndpoint.templateView,'loaded',function() {
        self.templateView.$('.endpoint').append(apiEndpoint.templateView.$el);
        self.$('.group-content').hide();
      });
    });
    this.$el = this.templateView.$el;
    this.delegateEvents(this.events);
  },
  onClick: function() {
    this.$('.group-content').slideToggle({duration: 1000});
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

var ApiInfo = Backbone.View.extend({
  el: '.api-data',
  model: new ApiModel(),
  templateView: null,
  initialize: function() {
    this.listenTo(this.model,'sync',this.render);
    this.model.fetch();
  },
  render: function() {
    this.renderTemplate();
  },
  renderTemplate: function() {
    this.templateView = new Template.TemplateView({
      template: 'api-container',
      el      : '.api-container',
      data    : this.model.get('processed')
    });
    this.listenTo(this.templateView,'loaded',this.templateLoaded);
  },
  templateLoaded: function() {
    this.$el.html(this.templateView.$el);
    this.$el.parent().removeClass('loading');
    var self = this;
    this.children = [];
    _.each(this.model.get('processed'),function(group,name) {
      var apiGroup = new ApiGroup({data: group});
      self.children.push(apiGroup);
      self.listenTo(apiGroup.templateView,'loaded',function() {
        self.templateView.$el.append(apiGroup.templateView.$el);
      });
    });
  }
});

module.exports = {
  ApiInfo: ApiInfo
};