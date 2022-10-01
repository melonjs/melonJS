export default {
    transform: {
        "^.+\\.m?jsx?$": "babel-jest",
    },
    testMatch: ["**/tests/spec/**/*.mjs", "**/tests/spec/**/*.js"],
};
