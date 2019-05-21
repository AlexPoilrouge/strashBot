const ogm= require('./onlineGroupManager');

const fcm= require('./friendCodeManager');

const am= require('./arenaManager');

class Worker{
    

    constructor(bot){
        this.bot= bot;

        this._ogm= null;
        this._fcm= null;
        this._am= null;

        this._errorHandlerSteup();
    }

    destroy(){

    }

    ready_setup(){
        this._readyOGM();
        this._readyFCM();
        this._readyAM();
    }

    _errorHandlerSteup(){
        this._baseDataCheck ={
            GUILDOK: 0b1,
            BOTCHANNELOK: 0b10,
            ONLINECHANNELOK: 0b100,
            ROLEOK: 0b1000,
            EMOJIOK: 0b10000,
            REFMSGOK: 0b100000,
            TOTAL: 0b111111,

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

            validity: (testObj, expected= this._baseDataCheck.TOTAL) => {
                return (this._baseDataCheck.evaluate(testObj)===expected);
            },

            report: (testObj, expected= this._baseDataCheck.TOTAL) => {
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
        let role= null;
        let emoji= null;
        if(this._baseDataCheck.validity({guild:guild},this._baseDataCheck.GUILDOK)){
            role= guild.roles.get(this._onlineRoleID);
            emoji= guild.emojis.get(this._availableEmoteID);
        }
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

    _readyFCM(){
        let guild= this.bot.guilds.get(this._guildID);
        let obj= {guild:guild};
        if(this._baseDataCheck.validity(obj,this._baseDataCheck.GUILDOK)){
            this._fcm= new fcm.FriendCodeManager(this.bot, guild);
            this._fcm.adminID= this._masterID;
    
            this._fcm.loadFriendCodes();
            this._fcm.checkMembers();
        }
        else{
            console.log(this._baseDataCheck.report(obj));

            this.bot.destroy();
        }
    }

    _readyAM(){
        let onlineChannel= this.bot.channels.get(this._onlineChannelID);
        let obj= {onlineChannel:onlineChannel};
        if(this._baseDataCheck.validity(obj,this._baseDataCheck.ONLINECHANNELOK)){
            this._am= new am.ArenaManager(this.bot, onlineChannel);

            this._am.loadArenas();
        }
        else{
            console.log(this._baseDataCheck.report(obj));

            this.bot.destroy();
        }

    }

    reactionAdd(reaction, user){
        if(user.id!==this.bot.user.id){
            if (this._ogm!==null){
                this._ogm.reactionAdd(reaction,user);
            }

            if (this._am!==null){
                this._am.reactionAdd(reaction, user);
            }
        }
    }

    reactionRemove(reaction, user){
        if(user.id!==this.bot.user.id){
            if (this._ogm!==null){
                this._ogm.reactionRemove(reaction,user);
            }

            if (this._am!==null){
                this._am.reactionRemove(reaction, user);
            }
        }
    }

    messageDelete(message){
        if(this._am){
            this._am.messageDelete(message);
        }
    }

    processMessage(message){
        if(message.content.startsWith('!')){
            this.processCommand(message);
        }
    }

    processCommand(message){
        let splitCmd= message.content.substr(1).split(" ");
        let coreCmd= splitCmd[0].toLowerCase();
        let args= splitCmd.slice(1);

        let hasAttachments= (message.attachments && message.attachments.size > 0);

        if(message.channel.id === this._onlineChannelID){
            if(coreCmd==="ping"){
                console.log("[cmd] !ping");
                message.author.send("'sup?");
            }
            else if(coreCmd==="kijou" && this._ogm!==null){
                console.log("[cmd] !kijou");
                this._ogm.kijouRequestFrom(message.author);
            }
            else if((coreCmd==="codeami" || coreCmd==="ca" || coreCmd==="friendcode" || coreCmd==="fc" || coreCmd==="codami" || coreCmd==="kodami" || coreCmd==="code-ami"
                    || coreCmd==="friend-code"|| coreCmd==="ça") && this._fcm)
            {
                console.log(`[cmd] !${coreCmd}`);
                this._fcm.command(args, message.author, message.channel);
            }
            else if(coreCmd.match(/^a(r(e|é|è|ê)n(e|a))?$/) && this._am){
                console.log(`[cmd] !${coreCmd}`);
                this._am.command(args, message.author, message.channel,
                    (hasAttachments? message.attachments.first().count : null));
            }
            else if(coreCmd.match(/^a(r(e|é|è|ê)n(e|a))?s$/) && this._am){
                console.log(`[cmd] !${coreCmd}`);
                if(args.length<=0){
                    this._am.postArenaList(message.channel);
                }
                else{
                    this._am.command(args, message.author, message.channel,
                        (hasAttachments? message.attachments.first().count : null));
                }
            }
            else if(coreCmd.match(/^q(uit)?$/) && this._am){
                console.log(`[cmd] !${coreCmd}`);
                this._am._qCall(message.author);
            }
        }
    }

    dMessage(message){
        console.log("Recieving DMessage…");
        if(message.content.startsWith('!')){
            this.processDMCommand(message);
        }
        else if(this._am){
            this._am.dMessage(message);
        }
    }

    processDMCommand(message){
        let splitCmd= message.content.substr(1).split(" ");
        let coreCmd= splitCmd[0].toLowerCase();
        let args= splitCmd.slice(1);

        let hasAttachments= (message.attachments && message.attachments.size > 0);

        if(coreCmd==="ping"){
            console.log("[dm cmd] !ping");
            message.author.send("'sup?");
        }
        else if((coreCmd==="kijou" || coreCmd==="@kijou") && this._ogm){
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
        else if((coreCmd==="codeami" || coreCmd==="ca" || coreCmd==="friendcode" || coreCmd==="fc" || coreCmd==="codami" || coreCmd==="kodami" || coreCmd==="code-ami"
                    || coreCmd==="friend-code" || coreCmd==="ça") && this._fcm)
        {
            console.log(`[dm cmd] !${coreCmd}`);
            this._fcm.command(args, message.author, message.channel);
        }
        else if(coreCmd.match(/^a(r(e|é|è|ê)n(e|a))?$/) && this._am){
            console.log(`[cmd] !${coreCmd}`);
            this._am.command(args, message.author, message.channel,
                (hasAttachments? message.attachments.first(): null));
        }
        else if(coreCmd.match(/^a(r(e|é|è|ê)n(e|a))?s$/) && this._am){
            console.log(`[cmd] !${coreCmd}`);
            if(args.length<=0){
                this._am.postArenaList(message.channel);
            }
            else{
                console.log(`hattcmnts ${hasAttachments}`);
                this._am.command(args, message.author, message.channel,
                    (hasAttachments? message.attachments.first(): null));
            }
        }
        else if(coreCmd.match(/^q(uit)?$/) && this._am){
            console.log(`[cmd] !${coreCmd}`);
            this._am._qCall(message.author);
        }
    }

    _cmdHelpRequestFrom(user){
        let txt= `Les commandes ci-dessous sont disponibles.\n( 📬 = 'via DM sur <@${this.bot.user.id}>; 🎮 = 'via le salon <#${this._onlineChannelID}>' )\n\n`;

        if(this._ogm){
            txt+= "\t`!kijou`\t📬🎮\n\t\t*liste les joueurs dispo pour du online*\n";
        }
        if(this._fcm){
            txt+="\t`!ca | !codeami`\t📬🎮\n\t\t*gestion des codes ami; tape `!codeami !help` pour plus d'infos*\n"
        }
        if(this._am){
            txt+="\t`!arene | !a` \t📬🎮\n\t\t*Création d'arène; tape `!arene !help` pour plus d'infos*\n"
            txt+="\t`!arenes | !as` \t📬🎮\n\t\t*Liste arènes dispos, équvialent à `!arene !list`*\n"
        }
        txt+= "\t`!version | !ver | !v`\t📬\n\t\t*version courante du bot*\n";
        txt+= "\t`!help | !h | !cmd`\t📬\n\t\t*affiche cette aide*\n\n";

        txt+= `Fais aussi un tour du côté du salon <#${this._botChannelID}> puis <#${this._onlineChannelID}> pour t'aider à trouver des games`;

        user.send(txt);
    }

    memberRemove(member){
        if(member.guild.id===this._guildID){
            if(this._fcm && this._fcm.getFriendCode(member.user)){
                console.log(`[Worker] ${member.user.id} is no longer part of the guild, deleting friend code`);
                this._fcm.deleteFriendCode(member.user);
            }
        }
    }

    request(requestObject){
        let rq= requestObject.name.toLowerCase();

        if(rq==='friend-code' && this._fcm){
            let usr= requestObject['user'];
            let fc= null;
            if(usr){
                fc= this._fcm.getFriendCode(usr);
            }

            return {'friendCode':fc, 'user': usr};
        }
        else if(rq==='friend-code-update' && this._am){
            let usr= requestObject['user'];
            let fc= requestObject['friendCode'];
            if(usr){
                this._am._fcUpdate(usr, fc);
            }
        }
        else if(rq==='friend-code-delete' && this._am){
            let usr= requestObject['user'];
            if(usr){
                this._am._fcDelete(usr);
            }
        }
        else if(rq==='arena-status' && this._am){
            let usr= requestObject['user'];
            let status=null;
            if(usr){
                status=(this._am.getCreatedArena(usr))?
                                'owner'
                            : (this._am._userArenaDict[usr.id])?
                                'member'
                                : '';
            }
            return {'status': status, 'user': usr};
        }

        return null;
    }

    set master(id){
        this._masterID= id;
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
