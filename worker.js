const ogm= require('./onlineGroupManager');

class Worker{
    

    constructor(bot){
        this.bot= bot;

        this._ogm= null;

        this._errorHandlerSteup();
    }

    destroy(){

    }

    ready_setup(){
        this._readyOGM();
    }

    _errorHandlerSteup(){
        this._baseDataCheck ={
            GUILDOK: 0b1,
            BOTCHANNELOK: 0b10,
            ONLINECHANNELOK: 0b100,
            ROLEOK: 0b1000,
            EMOJIOK: 0b10000,
            REFMSGOK: 0b100000,

            evaluate: (testObj) =>{
                return (
                    ((testObj.guild)?this._baseDataCheck.GUILDOK:0b0) |
                    ((testObj.channel)?this._baseDataCheck.BOTCHANNELOK:0b0) |
                    ((testObj.onlineChannel)?this._baseDataCheck.ONLINECHANNELOK:0b0) |
                    ((testObj.role)?this._baseDataCheck.ROLEOK:0b0) |
                    ((testObj.emoji)?this._baseDataCheck.EMOJIOK:0b0) |
                    ((testObj.msg)?this._baseDataCheck.REFMSGOK:0b0)
                );
            },

            validity: (testObj) => {
                return (this._baseDataCheck.evaluate(testObj)===0b111111);
            },

            report: (testObj) => {
                let str= "[bot - worker class] Could obtain coherent data for: ";
                let r= this._baseDataCheck.evaluate(testObj);
                
                let reportConcat= (CTRL, fieldName) => {
                    if ( !(r & CTRL) ){
                        str+= "\n\t"+fieldName;
                    }
                }

                reportConcat(this._baseDataCheck.GUILDOK,"guild");
                reportConcat(this._baseDataCheck.BOTCHANNELOK,"bot channel");
                reportConcat(this._baseDataCheck.ONLINECHANNELOK,"online channel");
                reportConcat(this._baseDataCheck.ROLEOK,"online role");
                reportConcat(this._baseDataCheck.EMOJIOK,"emoji online mark");
                reportConcat(this._baseDataCheck.REFMSGOK,"reference message");

                return str;
            },
        };
    }


    _readyOGM(){
        let guild= this.bot.guilds.get(this._guildID);
        let channel= this.bot.channels.get(this._botChannelID);
        let onlineChannel= this.bot.channels.get(this._onlineChannelID);
        let role= guild.roles.get(this._onlineRoleID);
        let emoji= guild.emojis.get(this._availableEmoteID);
        let msg= null;

        channel.fetchMessage(this._onlineReacMessageID).then( message => {
            msg= message;
        })
        .catch(err => {
            console.log("Couldn't fetch reference message at "+this._onlineReacMessageID);
            console.log(err);

            this.bot.destroy();
        })
        .finally( () => {
            let obj= {guild:guild,channel:channel,onlineChannel:onlineChannel,role:role,emoji:emoji,msg:msg};
            if(this._baseDataCheck.validity(obj)){
                this._ogm= new ogm.OnlineGroupManager(this.bot, channel, role, msg, emoji);

                this._ogm.ready();
            }
            else{
                console.log(this._baseDataCheck.report(obj));

                this.bot.destroy();
            }
        });
    }

    reactionAdd(reaction, user){
        if (this._ogm!==null && user.id!==this.bot.user.id){
            this._ogm.reactionAdd(reaction,user);
        }
    }

    reactionRemove(reaction, user){
        if (this._ogm!==null && user.id!==this.bot.user.id){
            this._ogm.reactionRemove(reaction,user);
        }
    }

    processMessage(message){
        if(message.content.startsWith('!')){
            this.processCommand(message);
        }
    }

    processCommand(message){
        let splitCmd= message.content.substr(1).split(" ");
        let coreCmd= splitCmd[0];
        let args= splitCmd.slice(1);

        if(message.channel.id === this._onlineChannelID){
            if(coreCmd==="ping"){
                console.log("[cmd] !ping");
                message.author.send("'sup?");
            }
            else if(coreCmd==="kijou" && this._ogm!==null){
                console.log("[cmd] !kijou");
                this._ogm.kijouRequestFrom(message.author);
            }
        }
    }

    dMessage(message){
        if(message.content.startsWith('!')){
            this.processDMCommand(message);
        }
    }

    processDMCommand(message){
        let splitCmd= message.content.substr(1).split(" ");
        let coreCmd= splitCmd[0];
        let args= splitCmd.slice(1);

        if(coreCmd==="ping"){
            console.log("[dm cmd] !ping");
            message.author.send("'sup?");
        }
        else if(coreCmd==="kijou" && this._ogm!==null){
            console.log("[dm cmd] !kijou");
            this._ogm.kijouRequestFrom(message.author);
        }
        else if(coreCmd==="version" || coreCmd==="ver" || coreCmd==="v"){
            console.log(`[dm cmd] !${coreCmd}`);
            message.author.send(`Je suis **StrashBot** version *${this.bot.version}*`);
        }
        else if(coreCmd==="help" || coreCmd==="h" || coreCmd==="cmd"){
            console.log(`[dm cmd] !${coreCmd}`);
            this._cmdHelpRequestFrom(message.author);
        }
    }

    _cmdHelpRequestFrom(user){
        if(this._ogm){
            let txt= `Les commandes ci-dessous sont disponibles.\n( 📬 = 'via DM sur <@${this.bot.user.id}>; 🎮 = 'via le salon <#${this._onlineChannelID}>' )\n\n`;

            txt+= "\t`!kijou`\t📬🎮\n\t\t*liste les joueurs dispo pour du online*\n";
            txt+= "\t`!version | !ver | !v`\t📬\n\t\t*version courante du bot*\n";
            txt+= "\t`!help | !h | !cmd`\t📬\n\t\t*affiche cette aide*\n"

            user.send(txt);
        }
    }

    set guildID(id){
        this._guildID= id;
    }

    set botChannel(id){
        this._botChannelID= id;
    }

    set onlineChannel(id){
        this._onlineChannelID= id;
    }

    set onlineReacMessage(id){
        this._onlineReacMessageID= id;
    }

    set onlineReacEmote(id){
        this._availableEmoteID= id;
    }

    set onlineRole(id){
        this._onlineRoleID= id;
    }
};

module.exports.Worker= Worker;
