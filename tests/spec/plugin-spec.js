describe("me.plugin", function () {
    describe("#patch", function () {
        var BaseObject = Object.extend({
            init : function () {

            },

            setType : function (t) {
                this.type = t;
            }
        });

        me.plugin.patch(BaseObject, "setType", function (t) {
            this.parent(t);
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

        it("name should be 'John Smith'", function () {
            expect(obj.name).toEqual("John Smith");
        });
    });
});