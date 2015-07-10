describe("me.plugin", function () {
    describe("patch", function () {
        var BaseObject = me.Object.extend({
            init : function () {
                this.name = "John Doe";
            },

            setType : function (t) {
                this.type = t;
            }
        });

        me.plugin.patch(BaseObject, "setType", function (t) {
            this._patched(t);
            this.name = "John Smith";
        });

        var obj;
        beforeEach(function () {
            obj = new BaseObject();
            obj.setType("something_awesome");
        });

        it("type should be 'something_awesome'", function () {
            expect(obj.type).toEqual("something_awesome");
        });

        /**
         * XXX: Disabled because it fails under grunt-contrib-jasmine
         * Works in Chrome, Firefox, Safari, and Opera (12 and 21)
         * PhantomJS bug: https://github.com/ariya/phantomjs/issues/11856
         */
        var _it = it;
        if (navigator.userAgent.indexOf("PhantomJS") >= 0) {
            _it = xit;
        }
        _it("name should be 'John Smith'", function () {
            expect(obj.name).toEqual("John Smith");
        });
    });

    describe("register", function () {
        var Plugin = me.plugin.Base.extend({});

        me.plugin.register(Plugin, "ExamplePlugin");

        it("should register to the me.plugins namespace", function () {
            expect(me.plugins.ExamplePlugin).toBeDefined();
        });

        it("should not register to the me.plugin namespace", function () {
            expect(me.plugin.ExamplePlugin).not.toBeDefined();
        });
    });
});
