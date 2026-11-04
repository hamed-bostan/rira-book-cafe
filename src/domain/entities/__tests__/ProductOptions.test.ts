import { describe, expect, it } from "vitest";

import {
  choiceBounds,
  choiceKey,
  defaultChoiceIds,
  lowestPrice,
  normalizeOptionGroups,
  optionGroupsProblem,
  optionSelectionProblem,
  optionsChangePrice,
  optionsSummary,
  priceWithChoices,
  snapshotOptions,
  withDefaultChoices,
  type ProductOptionGroup,
  type ProductOptionGroupInput,
} from "../ProductOptions";

const SIZE: ProductOptionGroup = {
  id: "size",
  name: "Size",
  nameFa: "اندازه",
  required: true,
  selection: "single",
  minChoices: 1,
  maxChoices: 1,
  choices: [
    { id: "s", name: "Small", nameFa: "کوچک", priceDelta: 0, isAvailable: true, isDefault: false },
    { id: "m", name: "Medium", nameFa: "متوسط", priceDelta: 10000, isAvailable: true, isDefault: true },
    { id: "l", name: "Large", priceDelta: 20000, isAvailable: false, isDefault: false },
  ],
};

const EXTRAS: ProductOptionGroup = {
  id: "extras",
  name: "Extras",
  required: false,
  selection: "multiple",
  minChoices: 0,
  maxChoices: 2,
  choices: [
    { id: "shot", name: "Extra shot", priceDelta: 15000, isAvailable: true, isDefault: false },
    { id: "oat", name: "Oat milk", nameFa: "شیر جو", priceDelta: 12000, isAvailable: true, isDefault: false },
    { id: "syrup", name: "Syrup", priceDelta: 8000, isAvailable: true, isDefault: false },
  ],
};

const GROUPS = [SIZE, EXTRAS];

describe("choiceBounds", () => {
  it("takes one from a required single-choice group, at most one from an optional one", () => {
    expect(choiceBounds(SIZE)).toEqual({ min: 1, max: 1 });
    expect(choiceBounds({ ...SIZE, required: false })).toEqual({ min: 0, max: 1 });
  });

  it("holds a multiple-choice group to its bounds, never past the choices it has", () => {
    expect(choiceBounds(EXTRAS)).toEqual({ min: 0, max: 2 });
    expect(choiceBounds({ ...EXTRAS, required: true, minChoices: 2, maxChoices: undefined })).toEqual({
      min: 2,
      max: 3,
    });
    expect(choiceBounds({ ...EXTRAS, required: true, minChoices: 0 }).min).toBe(1);
  });
});

describe("optionSelectionProblem", () => {
  it("accepts a selection that answers every group", () => {
    expect(optionSelectionProblem(GROUPS, ["m"])).toBeNull();
    expect(optionSelectionProblem(GROUPS, ["s", "shot", "oat"])).toBeNull();
  });

  it("refuses a choice the item doesn't have, or one twice", () => {
    expect(optionSelectionProblem(GROUPS, ["m", "nope"])).toBe("optionUnknown");
    expect(optionSelectionProblem(GROUPS, ["m", "shot", "shot"])).toBe("optionUnknown");
    expect(optionSelectionProblem([], ["m"])).toBe("optionUnknown");
  });

  it("refuses a choice that's switched off", () => {
    expect(optionSelectionProblem(GROUPS, ["l"])).toBe("optionUnavailable");
  });

  it("refuses a required group left unanswered, two sizes, or too many extras", () => {
    expect(optionSelectionProblem(GROUPS, [])).toBe("optionRequired");
    expect(optionSelectionProblem(GROUPS, ["s", "m"])).toBe("optionTooMany");
    expect(optionSelectionProblem(GROUPS, ["m", "shot", "oat", "syrup"])).toBe("optionTooMany");
  });

  it("asks for more when a required multiple-choice group has too few", () => {
    const pickTwo = { ...EXTRAS, required: true, minChoices: 2 };
    expect(optionSelectionProblem([pickTwo], ["shot"])).toBe("optionTooFew");
    expect(optionSelectionProblem([pickTwo], [])).toBe("optionTooFew");
    expect(optionSelectionProblem([{ ...pickTwo, minChoices: 1 }], [])).toBe("optionRequired");
  });
});

describe("defaults", () => {
  it("starts on a required single-choice group's available default", () => {
    expect(defaultChoiceIds(GROUPS)).toEqual(["m"]);
    const offDefault = { ...SIZE, choices: SIZE.choices.map((c) => ({ ...c, isAvailable: c.id !== "m" })) };
    expect(defaultChoiceIds([offDefault])).toEqual([]);
  });

  it("fills a required group a request left out, and leaves an answered one alone", () => {
    expect(withDefaultChoices(GROUPS, ["shot"])).toEqual(["shot", "m"]);
    expect(withDefaultChoices(GROUPS, ["s"])).toEqual(["s"]);
  });
});

