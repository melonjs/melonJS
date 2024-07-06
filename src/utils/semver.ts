const MAX_LENGTH = 256;

const compareIdentifiers = (a: number, b: number) => {
	if (a === b) {
		return 0;
	} else if (Number(a) < Number(b)) {
		return -1;
	} else {
		return 1;
	}
};

const SEMVER_REGEX = /(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/;

class SemVer {
	major: number;
	minor: number;
	patch: number;

	constructor(version: string) {
		if (version.length > MAX_LENGTH) {
			throw new TypeError(`version is longer than ${MAX_LENGTH} characters`);
		}

		const m = version.trim().match(SEMVER_REGEX);

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
	}

	asString() {
		return `${this.major}.${this.minor}.${this.patch}`;
	}

	compare(other: SemVer) {
		if (other.asString() === this.asString()) {
			return 0;
		}

		return this.compareMain(other);
	}

	compareMain(other: SemVer) {
		return (
			compareIdentifiers(this.major, other.major) ||
			compareIdentifiers(this.minor, other.minor) ||
			compareIdentifiers(this.patch, other.patch)
		);
	}
}

export const compare = (a: string, b: string) => {
	return new SemVer(a).compare(new SemVer(b));
};
