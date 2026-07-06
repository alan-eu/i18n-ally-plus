/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-check
'use strict'

const path = require('path')
const webpack = require('webpack')
const { TsconfigPathsPlugin } = require('tsconfig-paths-webpack-plugin')

/** @type {import('webpack').Configuration} */
const config = {
  target: 'node',
  optimization: {
    minimize: false,
  },
  entry: './src/extension.ts',
  output: {
    hashFunction: 'sha256',
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  devtool: 'source-map',
  externals: {
    'vscode': 'commonjs vscode',
    'nodejieba': 'nodejieba',
    'esm': 'esm',
    'ts-node': 'ts-node',
    'consolidate': 'consolidate',
    'less': '_',
    'sass': '_',
    'stylus': '_',
    'prettier': 'prettier',
    '@microsoft/typescript-etw': '_',
  },
  resolve: {
    extensions: ['.ts', '.js'],
    plugins: [
      new TsconfigPathsPlugin(),
    ],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
      {
        // some deps ship ESM .mjs with extensionless imports; don't require fully
        // specified request paths for them (webpack 5 default is strict)
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto',
        resolve: {
          fullySpecified: false,
        },
      },
    ],
  },
  // webpack 5: replaced webpack-filter-warnings-plugin
  ignoreWarnings: [
    /Critical dependency: the request of a dependency is an expression/,
  ],
  plugins: [
    // webpack 5: replaced the unplugin string-replace transform
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.I18N_ALLY_ENV),
    }),
  ],
}

module.exports = config
