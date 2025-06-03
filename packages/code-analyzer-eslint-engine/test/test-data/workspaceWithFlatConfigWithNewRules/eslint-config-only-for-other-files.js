module.exports = [
    {
        plugins: {
            'dummy': require('eslint-plugin-dummy')
        },
        files: ["**/*.other"],
        rules: {
            "dummy/my-rule-1": [2],       // Checks that we users can specify number values and things won't blow up
            "dummy/my-rule-2": ['warn'],  // Warn should have an Info level severity
            "dummy/my-rule-3": ['error'], // Checks that we users can specify number values and things won't blow up
            "dummy/my-rule-5": ['error'], // Has no metadata and so it too should act like it doesn't even exist and can't be selected
            "dummy/my-rule-6": ['off'],   // Is explicitly turned off, therefore it is also acts like it does not exist and can't be selected
            "dummy/my-rule-7": ['error'], // Is deprecated and so it too should act like it doesn't even exist and can't be selected
            "dummy/my-rule-8": 'error',  // Tests that "problem" category is converted to high severity and tests that a string can be given instead of an array
        },
    }
];
