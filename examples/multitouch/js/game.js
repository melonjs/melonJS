
/* Game namespace */
var game = {
    // Run on page load.
    "onload" : function () {
        // Initialize the video.
        if (!me.video.init(1024, 768, {wrapper : "screen", scale : "auto"})) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // clear the background
        me.game.world.addChild(new me.ColorLayer("background", "#000000", 0), 0);
        // add a few squares
        me.game.world.addChild(new game.square(10, 10, {width: 100, height: 100}), 1);
        me.game.world.addChild(new game.square(400, 300, {width: 100, height: 100}), 2);
        me.game.world.addChild(new game.square(750, 600, {width: 100, height: 100}), 3);
    }
};
