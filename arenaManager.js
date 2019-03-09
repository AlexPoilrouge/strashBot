const fs = require('fs');
const path= require('path');

const Discord= require('discord.js');

const utils= require('./utils');

const schedule= require('node-schedule');

class Arena{
    constructor(user){
        this._creator= user;

        this._friendsOnly= false;
        this._arenaID= undefined;
        this._accessCode= undefined;
        this._availableSlots= 3;
        this._knowMembers= [];
        this._description= "-";
        this._imgUrl="";
    }

    arenaGenericInfoTxt(){
        return `*ID d'arène*:\t **${(this._arenaID)?this._arenaID:'-'}**\n`+
                `*Type*:\t **${(this._friendsOnly)?'Amis uniquement':'Publique'}**\n`+
                `*Code d'accès*:\t **${(this._accessCode)?`${this._accessCode}`:'-'}**\n`+
                `*Capacité:*\t **${this._availableSlots}** places\n`+
                `*Description:*\t **${this.description}**`;
    }

    joining(user){
        if( user.id!==this._creator.id && !(this._knowMembers.find(m => m.id===user.id)) ){
            this._knowMembers.push(user);

            return true;
        }

        return false;
    }

    leaving(user){
        for(var i=0; i<this._knowMembers.length; ++i){
            let m= this._knowMembers[i];
            if(m && m.id===user.id){
                this._knowMembers= this._knowMembers.slice(0,i).concat(this._knowMembers.slice(i+1,this._knowMembers.length));
            }
        }
    }

    savableObject(){
        let r= {};

        r['creatorID']= (this._creator)?this._creator.id:null;
        r['friendsOnly']= this._friendsOnly;
        r['ID']= this._arenaID;
        r['accessCode']= this._accessCode;
        r['availableSlot']= this._availableSlots;
        r['imageUrl']= this._imgUrl;

        let km= [];
        this._knowMembers.forEach(u => {
            if(u){
                km.push(u.id);
            }
        });

        r['members']= km;

        r['description']= this._description;

        return r;
    }

    async assignFromSavedObject(o, bot){
        this._friendsOnly= o._friendsOnly;
        this._arenaID= o.ID;
        this._accessCode= o.accessCode;
        this._availableSlots= o.availableSlot;
        this.imgUrl= o.imageUrl;
        this._description= o.description;

        await bot.fetchUser(o.creatorID).then(u => {
            this._creator= u;
        })
        .catch(err => {
            console.log(`[Arena] couldn't find creator ${o.creator.id}`);
            console.log(err);
            this._creator= null;
        });

        let t= [];
        if(o.members){
            await Promise.all(o.members.map(async id => {
                if(id && id!==o.creator.id){
                    await bot.fetchUser(id).then(u => {
                        t.push(u);
                    })
                    .catch(err => {
                        console.log(`[Arena] couldn't find user ${id}`);
                        console.log(err);
                    });
                }
            }));
        }
        this._knowMembers= t;
    }


    get creator(){ return this._creator; }
    get isFriendsOnly(){ return this._friendsOnly; }
    get isPublic(){ return !this._friendsOnly; }
    get arenaID(){ return this._arenaID; }
    get needsAccessCode(){ return (this._accessCode)?true:false; }
    get accessCode(){ return this._accessCode; }
    get capacity(){ return this._availableSlots; }
    get slotsRemaining(){
        let r= this._availableSlots - this._knowMembers.length - 1;
        return (r<0)?0:r;
    }
    get members(){
        return this._knowMembers;
    }
    get absoluteSlotsRemaining(){ return this._availableSlots - this._knowMembers.length - 1; }
    get description(){ return this._description;  }
    get isComplete(){ return (this._creator && (this._arenaID || this._imgUrl) ); }

    set imgUrl(url){
        if(url && url.match(/^http(s)?:\/\/\S*\.(png|jpg|jpeg|gif|bmp|tiff)$/)){
            this._imgUrl=url;
        }
        else{
            this._imgUrl="";
        }
    }
    get imgUrl(){
        return this._imgUrl;
    }
    
    
    hasMember(user){ return (this._knowMembers.find(u => {return u.id===user.id;})); }

    _setArenaID(id){


        return false;
    }

    _setAccessCode(code){


        return false;
    }

    _addPlayer(user){
        if(!this._knowMembers.includes(user.id));
            this._knowMembers.push(user.id);
    }

    _removePlayer(user){
        let i= this._knowMembers.indexOf(user.id);
        if(i>0 && i< this._knowMembers.length){
            this._knowMembers.splice(i,1);
            return true;
        }
        return false;
    }

    _setCapacity(n){
        if(n>1 && n<=8){
            this._availableSlots= n;
        }
    }

    _addDescription(txt){
        if(txt.length<=240){
            this._description= txt;
            return true;
        }
        else{
            return false;
        }
    }
};

class ArenaContainer{
    constructor(arena, ctrlMsg= null, accessMsg= null, initDate= null){
        this._arena= arena;
        this._ctrlMsg= ctrlMsg;
        this._accessMsg= accessMsg;
        this._initDate= initDate;
    }

    savableObject(){
        let r= this._arena.savableObject();
        r['ctrlMsgID']= (this._ctrlMsg)?this._ctrlMsg.id:null;
        r['accessMsgID']= (this._accessMsg)?this._accessMsg.id:null;
        r['initDate']= (this._initDate)?this._initDate:null;

        return r;
    }

