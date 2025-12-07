/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  plugins: ["prettier-plugin-organize-imports"],
  printWidth: 120,
  trailingComma: "es5",
  arrowParens: "avoid",
  tabWidth: 2,
  useTabs: false,
  semi: false,
};

export default config;
