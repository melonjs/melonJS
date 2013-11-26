describe("John Resig Simple Inheritance", function () {
    var Person = Object.extend({
        init: function(isDancing) {
            this.dancing = isDancing;
        },
        dance: function() {
            return this.dancing;
        }
    });

    var Ninja = Person.extend({
        init: function() {
            this.parent( false );
        },
        dance: function() {
            // Call the inherited version of dance()
            return this.parent();
        },
        swingSword: function() {
            return true;
        }
    });

    var AnchoredRenderable = me.Renderable.extend({
        anchorPoint : new me.Vector2d(0.5, 1.0)
    });

    var p = new Person(true);
    var n = new Ninja();

    describe("p", function () {
        it("is an instance of Person", function () {
            expect(p).toBeInstanceOf(Person);
        });

        it("is not an instance of Ninja", function () {
            expect(p).not.toBeInstanceOf(Ninja);
        });

        it("can dance", function () {
            expect(p.dance()).toEqual(true);
        });

        it("cannot swing a sword", function () {
            expect(p.swingSword).toBe(undefined);
        });

        it("inherits from Object", function () {
            expect(p).toBeInstanceOf(Person);
            expect(p).toBeInstanceOf(Object);
        });
    });

    describe("n", function () {
        it("is an instance of Ninja", function () {
            expect(n).toBeInstanceOf(Ninja);
        });

        it("is also an instance of Person", function () {
            expect(n).toBeInstanceOf(Person);
        });

        it("cannot dance", function () {
            expect(n.dance()).toEqual(false);
        });

        it("can swing a sword", function () {
            expect(n.swingSword()).toEqual(true);
        });

        it("inherits from Person", function () {
            expect(n).toBeInstanceOf(Ninja);
            expect(n).toBeInstanceOf(Person);
            expect(n).toBeInstanceOf(Object);
        });
    });

    describe("AnchoredRenderable", function () {
        it("is anchored at 0.5,1.0", function () {
            var obj = new AnchoredRenderable(new me.Vector2d(), 20, 20);
            expect(obj.anchorPoint.x).toEqual(0.5);
            expect(obj.anchorPoint.y).toEqual(1.0);
        });
    });
});
