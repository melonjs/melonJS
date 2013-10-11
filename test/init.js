(function () {
    var i, l,
        //  Add includes and test specification scripts here
        testScripts = [
            // melon
            '../build/melonJS-0.9.9.js',
            '../plugins/debug/debugPanel.js',
            // jasmine
            'lib/jasmine-1.3.1/jasmine.js',
            'lib/jasmine-1.3.1/plugins.js',
            'lib/jasmine-1.3.1/jasmine-html.js',
            'spec/spechelper.js',
            // specs (functional tests)
            'spec/entity/draggable.js',
            'spec/entity/droptarget.js'
        ],
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
                    me.game.add(new me.ColorLayer("background", "#000000", 0), 0);
                    if (!showCanvas) {
                        me.video.getScreenCanvas().style.display = 'none';
                    }
                    callback();
                },
                /** 
                 *  action to perform when leaving this screen (state change)
                 */
                onDestroyEvent: function() {
                    me.input.releasePointerEvent("mousemove", me.game.viewport);
                }
            });

            // Initialize the video.
            if (!me.video.init("screen", 1024, 768, true, 'auto')) {
                alert("Your browser does not support HTML5 canvas.");
                return;
            }
            // add "#debug" to the URL to enable the debug Panel
            if (document.location.hash === "#debug") {
                window.onReady(function () {
                    me.plugin.register.defer(debugPanel, "debug");
                });
            }
            // Initialize the audio.
            me.audio.init("mp3,ogg");
            // switch to the Play Screen.
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