describe("prices", () => {
  it("adds what each choice adds", () => {
    expect(priceWithChoices({ price: 100000, optionGroups: GROUPS }, ["m", "shot", "oat"])).toBe(137000);
    expect(priceWithChoices({ price: 100000 }, [])).toBe(100000);
  });

  it("reads 'from' the cheapest way to answer the required groups, among choices that can be had", () => {
    expect(lowestPrice({ price: 100000, optionGroups: GROUPS })).toBe(100000);
    const noSmall = { ...SIZE, choices: SIZE.choices.filter((c) => c.id !== "s") };
    expect(lowestPrice({ price: 100000, optionGroups: [noSmall, EXTRAS] })).toBe(110000);
    const pickTwo = { ...EXTRAS, required: true, minChoices: 2 };
    expect(lowestPrice({ price: 100000, optionGroups: [pickTwo] })).toBe(120000);
  });

  it("says whether options change the price at all", () => {
    expect(optionsChangePrice({ optionGroups: GROUPS })).toBe(true);
    const free = { ...EXTRAS, choices: EXTRAS.choices.map((c) => ({ ...c, priceDelta: 0 })) };
    expect(optionsChangePrice({ optionGroups: [free] })).toBe(false);
    expect(optionsChangePrice({})).toBe(false);
  });
});

describe("snapshotOptions", () => {
  it("keeps the names in both languages and the deltas, in the item's order", () => {
    expect(snapshotOptions(GROUPS, ["oat", "m"])).toEqual([
      {
        groupId: "size",
        group: "Size",
        groupFa: "اندازه",
        choiceId: "m",
        choice: "Medium",
        choiceFa: "متوسط",
        priceDelta: 10000,
      },
      {
        groupId: "extras",
        group: "Extras",
        choiceId: "oat",
        choice: "Oat milk",
        choiceFa: "شیر جو",
        priceDelta: 12000,
      },
    ]);
  });

  it("reads in the reader's language, falling back to English", () => {
    const options = snapshotOptions(GROUPS, ["m", "shot"]);
    expect(optionsSummary(options, "en")).toBe("Medium, Extra shot");
    expect(optionsSummary(options, "fa")).toBe("متوسط, Extra shot");
    expect(optionsSummary(undefined, "en")).toBe("");
  });
});

describe("choiceKey", () => {
  it("is the same whatever order the choices were picked in", () => {
    expect(choiceKey("p1", ["oat", "m"])).toBe(choiceKey("p1", ["m", "oat"]));
    expect(choiceKey("p1", ["m"])).not.toBe(choiceKey("p1", ["s"]));
    expect(choiceKey("p1")).toBe("p1");
  });
});

describe("saving groups", () => {
  const input = (overrides: Partial<ProductOptionGroupInput> = {}): ProductOptionGroupInput => ({
    name: " Size ",
    nameFa: " ",
    required: false,
    selection: "single",
    minChoices: 3,
    maxChoices: 4,
    choices: [
      { name: " Small ", priceDelta: 0, isAvailable: true, isDefault: true },
      { name: "Large", priceDelta: 20000, isAvailable: true, isDefault: false },
    ],
    ...overrides,
  });

  it("tidies names, bounds and defaults for the group's kind", () => {
    const [optional] = normalizeOptionGroups([input()]);
    expect(optional).toMatchObject({ name: "Size", minChoices: 0, maxChoices: 1 });
    expect(optional.nameFa).toBeUndefined();
    expect(optional.choices[0]).toMatchObject({ name: "Small", isDefault: false });

    const [required] = normalizeOptionGroups([input({ required: true })]);
    expect(required.minChoices).toBe(1);
    expect(required.choices[0].isDefault).toBe(true);

    const [extras] = normalizeOptionGroups([input({ selection: "multiple", minChoices: 2, maxChoices: undefined })]);
    expect(extras.minChoices).toBe(0);
    expect(extras.maxChoices).toBeUndefined();
  });

  it("refuses groups that can't be ordered from", () => {
    expect(optionGroupsProblem(normalizeOptionGroups([input()]))).toBeNull();
    expect(optionGroupsProblem([input({ choices: [] })])).toBe("optionChoicesRequired");
    expect(
      optionGroupsProblem([
        input({
          choices: [
            { name: "Small", priceDelta: 0, isAvailable: true, isDefault: false },
            { name: "small", priceDelta: 0, isAvailable: true, isDefault: false },
          ],
        }),
      ]),
    ).toBe("optionChoiceDuplicate");
    expect(
      optionGroupsProblem([input({ choices: [{ name: "A", priceDelta: -1, isAvailable: true, isDefault: false }] })]),
    ).toBe("optionPriceInvalid");
    expect(optionGroupsProblem([input({ selection: "multiple", minChoices: 0, maxChoices: 5 })])).toBe(
      "optionMaxInvalid",
    );
    expect(optionGroupsProblem([input({ selection: "multiple", required: true, minChoices: 3, maxChoices: 2 })])).toBe(
      "optionMinInvalid",
    );
    expect(optionGroupsProblem(Array.from({ length: 9 }, () => input()))).toBe("optionGroupsTooMany");
  });
});
