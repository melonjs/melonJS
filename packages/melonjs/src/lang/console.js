/**
 * the messages already printed in this page, by {@link warnOnce} or
 * {@link warning}
 * @ignore
 */
const printed = new Set();

/**
 * Whether a message is printed for the first time in this page, and if so
 * remember it: what makes {@link warnOnce} and {@link warning} say each
 * thing once.
 * @param {string} message - the message about to be printed
 * @returns {boolean} true the first time, false after
 * @ignore
 */
function firstTime(message) {
	if (printed.has(message)) {
		return false;
	}
	printed.add(message);
	return true;
}

/**
 * display a deprecation warning in the console, once per page
 * @param {string} deprecated - deprecated class,function or property name
 * @param {string} replacement - the replacement class, function, or property name
 * @param {string} version - the version since when the lass,function or property is deprecated
 */
export function warning(deprecated, replacement, version) {
	const msg = "melonJS: %s is deprecated since version %s, please use %s";
	if (!firstTime(`${deprecated}|${version}|${replacement}`)) {
		return;
	}
	const stack = new Error().stack;

	if (console.groupCollapsed) {
		console.groupCollapsed(
			"%c" + msg,
			"font-weight:normal;color:yellow;",
			deprecated,
			version,
			replacement,
		);
	} else {
		console.warn(msg, deprecated, version, replacement);
	}

	if (typeof stack !== "undefined") {
		console.warn(stack);
	}

	if (console.groupCollapsed) {
		console.groupEnd();
	}
}

/**
 * Print a warning in the console once per page: the same message again is
 * not printed, so a warning raised wherever something is created or drawn
 * does not fill the console.
 * @param {string} message - the warning, which is also what makes it the same as another
 * @ignore
 */
export function warnOnce(message) {
	if (firstTime(message)) {
		console.warn(message);
	}
}

/**
 * Forget the messages {@link warnOnce} and {@link warning} have printed, so
 * each prints again. For tests, which share one page across a whole spec
 * file.
 * @ignore
 */
export function resetWarnOnce() {
	printed.clear();
}
