describe("ES5 Features", function () {

    describe("Function functions :", function () {

        it("Function.bind", function () {
            this.x = 9;
            var module = {
              x: 81,
              getX: function() { return this.x; }
            };

            module.getX(); // 81

            var retrieveX = module.getX;
            retrieveX();
            // returns 9 - The function gets invoked at the global scope

            // Create a new function with 'this' bound to module
            // New programmers might confuse the
            // global var x with module's property x
            var boundGetX = retrieveX.bind(module);
            expect(boundGetX()).toEqual(81); // 81
        });
    });

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
        var untrimmed_str = " start and end with white space ";

        it("trim both sides", function () {
            expect(untrimmed_str.trim()).toEqual("start and end with white space");
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
