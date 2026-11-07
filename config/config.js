module.exports = {
  webUsername: 'admin',
  webPassword: 'CHANGE_THIS_PASSWORD',
  lookupToken: 'YOUR_DISCORD_TOKEN_HERE',

  openRouterKey: 'YOUR_OPENROUTER_API_KEY_HERE',

  allowedUserIds: [
    'YOUR_DISCORD_USER_ID'
  ],

  prefix: '',

  nodes: [
    {
      name: 'Local-Lavalink',
      host: '127.0.0.1',
      port: 2333,
      auth: 'youshallnotpass',
      secure: false,
      driver: 'lavalink/v4'
    },
    {
      name: 'BGCrazy-Lavalink',
      host: 'node.bgcrazy.in',
      port: 25575,
      auth: 'Mark1234',
      secure: false,
      driver: 'lavalink/v4'
    }
  ]
};