    async assignFromSavedObject(o, bot, onlineChannel){
        let a= new Arena(null);
        await a.assignFromSavedObject(o, bot);

        this._arena= a;

        let timeOut= false;
        await this._arena.creator.createDM();
        if( o.ctrlMsgID && o.initDate && !(timeOut=(((Date.now()-o.initDate)/3600000)>4)) ){
            await this._arena.creator.dmChannel.fetchMessage(o.ctrlMsgID)
            .then( msg => this._ctrlMsg= msg )
            .catch( err => {
                console.log(`[AC] Couldn't fetch ctrlMessage ${o.ctrlMsgID} for user ${a.creator.id}'s arena.`);
                console.log(err);
                this._ctrlMsg= null;
            });

            this._initDate= new Date(o.initDate);
        }

        let reac= null;
        if(timeOut){
            console.log(`[AC] Didn't create arena for user ${this._arena.creator} because already timed out`);

            this._arena= null;
        }
        else if(!this._ctrlMsg){
            console.log(`[AC] Coudln't read or find ctrlMessage for user ${this._arena.creator}'s arena from saved data`);

            this._arena= null;
        }
        else if(this._arena){
            if(this._ctrlMsg.reactions && (reac= this._ctrlMsg.reactions.find(r =>{return (r.emoji.name==='👥' && r.count>1);}))){
                await reac.fetchUsers().then( users => {
                    this._arena._friendsOnly= (users.find(u => {return (u.id===this._arena.creator.id);}));
                })
                .catch(err => {
                    console.log(`[AC] couldn't find reaction's users of 👥 on ctrlMessage ${this._ctrlMsg.id}`);
                    console.log(err);
                })
            }
            if(this._ctrlMsg.reactions && (reac= this._ctrlMsg.reactions.find(r =>{return (r.emoji.name==='🛑' && r.count>1);}))){
                await reac.fetchUsers().then( users => {
                    if(users.find(u => {return (u.id===this._arena.creator.id);})){
                        console.log(`[AC] User ${this._arena.creator} seems to have closed his arena…`);

                        this._arena= null;
                    }
                })
                .catch(err => {
                    console.log(`[AC] couldn't find reaction's users of 🛑 on ctrlMessage ${this._ctrlMsg.id}`);
                    console.log(err);
                })
            }
        }

        if(o.accessMsgID){
            await onlineChannel.fetchMessage(o.accessMsgID)
            .then( msg => { this._accessMsg= msg; })
            .catch( err => {
                console.log(`[AC] Couldn't fetch accessMessage ${o.accessMsgID} for user ${a.creator.id}'s arena.`)
            });

            if(this._arena && this._accessMsg.reactions && (reac= this._accessMsg.reactions.find(r =>{return (r.emoji.name==='⚔' && r.count>1);}))){
                await reac.fetchUsers().then( users => {
                    users.tap( usr=>{
                        if(!this._arena.hasMember(usr)){
                            this._arena.joining(usr);
                        }
                    });
                })
                .catch(err =>{
                    console.log(`[AC] couldn't find reaction's users of ⚔ on ctrlMessage ${this._ctrlMsg.id}`);
                    console.log(err);
                });

                let rejects= [];
                this._arena.tap(usr => {
                    if(! reac.users.find( u => {u.id === usr.id})){
                        rejects.push(usr);
                    }
                });

                rejects.tap(usr => {this._arena.leaving(usr);});
            }
        }

        return (this._arena && this._ctrlMsg);
    }

    refreshNow(){ this._initDate= Date.now();}
    isTimedOut(hoursTimeOut=4){
        return (this._initDate && (((Date.now()-this.savableObject._initDate)/3600000)>4));
    }

    get arena(){ return this._arena; }
    set arena(a){ this._arena= a; }
    get ctrlMessage(){ return this._ctrlMsg; }
    set ctrlMessage(msg){ this._ctrlMsg= msg; }
    get accessMessage(){ return this._accessMsg; }
    set accessMessage(msg){ this._accessMsg= msg; }
}

class ArenaManager{
    constructor(bot, onlineChannel){
        this._bot= bot;
        this._onlineChannel= onlineChannel;


        this.arenaJSONFile= path.resolve(__dirname, "data/arenas.json");
        this._arenaList= {};
        this._userArenaDict= {};

        this._areanKillTimer= schedule.scheduleJob('0 */4 * * *', () =>    {
            let killList=[];
            Object.keys(this._arenaList).forEach(ack => {
                let ac= this._arenaList[ack];
                if(ac && ac.arena && ac.isTimedOut()){
                    killList.push(ac.arena);
                }
            })

            killList.forEach(a =>{
                console.log(`[AM TO] Killing off arena of ${a.creator.id} because of timeout`);
                this._endArena(a);
            });
        });
    }


