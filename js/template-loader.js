var Backbone   = require('backbone');
var Handlebars = require('handlebars');

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

module.exports = {
  TemplateModel: TemplateModel,
  TemplateView : TemplateView
};