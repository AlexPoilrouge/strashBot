const fs = require('fs');
const path= require('path');

class FriendCodeManager{
    constructor(bot, guild){
        this.bot= bot;
        this.guild= guild;
        
        this.fcJSONFile= path.resolve(__dirname, "data/fc.json");
        this.fcList= {};
    }

    loadFriendCodes(){
        let data= fs.readFileSync(this.fcJSONFile);
        if(data){
            this.fcList= JSON.parse(data);
        }
        else{
            console.log(`[FC loading] Error reading data from '${this.fcJSONFile}'!`)
        }
    }

    saveFriendCodesAsync(){
        let data= JSON.stringify(this.fcList, null, 2);

        fs.writeFile(this.fcJSONFile, data, err => {
            if(err){
                console.log(`[FC Saving] Couldn't write in file '${this.fcJSONFile}'…` );
                console.log(err);
            }
        });
    }

    addFriendCode(user, fc){
        if(user && user.id){
            let rfc= this._matchFCSyntax(fc);
            if(rfc){
                let r= (this.fcList[user.id])?1:2;

                this.fcList[user.id]= rfc;

                console.log(`[FCManager] Adding friend code '${fc}'`);

                return r;
            }
            else{
                console.log(`[FCManager] Couldn't add friend code '${fc}': invalid format`);

                return null;
            }
        }
    }

    getFriendCode(user){
        if(user && user.id){
            console.log(`[FCManager] Fetching a code for user '${user.id}'`);

            return this.fcList[user.id];
        }
        else return undefined;
    }

    command(args, user, channel){
        console.log(`[FCM cmd] ${args}`);
        if(args.length>0) {
            let a0= args[0];
            let test= this._matchFCSyntax(a0);

            let b= false;

            if(test){
                let r= this.addFriendCode(user, test);

                if(r===2){
                    user.send("Code ami ajouté!");
                    b=true;
                }
                else if(r===1){
                    user.send("Code ami mis à jour!");
                    b=true;
                }
                else{
                    channel.send("Error :(");
                }
            }
            else if( !( a0.startsWith('!') && this._subCommand(a0, args.slice(1),user) ) ){
                let rest= args.join(' ');
                if(!this._adminAdd(rest, user)){
                    this.lookingFCFor(rest, user);
                }
                else{
                    b= true;
                }
            }

            if(b){
                this.bot.worker.request({name:'friend-code-update', user: user, friendCode: test});

                this.saveFriendCodesAsync();
            }
        }
        else{
            let fc= this.getFriendCode(user);
            if(fc){
                channel.send(`${fc}`);
            }
            else{
                channel.send("Code ami pas encore enregistré…");
            }
        }
    }

    async lookingFCFor(name, user){
        let idRx=/^[0-9]{18}$/;
        let mentionRx=/^<@!?[0-9]{18}>$/;

        let lookUpID= (id, str1, str2=null) => {
            let fc= this.fcList[id];
            if(fc){
                console.log(`[FC looking] found FC for ${id}`);

                user.send(`Code ami de *${str1}${(str2)?` (${str2})`:""}*: **${fc}**`);
            }
            else{
                console.log(`[FC looking] not found FC for ${id}`);

                user.send(`Aucun code ami trouvé pour ${str1}${(str2)?` (${str2})`:""}…\n\t(Ce dernier n'a peut-être pas enregistré son code ami…)`);
            }
        };

        if(name.match(idRx) || name.match(mentionRx)){
            let v= (name.match(mentionRx))?name.match(/[0-9]{18}/)[0]:name;        
            
            lookUpID(v, name);
        }
        else{
            await Promise.all(Object.keys(this.fcList).map(async key =>{
                await this.bot.fetchUser(key).then(u => {
                    console.log(`fetch user for key ${key}`)
                })
                .catch(err => {
                    console.log(`[FC look] Couldn't fetch user from ${key}`);
                });
            }));

            let tn= (name.startsWith('@')?name.slice(1):name);

            let members= [];
            this.guild.members.forEach(m =>{
                if (m.nickname && (m.nickname.toLowerCase()===tn.toLowerCase())){
                    members.push(m);
                }
            })
            let users= [];
            this.bot.users.forEach(u => {
                if(u.username.toLowerCase()===tn.toLowerCase() || u.tag===tn){
                    users.push(u);
                }
            });

            members.forEach(m => {
                let mid= m.user.id;
                
                let i= 0;
                while(i<users.length){
                    if(users[i].id===mid){
                        users.splice(i,1);
                    }
                    else{
                        ++i;
                    }
                }
            })

            let lu= users.length;
            let lm= members.length;

            if((lm+lu)>0){
                if((lm+lu)>1){
                    user.send("Plusieurs codes ami trouvés pour cette recherche…")
                }

                if(lm>0){
                    members.forEach(m => {
                        lookUpID(m.user.id, tn, m.user.username);
                    });
                }

                if(lu>0){
                    users.forEach(u => {
                        lookUpID(u.id, tn, null);
                    });
                }
            }
            else{
                user.send(`Aucun code ami trouvé pour ${tn}…\n\t(Ce dernier n'a peut-être pas enregistré son code ami…)`);
            }
        }
    }

