var _          = require('underscore');
var Backbone   = require('backbone');
var $          = require('jquery');
var Handlebars = require('handlebars');

var TemplateCache = new (Backbone.Model.extend({
  cache: null,
  initialize: function() {
    this.cache = {};
  },
  isCached: function(name) {
    return this.getCache(name) != null;
  },
  isPendingCached: function(name) {
    var c = this.cache[name];
    return c && c.pending;
  },
  setCache: function(name,data) {
    this.cache[name] = data;
  },
  getCache: function(name) {
    var c = this.cache[name];
    if(c && !c.pending) {
      return c.data;
    }
    return null;
  },
  pendingCache: function(name) {
    this.setCache(name,{
      pending: true,
      data   : null
    });
  },
  finalizeCache: function(name,data) {
    var finalizedCache = {
      pending: false,
      data   : data
    };
    this.trigger('cache:finalized:' + name,finalizedCache);
    this.setCache(name,finalizedCache);
  },
  doCache: function(key,funcMiss,funcHit) {
    var self = this;
    if(this.isCached(key)) {
      funcHit(this.getCache(key));
    } else if(this.isPendingCached(key)) {
      this.on('cache:finalized:' + key,function(cache) {
        funcHit(cache.data);
      });
    } else {
      this.pendingCache(key);
      var r = funcMiss();
      if(_.isFunction(r['then'])) {
        r.then(function(d) {
          funcHit(d);
          self.finalizeCache(key,d);
        });
      }
    }
  }
}));

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
    TemplateCache.doCache(this.url,
      function() {
        return Backbone.ajax({
          url: self.url
        }).then(function (d) {
          return self.handlebars.compile(d);
        });
      },
      function(hit) {
        self.hbs = hit;
        self.trigger('sync');
      });
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
  isCacheable: false,
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