    loadArenas(){
        let data= fs.readFileSync(this.arenaJSONFile);
        this._arenaList= {};
        let miss= false;
        if(data){
            let tmpList= JSON.parse(data);

            Object.keys(tmpList).forEach(async key =>{
                let ac= new ArenaContainer(null);
                if(await ac.assignFromSavedObject(tmpList[key], this._bot, this._onlineChannel)){
                    this._arenaList[key]= ac;

                    ac.arena.members.forEach( usr => {
                        this._userArenaDict[usr.id]= ac.arena;

                        this._checkArenaMemberShip(usr);
                    });
                }
                else{
                    if(ac.ctrlMessage){
                        ac.ctrlMessage.delete().then( m => {})
                        .catch(err => {console.log("[AC Load] error deleting old ctrlMessage"); console.log(err);})
                    }
                    if(ac.accessMessage){
                        ac.accessMessage.delete().then( m => {})
                        .catch(err => {console.log("[AC Load] error deleting old accessMessage"); console.log(err);})
                    }

                    miss= true;
                    console.log(`[AM load] Couldn't load user ${key}'s arena…`);
                }
            });
        }
        else{
            console.log(`[FC loading] Error reading data from '${this.arenaJSONFile}'!`);
        }

        if(miss){
            this.saveArenas();
        }
    }

    saveArenas(){
        let tmpList= {};
        Object.keys(this._arenaList).forEach(key =>{
            let ac= this._arenaList[key];
            if(ac){
                tmpList[key]= ac.savableObject();
            } 
        });

        let data= JSON.stringify(tmpList, null, 2);
        fs.writeFile(this.arenaJSONFile, data, err => {
            if(err){
                console.log(`[FC Saving] Couldn't write in file '${this.arenaJSONFile}'…` );
                console.log(err);
            }
        });
    }

    command(args, user, channel, mAttach= null){
        if(mAttach && mAttach.height && mAttach.width && (mAttach.height*mAttach.width)>0){
            this.command([mAttach.url].concat(args),user, channel);
        }
        else if(args && args.length>0 && args[0].toLowerCase().match(/^http(s)?:\/\/\S*\.(png|jpg|jpeg|gif|bmp|tiff|svg)$/)){
            this._arenaCall(user, args);
        }
        else if((! args) || args.length<=0){
            this._arenaCall(user);
        }
        else if( !(args[0].startsWith('!') && args[0].length>1 && this._subCommand(args[0].slice(1),args.slice(1),user, channel))){
            let rest= args.join(' ');
            this._invokePlayerName(rest, user);
        }
    }

    _subCommand(cmd, args, user, channel){
        if(cmd.match(/^l(ist(s)?)?$/)){
            this.postArenaList(channel);

            return true;
        }
        else if(cmd.match(/^h(elp)?$/)){            
            let txt= "Les modalités d'utilisation de la commande `!arene` sont les suivantes: \n\n";

            txt+="\t`!arene`\n\t\t*Entame la création d'arène. Suivre les instructions du strashBot via DM.*\n";
            txt+="\t`!arene !list|!l`\n\t\t*Listes les arène crées et ouvertes*\n";
            txt+="\t`!arene [@]<username|pseudo>`\n\t\t*Invite un membre à ton arène si tu es proprio d'une arène, rejoint l'arène du gars sinon"+
                    "(@ optionnel pour éviter la mention).*\n";

            txt+="\t`!arene !delete|!d|!quit|!q`\n\t\t*Quitte l'arène si tu es membre, ferme l'arène si propriétaire.*\n";

            txt+="\nNB: Les arènes sans activité depuis 4 heures seront effacés toutes les 4 heures."

            user.send(txt);

            return true;
        }
        else if(cmd.match(/^(d(el(ete)?)?)|(q(uit)?)$/)){ 
            this._qCall(message.author);

            return true;
        }

        return false;
    }

    _qCall(user){
        let a= this.getCreatedArena(user);
        if(a){
            this._endArena(a);
        }
        else if((a=this._userArenaDict[user]) && a.isComplete){
            this._leave(user, a);
        }
    }

    async _invokePlayerName(name, caller){
        await Promise.all(Object.keys(this._arenaList).map(async key =>{
            await this._bot.fetchUser(key)
                .catch(err => {console.log(`[AM Invoke] can't fetch user ${key}…`)});
        }));
        await Promise.all(Object.keys(this._userArenaDict).map(async key =>{
            await this._bot.fetchUser(key)
                .catch(err => {console.log(`[AM Invoke] can't fetch user ${key}…`)});
        }));
        
        await this._bot.fetchUser(caller.id);

        let usrs= [];
        await utils.Misc.findCachedUsersFromString(name, this._onlineChannel.guild).then(uu => {usrs= uu;}).catch(err => console.log(err));

        if(usrs && usrs.length>0){
            usrs.some(u =>{
                let a= null;
                if(caller.id===u.id){
                    if(this.getCreatedArena(caller)){
                        caller.send(`⭕ - Tu as une arène`+
                            `${(this._arenaList[caller.id].ctrlMessage)?` ouverte ( <${this._arenaList[caller.id].ctrlMessage.url}> )`
                                                                    : ` en cours de création…` }`);
                    }
                    else{
                        caller.send(`⭕ - Tu n'es pas officiellement propriétaire d'une arène…`);
                    }
                }
                else if(a=this.getCreatedArena(caller)){
                    if(this.getCreatedArena(u)){
                        let aMsg= this.getArenaAccessMessage(u);
                        caller.send(`❌ - ${u} est déjà propriétaire de sa propre arène ${aMsg?`(<${aMsg.url}>)`:''}, tu ne peux pas l'inviter…`);
                    }
                    else if(a=this._userArenaDict[u.id]){
                        if(a.creator && a.creator.id===caller.id){
                            caller.send(`⭕ - ${u} fait déjà partie de ton arène…`);
                        }
                        else{
                            caller.send(`❌ - ${u} est déjà dans une autre arène (${a.creator}), tu ne peux pas l'inviter…`);
                        }
                    }
                    else{
                        this._join(u,a);

                        return true;
                    }
                }
                else{
                    if(a=this.getCreatedArena(u)){
                        let a2= null;
                        if(a.creator && (a2=this._userArenaDict[u.id]) && a2.creator.id===a.creator.id){
                            caller.send(`⭕ - Tu es déjà membre de l'arène de ${u}…`);
                        }
                        else{
                            this._join(caller,a);

                            return true;
                        }
                    }
                    else if(a=this._userArenaDict[u.id]){
                        let aMsg= this.getArenaAccessMessage(a.creator);
                        caller.send(`⭕ - ${u} est membre de l'arène de ${a.creator} ${aMsg?`(<${aMsg.url}>)`:''}…`);
                    }
                    else{
                        caller.send(`❌ - ${u} n'a pas ouvert d'arène…`);
                    }
                }

                return false;
            });
        }
        else{
            caller.send(`❌ - Aucune arène pour un joueur ou membre connu sous la désignation “${name}” n'a été trouvée…`);
        }
    }
    
