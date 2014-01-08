(function () {
    // enable game canvas below for debugging
    var showCanvas = false,
        loadCount = 0,
        game = {},
        that = this,

        initMelon = function (callback) {
            game.PlayScreen = me.ScreenObject.extend({
                /** 
                 *  action to perform on state change
                 */
                onResetEvent: function() {
                    me.game.reset();
                    // clear the background
                    me.game.world.addChild(new me.ColorLayer('background', '#000000', 0), 0);
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

            // switch to the Play Screen
            me.state.set(me.state.PLAY, new game.PlayScreen());
            me.state.change(me.state.PLAY);
        },
        
        // loads the Jasmine environment, runs tests
        loadJasmine = function () {
            var jasmineEnv = jasmine.getEnv();
            jasmineEnv.updateInterval = 1000;

            var htmlReporter = new jasmine.HtmlReporter();
            jasmineEnv.addReporter(htmlReporter);

            jasmineEnv.specFilter = function(spec) {
                return htmlReporter.specFilter(spec);
            };

            jasmineEnv.execute();
        };

        // init MelonJS
        window.onReady(function () {
            initMelon(function () {
                loadJasmine().bind(this);
            });
        });
        
}());
