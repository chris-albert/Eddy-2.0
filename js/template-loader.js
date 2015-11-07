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

/**
 * Template views are loaded asynchronously from the server
 */
var TemplateView = Backbone.View.extend({
  //The data that will be applied to your handlebars template
  data              : null,
  model             : null,
  renderOnLoad      : true,
  partials          : null,
  partialHash       : null,
  mainLoadedCount   : 0,
  partialLoadedCount: 0,
  insertEl          : null,
  isCacheable       : false,
  initialize: function(opt) {
    this.data = this.data || opt.data;
    this.model = new TemplateModel({template: this.template + '.hbs'});
    this.partials = this.partials || [];
    this.partialHash = {};
    if(!this.el && this.template) {
      this.el = '.' + this.template;
    }
    this.load();
    this.on('loaded',this.onTemplateLoaded);
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
    this.delegateEvents(this.events);
    this.trigger('loaded');
  },
  onTemplateLoaded: function() {},
  attachPartials: function() {
    var self = this;
    _.each(this.partialHash,function(template,name) {
       self.model.handlebars.registerPartial(name,template.hbs);
    });
  }
});

var NestedTemplateView = TemplateView.extend({
  childrenTemplates: null,
  childView: null,
  data: null,
  childrenIterateKey: null,
  appendTo: null,
  initialize: function(opt) {
    this.data = this.data || opt.data;
    if(!this.childView) {
      console.error('You must specify a child view for nested templates to work');
      return;
    }
    this.childrenTemplates = this.childrenTemplates || [];
    NestedTemplateView.__super__.initialize.apply(this,opt);

    this.renderChildren();
  },
  renderChildren: function() {
    _.each(this.getIterable(),function(value) {
      var child = new this.childView({data: value});
      this.childrenTemplates.push(child);
      this.listenTo(child,'loaded',function() {
        if(this.appendTo) {
          this.$(this.appendTo).append(child.$el);
        } else {
          this.$el.append(child.$el);
        }
      },this);
    },this);
  },
  /**
   * What you want to iterate over for rendering children,
   * by default this is just the base of this classes data
   */
  getIterable: function() {
    if(this.childrenIterateKey) {
      return this.data[this.childrenIterateKey];
    } else {
      return this.data;
    }
  }
});

module.exports = {
  TemplateModel     : TemplateModel,
  TemplateView      : TemplateView,
  NestedTemplateView: NestedTemplateView
};