    async postArenaList(channel){
        let compArenaCont= [];
        Object.keys(this._arenaList).forEach( ack => {
            let ac= this._arenaList[ack];
            if(ac && ac.arena && ac.arena.isComplete && ac.accessMessage){
                compArenaCont.push(ac);
            }
        });

        if(compArenaCont.length<=0){
            channel.send("- *Il n'y a pas l'air officiellement d'avoir d'arène d'ouverte :(* -");
        }
        else{
            let embed= new Discord.RichEmbed()
            .setTimestamp()
            .setDescription(`Wesh, voici les arènes officiellement ouvertes par propriétaire:\n`)

            await Promise.all(compArenaCont.map( async ac => {
                let a= ac.arena;
                await this._bot.fetchUser(a.creator.id).catch(err => {console.log(`[AM list] couldn't fetch user ${a.creator.id}`);});
                let m= this._onlineChannel.guild.member(a.creator.id);

                await embed.addField(`${(m && m.nickname)?m.nickname:a.creator.username}: `, `\t${ac.accessMessage.url}`);
            }));

            channel.send(embed);
        }
    }

    getCreatedArena(user){
        let f= Object.keys(this._arenaList).find( key => { return key===user.id;} );
        if(f && this._arenaList[f]){
            return this._arenaList[f].arena;
        }
        else{
            return null;
        }
    }


    getArenaCtrlMessage(user){
        let f= Object.keys(this._arenaList).find( key => { return key===user.id;} );
        if(f && this._arenaList[f]){
            return this._arenaList[f].ctrlMessage;
        }
        else{
            return null;
        }
    }

    getArenaAccessMessage(user){
        let f= Object.keys(this._arenaList).find( key => { return key===user.id;} );
        if(f && this._arenaList[f]){
            return this._arenaList[f].accessMessage;
        }
        else{
            return null;
        }
    }

    reactionAdd(reaction,user){
        let a= this.getCreatedArena(user);
        let ctrlMsg= this.getArenaCtrlMessage(user);

        if(a && ctrlMsg){
            if(reaction.message.id===ctrlMsg.id && user.id===a.creator.id){
                if(reaction.emoji.name==='👥'){
                    a._friendsOnly= true;

                    //if(a.isComplete){
                        ctrlMsg.edit(this._arenaInfoEmbedMessage(a));

                        this._arenaList[a.creator.id].refreshNow();
                        this.saveArenas();
                    //}
                }

                if(reaction.emoji.name==='🛑'){
                    this._endArena(a);
                }
            }
        }
        else{
            let a= this._findArenaFromAccessMessage(reaction.message);

            if(a && reaction.emoji.name==='⚔' && a.creator.id!==user.id){
                this._join(user,a);
            }
        }
    }

    reactionRemove(reaction,user){
        let a= this.getCreatedArena(user);
        let ctrlMsg= this.getArenaCtrlMessage(user);

        if(a){
            if(reaction.message.id===ctrlMsg.id && user.id===a.creator.id){
                if(reaction.emoji.name==='👥'){
                    a._friendsOnly= false;

                    if(a.isComplete){
                        ctrlMsg.edit(this._arenaInfoEmbedMessage(a));
                        this.saveArenas();
                    }
                }
            }
        }
        else{
            let a= this._findArenaFromAccessMessage(reaction.message);

            if(a && reaction.emoji.name==='⚔' && a.creator.id!==user.id){
                this._leave(user, a);
            }
        }   
    }

    messageDelete(message){
        if(this._arenaList){
            Object.keys(this._arenaList).forEach(ack =>{
                let ac= this._arenaList[ack];
                if(ac.ctrlMessage && ac.ctrlMessage.id===message.id){
                    ac.ctrlMessage= null;
                    if(ac.arena && ac.arena.isComplete){
                        this._endArena(ac.arena);
                    }
                }
                else if(ac.accessMessage && ac.accessMessage.id===message.id){
                    ac.accessMessage= null;
                }
            });
        }
    }

