describe("ES5/ES6 Shim", function () {

    describe("Object functions :", function () {

        it("Object.create", function () {
            // Shape - superclass
            var Shape = function() {
                this.x = 0;
                this.y = 0;
            }

            // superclass method
            Shape.prototype.move = function(x, y) {
                this.x += x;
                this.y += y;
            };

            // Rectangle - subclass
            function Rectangle() {
                Shape.call(this); // call super constructor.
            }

            // subclass extends superclass
            Rectangle.prototype = Object.create(Shape.prototype);
            Rectangle.prototype.constructor = Rectangle;

            var rect = new Rectangle();

            expect(rect instanceof Rectangle).toEqual(true); // true
            expect(rect instanceof Shape).toEqual(true); // true
            rect.move(1, 1); // Outputs, 'Shape moved.'
            expect(rect.x).toEqual(1);
        });

        it("Object.defineProperty", function () {
            var o = {}; // Creates a new object
            // object property added with defineProperty with an
            // accessor property descriptor
            var bValue = 38;
            Object.defineProperty(o, "a", {
              get: function() { return bValue; },
              set: function(newValue) { bValue = newValue; },
              enumerable: true,
              configurable: true
            });
            expect(o.a).toEqual(38); // 38
        });

    });

    describe("String functions :", function () {
        var str = "To be, or not to be, that is the question.";
        var untrimmed_str = " start and end with white space ";

        it("contains 'To Be'", function () {
            expect(str.includes("To be")).toEqual(true);
        });

        it("contains 'question'", function () {
            expect(str.includes("question")).toEqual(true);
        });

        it("does no contain 'nonexistent'", function () {
            expect(str.includes("nonexistent")).toEqual(false);
        });

        it("does not contains 'To be' at index 1", function () {
            expect(str.includes("To be", 1)).toEqual(false);
        });

        it("does not contain 'TO BE'", function () {
            expect(str.includes("TO BE")).toEqual(false);
        });

        it("trim both sides", function () {
            expect(untrimmed_str.trim()).toEqual("start and end with white space");
        });

        it("trim left side", function () {
            expect(untrimmed_str.trimLeft()).toEqual("start and end with white space ");
        });

        it("trim right side", function () {
            expect(untrimmed_str.trimRight()).toEqual(" start and end with white space");
        });

    });

    describe("math functions :", function () {
        it("123 is positive", function () {
            expect(Math.sign(123)).toEqual(1);
        });
        it("-123 is negative", function () {
            expect(Math.sign(-123)).toEqual(-1);
        });
        it("0 is 0", function () {
            expect(Math.sign(0)).toEqual(0);
        });
    });

    describe("Array functions :", function () {
        it("Array.forEach", function () {
            // Create an array.
            var numbers = [10, 11, 12];
            // Call the addNumber callback function for each array element.
            var sum = 0;
            numbers.forEach(
                function addNumber(value) { sum += value; }
            );
            expect(sum).toEqual(33);
        });
        it("Array.isArray", function () {
            expect(Array.isArray([1, 2, 3])).toEqual(true);  // true
            expect(Array.isArray({foo: 123})).toEqual(false); // false
            expect(Array.isArray("foobar")).toEqual(false);   // false
            expect(Array.isArray(undefined)).toEqual(false);  // false
        });
    });

});
