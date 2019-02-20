

class OnlineGroupManager{
    constructor(client, botChannel, onlineRole, refMsg, reactEmote){
        this._client= client;
        this._botChannel= botChannel;
        this._onlineRole= onlineRole;
        this._refMsg= refMsg;
        this._reactEmote= reactEmote;
    }

    ready(){
        this._checkReactions();
        this._checkOnlineRole();

        this._setRefMessage();
    }

    reactionAdd(reaction,user){
        if(reaction.message.id===this._refMsg.id && reaction.emoji.id===this._reactEmote.id){
            console.log(`[OGM reac Monitor] Reaction emoji ${reaction.emoji.id} added to msg ${reaction.message.id}`);
            
            this._addOnlineRoleTo(user);
        }
    }

    reactionRemove(reaction,user){
        if(reaction.message.id===this._refMsg.id && reaction.emoji.id===this._reactEmote.id){
            console.log(`[OGM reac Monitor] Reaction emoji ${reaction.emoji.id} removed from msg ${reaction.message.id}`);

            this._removeOnlineRoleFrom(user);
        }
    }

    kijouRequestFrom(user){
        let onlineUsers= this._getOnlineRoleUsers();

        if(onlineUsers.length===0){
            user.send("Il semble qu'il n'y ait personne pour jouer en ligne… Même pas toi!!! Marque-toi comme disponible en réagissant au message <"+this._refMsg.url+"> !");
        }
        else if(onlineUsers.length===1 && onlineUsers[0].id===user.id){
            user.send("À part toi, il semble qu'il n'y ait personne dispo pour jouer en ligne 😢");
        }
        else{
            let reply="Les joueurs qui sont *marqués* comme étant dipsonible pour du online sont:\n"

            if(!onlineUsers.includes(user)){
                reply+="( tu n'es pas marqué comme étant en ligne, pour y remédier réagit au message <"+this._refMsg.url+"> )\n";
            }

            while( onlineUsers.length>0 ){
                let c= reply.length;

                let u= onlineUsers[onlineUsers.length-1];
                let name= "";

                let m= this._botChannel.guild.member(u);
                if(m!==null && m.nickname!==null){
                    name= "\t" + m.nickname + " ( <@" + u.id + "> )";
                }
                else{
                    name= "\t<@" + u.id + ">";
                }

                if((name.length+c+4)<2000){
                    onlineUsers.pop();
                    reply+=name+"\n";
                }
                else{
                    user.send(reply);
                    reply= "";
                }
            }

            user.send(reply);
        }
    }

    _addOnlineRoleTo(user){
        if(user.id!==this._client.user.id){
            let member= this._botChannel.guild.member(user);
            if(member!=null && !(member.roles.has(this._onlineRole))){
                member.addRole(this._onlineRole).then(member => {
                    console.log(`[OGM] adding role ${this._onlineRole.id} to ${user.id}`);
                })
                .catch(err => {
                    console.log("[OGM] Couldn't add role "+this._onlineRole.name);
                    console.log(err);
                });
            }
        }
    }

    _removeOnlineRoleFrom(user){
        if(user.id!==this._client.user.id){
            let member= this._botChannel.guild.member(user);
            if(member!=null && !(member.roles.has(this._onlineRole))){;
                member.removeRole(this._onlineRole).then(member => {
                    console.log(`[OGM] Removing role ${this._onlineRole.id} from ${user.id}`);
                })
                .catch(err => {
                    console.log("[OGM !] Couldn't remove role "+this._onlineRole.name);
                    console.log(err);
                });
            }
        }
    }

    __fetchEachUserFromReactionMessage(thenFn, finallyFn=null){
        this._refMsg.reactions.tap( reaction =>{
            if(reaction.emoji.id === this._reactEmote.id){
                reaction.fetchUsers().then( users => { users.tap( user => {
                    thenFn(user);
                });})
                .catch( err => {
                    console.log("[OGM reac get] Couldn't fetch users for reaction "+reaction.emoji.name+" on message "+this._refMsg.id);
                    console.log(err);
                })
                .finally(() => {
                    if (finallyFn!==null) finallyFn();
                });
            }
        });
    }

    _checkReactions(){
        console.log("[OGM check] Ensuring every reactions corresponds to online role ownership")
        this.__fetchEachUserFromReactionMessage(user => {
            this._addOnlineRoleTo(user);
        });
    }

    _getOnlineRoleUsers(){
        return this._botChannel.guild.members.filter(member => { 
            return member.roles.find(r => r.id===this._onlineRole.id);
        }).map(member => {
            return member.user;
        });
    }

    _checkOnlineRole(){
        console.log("[OGM check] Ensuring every online role ownership corresponds to reaction")
        let usersWithRole = this._getOnlineRoleUsers();
        
        let membersReactUID= [];
        this.__fetchEachUserFromReactionMessage(user => {

            membersReactUID.push(user.id);
        }, () => {
            usersWithRole.forEach(user => {
                if(! membersReactUID.includes(user.id)){
                    this._removeOnlineRoleFrom(user);
                }
            })
        });
                
    }

    _setRefMessage(){
        this._refMsg.react(this._reactEmote).then( msgReaction => {;} )
            .catch(err => {
                console.log("[OGM refMessage!] failed to react "+this._reactEmote.name+" on message "+this._refMsg.id);
                console.log(err);
            });
    }
    
}

module.exports.OnlineGroupManager= OnlineGroupManager;