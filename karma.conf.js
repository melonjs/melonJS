module.exports = function(config) {

  var sourceFiles = require("./sourceFiles.json");
  var testSpecs = require("./testSpecs.json");

  var files = sourceFiles.concat("tests/spec/helper-spec.js").concat(testSpecs);
  var files = files.concat([{pattern: 'tests/data/**/*', watched: false, included: false, served: true}]);


  config.set({

    basePath: '',

    frameworks: ['jasmine'],
    //all js files needed for tests to run order matters!
    files: files,

    //Note that instrumented js files are very inconvenient for debugging purpose, so consider having separate launch profile without instrumentation for debugging purposes
    preprocessors: {
      './src/**/*.js': 'coverage',
    },

    reporters: ['nyan', 'coverage', 'htmlDetailed'],
    htmlDetailed: {
      dir: 'build/reports/karma',
      splitResults: true,
      useHostedBootstrap: true,
      autoReload: false
    },
    coverageReporter: {
      dir: 'build/reports/coverage',
      reporters: [
        {type: 'html', subdir: 'report-html'}
      ]
    },


    browsers: ['ChromeHeadless'],
    proxies: {
      "/tests/": "/base/tests/"
      },

    singleRun: true
  })
}