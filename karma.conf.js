module.exports = function(config) {
  config.set({
    basePath: '',

    files: [
        // melonJS
        { pattern: 'build/melonjs.js', watched: false },
        // test data
        { pattern: 'tests/data/**/*', watched: false, included: false, served: true, nocache: false },
        // test files
        'tests/helper/helper-spec.js',
        'tests/spec/**/*.js'
    ],

    proxies: {
        "/tests/": "/base/tests/"
    },

    frameworks: ['jasmine'],
    
    client: {
        jasmine: {
            random: false,
            seed: '4321',
            oneFailurePerSpec: false,
            failFast: true,
            timeoutInterval: 1000
        }
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
            { type: 'html', subdir: 'report-html' }
        ]
    },

    //other supported options are Chrome and ChromeHeadless
    browsers: ["ChromeHeadless"],
    singleRun: true

  });

  if (process.env.TRAVIS) {
     config.nyanReporter.renderOnRunCompleteOnly = true;
  }
}
