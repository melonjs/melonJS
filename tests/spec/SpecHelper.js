beforeEach(function() {
    this.addMatchers({
        toBeInstanceOf : function(expected) {
            return this.actual instanceof expected;
        }
    });
});
