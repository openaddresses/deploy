import js from "@eslint/js";
import nodePlugin from "eslint-plugin-n";
import tseslint from "typescript-eslint";

export default [
    js.configs.recommended,
    nodePlugin.configs["flat/recommended-module"],
    ...tseslint.configs.recommended,
    {
        "files": ["**/*.ts"],
        "languageOptions": {
            "parserOptions": {
                "project": "./tsconfig.json"
            }
        },
        "rules": {
            "@typescript-eslint/no-unused-vars": "off",
            "n/hashbang": "off",
            "n/no-process-exit": "warn",
            "no-console": 0,
            "arrow-parens": [ "error", "always" ],
            "no-var": "error",
            "prefer-const": "error",
            "array-bracket-spacing": [ "error", "never" ],
            "comma-dangle": [ "error", "never" ],
            "computed-property-spacing": [ "error", "never" ],
            "eol-last": "error",
            "eqeqeq": [ "error", "smart" ],
            "indent": [ "error", 4, { "SwitchCase": 1 } ],
            "@typescript-eslint/no-explicit-any": "off",
            "no-unused-vars": "off",
            "no-confusing-arrow": [ "error", { "allowParens": false } ],
            "no-extend-native": "error",
            "no-mixed-spaces-and-tabs": "error",
            "func-call-spacing": [ "error", "never" ],
            "no-trailing-spaces": "error",
            "no-use-before-define": [ "error", "nofunc" ],
            "object-curly-spacing": [ "error", "always" ],
            "prefer-arrow-callback": "error",
            "quotes": [ "error", "single", "avoid-escape" ],
            "semi": [ "error", "always" ],
            "space-infix-ops": "error",
            "spaced-comment": [ "error", "always" ],
            "keyword-spacing": [ "error", { "before": true, "after": true } ],
            "template-curly-spacing": [ "error", "never" ],
            "semi-spacing": "error",
            "strict": "error"
        }
    },
    {
        "files": ["test/**/*.ts"],
        "rules": {
            "n/no-unpublished-import": "off"
        }
    }
]
