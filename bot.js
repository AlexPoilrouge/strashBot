// Import the discord.js module
const Discord= require('discord.js');

const wk= require('./worker');
const utils= require('./utils')

const botSettings= require('./settings.json');

class SmashBot extends Discord.Client{
    constructor(){
        super();

        this.worker= new wk.Worker(this);

        this.worker.guildID= botSettings.smashGuildID;
        this.worker.botChannel= botSettings.botChannelID;
        this.worker.onlineChannel= botSettings.online.channelID;
        this.worker.onlineReacMessage= botSettings.online.reacMessageID;
        this.worker.onlineReacEmote= botSettings.online.availableEmoteID;
        this.worker.onlineRole= botSettings.online.roleID;

        this.valid= utils.JSONCheck.validity(botSettings);
    }

    login(token){
        if(!this.valid){
            console.log( utils.JSONCheck.report(botSettings) );
            console.log("bot config isn't valid, won't login to discord");
        }
        else{
            super.login(token)
            .then()
            .catch( err => { console.log("Error when login to discord attempt…"); console.log(err); });
        }
    }

    get version(){
        return botSettings.version+'-'+botSettings.build;
    }
};


const client= new SmashBot();

/**
 * The ready event is vital, it means that only _after_ this will your bot start reacting to information
 * received from Discord
 */
client.on('ready', ()=>{
    console.log("Pif paf! SmashBot rrrready to rumblllllllllle!");
    
    console.log("Servers:")
    client.guilds.forEach((guild) => {
        console.log(" - " + guild.name)
    })

    client.worker.ready_setup();


    client.ws.connection.ws.setKeepAlive(true,2000,10000);
});

client.on('message', (message)=>{
    if(message.author.id === client.user.id) return; // Prevent bot from responding to its own messages


    if(message.channel.type === 'dm'){
        console.log(`Recieving DM command from ${message.author.id}`);
        client.worker.dMessage(message);
    }
    else{
        console.log(`Recieving command from channel ${message.channel.id}`);
        client.worker.processMessage(message);
    }
});

client.on('messageReactionAdd', (reaction, user) => {
	client.worker.reactionAdd(reaction, user)
});

client.on('messageReactionRemove', (reaction, user) => {
	client.worker.reactionRemove(reaction, user);
});

client.on('error', (error)=>{
    console.log("SmashBot websocket encountered an error…");
    console.log(error);
});

client.on('reconnecting', ()=>{
    console.log("SmashBot is attempting a reconnection through websocket…");
    client.worker.destroy();
});

client.on('resume', (replayed) =>{
    client.worker.destroy();
    console.log("SmashBot's websocket is resuming… "+replayed+" events were played.");
});

client.on('warn', (info) =>{
    console.log("SmashBot WARNING!!! : "+info);
});

client.on('disconnect', (event)=>{
    client.worker.destroy();
    console.log("SmashBot disconnected.");
    console.log(event);
});

// Log our bot in using the token from https://discordapp.com/developers/applications/me
client.login(botSettings.token)