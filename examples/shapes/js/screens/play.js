game.PlayScreen = me.Stage.extend({
    /**
     *  action to perform on state change
     */
    onResetEvent: function() {
        // clear the background
        me.game.world.addChild(new me.ColorLayer("background", "#5E3F66"), 0);

        // add a few shapes

        // physic-editor
        var physicEditorContainer = new me.Container(25, 75, 350, 600);
        physicEditorContainer.anchorPoint.set(0, 0);
        physicEditorContainer.addChild(new game.Poly(10, 75, {width: 200, height: 200, sprite:"hamburger"}), 1);
        physicEditorContainer.addChild(new game.Poly(200, 100, {width: 200, height: 200, sprite:"icecream3"}), 1);
        physicEditorContainer.addChild(new game.Poly(275, 0, {width: 200, height: 200, sprite:"icecream2"}), 1);
        physicEditorContainer.addChild(new game.Poly(50, 200, {width: 200, height: 200, sprite:"hotdog"}), 1);
        physicEditorContainer.addChild(new game.Poly(50, 300, {width: 200, height: 200, sprite:"icecream"}), 1);
        physicEditorContainer.addChild(new game.Circle(250, 350, {width: 50, height: 50}), 1);
        me.game.world.addChild(physicEditorContainer, 1);


        // physic body editor
        var physicBodyEditorContainer = new me.Container(390, 75, 500, 600);
        physicBodyEditorContainer.anchorPoint.set(0, 0);
        physicBodyEditorContainer.addChild(new game.Poly2(0, 0, {width: 256, height: 256, sprite:"test03"}), 7);
        physicBodyEditorContainer.addChild(new game.Poly2(0, 250, {width: 300, height: 300, sprite:"test02"}), 8);
        physicBodyEditorContainer.addChild(new game.Poly2(200, 100, {width: 256, height: 256, sprite:"test01"}), 9);
        me.game.world.addChild(physicBodyEditorContainer, 2);

        // display the current pointer coordinates on top of the pointer arrow
        me.game.world.addChild(new (me.Renderable.extend({
            init: function() {
                this._super(me.Renderable, 'init', [0, 0, 10, 10]);
                this.font = new me.Font("Arial", 10, "#FFFFFF");
                this.font.textAlign = "center";
                this.fontHeight = this.font.measureText(me.video.renderer, "DUMMY").height;
            },
            update : function (dt) {
                return true;
            },
            draw: function(renderer) {
                var x = Math.round(me.input.pointer.gameWorldX);
                var y = Math.round(me.input.pointer.gameWorldY);
                this.font.draw (
                    renderer,
                    "( " + x + "," + y + " )",
                    x,
                    y - this.fontHeight);
            }
        })), 10);
    }
});
