describe("me.loader", function () {

    it("should load supported audio assets", function (done) {

        if (me.audio.hasFormat("mp3") || me.audio.hasFormat("ogg")) {

            // Initialize audio
            expect(me.audio.init("mp3,ogg")).toEqual(true);

            me.loader.load({
                    "name"  : "silence",
                    "type"  : "audio",
                    "src"   : "tests/data/sfx/"
            },
            done,
            function () {
                throw new Error("Failed to load `silence`");
            });
        }
    });

    it("should load image asset", function () {
        me.loader.load({
                "name"  : "testimage",
                "type"  : "image",
                "src"   : "tests/data/img/rect.png"
        },
        function () {
            expect(me.loader.getImage("testimage")).not.toEqual(null);
        },
        function () {
            throw new Error("Failed to load `rect.png`");
        });
    });

    it("should unload image asset", function () {
        expect(me.loader.unload({name: "testimage",  type:"image"})).toEqual(true);
        expect(me.loader.getImage("testimage")).toEqual(null);
    });
});
