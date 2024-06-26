const MAX_LENGTH = 256;

const numeric = /^[0-9]+$/;

const compareIdentifiers = (a, b) => {
	const anum = numeric.test(a);
	const bnum = numeric.test(b);

	if (anum && bnum) {
		a = +a;
		b = +b;
	}

	return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
};

class SemVer {
	constructor(version) {
		if (version.length > MAX_LENGTH) {
			throw new TypeError(`version is longer than ${MAX_LENGTH} characters`);
		}

		const m = version
			.trim()
			.match(/(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/, "g");

		if (!m) {
			throw new TypeError(`Invalid Version: ${version}`);
		}

		// these are actually numbers
		this.major = +m[1];
		this.minor = +m[2];
		this.patch = +m[3];

		if (this.major > Number.MAX_SAFE_INTEGER || this.major < 0) {
			throw new TypeError("Invalid major version");
		}

		if (this.minor > Number.MAX_SAFE_INTEGER || this.minor < 0) {
			throw new TypeError("Invalid minor version");
		}

		if (this.patch > Number.MAX_SAFE_INTEGER || this.patch < 0) {
			throw new TypeError("Invalid patch version");
		}

		this.format();
	}

	format() {
		this.version = `${this.major}.${this.minor}.${this.patch}`;
	}

	compare(other) {
		if (other.version === this.version) {
			return 0;
		}

		return this.compareMain(other);
	}

	compareMain(other) {
		return (
			compareIdentifiers(this.major, other.major) ||
			compareIdentifiers(this.minor, other.minor) ||
			compareIdentifiers(this.patch, other.patch)
		);
	}
}

export const compare = (a, b) => new SemVer(a).compare(new SemVer(b));
