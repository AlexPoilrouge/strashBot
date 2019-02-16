#### INFO

Bot made for small local Discord server.
Can (non-exhaustively):
* Add specific role to a user that reacts with a specific emoji to a specific message
* Respond to some command under format `!command`
(only works for one server per instance)
Bot written in node.js.



#### Dependencies

* npm
* Node.js
* discord.js



#### Install and use

##### Create and invite Bot

Check out Discord's documentation for how to [create a bot account](https://discordpy.readthedocs.io/en/rewrite/discord.html) for your server.
Once it's done, invite the bot to the server (only possible by user with "manager server" permission) by using a link formatted as follow:
`https://discordapp.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot&permissions=PERMISSION_INTEGER`
Where `YOUR_CLIENT_ID` can be found on the [discord application page](https://discordapp.com/developers/applications), and the `PERMISSION_INTEGER` can also be compute from there ('Bot' section).

**Be sure to note your bot's `TOKEN` from the bot section.**


##### Configure bot

Configure the bot by filling appropriately the `settings.json` file.
The `token` filed is your bot's previously obtained token.
All the IDs can be found from your Discord App, by switching to developer mode.


##### Launch bot

`node bot.js`



#### Release and use

This bot was made for personal needs and use. The code is release on the
off chance it might be of use to someone but without the intention of providing
any form of utility software or service in a rigorous manner.
Therefore, **no support** is endorsed by the developer, meaning that **any
comment, feedback, or request regarding this code should be expected to be completely
ignored by the developer**.
Additionally, the responsibility of any undesired effect the execution of this
bot might have on any system lies solely in the hands of the user.


*From Strasbourg,
with love.*

