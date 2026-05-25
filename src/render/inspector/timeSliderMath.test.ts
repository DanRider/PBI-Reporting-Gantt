import { describe, it, expect } from "vitest";
import { parseSliderRange } from "./timeSliderMath";

describe("parseSliderRange", () => {
    it("parses kind=all", () => {
        expect(parseSliderRange('{"kind":"all"}')).toEqual({ kind: "all" });
    });

    it("parses kind=range with numeric offsets", () => {
        expect(parseSliderRange('{"kind":"range","startOffset":-2,"endOffset":6}'))
            .toEqual({ kind: "range", startOffset: -2, endOffset: 6 });
    });

    it("returns null on malformed JSON", () => {
        expect(parseSliderRange("{not json")).toBeNull();
    });

    it("returns null on empty string", () => {
        expect(parseSliderRange("")).toBeNull();
    });

    it("returns null on null primitive parsed", () => {
        expect(parseSliderRange("null")).toBeNull();
    });

    it("returns null on unknown kind", () => {
        expect(parseSliderRange('{"kind":"banana"}')).toBeNull();
    });

    it("returns null when range offsets are not numbers", () => {
        expect(parseSliderRange('{"kind":"range","startOffset":"abc","endOffset":6}')).toBeNull();
    });

    it("returns null when range offsets are NaN", () => {
        expect(parseSliderRange('{"kind":"range","startOffset":null,"endOffset":6}')).toBeNull();
    });

    it("returns null when range is missing endOffset", () => {
        expect(parseSliderRange('{"kind":"range","startOffset":0}')).toBeNull();
    });

    it("returns null on array input", () => {
        expect(parseSliderRange("[1,2,3]")).toBeNull();
    });
});
