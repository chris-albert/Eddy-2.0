var _          = require('underscore');
var Backbone   = require('backbone');
var $          = require('jquery');
var Handlebars = require('handlebars');

var templateCache = {};

var TemplateModel = Backbone.Model.extend({
  templateDir: 'handlebars',
  hbs        : null,
  handlebars : null,
  initialize: function(data) {
    this.handlebars = Handlebars.create();
    this.url = this.templateDir + '/' + data.template;
    this.listenTo(this,'error',this.error);
  },
  sync: function() {
    var self = this;
    console.log(templateCache[this.url]);
    if(templateCache[this.url]) {
      this.hbs = templateCache[this.url];
      this.trigger('sync');
    } else {
      Backbone.ajax({
        url: this.url
      }).then(function (d) {
        self.onHbs(d);
      });
    }
  },
  onHbs: function(hbsRaw) {
    this.compile(hbsRaw);
    console.log('hey')
    templateCache[this.url] = this.hbs;
    this.trigger('sync');
  },
  compile: function(hbsRaw) {
    this.hbs = this.handlebars.compile(hbsRaw);
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
  partials    : null,
  partialHash : null,
  mainLoadedCount: 0,
  partialLoadedCount: 0,
  insertEl: null,
  initialize: function(d) {
    this.data = d.data;
    this.model = new TemplateModel({template: d.template + '.hbs'});
    this.partials = d.partials || [];
    this.partialHash = {};

    this.load();
  },
  load: function() {
    if(this.renderOnLoad) {
      this.listenTo(this.model, 'sync', this.mainLoaded);
    }
    this.model.fetch();
    this.loadPartials();
  },
  loadPartials: function() {
    var self = this;
    _.each(this.partials,function(tempName) {
      var temp = new TemplateModel({template: tempName + '.hbs'});
      self.listenTo(temp,'sync',function() {
        self.partialLoaded(tempName,temp);
      });
      temp.fetch();
    });
  },
  partialLoaded: function(tempName,temp) {
    this.partialHash[tempName] = temp;
    this.partialLoadedCount += 1;
    this.checkAllLoaded();
  },
  mainLoaded: function() {
    this.mainLoadedCount = 1;
    this.checkAllLoaded();
  },
  checkAllLoaded: function() {
    if(this.mainLoadedCount === 1 && this.partialLoadedCount == this.partials.length) {
      this.allLoaded();
    }
  },
  allLoaded: function() {
    this.attachPartials();
    this.template = this.model.hbs(this.data);
    this.$el = $('<div />').html(this.template).contents();
    this.trigger('loaded');
  },
  attachPartials: function() {
    var self = this;
    _.each(this.partialHash,function(template,name) {
       self.model.handlebars.registerPartial(name,template.hbs);
    });
  }
});

module.exports = {
  TemplateModel: TemplateModel,
  TemplateView : TemplateView
};