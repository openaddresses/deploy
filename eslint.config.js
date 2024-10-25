import js from "@eslint/js";
import nodePlugin from "eslint-plugin-n";

export default [
    js.configs.recommended,
    nodePlugin.configs["flat/recommended-module"],
    {
        "rules": {
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
            "no-confusing-arrow": [ "error", { "allowParens": false } ],
            "no-extend-native": "error",
            "no-mixed-spaces-and-tabs": "error",
            "func-call-spacing": [ "error", "never" ],
            "no-trailing-spaces": "error",
            "no-unused-vars": "error",
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
            "strict": "error",
        }
    }
]
