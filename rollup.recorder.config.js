import 'dotenv/config';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/recorder/index.js',
  output: {
    file: 'public/recorder.js',
    format: 'iife',
  },
  plugins: [
    resolve({ browser: true }),
    commonjs(),
    replace({
      __COLLECT_API_HOST__: process.env.COLLECT_API_HOST || '',
      delimiters: ['', ''],
      preventAssignment: true,
    }),
    // maxWorkers: 1 : le conteneur de build canner signale 0 CPU, et terser lance alors 0 worker et bloque
    terser({ compress: { evaluate: false }, maxWorkers: 1 }),
  ],
};
