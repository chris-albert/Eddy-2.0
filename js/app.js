$(function() {

  var ApiModel = Backbone.Model.extend({
    url: 'config/api.json',
    parse: function(d) {
      console.log(d);
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