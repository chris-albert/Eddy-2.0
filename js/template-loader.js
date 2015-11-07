var _          = require('underscore');
var Backbone   = require('backbone');
var $          = require('jquery');
var Handlebars = require('handlebars');

/**
 * Caches templates... duh
 *
 * We don't want to keep going to the server to get the same damn
 * template every .1 seconds so here we will cache all templates
 * by url. This also has a loading cache, so if you ask for the
 * same template 100 before 1 is loaded, it will set that url
 * to a pending stage and then run callback for each caller
 * that asked for the cache.
 */
var TemplateCache = new (Backbone.Model.extend({
  //The main cache
  cache: null,
  initialize: function() {
    this.cache = {};
  },
  /**
   * Checks if cache has `name` in it
   */
  isCached: function(name) {
    return this.getCache(name) != null;
  },
  /**
   * Checks if cache has name and is in pending stage
   */
  isPendingCached: function(name) {
    var c = this.cache[name];
    return c && c.pending;
  },
  /**
   * Sets the raw hash with `name` as key and `data` as value
   */
  setCache: function(name,data) {
    this.cache[name] = data;
  },
  /**
   * Gets a cache only if it's not pending, otherwise `null`
   */
  getCache: function(name) {
    var c = this.cache[name];
    if(c && !c.pending) {
      return c.data;
    }
    return null;
  },
  /**
   * Sets a cache key `name` as in pending state
   */
  pendingCache: function(name) {
    this.setCache(name,{
      pending: true,
      data   : null
    });
  },
  /**
   * Sets a cache key `name` and not pending with value `data`
   */
  finalizeCache: function(name,data) {
    var finalizedCache = {
      pending: false,
      data   : data
    };
    this.trigger('cache:finalized:' + name,finalizedCache);
    this.setCache(name,finalizedCache);
  },
  /**
   * The magic function, does everything... and well
   *
   * So here.. first we check to see if the cache has a non pending
   * result for the `key` if it does then job well done, call `funcHit`
   * with the result.
   *
   * If we don't have the `key` cached but it is in a pending state, we
   * want to call `funcHit` when the pending cache is done.
   *
   * If we don't have the `key` cached and we don't have it in a pending
   * state, we need to call `funcMiss` to fill the cache. As of now `funcMiss`
   * needs to return a `promise`, when the `promise` is redeemed we will
   * finalize the cache and call `funcHit`.
   *
   * The end...
   */
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

/**
 * Loads handlebars templates from the server using async
 *
 * By default looks at the server for `/handlebars/{this.template}`,
 * if it finds it, it sets the `hbs` property to the compiled handlebars
 * template. Each `TemplateModel` gets it own sandboxed handlebars engine,
 * so you can attach partials later without stepping on toes.
 */
var TemplateModel = Backbone.Model.extend({
  //Root dir to look for handlebars templates
  templateDir: 'handlebars',
  //The cached compiled handlebars template
  hbs        : null,
  //The handlebars engine
  handlebars : null,
  initialize: function(data) {
    this.handlebars = Handlebars.create();
    this.url = this.templateDir + '/' + data.template;
    this.listenTo(this,'error',this.error);
  },
  /**
   * When loading an async template we want to call the template cache,
   * so if we have to load many templates we just keep getting the same
   * one back.
   */
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
  /**
   * Logs what the error is, if template loading fails
   */
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
  //The template loaded from async
  model             : null,
  //If you want to render right away
  renderOnLoad      : true,
  //Array of async partials you want applied
  partials          : null,
  //Internal: used to keep track of loaded partials
  partialHash       : null,
  //Internal: used to know if main loaded
  mainLoadedCount   : 0,
  //Internal: used to count loaded partials
  partialLoadedCount: 0,
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
  /**
   * Loads main template and partials
   */
  load: function() {
    if(this.renderOnLoad) {
      this.listenTo(this.model, 'sync', this.mainLoaded);
    }
    this.model.fetch();
    this.loadPartials();
  },
  /**
   * Loads async partials
   */
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
  /**
   * Sets a partial as being loaded
   */
  partialLoaded: function(tempName,temp) {
    this.partialHash[tempName] = temp;
    this.partialLoadedCount += 1;
    this.checkAllLoaded();
  },
  /**
   * Sets the main template as being loaded
   */
  mainLoaded: function() {
    this.mainLoadedCount = 1;
    this.checkAllLoaded();
  },
  /**
   * Checks that main template and all partials are loaded
   */
  checkAllLoaded: function() {
    if(this.mainLoadedCount === 1 && this.partialLoadedCount == this.partials.length) {
      this.allLoaded();
    }
  },
  /**
   * Fired with all partials are loaded and main template is loaded
   */
  allLoaded: function() {
    this.attachPartials();
    this.template = this.model.hbs(this.data);
    this.$el = $('<div />').html(this.template).contents();
    this.delegateEvents(this.events);
    this.trigger('loaded');
  },
  /**
   * Override this to have callback to when complete template is loaded,
   * partials and all
   */
  onTemplateLoaded: function() {},
  /**
   * Attaches all partials to local handlebars engine
   */
  attachPartials: function() {
    var self = this;
    _.each(this.partialHash,function(template,name) {
       self.model.handlebars.registerPartial(name,template.hbs);
    });
  }
});

/**
 * Helper for rendering hbs templates that have nested async hbs templates.
 *
 * Iterates over `data` or `getIterable` to pass data on to nexted tempaltes
 */
var NestedTemplateView = TemplateView.extend({
  //Stores the children template object
  childrenTemplates: null,
  //The view to create for each child - REQUIRED
  childView: null,
  //Data for this view
  data: null,
  //Key to pull from data for your children iteration
  childrenIterateKey: null,
  //Selector you want to append children to,
  //if blank uses `this.$el`
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
  /**
   * Goes through `getIterable()` and renders a template for
   * each element
   */
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