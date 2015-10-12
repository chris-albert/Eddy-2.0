module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    watch: {
      files: ['js/app.js'],
      tasks: ['browserify']
    },
    browserify: {
      dist: {
        files: {
          'js/app.bundle.js': ['js/app.js']
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-browserify');
};