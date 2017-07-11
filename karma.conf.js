module.exports = function(config) {

  var sourceFiles = require("./sourceFiles.json");
  var testSpecs = 'tests/spec/**/*.js';

  var files = sourceFiles.concat("tests/helper/helper-spec.js").concat(testSpecs);
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
    // reporter options
    nyanReporter: {
        // suppress the error report at the end of the test run
        suppressErrorReport: false, // default is false

        // suppress the red background on errors in the error
        // report at the end of the test run
        suppressErrorHighlighting: false, // default is false

        // increase the number of rainbow lines displayed
        // enforced min = 4, enforced max = terminal height - 1
        numberOfRainbowLines: 4, // default is 4

        // only render the graphic after all tests have finished.
        // This is ideal for using this reporter in a continuous
        // integration environment.
        renderOnRunCompleteOnly: false // default is false
    },
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

    proxies: {
      "/tests/": "/base/tests/"
      },

    // This is the new content for your travis-ci configuration test
    //  Custom launcher for Travis-CI
    customLaunchers: {
        Chrome_travis_ci: {
           base: 'Chrome',
           flags: ['--no-sandbox']
         }
    },

    singleRun: true
  });

  if(process.env.TRAVIS){
     config.browsers = ['Chrome_travis_ci'];
     config.nyanReporter.renderOnRunCompleteOnly = true;
  }
}
