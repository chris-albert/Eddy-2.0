var SwaggerContact = Backbone.Model.extend({
    defaults: {
      email: null,
      name : null
    }
  });

  var SwaggerLicense = Backbone.Model.extend({
    defaults: {
      name: null,
      url : null
    }
  });

  var SwaggerInfo = Backbone.Model.extend({
    defaults: {
      contact       : new SwaggerContact(),
      description   : null,
      license       : new SwaggerLicense(),
      termsOfService: null,
      title         : null,
      version       : null
    }
  });

  var SwaggerSchemes = Backbone.Collection.extend();

  var SwaggerExternalDocs = Backbone.Model.extend({
    defaults: {
      description: null,
      url        : null
    }
  });

  var SwaggerTag = Backbone.Model.extend({
    defaults: {
      description : null,
      name        : null,
      externalDocs: new SwaggerExternalDocs()
    }
  });

  var SwaggerTags = Backbone.Collection.extend({
    model: new SwaggerTag()
  });

  var SwaggerPaths = Backbone.Collection.extend({
    
  });

  var SwaggerPath = Backbone.Model.extend({
    
  });

  var SwaggerOperation = Backbone.Model.extend({
      
  });

  var Swagger = Backbone.Model.extend({
    defaults: {
      swagger     : null,
      host        : null,
      basePath    : null,
      schemes     : new SwaggerSchemes(),
      info        : new SwaggerInfo(),
      externalDocs: new SwaggerExternalDocs()
    }
  });