    _arenaInfoEmbedMessage(arena){
        let fcAsk= this._bot.worker.request({name: 'friend-code', user: arena.creator});
        let hasFC= Boolean(fcAsk && fcAsk['friendCode']);

        let embed= new Discord.RichEmbed()
            .setTitle("**=== NEW ARENA ===**")
            .setAuthor(`${arena.creator.username}`,`${arena.creator.avatarURL}`)
            .setColor((arena.isComplete)?0x64f864:0x9cc1bb)
            .setTimestamp()
            .setThumbnail("https://media.discordapp.net/attachments/536855284195262516/551017392243867659/ring_ssbu_icon_kinda.png")
            .setDescription(`${arena.isComplete?"Tu peux modifier ":"⚠ **Arène incomplète!** complète "} cette arène en postant un message du type \`\`\`HX4G8 5 1234 Ama kick yo ass!\`\`\`\n`+
                "\t\te.g.: `ID` `Nb_Place` `Code_d'accès` `Description`\n"+
                "Tu peux poster la photo de ton arène ici (liens ou PJ)\n\n"+
                "Aussi, tu peux réagir à ce message en fonction.\n\n\n")
            .addField("Réaction '👥': ", "\tsi ton arène est réservée à tes amis Nintendo Switch")
            .addField("Réaction '🛑': ", "\tpour fermer cette arène.\n\n")
            .addBlankField()
            .addField("--- **Paramètres** ---")
            .addField(`*ID*: \t\t**\`${(arena.arenaID)?arena.ID:(arena.imgUrl?'voir image':' ')}\`**`,`\t*ID de l'arène (n'est pas le nom)*`)
            .addField(`*Type*: \t\t**\`${(arena.isFriendsOnly)?'Amis uniquement':"Publique"}\`**`,
                        `\t*${(arena.isFriendsOnly)?
                            `Seuls tes amis switch peuvent entrer cette arène. ${(hasFC)?"":"(ton code ami n'est pas renseigné)"}`
                            : 'Tout le monde peut joindre cette arène via recherche par son ID'}*`
                    )
            .addField(`*Code d'accès*: \t\t${(arena.accessCode)?`**\`${arena.accessCode}\`**`:(arena.imgUrl?` voir image`:`*Aucun*`)}`,
                        `\t${((!arena.accessCode)||(arena.accessCode.length<=0))? '*Accès libre.*':"*Arène verouillée à l'accès par ce code.*"}`)
            .addField(`*Capacité*: \t\t**\`\t${arena.capacity}\`**`,"\t*La capacité en nombre de personne de l'arène*")
            .addField(`*Description*:`,`\t${arena.description}`);
        if(arena.imgUrl) embed.setImage(arena.imgUrl);

