describe("me.Sprite", function () {
    var container;
    var sprite;
    var setCurrentAnimationCallback = {}

    beforeAll(function () {
        container = new me.Container(50, 50, 150, 150);
        sprite = new me.Sprite(0, 0, {
            "framewidth" : 32,
            "frameheight" : 32,
            "image" : me.video.createCanvas(64, 64),
            "anchorPoint" : {x:0, y:0}
        });

        setCurrentAnimationCallback["callback"] = function () {};
        spyOn(setCurrentAnimationCallback, "callback");

        // add to a parent container
        container.addChild(sprite);
    });


    it("me.Sprite bounds return the visible part of the sprite", function () {
        var bounds = sprite.getBounds();
        expect(bounds.pos.x).toEqual(50);
        expect(bounds.pos.y).toEqual(50);
        expect(bounds.width).toEqual(32);
        expect(bounds.height).toEqual(32);
    });

    it("me.Sprite addAnimation should return the correct amount of frame", function () {
        expect(sprite.addAnimation("test", [ 0, 1 ])).toEqual(2);
        expect(sprite.addAnimation("test2", [ 0, 1, 0, 1, 0 ])).toEqual(5);
    });

    it("me.Sprite reverseAnimation should return the correct amount of frame", function () {
        expect(sprite.addAnimation("test", [ 0, 1])).toEqual(2);
        sprite.setCurrentAnimation("test");
        // XXX how to test the current animation sequence without using private objects
        expect(sprite.anim["test"].frames[0].name).toEqual(0);
        expect(sprite.anim["test"].frames[1].name).toEqual(1);
        sprite.reverseAnimation("test");
        expect(sprite.anim["test"].frames[0].name).toEqual(1);
        expect(sprite.anim["test"].frames[1].name).toEqual(0);
        sprite.reverseAnimation();
        expect(sprite.anim[sprite.current.name].frames[0].name).toEqual(0);
        expect(sprite.anim[sprite.current.name].frames[1].name).toEqual(1);
    });

    it("me.Sprite isCurrentAnimation allows to verify which animation is set", function () {
        expect(sprite.addAnimation("test", [ 0, 1 ])).toEqual(2);
        expect(sprite.addAnimation("yoyo", [ 1, 0, 1, 0 ], 60)).toEqual(4);
        sprite.setCurrentAnimation("test");
        expect(sprite.isCurrentAnimation("test")).toEqual(true);
        sprite.setCurrentAnimation("yoyo", "test");
        expect(sprite.isCurrentAnimation("test")).toEqual(false);
        expect(sprite.isCurrentAnimation("yoyo")).toEqual(true);
        for (var i = -1; i < 8; i++) {
            sprite.update(16);
        }
        // at this point we half way though the "reverse_test" animation
        expect(sprite.isCurrentAnimation("yoyo")).toEqual(true);
        for (var j = -1; j < 8; j++) {
            sprite.update(16);
        }
        // at this point "reverse_test" is finished and we switched to test
        expect(sprite.isCurrentAnimation("yoyo")).toEqual(false);
        expect(sprite.isCurrentAnimation("test")).toEqual(true);
    });

    it("me.Sprite bounds should be updated when the sprite is scaled", function () {
        var bounds = sprite.getBounds();

        // scale up the sprite
        sprite.scale(2.0); // w & h -> 64, 64
        expect(bounds.width).toEqual(64);
        expect(bounds.height).toEqual(64);
        expect(sprite.width).toEqual(64);
        expect(sprite.height).toEqual(64);

        // scale back to original size
        sprite.scale(0.5);
        expect(bounds.width).toEqual(32);
        expect(bounds.height).toEqual(32);
    });

    it("me.Sprite bounds should be updated when the anchor is changed", function () {
        var bounds = sprite.getBounds();

        sprite.anchorPoint.set(0, 1);
        expect(bounds.pos.x).toEqual(sprite.ancestor._absPos.x + sprite.pos.x - (0 * bounds.width));
        expect(bounds.pos.y).toEqual(sprite.ancestor._absPos.y + sprite.pos.y - (1 * bounds.height));

        sprite.anchorPoint.set(0.5, 0.5);
        expect(bounds.pos.x).toEqual(sprite.ancestor._absPos.x + sprite.pos.x - (0.5 * bounds.width));
        expect(bounds.pos.y).toEqual(sprite.ancestor._absPos.y + sprite.pos.y - (0.5 * bounds.height));

        sprite.anchorPoint.set(1, 0);
        expect(bounds.pos.x).toEqual(sprite.ancestor._absPos.x + sprite.pos.x - (1 * bounds.width));
        expect(bounds.pos.y).toEqual(sprite.ancestor._absPos.y + sprite.pos.y - (0 * bounds.height));

        sprite.anchorPoint.set(1, 1);
        expect(bounds.pos.x).toEqual(sprite.ancestor._absPos.x + sprite.pos.x - (1 * bounds.width));
        expect(bounds.pos.y).toEqual(sprite.ancestor._absPos.y + sprite.pos.y - (1 * bounds.height));
    });

    it("me.Sprite onComplete of setCurrentAnimation shall be called when sprite array of addAnimation is > 0", function () {

        var randomSpriteLength = Math.floor(Math.random() * Math.floor(100))
        var spriteArr =[];

        for (var i = -1; i < randomSpriteLength; i++) {
            spriteArr.push(1 + i);
        }

        sprite.addAnimation("sample", spriteArr, 10)
        sprite.setCurrentAnimation("sample", function () {
            setCurrentAnimationCallback.callback();
            expect(setCurrentAnimationCallback.callback).toHaveBeenCalled();
        })

        for (var j = -1; j < randomSpriteLength; j++) {
            sprite.update(16);
        }
    });
});
