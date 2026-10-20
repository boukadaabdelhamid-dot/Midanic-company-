const assert = require("node:assert/strict");
const { test } = require("node:test");
const { language, dictionary } = require("./language-test-helpers.cjs");

test("French and Arabic retain their original labels for every English entry", () => {
  for (const french of Object.keys(dictionary.enTranslations)) {
    assert.equal(language.translateUi("fr", french, "نص عربي"), french);
    assert.equal(language.translateUi("ar", french, "نص عربي"), "نص عربي");
    assert.equal(language.translateUi("en", french, "نص عربي"), dictionary.enTranslations[french]);
  }
});

test("unknown labels and object property names remain safe strings", () => {
  for (const source of ["Unconfigured custom label", "constructor", "toString", "__proto__"]) {
    assert.equal(language.translateUi("en", source, "نص عربي"), source);
  }
});

test("explicit locale selection never changes machine values", () => {
  for (const [lang, locale] of [["fr", "fr-DZ"], ["ar", "ar-DZ"], ["en", "en-DZ"]]) {
    assert.equal(language.useLang.locale(lang), locale);
    for (const value of ["true", "false", "draft", "ORDER-123"]) {
      assert.equal(language.translateUi(lang, value, value), value);
    }
  }
});
