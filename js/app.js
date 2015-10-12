$(function() {

  var TemplateModel = Backbone.Model.extend({
    templateDir: 'handlebars',
    hbsRaw     : null,
    hbs        : null,
    initialize: function(data) {
      console.log(data);
      this.url = this.templateDir + '/' + data.template;
      this.listenTo(this,'error',this.error);
    },
    parse: function(d) {
      console.log("parse");
    },
    sync: function() {
      var self = this;
      Backbone.ajax({
        url: this.url
      }).then(function(d) {
        self.onHbs(d);
      });
    },
    onHbs: function(hbs) {
      this.hbsRaw = hbs;
      this.compile();
      this.trigger('sync');
    },
    compile: function() {
      this.hbs = Handlebars.compile(this.hbsRaw);
    },
    error: function(e) {
      console.log('in error');
      console.log(e);
    }
  });

  var TemplateView = Backbone.View.extend({
    data        : null,
    model       : null,
    renderOnLoad: true,
    initialize: function(d) {
      this.data = d.data;
      this.model = new TemplateModel({template: d.template});
      if(this.renderOnLoad) {
        this.listenToLoad();
      }
      this.model.fetch();
    },
    listenToLoad: function() {
      this.listenTo(this.model, 'sync', this.render);
    },
    render: function() {
      this.$el.html(this.model.hbs(this.data));
      this.$el.parent().removeClass('loading');
    }
  });

  var ParameterView = Backbone.View.extend({
    name       : null,
    type       : null,
    default    : null,
    example    : null,
    description: null,
    required   : null,
    requiredText: function() {
      if(this.required) {
        return "Required"
      } else {
        return "Optional"
      }
    },
    requiredColor: function() {
      if(this.required) {
        return "red"
      } else {
        return "blue"
      }
    },
    typeText: function() {
      var out = [];
      if(this.type) {
        out.push(this.type);
      }
      if(this.default) {
        out.push('(default:' + this.default + ')');
      }
      if(this.example) {
        out.push('(example: ' + this.example + ')');
      }
      return out.join(' ');
    }
  });

  var Parameters = Backbone.Model.extend({
    type: null,
    parameters: null,
    initialize: function(parameters,operation,definitions) {
      var self = this;
      this.parameters = [];
      this.definitions = definitions;
      this.operation = operation;
      _.each(parameters, function (parameter) {
        if (parameter.name && parameter.name === 'body') {
          var schema = self.getSchema(parameter.schema);
          self.buildParameters(schema);
        }
      });
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
        var view = new (ParameterView.extend({
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

  var OperationView = Backbone.View.extend({
    operation: null,
    path: null,
    summary: null,
    description: null,
    consumes: [],
    produces: []
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
      var tempView = new TemplateView({
        template: 'test.hbs',
        el: '.api-data',
        data: this.model.get('processed')
      });
    }
  });

  setTimeout(function() {
    var apiInfo = new ApiInfo();
  },0);

});