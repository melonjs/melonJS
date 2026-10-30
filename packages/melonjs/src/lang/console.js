/**
 * display a deprecation warning in the console, once per page (see
 * {@link warnOnce})
 * @param {string} deprecated - deprecated class,function or property name
 * @param {string} replacement - the replacement class, function, or property name
 * @param {string} version - the version since when the lass,function or property is deprecated
 */
export function warning(deprecated, replacement, version) {
	warnOnce(
		`melonJS: ${deprecated} is deprecated since version ${version}, please use ${replacement}`,
	);
}

/**
 * the messages {@link warnOnce} has already printed
 * @ignore
 */
const printed = new Set();

/**
 * Print a warning in the console once per page: the same message again is
 * not printed, so a warning raised wherever something is created or drawn
 * does not fill the console.
 * @param {string} message - the warning, which is also what makes it the same as another
 * @ignore
 */
export function warnOnce(message) {
	if (printed.has(message)) {
		return;
	}
	printed.add(message);
	console.warn(message);
}

/**
 * Forget the messages {@link warnOnce} has printed, so each prints again.
 * For tests, which share one page across a whole spec file.
 * @ignore
 */
export function resetWarnOnce() {
	printed.clear();
}
