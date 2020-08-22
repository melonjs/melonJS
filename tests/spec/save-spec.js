describe("local Storage", function () {

    it("add and retrieve keys", function () {
        if (me.device.localStorage === true) {
            me.save.add({ testKey1 : 1, testKey2 : 2 });
            expect(me.save.testKey1).toBe(1);
            expect(me.device.getStorage().testKey2).toBe(2);
        } else {
            // localStorage not supported in the testing environment
            expect(true).toBe(true);
        }
    });

    it("remove keys", function () {
        if (me.device.localStorage === true) {
            // access through getStorage
            var localStorage = me.device.getStorage("local");
            // both value should still be there
            expect(localStorage.testKey1).toBe(1);
            expect(localStorage.testKey2).toBe(2);
            localStorage.remove("testKey1");
            localStorage.remove("testKey2");
            expect(localStorage.testKey1).toBeUndefined();
            expect(localStorage.testKey2).toBeUndefined();
        } else {
            // localStorage not supported in the testing environment
            expect(true).toBe(true);
        }
    });

});
