import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
    input: 'src/index.js',
    output: {
        file: 'dist/index.js',
        format: 'cjs'
    },
    plugins: {
        nodeResolve(),
        commonjs(),
        babel({
            presets: [[ '@babel/env', { modules: false } ]]
        }),
    },
    external: ["report-sdk"]
}