    deleteFriendCode(user, id=undefined){
        let delID= (uid) => {
            if(delete this.fcList[uid]){
                console.log(`[FC delete] ${uid}'s FC deleted.`)
                if(this.guild.member(user)){
                    user.send(`Code ami ${(uid!==user.id)?`( <@${uid}> ) `:''}supprimé.`);                    
                }
                else{
                    console.log(`[FC delete] L'user ${uid} n'est pas/plus membre du serveur…`)
                }

                this.saveFriendCodesAsync();
            }
            else{
                console.log(`[FC delete] Deletion of ${uid}'s FC error`);
                user.send(`Erreur lors de la suppression ${(uid!==user.id)?`( <@${uid}> ) `:''}:/`);
            }
        }
        
        if(user.id===this._adminID && id && id.match(/^[0-9]{18}$/)){
            delID(id);

            return;
        }

        let t= this.fcList[user.id];

        if(t){
            delID(user.id);
        }
        else{
            user.send("Tu n'as pas enregistré de code ami, il n'y a donc rien à supprimer…")
        }
    }

    checkMembers(){
        Object.keys(this.fcList).forEach( key => {
            this.bot.fetchUser(key).then( user => {
                if(!this.guild.member(user)){
                    console.log(`[FC check] couldn't find FC list's user ${key} as a guild member…`);

                    this.deleteFriendCode(user);
                }
            })
            .catch(err => {
                if(err.code===10013){
                    console.log(`[FC check] User ${key} not existing? Deleting!`);
                    delete this.fcList[key];

                    this.saveFriendCodesAsync();
                }
                else{
                    console.log(`Couldn't fetch user ${key}`);
                    console.log(err);
                }
            });
        });
    }

    _adminAdd(name, user){
        if(user.id===this._adminID){
            let rx=/[0-9]{18}\s+SW(\-[0-9]{4}){3}$/
            if(name.match(rx)){
                let args= name.split(/\s+/);

                let fc= this.fcList[args[0]];
                this.fcList[args[0]]=args[1];
                if(fc){
                    user.send(`[FC adminAdd] ${args[0]}'s FC updated`);
                }
                else{
                    user.send(`[FC adminAdd] ${args[0]}'s FC added`);
                }

                return true;
            }
        }
        return false;
    }

    _adminList(user){
        if(user.id===this._adminID){
            let txt= "";
            Object.keys(this.fcList).forEach(key =>{
                let tmp=`<@${key}> : ${this.fcList[key]}\n`;

                if((txt.length+tmp.length)>2000){
                    user.send(txt);

                    txt= tmp;
                }
                else if(tmp.length>2000){
                    console.log("[FC adminList] line too long wtf?!");
                }
                else{
                    txt+= tmp;
                }
            });

            user.send(txt);
        }
    }

    _subCommand(cmd, args, user){
        console.log(`[FC subCmd] !codeamdi !${cmd}`);
        let coreCmd= cmd.substr(1);

        if (coreCmd==="delete" || coreCmd==="d"){
            this.deleteFriendCode(user, args[0]);

            this.bot.worker.request({name: 'friend-code-delete', user: user});

            return true;
        }
        else if(coreCmd==="help" || coreCmd==="h"){
            let txt= "Les modalités d'utilisation de la commande `!codeami` sont les suivantes: \n\n";

            txt+="\t`!codeami`\n\t\t*Affiche ton code ami sur le salon courant.*\n";
            txt+="\t`!codeami SW-XXXX-XXXX-XXXX`\n\t\t*(avec X des chiffres, of course) Ajoute ou met à jour ton code ami.*\n";
            txt+="\t`!codeami [@]<username|pseudo>`\n\t\t*Cherche le code ami de la personne désignée (@ optionnel pour éviter la mention).*\n";
            if(user.id===this._adminID){
                txt+="\t`!codeami XXXXXXXXXXXXXXXXXX SW-XXXX-XXXX-XXXX`\n\t\t**ADMIN** - *Ajoute code ami pour un user ID*\n";
            }

            txt+="\t`!codeami !delete|!d`\n\t\t*Efface ton code ami.*\n";
            if(user.id===this._adminID){
                txt+="\t`!codeami !delete XXXXXXXXXXXXXXXXXX`\n\t\t**ADMIN** - *Efface code ami pour un user ID*\n";
                txt+="\t`!codeami !list|!l`\n\t\t**ADMIN** - *Liste les codes ami enregistrés*\n";
            }
            txt+="\t`!codeami !help|!h`\n\t\t*Affiche cette aide.*\n\n";

            txt+="NB: Le code ami d'un membre est effacé si celui-ci est kické ou quitte le serveur."

            user.send(txt);

            return true;
        }
        else if(user.id===this._adminID && (coreCmd==="list" || coreCmd==="l")){
            this._adminList(user);

            return true;
        }

        return false;
    }


    _matchFCSyntax(fc){
        let ufc= fc.toUpperCase();
        let rx=/^SW(\-[0-9]{4}){3}$/;

        if(ufc.match(rx)) return fc;
        else{
            ufc= ufc.split('-').join('');
            if(ufc.startsWith("SW")){
                ufc=ufc.substr(2);
            }
            
            rx=/^[0-9]{12}$/;

            if(ufc.match(rx)){
                console.log(`[FC matchSyntax] ${fc} to ${ufc}`);

                return `SW-${ufc.substring(0,4)}-${ufc.substring(4,8)}-${ufc.substring(8,12)}`;
            }
            else{
                return null;
            }
        }
    }



    set adminID(id){
        this._adminID= id;
    }
};

module.exports.FriendCodeManager= FriendCodeManager;