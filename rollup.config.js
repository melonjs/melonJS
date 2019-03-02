import multiEntry from "rollup-plugin-multi-entry";
import replace from 'rollup-plugin-replace';

const pkg = require('./package.json');

export default {
    input: require('./sourceFiles.json'),
    plugins: [
        multiEntry(),
        replace({
            '__VERSION__': pkg.version,
            //'/this\._super\(\s*([\w\.]+)\s*,\s*"(\w+)"\s*(,\s*)?/g' : '$1.prototype.$2.apply(this$3',
             delimiters: ['', '']
        })
    ],
    output: {
      file: 'build/melonjs.js',
      format: 'cjs'
    }
};
