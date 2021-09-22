describe("me.loader", function () {

    it("should load supported audio assets", function (done) {

        if (me.audio.hasFormat("mp3")|| me.audio.hasFormat("ogg")) {

            // Initialize audio
            expect(me.audio.init("mp3,ogg")).toEqual(true);

            me.loader.load(
                {
                    "name"  : "silence",
                    "type"  : "audio",
                    "src"   : "tests/data/sfx/"
                },
                done,
                function () {
                    throw new Error("Failed to load `silence`");
                }
            );
        }
    });
});
