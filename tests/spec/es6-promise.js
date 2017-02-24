
// basic test unit based on the example on the MDN page, to validate integration within melonJS
// https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve

describe("ES6-Promises", function() {
    it("Success", function(done) {
        var foo = Promise.resolve("Success");
        foo.then(function(value) {
           expect(value).toEqual("Success");
           done();
        });
    });

    it("Resolving an array", function(done) {
        var foo = Promise.resolve([1, 2, 3]);
        foo.then(function(v) {
            expect(v[0]).toEqual(1);
            done();
        });
    });

    it("Resolving another promise", function(done) {
        var foo = Promise.resolve(true);
        var bar = Promise.resolve(foo);
        bar.then(function(v) {
            expect(v).toEqual(true);
            done();
        });
    });
});
