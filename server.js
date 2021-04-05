var express = require("express");
var app = express();
var path = require('path');
var EventEmitter = require('events');
var favicon = require('serve-favicon');
var expressWs = require("express-ws");
expressWs(app);

var port = process.env.PORT || 8080;

// Initialize the events emitter
const events = new EventEmitter();

//app.use("/favicon.ico", express.static(__dirname + "/img/coeur.svg"));
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

// Serve the public directory
app.use(express.static("public/"));

app.engine('html', require('ejs').renderFile); 

app.set('views', path.join(__dirname, 'public'));

// Serve the src directory
app.use("/src", express.static("src"));

app.listen(port, function() {});

// Web socket part
app.ws("/:userid", (ws, req) => {

	// TODO : verifier que le jeu n'est pas complet et encore en etat init
	// l'envoi ici de tout l'état du jeu et du chat se fait égalemnent
	// lors de reconnexion
	ws.send(JSON.stringify(game.gameStateByUser(req.params.userid)));
	ws.send(JSON.stringify(game.getMessages()));

	ws.on("message", (message) => {
		var data = JSON.parse(message);
		if(data.action == "play") {
			game.playCard(req.params.userid, data.cardid);
		} else if(data.action == "choose-atout") {
			if(game.getUserById(req.params.userid).isnextAtout) {
				console.log("Atout : " + data.atout);
				game.atoutColor = data.atout;
			}
		} else if(data.action == "message") {
			game.addMessage(req.params.userid, data.message);
		}
	});
	
	let listener = event => {
		if (ws.readyState === 1) {
			if(event == 1) { // send game state
				ws.send(JSON.stringify(game.gameStateByUser(req.params.userid)));
			} else if(event == 2) { // send new msg in chat
				ws.send(JSON.stringify(game.getMessages()));
			}
		}
	};
	
	events.on("event", listener);
  
	ws.on("close", () => {
		events.removeListener("event", listener);
	});
});

app.get("/cookie", (req, res) => {
	var cookie = req.headers.cookie;
	if(cookie) {
		var userid = cookie.split("=")[1];
		if(Number.isInteger(parseInt(userid, 10))) {
			res.redirect("/" + userid);
		}
	} else {
		res.send("PARTIE INDISPONIBLE");
	}
});

app.get("/:userid", (req, res) => {
	res.cookie("userid", req.params.userid);
	res.render("game.html", {userid: req.params.userid});
});

class Game {

	// color : [0, 1, 2, 3] -> coeur, carreau, trefle, pique
	constructor() {
		this.players = [];
		this.nbPlayers = 0;
		this.atoutColor = -1;
		this.state = "init";
		this.curPlayer = -1;
		this.numTurn = 0;
		this.round = 0;
		this.turnColor = -1;
		this.endTurn = false;
		this.teams = [{nbCards: 0, nbPoints: 0},{nbCards: 0, nbPoints: 0}];
		this.endSet = false;
		this.numSet = 0;
		this.messages = []; // chat
	}

	addPlayer(player) {
		this.players.push(player);
		this.nbPlayers++;
	}

	addMessage(userid, msg) {
		let player = this.getUserById(userid);
		this.messages.push({username: player.username, teamid: player.teamid, msg: msg});

		events.emit('event', 2);
	}

	getMessages() {
		let response = {
			type: "message",
			messages: this.messages
		}
		return response;
	}

	init() {
		if(this.nbPlayers == 4) {
			var allCards = [];
			for(var i = 1; i <= 36; ++i) {
				allCards.push(i);
			}
			var playerIndex = 0;
			for(let player of this.players) {
				var deck = [];
				for(var i = 0; i < 9; ++i) {
					var rdm = Math.floor(Math.random() * allCards.length); 
					deck.push(allCards[rdm]);
					allCards.splice(rdm, 1);
				}
				player.cards = deck;

				// Look for the 7 of diamond for the very first turn
				if(this.state == "init") {
					if(deck.includes(11)) {
						player.isnext = true;
						player.isnextAtout = true;
						this.curPlayer = playerIndex;
					}
				} else {
					console.log("state reset---------------------------")
					player.lastcard = -1;
					player.isTurnWinner = false;
					player.isnext = false;
					if(player.isnextAtout) {
						console.log("anciennement : " + player.username)
						console.log("maintenant : " + this.players[(playerIndex + 3) % 4].username)
						this.players[(playerIndex + 3) % 4].isnextAtout = true;
						this.players[(playerIndex + 3) % 4].isnext = true;
						this.curPlayer = playerIndex - 1;
						player.isnextAtout = false;
					}
				}
				playerIndex++;
			}
		} else {
			console.log("Waiting for all players...");
		}
	}

	getUserById(userid) {
		for(let player of this.players) {
			if(player.id == userid)
				return player;
		}
		console.log("This player doesn't exist");
	}

