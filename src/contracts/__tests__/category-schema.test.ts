import { describe, expect, it } from "vitest";

import { categoryFormSchema, type CategoryFormInput } from "../category-schema";

const FORM: CategoryFormInput = {
  name: " Hot drinks ",
  slug: " hot-drinks ",
  iconUrl: "/uploads/icons/cup.png",
  faName: " نوشیدنی گرم ",
};

const fieldErrorsOf = (input: CategoryFormInput): Record<string, string[] | undefined> | undefined =>
  categoryFormSchema.safeParse(input).error?.flatten().fieldErrors;

describe("categoryFormSchema", () => {
  it("defaults to active and folds the fa name into translations", () => {
    expect(categoryFormSchema.parse(FORM)).toEqual({
      name: "Hot drinks",
      slug: "hot-drinks",
      iconUrl: "/uploads/icons/cup.png",
      isActive: true,
      translations: [{ locale: "fa", name: "نوشیدنی گرم" }],
    });
  });

  it("drops translations for a blank fa name and keeps an explicit inactive flag", () => {
    expect(categoryFormSchema.parse({ ...FORM, faName: "  ", isActive: false })).toMatchObject({ isActive: false, translations: [] });
  });

  it("requires a name within 50 characters", () => {
    expect(fieldErrorsOf({ ...FORM, name: " " })?.name).toEqual(["nameRequired"]);
    expect(fieldErrorsOf({ ...FORM, name: "n".repeat(51) })?.name).toEqual(["nameTooLong"]);
  });

  it("requires a lower-case kebab slug within 60 characters", () => {
    expect(fieldErrorsOf({ ...FORM, slug: "" })?.slug).toContain("slugRequired");
    expect(fieldErrorsOf({ ...FORM, slug: "a".repeat(61) })?.slug).toEqual(["slugTooLong"]);
    for (const slug of ["Hot-Drinks", "hot drinks", "hot--drinks", "-hot", "hot-"]) {
      expect(fieldErrorsOf({ ...FORM, slug })?.slug).toEqual(["slugFormat"]);
    }
  });

  it("requires an icon that is a site path or an http(s) URL", () => {
    expect(fieldErrorsOf({ ...FORM, iconUrl: " " })?.iconUrl).toContain("iconRequired");
    expect(fieldErrorsOf({ ...FORM, iconUrl: "ftp://example.com/cup.png" })?.iconUrl).toEqual(["imageInvalid"]);
    expect(categoryFormSchema.safeParse({ ...FORM, iconUrl: "https://example.com/cup.png" }).success).toBe(true);
  });
});
