
/* Game namespace */
var game = {
    // Run on page load.
    onload: function () {
        // Initialize the video.
        if (!me.video.init(480, 320, {scaleMethod : "flex", renderer : me.video.CANVAS})) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // enable deviceorientation
        me.input.registerPointerEvent("pointerleave", me.game.viewport, function() {
            if (me.device.watchDeviceOrientation() || me.device.watchAccelerometer()) {
                me.input.releasePointerEvent("pointerleave", me.game.viewport);
            }
        });

        // clear the background
        me.game.world.addChild(new me.ColorLayer("background", "#000000"), 0);

        var DeviceInfo = me.Renderable.extend({
            init: function() {
                this._super(me.Renderable, "init", [0, 0, 100, 200]);
                this.font = new me.Text(0, 0, {font: "Arial", size: "24px", fillStyle: "#FFFFFF"});
                this.anchorPoint.set(0, 0);
            },
            update: function() {
                return true;
            },
            draw: function(renderer) {
                // current device orientation ("portrait" or "landscape")
                var orientation = me.device.getScreenOrientation();

                // write down device information
                renderer.setColor("#ffffff");
                if (me.device.hasDeviceOrientation) {
                    this.font.draw(renderer, "Touch to enable motion detection", 10, me.game.viewport.height - 30);
                } else {
                    this.font.draw(renderer, "Motion detection not supported", 10, me.game.viewport.height - 30);
                }

                this.font.draw(renderer, "Gamma: " + me.device.gamma,    10, 0);
                this.font.draw(renderer, "Beta: "  + me.device.beta,     10, 30);
                this.font.draw(renderer, "Alpha: " + me.device.alpha,    10, 60);
                this.font.draw(renderer, "X: " + me.device.accelerationX, 10, 90);
                this.font.draw(renderer, "Y: " + me.device.accelerationY, 10, 120);
                this.font.draw(renderer, "Z: " + me.device.accelerationZ, 10, 150);
                this.font.draw(renderer, "orientation: " + orientation,   10, 180);

                // draw a red circle based on the device motion and orientation
                var deltaX = ((orientation === "portrait" ? me.device.gamma : me.device.beta) * 10);
                var deltaY = ((orientation === "portrait" ? me.device.beta : me.device.gamma) * 10);
                var originX = me.Math.clamp((me.game.viewport.width  / 2) + deltaX, 0, me.game.viewport.width);
                var originY = me.Math.clamp((me.game.viewport.height / 2) + deltaY, 0, me.game.viewport.height);

                renderer.setColor("#ff000080");
                renderer.fillEllipse(originX, originY, 30, 30);
            }
        });

        // renderable to display device information
        me.game.world.addChild(new DeviceInfo(), 1);
    }
};
