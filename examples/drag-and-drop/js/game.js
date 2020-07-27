
/* Game namespace */
var game = {
    // Run on page load.
    "onload" : function () {
        // Initialize the video.
        if (!me.video.init(1024, 768, {scale : "auto", renderer : me.video.CANVAS})) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // clear the background
        me.game.world.addChild(new me.ColorLayer("background", "#000000", 0), 0);

        // add a few squares
        me.game.world.addChild(new game.square(200, 230, {width: 100, height: 100}), 1);

        // add a droptarget entity
        me.game.world.addChild(new game.droptarget(400, 200, {width: 200, height: 150}), 1);

        // add another droptarget entity
        me.game.world.addChild(new game.droptarget2(400, 400, {width: 200, height: 150}), 1);
    }
};
