import { describe, expect, it } from "vitest";
import { utils } from "../src/index.js";

describe("utils", () => {
	/*
    describe("TMX Parsing", function () {

        it("correctly decodes single-line csv", function () {
            var decodedString = me.TMXUtils.decodeCSV("1, 2");
            expect(decodedString).toEqual([1, 2]);

            decodedString = me.TMXUtils.decodeCSV("1,2");
            expect(decodedString).toEqual([1, 2]);

            decodedString = me.TMXUtils.decodeCSV("1,          2");
            expect(decodedString).toEqual([1, 2]);
        });

        it("only processes numbers", function () {
            var decodedString = me.TMXUtils.decodeCSV("1, value, 3");
            expect(decodedString).toEqual([1, NaN, 3]);
        });

        //ToDo I think this is a bug, next line should be treated as a comma, not as a space, since csv line doesn't end
        // with a comma by itself
        xit("correctly decodes multiple-line csv", function () {
            var decodedString = me.TMXUtils.decodeCSV("1, 2\n3, 4");
            expect(decodedString).toEqual([1, 2, 3, 4]);
        });

    });
    */

	describe("Array", () => {
		const arr = ["foo", "bar", "baz"];

		it("base", () => {
			expect(utils.array.remove(arr, "foo").includes("foo")).toEqual(false);
		});
	});

	describe("File", () => {
		const filename = "/src/bar/foo.bar-test.bar.baz";

		it("file basename", () => {
			expect(utils.file.getBasename(filename)).toEqual("foo.bar-test.bar");
		});

		it("file extension", () => {
			expect(utils.file.getExtension(filename)).toEqual("baz");
		});
	});

	describe("String", () => {
		it("capitalize", () => {
			expect(utils.string.capitalize("capitalize")).toEqual("Capitalize");
		});

		it("isNumeric", () => {
			expect(utils.string.isNumeric("123")).toEqual(true);
			expect(utils.string.isNumeric(" 123")).toEqual(true);
			expect(utils.string.isNumeric("123 ")).toEqual(true);
			expect(utils.string.isNumeric("")).toEqual(false);
			expect(utils.string.isNumeric(null)).toEqual(false);
			expect(utils.string.isNumeric(undefined)).toEqual(false);
			expect(utils.string.isNumeric("12 3")).toEqual(false);
			expect(utils.string.isNumeric("ab2c")).toEqual(false);
			expect(utils.string.isNumeric("12-3")).toEqual(false);
			expect(utils.string.isNumeric("12.3")).toEqual(true);
			expect(utils.string.isNumeric(".3")).toEqual(true);
			expect(utils.string.isNumeric("12,3")).toEqual(false);
			expect(utils.string.isNumeric("-123")).toEqual(true);
			expect(utils.string.isNumeric("+123")).toEqual(true);
		});

		it("isDataUrl", () => {
			// valid urls
			expect(
				utils.string.isDataUrl(
					"data:application/font-woff2;charset=utf-8;base64,d09GMgABAAAAAByYABAAAAAAixgAAB",
				),
			).toEqual(true);

			expect(
				utils.string.isDataUrl(
					"data:audio/mpeg;base64,//PAxAAAAAAAAAAAAEluZm8AAAAPAAAAEwAAIKYADQ0ND",
				),
			).toEqual(true);

			expect(
				utils.string.isDataUrl(
					"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAMAAABrrFhUAAAA8FBMVEUgICBrqDHRZVtqp",
				),
			).toEqual(true);

			expect(
				utils.string.isDataUrl(
					"data:video/mpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAMAAABrrFhUAAAA8FBMVEUgICBrqDHRZVtqp",
				),
			).toEqual(true);

			// invalid urls
			expect(
				utils.string.isDataUrl(
					"data:image/png;iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAMAAABrrFhUAAAA8FBMVEUgICBrqDHRZVtqp",
				),
			).toEqual(false);
			expect(
				utils.string.isDataUrl(
					"data:iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAMAAABrrFhUAAAA8FBMVEUgICBrqDHRZVtqp",
				),
			).toEqual(false);
			expect(
				utils.string.isDataUrl(
					"iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAMAAABrrFhUAAAA8FBMVEUgICBrqDHRZVtqp",
				),
			).toEqual(false);
		});
	});

	describe("UriFragment", () => {
		const url1 = "http://www.example.com/index.html";
		const url2 =
			"http://www.example.com/index.html#debug&hitbox=true&mytag=value";

		it("empty arguments", () => {
			const params = utils.getUriFragment(url1);
			expect(Object.entries(params).length).toEqual(0);
		});

		it("extract arguments", () => {
			const params = utils.getUriFragment(url2);
			expect(params.debug).toEqual(true);
			expect(params.hitbox).toEqual("true");
			expect(params.mytag).toEqual("value");
		});
	});

	describe("checkVersion", () => {
		it("version match", () => {
			// > 0 if the first string is greater,
			// < 0 if the second string is greater
			// === 0 if the strings are equal
			expect(utils.checkVersion("15.13.0", "15.12.0") > 0).toEqual(true);
			expect(utils.checkVersion("15.13", "15.12.0") > 0).toEqual(true);
			expect(utils.checkVersion("16", "15.12.0") > 0).toEqual(true);
			expect(utils.checkVersion("16", "15") > 0).toEqual(true);
			expect(utils.checkVersion("7.0.0", "15.5.0") < 0).toEqual(true);
			expect(utils.checkVersion("15.12.0", "15.12.0") === 0).toEqual(true);
			expect(utils.checkVersion("15.12.0", "15.12") === 0).toEqual(true);
			expect(utils.checkVersion("15.0.0", "15.0") === 0).toEqual(true);
			expect(utils.checkVersion("15.0.0", "15") === 0).toEqual(true);
			expect(utils.checkVersion("15.12.1", "16.1.1") < 0).toEqual(true);
			expect(utils.checkVersion("15.12.1", "16.1") < 0).toEqual(true);
			expect(utils.checkVersion("15.12.1", "16") < 0).toEqual(true);
			expect(utils.checkVersion("15", "16") < 0).toEqual(true);
		});
	});
});
