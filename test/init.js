(function () {
    var i, l,
        //  Add includes and test specification scripts here
        testScripts = [
            // melon
            '../build/melonJS-0.9.9.js',
            '../plugins/debug/debugPanel.js',
            // jasmine
            '../bower_components/jasmine/lib/jasmine-core/jasmine.js',
            '../bower_components/jasmine/lib/jasmine-core/jasmine-html.js',
            'plugins/plugins.js',
            'spec/spechelper.js',
            // specs (functional tests)
            'spec/entity/draggable.js',
            'spec/entity/droptarget.js'
        ],
        // enable game canvas below for debugging
        showCanvas = false,
        loadCount = 0,
        game = {},
        initMelon = function (callback) {
            game.PlayScreen = me.ScreenObject.extend({
                /** 
                 *  action to perform on state change
                 */
                onResetEvent: function() {
                    // clear the background
                    me.game.add(new me.ColorLayer('background', '#000000', 0), 0);
                    if (!showCanvas) {
                        me.video.getScreenCanvas().style.display = 'none';
                    }
                    callback();
                }
            });

            // Initialize the video, set scale to 1 to get accurate test results
            if (!me.video.init('screen', 1024, 768, true, 1)) {
                alert('Your browser does not support HTML5 canvas.');
                return;
            }
            // add '#debug' to the URL to enable the debug Panel
            if (document.location.hash === '#debug') {
                window.onReady(function () {
                    me.plugin.register.defer(debugPanel, 'debug');
                });
            }
            // Initialize the audio
            me.audio.init('mp3,ogg');
            // switch to the Play Screen
            me.state.set(me.state.PLAY, new game.PlayScreen());
            me.state.change(me.state.PLAY);
        },
        // loads the Jasmine environment, runs tests
        loadJasmine = function () {
            // get the environment
            var environment = jasmine.getEnv();
            // add the reporter
            environment.addReporter(new jasmine.HtmlReporter());
            // exectute the tests
            environment.execute();
        },
        // called when a spec is loaded
        callback = function () {
            ++loadCount;
            if (loadCount === testScripts.length) {
                // init MelonJS
                window.onReady(function onReady() {
                    initMelon(function () {
                        loadJasmine();
                    });
                });
            }
        };
    // load includes and test scripts
    for (i = 0, l = testScripts.length; i < l; ++i) {
        var script = document.createElement('script');
        // create script and append to head
        script.src = testScripts[i];
        script.async = false;
        document.head.appendChild(script);
        // call the callback function when a script is loaded
        script.onreadystatechange = script.onload = function () {
            var state = script.readyState;
            if (!state || /loaded|complete/.test(state)) {
                callback();
            }
        };
    }
}());
