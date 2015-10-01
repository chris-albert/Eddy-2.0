$(function() {

  var ApiModel = Backbone.Model.extend({
    url: 'config/api.json',
    parse: function(d) {
      console.log(d);
      var tags = {};
      _.each(d.tags,function(tag) {
        tags[tag.name] = tag;
        tags[tag.name].paths = [];
      });
      _.each(d.paths,function(pathObj,path) {
        _.each(pathObj,function(opObj,op) {
          _.each(opObj.tags,function(tag) {
            tags[tag].paths.push({
              path      : path,
              operation : op,
              definition: opObj
            });
          });
        });
      });
      d.processed = tags;
      return d;
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
    }
  });

  setTimeout(function() {
    var apiInfo = new ApiInfo();
  },1000);

});