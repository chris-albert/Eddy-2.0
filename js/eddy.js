var Backbone   = require('backbone');

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

module.exports = {
  ParameterView: ParameterView
};
