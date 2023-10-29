import svelte from 'rollup-plugin-svelte'
import { terser } from 'rollup-plugin-terser'
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import serve from 'rollup-plugin-serve'

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
            }
        }),
        resolve({
            browser: true,
            dedupe: ['svelte']
        }),
        serve('public'),
        commonjs()
        //terser()
    ]
};