	playCard(userid, cardid) {
		//if(this.state == "playing") {
			var player = this.getUserById(userid);
			if(player.isnext) {

				this.state = "playing";

				player.cards = player.cards.filter(c => c != cardid);
				player.lastcard = cardid;
				player.isnext = false;
				this.curPlayer--;
				if(this.curPlayer < 0)
					this.curPlayer = this.players.length - 1;
				this.players[this.curPlayer].isnext = true;

				if(this.round == 0) {
					this.turnColor = Math.floor((cardid - 1) / 9);
					this.endTurn = false;
					for(let p of this.players) {
						p.isTurnWinner = false;
						if(p != player) {
							p.lastcard = -1;
						}
					}
				}

				if(this.round == 3) { 

					// compute score
					var effectiveScore = 0;
					var bestCard = -1; var bestScore = 0; var turnWinner = null;
					var turnWinnerIndex = 0; var i = 0;
					for(let player of this.players) {
						
						var card = (player.lastcard - 1);
						effectiveScore += this.score(card % 9, Math.floor(card / 9) == this.atoutColor);
						console.log("eff score : " + effectiveScore);
						var curScore = 0;
						// check first if it is an atout
						if(Math.floor(card / 9) == this.atoutColor) {
							curScore = card % 9 + (2 * 9) + this.majoration(card % 9);
						}
						// then check if it is turn color
						else if(Math.floor(card / 9) == this.turnColor) {
							curScore = card % 9 + 9;
						} else {
							curScore = card % 9;
						}
						if(curScore > bestScore) {
							bestScore = curScore;
							bestCard = card + 1;
							turnWinner = player;
							turnWinnerIndex = i;
						}
						console.log("card : " + valueToCardname(card + 1));
						player.isnext = false;
						//player.isnextAtout = false;
						i++;
					}

					turnWinner.isnext = true;
					this.turnColor = -1;
					this.endTurn = true;
					this.curPlayer = turnWinnerIndex;
					turnWinner.isTurnWinner = true; // TODO : enlever isturnwinner et utiliser endSet == true dans le client pour factoriser
					console.log("Carte gagnante : " + valueToCardname(bestCard));
					this.teams[turnWinner.teamid].nbCards += 4;
					this.teams[turnWinner.teamid].nbPoints += effectiveScore + (this.numTurn == 8 ? 5 : 0);
					this.endSet = this.numTurn == 8;
					this.numTurn = (this.numTurn + 1) % 9;

					if(this.endSet) {
						setTimeout(() => {
							this.state = "reset";
							this.endSet = false;
							this.teams[0].nbCards = this.teams[1].nbCards = 0;
							this.init();
							events.emit("event", 1);
						}, 4000);
					}
				}

				this.round = (this.round + 1) % 4;
			}
		//} else {
			//console.log("Waiting for game to start...");
		//}
		events.emit('event', 1);
	}

	score(cardIndex, isAtout) {
		switch(cardIndex) {
			case 3 : return isAtout ? 14 : 0; break;
			case 4 : return 10; break;
			case 5 : return isAtout ? 20 : 2; break;
			case 6 : return 3; break;
			case 7 : return 4; break;
			case 8 : return 11; break;
			default: return 0; break;
		}
	}

	// majoration nell and bour atout
	majoration(cardIndex) {
		if(cardIndex == 3)
			return 6;
		if(cardIndex == 5)
			return 5;
		return 0;
	}

	gameStateByUser(userId) {

		var response = {};
		response.type = "game";
		response.players = {};
		response.state = this.state;
		response.teams = this.teams;
		response.turnColor = this.turnColor;
		response.atoutColor = this.atoutColor;
		response.endTurn = this.endTurn;
		response.endSet = this.endSet;
		response.numSet = this.numSet;
	
		for(let i = 0; i < 4; ++i) {
			if(this.players[i].id == userId) {
				for(let j = 0; j < 4; ++j) {
					if(j == 0)
						response.players.down = this.players[i];
					else if(j == 1)
						response.players.left = this.players[(i + 1) % 4].hideCards();
					else if(j == 2)
						response.players.up = this.players[(i + 2) % 4].hideCards();
					else 
						response.players.right = this.players[(i + 3) % 4].hideCards();
					
				}
			}
		}
		return response;
	}
}

class Player {
	constructor(id, username, teamid) {
		this.id = id;
		this.username = username;
		this.teamid = teamid;
		this.cards = [];
		this.lastcard = -1;
		this.isnext = false;
		this.isnextAtout = false;
		this.isTurnWinner = false;
	}

	hideCards() {
		// return a copy of the player with hiudden cards
		let p = Object.assign({}, this);
		p.cards = p.cards.map(c => c = 37);
		return p;
	}
}

function valueToCardname(val) {
    let str = "";
    switch(val % 9) {
        case 1:
            str += "six"; break;
        case 2:
            str += "sept"; break;
        case 3:
            str += "huit"; break;
        case 4:
            str += "neuf"; break;
        case 5:
            str += "dix"; break;
        case 6:
            str += "valet"; break;
        case 7:
            str += "dame"; break;
        case 8:
            str += "roi"; break;
        case 0:
            str += "as"; break; 
    }
    str += " de " + valueToColor(val);
    return str;
}

function valueToColor(val) {
    var str = "";
    switch(Math.floor((val - 1) / 9)) {
        case 0:
            str += "coeur"; break;
        case 1:
            str += "carreau"; break;
        case 2:
            str += "trefle"; break;
        case 3:
            str += "pique"; break;
    }
    return str;
}

let game = new Game();
game.addPlayer(new Player(0, "Simon", 0));
game.addPlayer(new Player(1, "Pierre", 1));
game.addPlayer(new Player(2, "Paul", 0));
game.addPlayer(new Player(3, "Jean-Daniel", 1));
game.init();