        return embed;
    }

    async _generateAccessMessage(arena){
        let ac= null;
        if(arena && arena.creator && (ac=this._arenaList[arena.creator.id])){
            if(ac.accessMessage){
                let tmp= ac.accessMessage;
                ac.accessMessage= null;
                await tmp.delete().then(message =>{})
                    .catch(err => {console.log(`[AM] can't delete message ${ac.accessMessage.id}`); console.log(err);});
            }

            await this._bot.fetchUser(arena.creator.id).catch(err => {console.log(`[AM discard] couldn't fetch user ${arena.creator.id}`);});
            let member= this._onlineChannel.guild.member(arena.creator.id);

            let embed= new Discord.RichEmbed()
                .setTitle("**=== NEW ARENA! ===**")
                .setAuthor(`${(member && member.nickname)?member.nickname:arena.creator.username}`,`${arena.creator.avatarURL}`)
                .setColor(0x64f864)
                .setTimestamp()
                .setThumbnail("https://media.discordapp.net/attachments/536855284195262516/551017392243867659/ring_ssbu_icon_kinda.png")
                .setDescription(`${(member && member.nickname)?member.nickname:arena.creator.username} a ouvert une arène!\n-----\n`
                                +`« *${arena.description}* »\n`)
                .addBlankField()
                .addField("Réaction '⚔': ","\tUtilise cette réaction pour rejoindre officiellement l'arène.")
                .addBlankField();
            if(arena.imgUrl) embed.setImage(arena.imgUrl);

            await this._onlineChannel.send(embed)
                .then(message => {
                    this._arenaList[arena.creator.id].accessMessage= message;
                    message.react('⚔').catch(err => {console.log("[AM Creator] couldn't add reaction '👥' to control message…")});
                })
                .catch(err => console.log(err));
        }
    }

    async dMessage(message){
        let a= this.getCreatedArena(message.author);
        let ctrlMsg= this.getArenaCtrlMessage(message.author);

        let hasAttachments= (message.attachments && message.attachments.size > 0);

        if(a){
            let txt= message.content;

            if(hasAttachments){
                let att= message.attachments.first();
                if(att && att.height && att.width && (att.height*att.width)>0 && att.url){
                    txt+= att.url;
                }
            }

            let completedBefore= a.isComplete;

            let aInfo= this._extractArenaInfo(txt);

            if(aInfo && (aInfo.id || aInfo.imgUrl)){
                a._arenaID= aInfo.id;

                a.imgUrl= aInfo.imgUrl;

                //if(aInfo.code){
                    a._accessCode= aInfo.code;
                //}
                if(aInfo.nSlots){
                    a._availableSlots= aInfo.nSlots;
                }
                if(aInfo.description && aInfo.description.split(/\s/).join('').length>0){
                    a._description= aInfo.description;
                }

                if(ctrlMsg){
                    ctrlMsg.edit(this._arenaInfoEmbedMessage(a));

                    await this._bot.fetchUser(a.creator.id).catch(err => {console.log(`[AM joining] couldn't fetch user ${a.creator.id}`);});
                    let m= this._onlineChannel.guild.member(a.creator.id);


                    let fcAsk= this._bot.worker.request({name: 'friend-code', user: a.creator});
                    let hasFC= Boolean(fcAsk && fcAsk['friendCode']);

                    let embed= new Discord.RichEmbed()
                    .setTitle("**==== ARENA UPDATE ====**")
                    .setAuthor(`${(m && m.nickname)?m.nickname:a.creator.username}`,`${a.creator.avatarURL}`)
                    .setColor((a.isComplete)?0x64f864:0x9cc1bb)
                    .setTimestamp()
                    .setDescription(`L'arène de @${(m && m.nickname)?m.nickname:a.creator.username} a modifié son arène:`)
                    .addBlankField()
                    .addField(`*ID*: \t\t**\`${a.arenaID}\`**`,`\t*ID de l'arène (n'est pas le nom)*`)
                    .addField(`*Type*: \t\t**\`${(a.isFriendsOnly)?'Amis uniquement':"Publique"}\`**`,
                                `\t*${(a.isFriendsOnly)?
                                    `Seuls les amis de ce joueur peuvent entrer son arène${(hasFC)?`: ${fcAsk['friendCode']}`:'.'}`
                                    : 'Tout le monde peut joindre cette arène via recherche par son ID'}*`
                            )
                    .addField(`*Code d'accès*: \t\t${((!a.accessCode)||(a.accessCode.length<=0))? '*Aucun*':`**\`${a.accessCode}\`**`}`,
                                `\t${((!a.accessCode)||(a.accessCode.length<=0))? '*Accès libre.*':"*Arène verouillée à l'accès par ce code.*"}`)
                    .addField(`*Capacité*: \t\t**\`\t${a.capacity}\`**`,"\t*La capactié en nombre de personne de l'arène*")
                    .addField(`*Description*:`,`\t${a.description}`);
                    if(a.imgUrl) embed.setImage(a.imgUrl);

                    a.members.forEach(p =>{
                        if(p){
                            p.send(embed);
                        }
                    });

                    this._arenaList[message.author.id].refreshNow();
                }
                else{
                    this._iniateArenaSetting(a);
                }
                
                if(!completedBefore || !this.getArenaAccessMessage(message.author)){
                    await this._generateAccessMessage(a);
                }

                this.saveArenas();
            }
            else{
                let ctrlMsg= this._arenaList[message.author.id].ctrlMessage;

                message.author.send("⚠ Aucun ID d'arène reconnu! Tu peux réessayer ou annuler la création de ton arène en répondant `!q` "+
                `(ou en commentant 🛑 dans le message${(ctrlMsg)?` <${ctrlMsg.url}>`:''} ci-dessus)`);
            }
        }
    }

    _extractArenaInfo(txt){
        let t= txt;
        let r= {id: null, code: null, nSlots: null, description: "", imgUrl: ""};

        let aIdRx=/\b([0-9]|[A-Z]){5}\b/;
        let codeRx=/\b[0-9]{1,8}\b/;
        let nbSlotsRx=/\b[2-8]\b/;
        let imgUrlRx=/\bhttp(s)?:\/\/\S*\.(png|jpg|jpeg|gif|bmp|tiff|svg)\b/;

        let tmp= t.toLowerCase().match(imgUrlRx);
        if(tmp){
            let i= tmp['index'];
            let l= tmp[0].length;
            r.imgUrl= t.substring(i, i+l);
            t= t.slice(0,i)+t.slice(i+l);
        }

        tmp= t.toUpperCase().match(aIdRx);
        if(tmp){
            r.id= tmp[0];
            t= t.slice(0,tmp['index'])+t.slice(tmp['index']+5);
        }

        tmp= t.match(nbSlotsRx);
        if(tmp){
            r.nSlots= parseInt(tmp[0]);
            t= t.slice(0,tmp['index'])+t.slice(tmp['index']+1);
        }

        tmp= t.match(codeRx);
        if(tmp){
            r.code= tmp[0];
            t= t.slice(0,tmp['index'])+t.slice(tmp['index']+tmp[0].length);
        }
        r.description= t.split(/\s+/).join(' ');

        return r;
    }

    _arenaCall(user, args){
        let aInfo= (args)? this._extractArenaInfo(args.join(" ")) : null;

        if(this._arenaList[user.id] && this._arenaList[user.id].arena){
            if(this._arenaList[user.id].ctrlMessage){
                user.send(`Tu as déjà créé une arène dont le message de contrôl est ici: <${this._arenaList[user.id].ctrlMessage.url}>`);
            }
            else{
                if(this._arenaList[user.id].arena.isComplete){
                    user.send(this._arenaInfoEmbedMessage(this._arenaList[user.id].arena));
                }
                else{
                    let a= this._arenaList[user.id].arena;
                    if(aInfo){
                        a._arenaID= aInfo.id;
                        a.imgUrl= aInfo.imgUrl;
                        a._accessCode= aInfo.code;
                        if(aInfo.nSlots){
                            a._availableSlots= aInfo.nSlots;
                        }
                        if(aInfo.description && aInfo.description.split(/\s/).join('').length>0){
                            a._description= aInfo.description;
                        }
                    }
                    this._iniateArenaSetting(a);
                }
            }
        }
        else if(this._userArenaDict[user.id]){
            let amsg= null;
            if(amsg=this._arenaList[this._userArenaDict[user.id]].accessMessage){
                user.send(`Tu participe déjà à l'arène de ${this._userArenaDict[user.id].creator}.\n`
                        +   `Dé-réagit au message <${amsg.url}>`);
            }
            else{
                user.send(`Tu participe déjà à l'arène de ${this._userArenaDict[user.id].creator}.\n`);
                this._generateAccessMessage(this._userArenaDict[user.id]);
            }
        }
        else{
            let arena= new Arena(user);

            this._arenaList[user.id]= new ArenaContainer(arena);

            if(aInfo){
                arena._arenaID= aInfo.id;
                arena.imgUrl= aInfo.imgUrl;
                arena._accessCode= aInfo.code;
                if(aInfo.nSlots){
                    arena._availableSlots= aInfo.nSlots;
                }
                if(aInfo.description && aInfo.description.split(/\s/).join('').length>0){
                    arena._description= aInfo.description;
                }
            }
            this._iniateArenaSetting(arena);
        }
    }

    async _iniateArenaSetting(arena){
        if(!arena.creator &&  !this._arenaList[arena.creator.id]){
            console.log("[AM creator] arena not properly initiated or stored or non existent");

            return false;
        }

        let embed= this._arenaInfoEmbedMessage(arena);

        await arena.creator.send(embed)
            .then(message => {
                this._arenaList[arena.creator.id].ctrlMessage=message;
                message.react('👥').catch(err => {console.log("[AM Creator] couldn't add reaction '👥' to control message…")});
                message.react('🛑').catch(err => {console.log("[AM Creator] couldn't add reaction '🛑' to control message…")})
            })
            .catch(err => console.log(err));

        this._arenaList[arena.creator.id].refreshNow();

        if(arena.isComplete){
            this._generateAccessMessage(arena);

            this.saveArenas();
        }
    }

    async _endArena(arena){
        if(!arena.creator &&  !this._arenaList[arena.creator.id]){
            console.log("[AM discard] arena not properly initiated or stored or non existent");

            return false;
        }
        let ctrlMsg= this._arenaList[arena.creator.id].ctrlMessage;

        let accessMsg= this._arenaList[arena.creator.id].accessMessage;

        delete this._arenaList[arena.creator.id];

        await this._bot.fetchUser(arena.creator.id).catch(err => {console.log(`[AM joining] couldn't fetch user ${arena.creator.id}`);});
        let m= this._onlineChannel.guild.member(arena.creator.id);

        arena.members.forEach(p => {
            if(p){
                p.send(`- *${(m && m.nickname)?m.nickname:arena.creator.username} a officiellement fermé son arène* -`);
            }
        });

        if(ctrlMsg){
            let embed= new Discord.RichEmbed()
                .setTitle("**=== DELETED ARENA ===**")
                .setAuthor(`${(m && m.nickname)?m.nickname:arena.creator.username}`,`${arena.creator.avatarURL}`)
                .setColor(0xC80000)
                .setTimestamp()
                .setThumbnail('https://media.discordapp.net/attachments/536855284195262516/551018508666929152/ring_ssbu_icon_kinda_g.png')
                .setDescription("Ton arène a été effacée.")
            ctrlMsg.edit(embed);
        }

        if(accessMsg){

            let embed= new Discord.RichEmbed()
                .setTitle("**=== DELETED ARENA ===**")
                .setAuthor(`${(m && m.nickname)?m.nickname:arena.creator.username}`,`${arena.creator.avatarURL}`)
                .setColor(0xC80000)
                .setTimestamp()
                .setThumbnail('https://media.discordapp.net/attachments/536855284195262516/551018508666929152/ring_ssbu_icon_kinda_g.png')
                .setDescription("L'arène a été fermée!")
            accessMsg.edit(embed);
            accessMsg.clearReactions();
        }


        this.saveArenas();
    }

    _findArenaFromAccessMessage(message){
        let r= null;
        Object.keys(this._arenaList).some(k => {
            let e= this._arenaList[k];

            if(e.accessMessage && e.accessMessage.id===message.id && e.arena){
                r= e.arena;

                return true;
            }

            return false;
        });

        return r;
    }

    async _join(user, arena){
        if(arena.isComplete && this._arenaList[arena.creator.id] ){
            if(!(this._arenaList[user.id])){
                if(arena.joining(user)){
                    let a= null;
                    if((a=this._userArenaDict[user.id]) && a.creator.id!=arena.creator.id){
                        this._userArenaDict[user.id];

                        this._leave(user, a);
                    }

                    this._arenaList[arena.creator.id].refreshNow();
                    this._userArenaDict[user.id]= arena;
                }

                this.saveArenas()

                await this._bot.fetchUser(arena.creator.id).catch(err => {console.log(`[AM joining] couldn't fetch user ${arena.creator.id}`);});
                let m= this._onlineChannel.guild.member(arena.creator.id);

                let embed= new Discord.RichEmbed.setTitle("**==== ARENA JOIN ====**")
                .setAuthor(`${(m && m.nickname)?m.nickname:arena.creator.username}`,`${arena.creator.avatarURL}`)
                .setTimestamp()
                .setDescription(`L'arène de @${(m && m.nickname)?m.nickname:arena.creator.username} a les paramètres suivants:`)
                .addBlankField()
                .addField(`*ID*: \t\t**\`${(arena.arenaID)?arena.ID:(arena.imgUrl?'voir image':' ')}\`**`,`\t*ID de l'arène (n'est pas le nom)*`)
                .addField(`*Type*: \t\t**\`${(arena.isFriendsOnly)?'Amis uniquement':"Publique"}\`**`,
                            `\t*${(arena.isFriendsOnly)?
                                'Seuls les amis de ce joueur peuvent entrer son arène.'
                                : 'Tout le monde peut joindre cette arène via recherche par son ID'}*`
                        )
                .addField(`*Code d'accès*: \t\t${(arena.accessCode)?`**\`${arena.accessCode}\`**`:(arena.imgUrl?` voir image`:`*Aucun*`)}`,
                            `\t${((!arena.accessCode)||(arena.accessCode.length<=0))? '*Accès libre.*':"*Arène verouillée à l'accès par ce code.*"}`)
                .addField(`*Capacité*: \t\t**\`\t${arena.capacity}\`**`,"\t*La capactié en nombre de personne de l'arène*")
                .addField(`*Description*:`,`\t${arena.description}`);
                if(arena.imgUrl) embed.setImage(arena.imgUrl);
                
                user.send(embed);
                
                await this._bot.fetchUser(user.id).catch(err => {console.log(`[AM joining info] couldn't fetch user ${user.id}`);});
                m= this._onlineChannel.guild.member(user.id);
                arena.creator.send(`- *${(m && m.nickname)?m.nickname:arena.creator.username} veut de joindre à votre arène* -`);
        
            }
            else{
                if(this._arenaList[user.id].arena){
                    this._endArena(this._arenaList[user.id].arena);
                }
                else{
                    delete this._arenaList[user.id];
                }
                    
                this._join(user, arena);
            }
        }
    }

    async _leave(user,arena){
        if(arena.isComplete){
            if(arena.creator.id!==user.id){
                arena.leaving(user);
                delete this._userArenaDict[user.id];

                this.saveArenas();

                await this._bot.fetchUser(arena.creator.id).catch(err => {console.log(`[AM joining] couldn't fetch user ${arena.creator.id}`);});
                let m= this._onlineChannel.guild.member(arena.creator.id);
                
                user.send(`==== ARENA LEAVE ===\nTu as officiellement quitté l'arène de @${(m && m.nickname)?m.nickname:arena.creator.username}!`);
                
                await this._bot.fetchUser(user.id).catch(err => {console.log(`[AM joining info] couldn't fetch user ${user.id}`);});
                m= this._onlineChannel.guild.member(user.id);
                arena.creator.send(`- *${(m && m.nickname)?m.nickname:arena.creator.username} a officiellement quitté votre arène* -`);
            }
            else{
                this._endArena(arena);
            }
        }
    }

    _checkArenaMemberShip(user){
        let isCrea= Boolean(this._arenaList[user.id]);
        let isAMember= Boolean(this._userArenaDict[user.id]);

        if(isCrea && isAMember){
            delete this._userArenaDict[user.id];
        }

        Object.keys(this._arenaList).forEach( k => {
            let ac= this._arenaList[k];
            if(ac && ac.arena){
                if(!isCrea && ac.arena.creator.id===user.id){
                    this._endArena(ac.arena);
                }
                else{
                    if( ac.arena.hasMember(user) && ((!isAMember) || (this._userArenaDict[user.id].creator.id!==ac.arena.creator.id) || (!ac.arena.isComplete)) ){
                        this._leave(user, ac.arena);
                    }
                    else if((!ac.arena.hasMember(user)) && (this._userArenaDict[user.id].creator.id===ac.arena.creator.id)){
                        if(ac.arena.isComplete && !isCrea){
                            this._join(user, ac.arena);
                        }
                        else{
                            delete this._userArenaDict[user.id];
                        }
                    }
                }
            }
            else{
                delete this._arenaList[k];
            }
        });

    }

    async _fcUpdate(user, fc){
        let ac= null;
        let a= null;
        if((ac=this._arenaList[user.id]) && (a= this._arenaList[user.id].arena) && a.isComplete){
            if(ac.ctrlMessage){
                ac.ctrlMessage.edit(this._arenaInfoEmbedMessage(a));
            }


            await this._bot.fetchUser(a.creator.id).catch(err => {console.log(`[AM fcUpdate] couldn't fetch user ${a.creator.id}`);});
            let m= this._onlineChannel.guild.member(a.creator.id);

            a.members.forEach(p =>{
                if(p){
                    p.send(`- *${(m && m.nickname)?m.nickname:arena.creator.username} a ajouté/modifié son code ami: \`${fc}\`* -`);
                }
            });
        }
    }

    async _fcDelete(user){
        let ac= null;
        let a= null;
        if((ac=this._arenaList[user.id]) && (a= this._arenaList[user.id].arena) && a.isComplete){
            if(ac.ctrlMessage){
                ac.ctrlMessage.edit(this._arenaInfoEmbedMessage(a));
            }
        }
    }
}

module.exports.ArenaManager= ArenaManager;