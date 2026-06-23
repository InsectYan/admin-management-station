module.exports = () => {
  const config = {};

  config.sequelize = {
    logging: console.log,
  };

  return config;
};
