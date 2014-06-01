/**
 * XXX: Audio is not supported in PhantomJS
 */
describe("Audio tests", function () {
    it("should load an mp3", function (done) {
        // Initialize audio
        expect(me.audio.init("mp3")).toEqual(true);

        me.loader.load(
            {
                "name"  : "silence",
                "type"  : "audio",
                "src"   : "tests/data/sfx/"
            },
            done,
            function () {
                throw new Error("Failed to load `silence.mp3`");
            }
        );
    });

    it("should load an ogg", function (done) {
        // Initialize audio
        expect(me.audio.init("ogg")).toEqual(true);

        me.loader.load(
            {
                "name"  : "silence",
                "type"  : "audio",
                "src"   : "tests/data/sfx/"
            },
            done,
            function () {
                throw new Error("Failed to load `silence.ogg`");
            }
        );
    });

    it("should load either an mp3 or ogg", function (done) {
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
    });

    it("should run callback on end", function (done) {
        var started = Date.now();
        me.audio.play("silence", false, function () {
            expect(Date.now() - started).toBeCloseTo(1000, -2);
            done();
        });
    });

    it("should run callback on loop", function (done) {
        var started = Date.now();
        me.audio.play("silence", true, function () {
            expect(Date.now() - started).toBeCloseTo(1000, -2);
            me.audio.stop("silence");
            done();
        });
    });
});
