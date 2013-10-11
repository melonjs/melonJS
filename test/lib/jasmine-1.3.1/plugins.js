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
