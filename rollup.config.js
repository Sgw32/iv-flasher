import svelte from 'rollup-plugin-svelte-hot'
import { terser } from 'rollup-plugin-terser'
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import serve from 'rollup-plugin-serve'
import reload from 'rollup-plugin-livereload'

export default {
    input: 'src/main.js',
    output: {
        file: 'public/main.min.js',
        name: 'app',
        format: 'iife'
    },
    plugins: [
        svelte({
            css: css => {
                css.write('css/bundle.css', false);
            },
            hot: true
        }),
        resolve({
            browser: true,
            dedupe: ['svelte']
        }),
        commonjs(),
        //terser()
        serve('public'),
        reload(),
    ]
};
