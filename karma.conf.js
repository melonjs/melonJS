module.exports = function(config) {

  var sourceFiles = require("./sourceFiles.json");
  var testSpecs = require("./testSpecs.json");

  var files = sourceFiles.concat("tests/spec/helper-spec.js").concat(testSpecs);
  var files = files.concat([{pattern: 'tests/data/**/*', watched: false, included: false, served: true}]);


  config.set({

    basePath: '',

    //test framework would be jasmine however other frameworks can be used
    frameworks: ['jasmine'],
    //all js files needed for tests to run order matters! e.g. do not load angular mocks before angular ect...
    files: files,

    browsers: ['Chrome'], // You may use 'ChromeCanary', 'Chromium' or any other supported browser
    proxies: {
      "/tests/": "/base/tests/"
      }
    // you can define custom flags
  })
}