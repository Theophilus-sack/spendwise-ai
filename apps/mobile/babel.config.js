module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@spendwise/shared': '../../packages/shared/src/index.ts',
          },
        },
      ],
      // Reanimated 4 split its babel transform into a separate
      // react-native-worklets package — must stay last in this list per
      // both libraries' setup docs.
      'react-native-worklets/plugin',
    ],
  };
};
