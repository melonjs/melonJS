//  Monkeypatch for using beforeAll and afterAll
(function(exports, jasmine) {

	if(!exports) {
		throw new Error("jasmine-beforeAll couldn't detect globals");
	}

	/**
	 * A function that is called once before running the first spec in a suite.
	 *
	 * Used for non-repeating spec setup, including validating assumptions.
	 *
	 * @param {Function} beforeAllFunction
	 */
	var beforeAll = exports.beforeAll = function(beforeAllFunction) {
		jasmine.getEnv().beforeAll(beforeAllFunction);
	};

	jasmine.Env.prototype.beforeAll = function(beforeAllFunction) {
		if (this.currentSuite) {
			this.currentSuite.beforeAll(beforeAllFunction);
		} else {
			this.currentRunner_.beforeAll(beforeAllFunction);
		}
	};

	jasmine.Runner.prototype.beforeAll =
	jasmine.Suite.prototype.beforeAll = function(beforeAllFunction) {
		beforeAllFunction.typeName = 'beforeAll';
		this.beforeAll_ || (this.beforeAll_ = []);
		this.beforeAll_.push(beforeAllFunction);
	};

	/* Monkey-patch Spec.addBeforesAndAftersToQueue to execyte any outstanding
	   beforeAll callbacks
	*/
	var specAddBeforesAndAftersToQueue = jasmine.Spec.prototype.addBeforesAndAftersToQueue;

	jasmine.Spec.prototype.addBeforesAndAftersToQueue = function() {

		/* queue up before/afterEach callbacks */
		specAddBeforesAndAftersToQueue.call(this);

		/* queue up any outstanding beforAll callbacks */
		var runner = this.env.currentRunner();

		for (var suite = this.suite; suite; suite = suite.parentSuite) {
			if(suite.beforeAll_) {
				while(suite.beforeAll_.length) {
					this.queue.addBefore(new jasmine.Block(this.env, suite.beforeAll_.pop(), this));
				}
				delete suite.beforeAll_;
			}
		}
		if(runner.beforeAll_) {
			while(runner.beforeAll_.length) {
				this.queue.addBefore(new jasmine.Block(this.env, runner.beforeAll_.pop(), this));
			}
			delete runner.beforeAll_;
		}
	}

	/**
	 * A function that is called once after running the last spec in a suite.
	 *
	 * Used for non-repeating cleanup of any state that is hijacked during spec execution.
	 *
	 * @param {Function} afterAllFunction
	 */
	var afterAll = exports.afterAll = function(afterAllFunction) {
		jasmine.getEnv().afterAll(afterAllFunction);
	};

	jasmine.Env.prototype.afterAll = function(afterAllFunction) {
		if (this.currentSuite) {
			this.currentSuite.afterAll(afterAllFunction);
		} else {
			this.currentRunner_.afterAll(afterAllFunction);
		}
	};

	jasmine.Runner.prototype.afterAll =
	jasmine.Suite.prototype.afterAll = function(afterAllFunction) {
		afterAllFunction.typeName = 'afterAll';
		if(!this.afterAll_) {
			var self = this;
			this.afterAll_ = [];
			this.beforeAll(function() {
				// beforeAll is called when we execute a spec,
				// which means we'll need to call the afterAllFunction
				// when Suite/Runner is finished
				self.execAfterAlls_ = true;
			});
		}
		this.afterAll_.unshift(afterAllFunction);
	};

	/* Monkey-patch Suite.finish and Runner.finishCallback to execute any registered
	   afterAll callbacks (if any specs were run)
	*/
	patchFinish(jasmine.Suite, 'finish');
	patchFinish(jasmine.Runner, 'finishCallback');

	function patchFinish(Runnable, finishMethod) {
		var runnableFinish = Runnable.prototype[finishMethod];
		Runnable.prototype[finishMethod] = function(onComplete) {
			var runnable = this;
			if(runnable.execAfterAlls_) {
				// one or more specs were executed
				while(runnable.afterAll_.length) {
					runnable.queue.add(new jasmine.Block(runnable.env, runnable.afterAll_.pop(), runnable));
				}
				delete runnable.afterAll_;
				runnable.queue.start(function () {
					runnableFinish.call(runnable, onComplete);
				});
			} else {
				runnableFinish.call(runnable, onComplete);
			}	 
		};
	}
	
})(
	(typeof window == "object" && window) || (typeof global == "object" && global),
	jasmine || require('jasmine')
);


//  Monkeypatch for using done
(function() {
    var withoutAsync = {};

    ["it", "beforeEach", "afterEach"].forEach(function(jasmineFunction) {
        withoutAsync[jasmineFunction] = jasmine.Env.prototype[jasmineFunction];
        return jasmine.Env.prototype[jasmineFunction] = function() {
            var args = Array.prototype.slice.call(arguments, 0);
            var timeout = null;
            if (isLastArgumentATimeout(args)) {
                timeout = args.pop();
                // The changes to the jasmine test runner causes undef to be passed when
                // calling all it()'s now. If the last argument isn't a timeout and the
                // last argument IS undefined, let's just pop it off. Since out of bounds
                // items are undefined anyways, *hopefully* removing an undef item won't
                // hurt.
            } else if (args[args.length-1] == undefined) {
                args.pop();
            }
            if (isLastArgumentAnAsyncSpecFunction(args))
            {
                var specFunction = args.pop();
                args.push(function() {
                    return asyncSpec(specFunction, this, timeout);
                });
            }
            return withoutAsync[jasmineFunction].apply(this, args);
        };
    });

    function isLastArgumentATimeout(args)
    {
        return args.length > 0 && (typeof args[args.length-1]) === "number";
    }

    function isLastArgumentAnAsyncSpecFunction(args)
    {
        return args.length > 0 && (typeof args[args.length-1]) === "function" && args[args.length-1].length > 0;
    }

    function asyncSpec(specFunction, spec, timeout) {
        if (timeout == null) timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL || 1000;
        var done = false;
        spec.runs(function() {
            try {
                return specFunction.call(spec, function(error) {
                    done = true;
                    if (error != null) return spec.fail(error);
                });
            } catch (e) {
                done = true;
                throw e;
            }
        });
        return spec.waitsFor(function() {
            if (done === true) {
                return true;
            }
        }, "spec to complete", timeout);
    };

}).call(this);
