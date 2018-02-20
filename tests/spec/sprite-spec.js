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

        setCurrentAnimationCallback["callback"] = function () {}
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
        expect(sprite.addAnimation("test2", [ 0, 0, 0, 0, 0 ])).toEqual(5);
    });

    it("me.Sprite isCurrentAnimation allows to verify which animation is set", function () {
        expect(sprite.addAnimation("reverse_test", [ 1, 0, 1, 0 ], 60)).toEqual(4);
        sprite.setCurrentAnimation("test");
        expect(sprite.isCurrentAnimation("test")).toEqual(true);
        sprite.setCurrentAnimation("reverse_test");
        expect(sprite.isCurrentAnimation("test")).toEqual(false);
        expect(sprite.isCurrentAnimation("reverse_test")).toEqual(true);
        sprite.update(16);
        expect(sprite.isCurrentAnimation("reverse_test")).toEqual(true);
        sprite.update(16);
        expect(sprite.isCurrentAnimation("reverse_test")).toEqual(true);
        sprite.update(16);
        expect(sprite.isCurrentAnimation("reverse_test")).toEqual(true);
        sprite.update(16);
        expect(sprite.isCurrentAnimation("reverse_test")).toEqual(true);
        sprite.update(16);
        expect(sprite.isCurrentAnimation("reverse_test")).toEqual(true);
        sprite.update(16);
        expect(sprite.isCurrentAnimation("reverse_test")).toEqual(true);
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
