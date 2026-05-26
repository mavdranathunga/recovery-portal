module.exports = {
  apps: [
    {
      name: "recovery-portal",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 5500",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
