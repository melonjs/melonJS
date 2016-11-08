describe("Jay Inheritance", function () {
    describe("Simple inheritance tests", function () {
        var Person = me.Object.extend({
            "init" : function (isDancing) {
                this.dancing = isDancing;
            },
            "dance" : function () {
                return this.dancing;
            }
        });

        var Ninja = Person.extend({
            "init" : function () {
                // Call the super constructor, passing a single argument
                this._super(Person, "init", [ false ]);
            },
            "dance" : function () {
                // Call the overridden dance() method
                return this._super(Person, "dance");
            },
            "swingSword" : function () {
                return true;
            }
        });

        var Pirate = Person.extend(Ninja, {
            "init" : function () {
                // Call the super constructor, passing a single argument
                this._super(Person, "init", [ true ]);
            }
        });


        describe("p = new Person(true)", function () {
            var p = new Person(true);

            it("is an instance of Person", function () {
                expect(p).toBeInstanceOf(Person);
            });

            it("is not an instance of Ninja", function () {
                expect(p).not.toBeInstanceOf(Ninja);
            });

            it("is not an instance of Pirate", function () {
                expect(p).not.toBeInstanceOf(Pirate);
            });

            it("can dance", function () {
                expect(p.dance()).toEqual(true);
            });

            it("cannot swing a sword", function () {
                expect(p.swingSword).toBe(undefined);
            });

            it("inherits from Object", function () {
                expect(p).toBeInstanceOf(Object);
            });
        });

        describe("n = new Ninja()", function () {
            var n = new Ninja();

            it("is an instance of Ninja", function () {
                expect(n).toBeInstanceOf(Ninja);
            });

            it("is also an instance of Person", function () {
                expect(n).toBeInstanceOf(Person);
            });

            it("is not an instance of Pirate", function () {
                expect(n).not.toBeInstanceOf(Pirate);
            });

            it("cannot dance", function () {
                expect(n.dance()).toEqual(false);
            });

            it("can swing a sword", function () {
                expect(n.swingSword()).toEqual(true);
            });

            it("inherits from Person", function () {
                expect(n).toBeInstanceOf(Person);
            });

            it("inherits from Object", function () {
                expect(n).toBeInstanceOf(Object);
            });
        });

        describe("r = new Pirate()", function () {
            var r = new Pirate();

            it("is an instance of Pirate", function () {
                expect(r).toBeInstanceOf(Pirate);
            });

            it("is also an instance of Person", function () {
                expect(r).toBeInstanceOf(Person);
            });

            it("is not an instance of Ninja", function () {
                expect(r).not.toBeInstanceOf(Ninja);
            });

            it("can dance", function () {
                expect(r.dance()).toEqual(true);
            });

            it("can swing a sword", function () {
                expect(r.swingSword()).toEqual(true);
            });

            it("inherits from Person", function () {
                expect(r).toBeInstanceOf(Person);
            });

            it("inherits from Object", function () {
                expect(r).toBeInstanceOf(Object);
            });
        });
    });


    describe("Complex inheritance tests", function () {
        var stepper = {
            "_data" : [],
            "step" : function () {
                this._data.push(Array.prototype.slice.call(arguments, 0));
            },
            "steps" : function () {
                return this._data;
            },
            "reset" : function () {
                this._data = [];
            }
        };

        beforeEach(function () {
            stepper.reset();
        });

        describe("d = new D()", function () {
            var A = me.Object.extend({
                "init" : function () {},
                "foo" : function () {
                    stepper.step("A.foo");
                },
                "bar" : function () {
                    stepper.step("A.bar");
                }
            });

            var B = A.extend({
                "foo" : function () {
                    stepper.step("B.foo");
                    this.bar();
                }
            });

            var C = B.extend({
                "bar" : function () {
                    stepper.step("C.bar");
                    this._super(B, "bar");
                }
            });

            var D = C.extend({
                "foo" : function () {
                    stepper.step("D.foo");
                    this._super(C, "foo");
                },
                "bar" : function () {
                    stepper.step("D.bar");
                    this._super(C, "bar");
                }
            });

            it("has the correct call chain", function () {
                var d = new D();
                d.foo();

                expect(stepper.steps()).toEqual([
                    [ "D.foo" ],
                    [ "B.foo" ],
                    [ "D.bar" ],
                    [ "C.bar" ],
                    [ "A.bar" ]
                ]);
            });
        });

        describe("z = new Z()", function () {
            var X = me.Object.extend({
                "init" : function () {},
                "foo" : function () {
                    stepper.step("X.foo");
                },
                "bar" : function () {
                    stepper.step("X.bar");
                }
            });

            var Y = X.extend({
                "foo" : function () {
                    stepper.step("Y.foo");
                    this._super(Y, "bar");
                },
                "bar" : function () {
                    stepper.step("Y.bar");
                }
            });

            var Z = Y.extend({
                "foo" : function () {
                    stepper.step("Z.foo");
                    this._super(Y, "foo");
                },
                "bar" : function () {
                    stepper.step("Z.bar");
                }
            });

            it("can perform sibling method calls", function () {
                var z = new Z();
                z.foo();

                expect(stepper.steps()).toEqual([
                    [ "Z.foo" ],
                    [ "Y.foo" ],
                    [ "Y.bar" ]
                ]);
            });
        });
    });


    describe("Correctness tests", function () {
        function missingConstructor() {
            me.Object.extend({});
        }

        function nonMethod() {
            me.Object.extend({
                "init" : function () {},
                "bad" : 0
            });
        }

        it("throws an exception when the constructor is missing", function () {
            expect(missingConstructor).toThrow();
        });

        it("throws an exception when non-methods are described", function () {
            expect(nonMethod).toThrow();
        });
    });


    describe("Mixin tests", function () {
        var Base = me.Object.extend({
            "init" : function () {}
        });

        var Extended = Base.extend({
            "foo" : function () {
                return "foo";
            }
        });

        var MixedIn = Base.extend(Extended, {
            "bar" : function () {
                return "bar";
            }
        });


        describe("m = new MixedIn()", function () {
            var m = new MixedIn();

            it("has foo", function () {
                expect(m.foo()).toBe("foo");
            });

            it("has bar", function () {
                expect(m.bar()).toBe("bar");
            });

            it("is an instance of MixedIn", function () {
                expect(m).toBeInstanceOf(MixedIn);
            });

            it("inherits from Base", function () {
                expect(m).toBeInstanceOf(Base);
            });

            it("inherits from Object", function () {
                expect(m).toBeInstanceOf(Object);
            });

            it("does not inherit from Extended", function () {
                expect(m).not.toBeInstanceOf(Extended);
            });
        });
    });


    describe("Inheritance binding tests", function () {
        var E = me.Object.extend.bind(Error)({
            "init" : function (message) {
                this.name = "E";
                this.message = message;
            }
        });

        var MyE = E.extend({});

        describe("e = new E()", function () {
            var e = new E("foo");

            it("is an instance of Error", function () {
                expect(e).toBeInstanceOf(Error);
            });

            it("is not an instance of me.Object", function () {
                expect(e).not.toBeInstanceOf(me.Object);
            });
        });

        describe("m = new MyE()", function () {
            var m = new MyE("bar");

            it("is an instance of Error", function () {
                expect(m).toBeInstanceOf(Error);
            });

            it("is not an instance of me.Object", function () {
                expect(m).not.toBeInstanceOf(me.Object);
            });
        });
    });
});
