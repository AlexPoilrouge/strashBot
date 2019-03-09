// Import the discord.js module
const Discord= require('discord.js');

const wk= require('./worker');
const utils= require('./utils');

const config= require('config');

class SmashBot extends Discord.Client{
    constructor(){
        super();

        this.worker= new wk.Worker(this);

        this.worker.master= config.get('StrashBot.masterID');
        this.worker.guildID= config.get('StrashBot.smashGuildID');
        this.worker.botChannel= config.get('StrashBot.botChannelID');
        this.worker.onlineChannel= config.get('StrashBot.online.channelID');
        this.worker.onlineReacMessage= config.get('StrashBot.online.reacMessageID');
        this.worker.onlineReacEmote= config.get('StrashBot.online.availableEmoteID');
        this.worker.onlineRole= config.get('StrashBot.online.roleID');

        this.valid= utils.JSONCheck.validity(config.get('StrashBot'));
    }

    login(token){
        if(!this.valid){
            console.log( utils.JSONCheck.report(config.get('StrashBot')) );
            console.log("bot config isn't valid, won't login to discord");
        }
        else{
            super.login(token)
            .then()
            .catch( err => { console.log("Error when login to discord attempt…"); console.log(err); });
        }
    }

    get version(){
        return config.get('StrashBot.version')+'-'+config.get('StrashBot.build');
    }
};


const client= new SmashBot();

/**
 * The ready event is vital, it means that only _after_ this will your bot start reacting to information
 * received from Discord
 */
client.on('ready', ()=>{
    console.log("Pif paf! StrashBot rrrready to rumblllllllllle!");
    
    console.log("Servers:")
    client.guilds.forEach((guild) => {
        console.log(" - " + guild.name)
    })

    client.worker.ready_setup();
});

client.on('message', (message)=>{
    if(message.author.id === client.user.id) return; // Prevent bot from responding to its own messages

    // console.log(`mmmm ${message.content}`);

    if(message.channel.type === 'dm'){
        client.worker.dMessage(message);
    }
    else{
        client.worker.processMessage(message);
    }
});

client.on('messageReactionAdd', (reaction, user) => {
	client.worker.reactionAdd(reaction, user)
});

client.on('messageReactionRemove', (reaction, user) => {
	client.worker.reactionRemove(reaction, user);
});

client.on('messageDelete', (message) => {
	client.worker.messageDelete(message);
});

client.on('guildMemberRemove', (member) => {
    client.worker.memberRemove(member);
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
client.login(config.get('StrashBot.token'));