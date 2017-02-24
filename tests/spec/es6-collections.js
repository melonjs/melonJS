/*

Copyright (C) 2011 by Andrea Giammarchi, @WebReflection

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

describe("ES6 Collections test", function() {
  it("WeakMap existence", function () {
    expect(WeakMap).toBeDefined();
  });

  it("WeakMap constructor behavior", function () {
    expect(new WeakMap()).toBeInstanceOf(WeakMap);
    var a = {};
    var b = {};
    var c = new WeakMap();
    var m = new WeakMap([[a, 1], [b, 2], [c, 3]]);
    expect(m.has(a)).toEqual(true);
    expect(m.has(b)).toEqual(true);
    expect(m.has(c)).toEqual(true);
  });


  it("WeakMap#has", function () {
    var
      o = new WeakMap(),
      generic = {},
      callback = function () {}
    ;
    expect(o.has(callback)).toEqual(false);
    o.set(callback, generic);
    expect(o.has(callback)).toEqual(true);
  });

  it("WeakMap#get", function () {
    var
      o = new WeakMap(),
      generic = {},
      callback = function () {}
    ;
    o.set(callback, generic);
    expect(o.get(callback, 123)).toEqual(generic);
    expect(o.get(callback)).toEqual(generic);
  });

  it("WeakMap#set", function () {
    var
      o = new WeakMap(),
      generic = {},
      callback = function () {}
    ;
    o.set(callback, generic);
    expect(o.get(callback)).toEqual(generic);
    o.set(callback, callback);
    expect(o.get(callback)).toEqual(callback);
    o.set(callback, o);
    expect(o.get(callback)).toEqual(o);
    o.set(o, callback);
    expect(o.get(o)).toEqual(callback);
  });

  it("WeakMap#['delete']", function () {
    var
      o = new WeakMap(),
      generic = {},
      callback = function () {}
    ;
    o.set(callback, generic);
    o.set(generic, callback);
    o.set(o, callback);
    expect(o.has(callback) && o.has(generic) && o.has(o)).toEqual(true);
    o["delete"](callback);
    o["delete"](generic);
    o["delete"](o);
    expect(!o.has(callback) && !o.has(generic) && !o.has(o)).toEqual(true);
    expect(o["delete"](o)).toEqual(false);
    o.set(o, callback);
    expect(o["delete"](o));
  });


  it("Map existence", function () {
    expect(Map).toBeDefined();
  });

  it("Map constructor behavior", function () {
    expect(new Map()).toBeInstanceOf(Map);
    var a = 1;
    var b = {};
    var c = new Map();
    var m = new Map([[1, 1], [b, 2], [c, 3]]);
    expect(m.has(a)).toEqual(true);
    expect(m.has(b)).toEqual(true);
    expect(m.has(c)).toEqual(true);
    expect(m.size).toEqual(3);
  });


  it("Map#has", function () {
    var
      o = new Map(),
      generic = {},
      callback = function () {}
    ;
    expect(o.has(callback)).toEqual(false);
    o.set(callback, generic);
    expect(o.has(callback)).toEqual(true);
  });

  it("Map#get", function () {
    var
      o = new Map(),
      generic = {},
      callback = function () {}
    ;
    o.set(callback, generic);
    expect(o.get(callback, 123)).toEqual(generic);
    expect(o.get(callback)).toEqual(generic);
  });

  it("Map#set", function () {
    var
      o = new Map(),
      generic = {},
      callback = function () {}
    ;
    o.set(callback, generic);
    expect(o.get(callback)).toEqual(generic);
    o.set(callback, callback);
    expect(o.get(callback)).toEqual(callback);
    o.set(callback, o);
    expect(o.get(callback)).toEqual(o);
    o.set(o, callback);
    expect(o.get(o)).toEqual(callback);
    o.set(NaN, generic);
    expect(o.has(NaN)).toEqual(true);
    expect(o.get(NaN)).toEqual(generic);
    o.set("key", undefined);
    expect(o.has("key")).toEqual(true);
    expect(o.get("key")).toEqual(undefined);

    expect(o.has(-0)).toEqual(false);
    expect(o.has(0)).toEqual(false);
    o.set(-0, callback);
    expect(o.has(-0)).toEqual(true);
    expect(o.has(0)).toEqual(false);
    expect(o.get(-0)).toEqual(callback);
    expect(o.get(0)).toBeUndefined();
    o.set(0, generic);
    expect(o.has(-0)).toEqual(true);
    expect(o.has(0)).toEqual(true);
    expect(o.get(-0)).not.toEqual(generic);
    expect(o.get(0)).toEqual(generic);
  });

  it("Map#['delete']", function () {
    var
      o = new Map(),
      generic = {},
      callback = function () {}
    ;
    o.set(callback, generic);
    o.set(generic, callback);
    o.set(o, callback);
    expect(o.has(callback) && o.has(generic) && o.has(o)).toEqual(true);
    o["delete"](callback);
    o["delete"](generic);
    o["delete"](o);
    expect(!o.has(callback) && !o.has(generic) && !o.has(o)).toEqual(true);
    expect(o["delete"](o)).toEqual(false);
    o.set(o, callback);
    expect(o["delete"](o));
  });

  it("keys, values, entries behavior", function () {
    // test that things get returned in insertion order as per the specs
    var o = new Map([["1", 1], ["2", 2], ["3", 3]]);
    var keys = o.keys(), values = o.values();
    var k = keys.next(), v = values.next();
    expect(k.value === "1" && v.value === 1).toEqual(true);
    o.delete("2");
    k = keys.next();
    v = values.next();
    expect(k.value === "3" && v.value === 3).toEqual(true);
    // insertion of previously-removed item goes to the end
    o.set("2", 2);
    k = keys.next();
    v = values.next();
    expect(k.value === "2" && v.value === 2).toEqual(true);
    // when called again, new iterator starts from beginning
    var entriesagain = o.entries();
    expect(entriesagain.next().value[0]).toEqual("1");
    expect(entriesagain.next().value[0]).toEqual("3");
    expect(entriesagain.next().value[0]).toEqual("2");
    // after a iterator is finished, don't return any more elements
    k = keys.next();
    v = values.next();
    expect(k.done && v.done).toEqual(true);
    k = keys.next();
    v = values.next();
    expect(k.done && v.done).toEqual(true);
    o.set("4", 4);
    k = keys.next();
    v = values.next();
    expect(k.done && v.done).toEqual(true);
    // new element shows up in iterators that didn't yet finish
    expect(entriesagain.next().value[0]).toEqual("4");
    expect(entriesagain.next().done).toEqual(true);
  });


  it("Map#forEach", function () {
    var o = new Map();
    o.set("key 0", 0);
    o.set("key 1", 1);
    if ("forEach" in o) {
      o.forEach(function (value, key, obj) {
        expect(key).toEqual("key " + value);
        expect(obj).toEqual(o);
        // even if dropped, keeps looping
        o["delete"](key);
      });
      expect(o.size).toEqual(0);
    }
  });

  it("Map#forEach with mutations", function () {
    var o = new Map([["0", 0], ["1", 1], ["2", 2]]), seen = [];
    o.forEach(function (value, key, obj) {
      seen.push(value);
      expect(obj).toEqual(o);
      expect(key).toEqual("" + value);
      // mutations work as expected
      if (value === 1) {
        o.delete("0"); // remove from before current index
        o.delete("2"); // remove from after current index
        o.set("3", 3); // insertion
      } else if (value === 3) {
        o.set("0", 0); // insertion at the end
      }
    });
    expect(JSON.stringify(seen)).toEqual(JSON.stringify([0, 1, 3, 0]));
    expect(JSON.stringify(o._values)).toEqual(JSON.stringify([1, 3, 0]));
  });

  it("Map#clear", function() {
    var o = new Map();
    o.set(1, "1");
    o.set(2, "2");
    o.set(3, "3");
    o.clear();
    expect(o.size).toEqual(0);
  });
});
