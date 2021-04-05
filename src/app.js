
var socket = new WebSocket("ws://" + window.location.href.substring(5)); // change wss:// to wss with heroku host
var reload = true;
socket.onmessage = function(message) {
    
    var data = JSON.parse(message.data);

    console.log(data);

    if(data.type == "game") {

        if(data.state == "init" || data.state == "reset" || reload) {

            deck = []; cards = [];
            var ownCards = data.players.down.cards;
            for(let cardid of ownCards)
                deck.push(cardid);

            initBoard();

            if(data.players.down.teamid == 1) {
                $("#leftboard").css("background-color", "#ffa366");
                $("#upboard").css("background-color", "#66c2ff");
                $("#rightboard").css("background-color", "#ffa366");
                $("#downboard").css("background-color", "#66c2ff");

                $("#lpseudo").css("color", "#ffdec7");
                $("#upseudo").css("color", "#b8e2ff");
                $("#rpseudo").css("color", "#ffdec7");
                $("#dpseudo").css("color", "#b8e2ff");

                $("#shadowcard").css("background-color", "#29a9ff");
            }

            if(reload) {
                curAtout = data.atoutColor; // TODO : utiliser uniquement la variable atoutColor
                reload = false;
            }
        }

        updateOtherBoards(data);

    } else if(data.type == "message") {
        let ccnt = document.getElementById("chatcontent");
        ccnt.innerHTML = "";
        for(let msg of data.messages) {
            ccnt.innerHTML += formattedMsg(msg.username, msg.teamid, msg.msg);
        }
        ccnt.scrollTop = ccnt.scrollHeight;
    }
};

function linkify(text) {
    var urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(urlRegex, function(url) {
        return '<a class=\"link\" href="' + url + '">' + url + '</a>';
    });
}

function formattedMsg(username, teamid, msg) {
    let style = teamid == 0 ? "--c: #ff8b3d" : "--c: #66c2ff";
    let ret = username == null ? "" : "<b style=\"" + style + "\">" + username + " : </b>";
    ret += "<a> " + linkify(msg) + "</a><br>";
    return ret;
}

/*********************************************************************************************/

Array.prototype.swap = function (x, y) {
    var b = this[x];
    this[x] = this[y];
    this[y] = b;
    return this;
}

var myturn = false;
var myturnAtout = false;
var turnColor = -1;
var atoutColor = -1;
var curAtout = -1;
var redScore = 0;
var blueScore = 0;

var cardDragEvent = {
    mousedown: false,
    capturedX: 0,
    capturedY: 0,
    target: null,
    index: 0,
    cursorOnMid: false,
    raf: null
};

var cardArgs = {
    w: 80, h: 120, spacing: 5
};

var curAnnonce = {

    suites: {
        colour: -1,
        highestCard: -1,
        majoration: -1
    },

    carres: {
        value: -1
    },

    reset: function() {
        this.suites.colour = 
        this.suites.highestCard = 
        this.suites.majoration = 
        this.carres.value = -1;
    }
}

function showAnnoncesPopup() {
    $("#annonces").css("display", "block");
    $("#controls").attr("disabled", true);   
    $("#controls").fadeTo("fast", 0.5);              
}

function hideAnnoncesPopup() {
    $("#annonces").css("display", "none");
    $("#controls").attr("disabled", false); 
    $("#controls").fadeTo("fast", 1);                     

    focusBtn("suitestype", -1);
    focusBtn("suitesvalue", -1);
    focusBtn("suitescouleur", -1);
    focusBtn("carres", -1);

    curAnnonce.reset();
    document.getElementById("errorLbl").innerHTML = "";
}

function showScores(redScore, blueScore) {
    $("#scores").css("display", "block");
    $("#controls").attr("disabled", true); 
    $("#redScore")[0].innerHTML = "+" + (redScore - parseInt($("#redScore")[0].innerHTML));
    $("#blueScore")[0].innerHTML = "+" + (blueScore - parseInt($("#blueScore")[0].innerHTML));  
    $("#controls").fadeTo("fast", 0.2);   
    setTimeout(() => {
        hideScores();
    }, 4000);
}

function hideScores() {
    $("#scores").css("display", "none");
    $("#controls").attr("disabled", false); 
    $("#controls").fadeTo("fast", 1);
}

function showAtoutsPopup() {

    focusBtn("atoutcouleurs", -1);
    curAtout = -1;

    $("#atouts").css("display", "block");
    $("#controls").attr("disabled", true);   
    $("#controls").fadeTo("fast", 0.5);              
}

function hideAtoutsPopup() {
    $("#atouts").css("display", "none");
    $("#controls").attr("disabled", false); 
    $("#controls").fadeTo("fast", 1);                     

    document.getElementById("errorLbl3").innerHTML = "";
}

function annoncesError(error) {
    document.getElementById("errorLbl").innerHTML = error;
    setTimeout(function(){document.getElementById("errorLbl").innerHTML = "";}, 2000);
}

function playError(error) {
    document.getElementById("errorLbl2").innerHTML = error;
    setTimeout(function(){document.getElementById("errorLbl2").innerHTML = "";}, 2000);
}

function atoutError(error) {
    document.getElementById("errorLbl3").innerHTML = error;
    setTimeout(function(){document.getElementById("errorLbl3").innerHTML = "";}, 2000);
}

var deck = [];
var cards = [];

function createCard(cardId, w, h, format, cardClass, imgid) {
    var card = document.createElement("img");
    card.setAttribute("width", w);
    card.setAttribute("height", h);
    card.setAttribute("src", "./img/card" + cardId + format);
    card.setAttribute("class", cardClass);
    card.setAttribute("cardId", cardId);
    card.setAttribute("id", imgid);

    return card;
}

async function updateOtherBoards(data) {

    var left = data.players.left, up = data.players.up, right = data.players.right, down = data.players.down;

    myturn = down.isnext;
    myturnAtout = down.isnextAtout;
    turnColor = data.turnColor;
    atoutColor = data.atoutColor;

    var dboard = document.getElementById("downboard");
    var lboard = document.getElementById("leftboard");
    var uboard = document.getElementById("upboard");
    var rboard = document.getElementById("rightboard");
    var cboard = document.getElementById("centerboard");
    document.getElementById("dpseudo").innerHTML = down.username;
    document.getElementById("lpseudo").innerHTML = left.username;
    document.getElementById("upseudo").innerHTML = up.username;
    document.getElementById("rpseudo").innerHTML = right.username;;
    drawCardMid(down.lastcard, "dcard", 0, "dcardimg");
    drawCardMid(left.lastcard, "lcard", 270, "lcardimg");
    drawCardMid(up.lastcard, "ucard", 0, "ucardimg");
    drawCardMid(right.lastcard, "rcard", 270, "rcardimg");
    lboard.style.transform = left.isnext ? "scale(1.05)" : "scale(1)";
    lboard.style["box-shadow"] = left.isnext ? "0 4px 8px 0 rgb(0 0 0 / 50%), 0 6px 20px 0 rgb(0 0 0 / 100%)" 
        : "0 4px 8px 0 rgb(0 0 0 / 12%), 0 6px 20px 0 rgb(0 0 0 / 23%)";
    uboard.style.transform = up.isnext ? "scale(1.05)" : "scale(1)";
    uboard.style.boxShadow = up.isnext ? "0 4px 8px 0 rgb(0 0 0 / 50%), 0 6px 20px 0 rgb(0 0 0 / 100%)" 
        : "0 4px 8px 0 rgb(0 0 0 / 12%), 0 6px 20px 0 rgb(0 0 0 / 23%)";
    rboard.style.transform = right.isnext ? "scale(1.05)" : "scale(1)";
    rboard.style.boxShadow = right.isnext ? "0 4px 8px 0 rgb(0 0 0 / 50%), 0 6px 20px 0 rgb(0 0 0 / 100%)" 
        : "0 4px 8px 0 rgb(0 0 0 / 12%), 0 6px 20px 0 rgb(0 0 0 / 23%)";
    dboard.style.boxShadow = down.isnext ? "0 4px 8px 0 rgb(0 0 0 / 50%), 0 6px 20px 0 rgb(0 0 0 / 100%)" 
        : "0 4px 8px 0 rgb(0 0 0 / 12%), 0 6px 20px 0 rgb(0 0 0 / 23%)";

    // TODO : checker si le nombvre de cartes a changé afin d'éviter de tout recalculer
    // TODO : factoriser
    lboard.innerHTML = "";
    for(let i = 0; i < left.cards.length; ++i) {
        var card = createCard(left.cards[i], cardArgs.w * 0.75, cardArgs.h * 0.75, ".svg", "othercard");
        card.style.transform = "rotate(90deg)";
        card.style.top = 40 + (cardArgs.h * 0.75) / 5 * i + "px";
        card.style.left = "30px";
        lboard.appendChild(card);
    }

    rboard.innerHTML = "";
    for(let i = 0; i < right.cards.length; ++i) {
        var card = createCard(right.cards[i], cardArgs.w * 0.75, cardArgs.h * 0.75, ".svg", "othercard");
        card.style.transform = "rotate(90deg)";
        card.style.top = 40 + (cardArgs.h * 0.75) / 5 * i + "px";
        card.style.left = "30px";
        rboard.appendChild(card);
    }

    uboard.innerHTML = "";
    for(let i = 0; i < up.cards.length; ++i) {
        var card = createCard(up.cards[i], cardArgs.w * 0.75, cardArgs.h * 0.75, ".svg", "othercard");
        card.style.left = 60 + (cardArgs.h * 0.75) / 3 * i + "px";
        card.style.top = "20px";
        uboard.appendChild(card);
    }

    updateScore(data.teams[0].nbCards, data.teams[0].nbPoints, data.teams[1].nbCards, data.teams[1].nbPoints);

    let i = 0;
    for(let p in data.players) {
        if(data.players[p].isTurnWinner) {
            cboard.children[i].style.transform = "scale(1.1)";
            cboard.children[i].style.boxShadow = "0 4px 8px 0 rgb(0 0 0 / 12%), 0 6px 20px 0 rgb(0 0 0 / 23%)";
            
            for(let j = 0; j < 4; ++j) {
                cboard.children[j].style.zIndex = j;
            }
            cboard.children[i].style.zIndex = "4";

            await sleep(1200);

            cboard.children[i].style.transform = "scale(1)";
            cboard.children[i].style.boxShadow = "";

            $("#ucardimg").css("transform", "translate(60px, 60px)");
            $("#rcardimg").css("transform", "translate(-40px, 30px) rotate(0deg)");
            $("#dcardimg").css("transform", "translate(-40px, -70px)");
            $("#lcardimg").css("transform", "translate(100px, -80px) rotate(0deg)");

            await sleep(800);

            //cboard.children[i].children[0].style.transformOrigin = "";
            for(let i = 0; i < 4; ++i) {
                cboard.children[i].children[0].style.transform += " scale(4)";
                cboard.children[i].children[0].style.opacity = "0";
            }

            await sleep(800);

            for(let j = 0; j < 4; ++j) {
                cboard.children[j].innerHTML = "";
            }

            break;
        } 
        i++;
    }

    if(data.endSet) {
        await sleep(1000);
        showScores(data.teams[0].nbPoints, data.teams[1].nbPoints);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function drawCardMid(cardId, divname, angle, imgid) {
    $("#" + divname)[0].innerHTML = "";
    $("#" + divname).css("background-color", "rgb(206 201 201)");
    if(cardId != -1) {
        var card = createCard(cardId, 80, 120, ".svg", "card", imgid);
        card.style.transform = "rotate(" + angle + "deg)";
        card.style.transformOrigin = "40px 40px";
        card.style.transition = "all 0.4s"
        $("#" + divname)[0].appendChild(card);
    }
}

function addCardToBoard(cardId) {

    var card = createCard(cardId, cardArgs.w, cardArgs.h, ".svg", "card", "undefined");
    var dboard = document.getElementById("downboard");
    
    card.addEventListener("mousedown", function(event) {
        cardDragEvent.mousedown = true;
        cardDragEvent.capturedX = event.pageX;
        cardDragEvent.capturedY = event.pageY;
        cardDragEvent.target = card;
        cardDragEvent.target.style.transform = "scale(1.2)"; 
        cardDragEvent.target.style.zIndex = "1000"; 

        var index = nthCard(event.pageX, event.pageY);
        cardDragEvent.index = index;
        $("#shadowcard").css("left", $("#downboard").children()[index].offsetLeft + "px");
 
    });

    cards.push(card);
    dboard.appendChild(card);
}

function initBoard() {

    for(let i = 0; i < deck.length; ++i) {
        addCardToBoard(deck[i]);
    }
}

function updateBoard() {

    var dboard = document.getElementById("downboard");
    dboard.innerHTML = ""; // remove childrens

    for(let i = 0; i < cards.length; ++i) {
        dboard.appendChild(cards[i]);
    }

}

function nthCard(mousePageX, mousePageY) {
    var n = cards.length;
    var totalWidth = cardArgs.w + 2 * cardArgs.spacing;

    if(mousePageY - $("#board").offset().top > 400) {
        // TODO : 800 = dboard width, 100 = dboard offset left
        var index = Math.floor((mousePageX - $("#board").offset().left 
            - (80 + (840 - n * totalWidth) / 2)) / totalWidth);
        if(index < 0)
            return 0;
        if(index >= n)
            return n - 1;
        return index;
    } else {
        return -1;
    }
}

// coeur, carreau, trefle, pique = 0, 1, 2, 3
// focus a clicked button in a certain div with a solid border
function focusBtn(divName, btnIndex) {
    var div = document.getElementById(divName);
    var i = 0;
    for(let child of div.children) {
        if(i == btnIndex) {
            child.style.border = "solid 4px"; 
            switch(divName) {
                case "suitestype": curAnnonce.suites.majoration = i; break;
                case "suitescouleur": curAnnonce.suites.colour = i; break;
                case "suitesvalue": curAnnonce.suites.highestCard = 3 + i; break;
                case "carres": curAnnonce.carres.value = 4 + i; break;
                case "atoutcouleurs" : curAtout = i; break;
                default: break;
            }
        } else {
            child.style.border = "";
        }
        i++;
    }
}

function chooseAtout() {
    if(curAtout == -1) {
        atoutError("Veuillez choisir une couleur ou schieber");
    } else {
        network.chooseAtout(curAtout);
        hideAtoutsPopup();
    }
}

function checkBonus() {
    let maj = curAnnonce.suites.majoration;
    let col = curAnnonce.suites.colour;
    let hi  = curAnnonce.suites.highestCard;
    let crr = curAnnonce.carres.value;

    let isValidSuite = true;
    if(maj !== -1) {
        for(let i = (maj == 0 ? 3 : 4), j = 0; i > 0; --i, --j) {
            if(!deck.includes((hi + j) + 9 * col))
                isValidSuite = false;
        }
    }
    if(!isValidSuite) {
        annoncesError("suite non valide");
        return;
    }

    let isValidCarre = true;
    if(crr !== -1) {
        for(let i = 0; i < 4; ++i) {
            if(!deck.includes(crr + 9 * i))
                isValidCarre = false;
        }
    }
    if(!isValidCarre) {
        annoncesError("carre non valide");
        return;
    }
    
    hideAnnoncesPopup();
}

var network = {

    sendMessage: function() {

        let msg = $("#message")[0].value;

        if(msg.length > 0) {

            let req = {
                action: "message",
                userid: document.getElementById("userid").innerHTML, // Not needed
                message: msg
            }
            socket.send(JSON.stringify(req));
            $("#message")[0].value = "";
        }
    },

    play: function(cardId) {
        let req = {
            action: "play",
            userid: document.getElementById("userid").innerHTML, // Not needed
            cardid: cardId
        }
        socket.send(JSON.stringify(req));
    },

    chooseAtout: function(atout) {
        let req = {
            action: "choose-atout",
            userid: document.getElementById("userid").innerHTML, // Not needed
            atout: atout
        }
        socket.send(JSON.stringify(req));
    }
}

function haveColor(color) {
    for(let card of cards) {
        if(Math.floor((card.getAttribute("cardid") - 1) / 9) == color)
            return true;
    }
    return false;
}

function haveOnlyBour(atoutColor, turnColor) {
    var nbCardOfThisColor = 0;
    var haveBour = false;
    for(let card of cards) {
        if(Math.floor((card.getAttribute("cardid") - 1) / 9) == atoutColor) {
            nbCardOfThisColor++;
        }
        if(card.getAttribute("cardid") - 1 == (5 + 9 * atoutColor)) {
            haveBour = true;
        }
    }
    return haveBour && (nbCardOfThisColor == 1) && (atoutColor == turnColor);
}

/*********************************************************************************************/

function cursorOnMid(pageX, pageY) {
    var top = $("#centerboard").offset().top;
    var left = $("#centerboard").offset().left;
    var w = $("#centerboard").width();
    var h = $("#centerboard").height();
    return (pageX - left > 0) && (pageX - left < w) && (pageY - top > 0) && (pageY - top < h);
}

$(document).on("dragstart", function() { // prevent default drag and drop behavior on browsers
    return false;
});

var board = document.getElementById("board");
var cboard = document.getElementById("centerboard");
var bckgd = document.getElementById("background");
var popupAnnonces = document.getElementById("annonces");

board.addEventListener("mouseup", function(event) {
    
    if(cardDragEvent.target && cardDragEvent.mousedown) {

        if(cardDragEvent.raf) {
            cancelAnimationFrame(cardDragEvent.raf);
            cardDragEvent.raf = null;
        }

        cardDragEvent.mousedown = false;

        cardDragEvent.target.style.transform = "translate(0px,0px) scale(1)"; 
        cardDragEvent.target.style.zIndex = "2"; 
        $("#dcard").css("background-color", "rgb(195 195 195)");	

        if(cursorOnMid(event.pageX, event.pageY)) {
        
            var card = cardDragEvent.target.attributes.cardid.value;

            if(myturn) {

                if(myturnAtout && curAtout == -1) {
                    playError("Veuillez d'abord choisir un atout");
                } else {

                    var playedColor = Math.floor((card - 1) / 9);
                    if(turnColor != -1 && haveColor(turnColor) && playedColor != atoutColor && playedColor != turnColor && !haveOnlyBour(atoutColor, turnColor)) {
                        playError("Veuillez suivre la couleur");
                    } else {

                        network.play(card);

                        // to avoid blink effects waiting for server to respond
                        drawCardMid(card, "dcard", 0);

                        cards.splice(cardDragEvent.index, 1);
                        document.getElementById("downboard").removeChild(cardDragEvent.target);
                        var n = cards.length;
                        var left = n == 0 ? 10000 : $("#downboard").children()[0].offsetLeft;
                        $("#shadowcard").css("left", left + "px");
                    }
                }
            } else {
                playError("Ce n'est pas votre tour");
            }
        }
    }
});

board.addEventListener("mousemove", function(event) {

    if(cardDragEvent.mousedown) {

        var curIndex = nthCard(event.pageX, event.pageY);
        var lastIndex = cardDragEvent.index;

        if(curIndex >= 0 && curIndex < cards.length && curIndex != lastIndex) {
            
            var totalWidth = cardArgs.w + 2 * cardArgs.spacing;
            cardDragEvent.capturedX += (curIndex - lastIndex) * totalWidth; 
            cardDragEvent.index = curIndex;
            cards.swap(lastIndex, curIndex);
            $("#shadowcard").css("left", $("#downboard").children()[curIndex].offsetLeft + "px")
            updateBoard();  
            
        }

        var top = $("#board").offset().top;
        var left = $("#board").offset().left;

        if(event.pageX < left || event.pageX > left + 1000 // drop card if cursor out of board
            || event.pageY < top || event.pageY > top + 650) {

            if(cardDragEvent.raf) {
                cancelAnimationFrame(cardDragEvent.raf);
                cardDragEvent.raf = null;
            }

            cardDragEvent.mousedown = false;
            cardDragEvent.target.style.transform = "translate(0px,0px) scale(1)"; 
            cardDragEvent.target.style.zIndex = "2"; 
            $("#dcard").css("background-color", "rgb(195 195 195)");

        } else { // update card drag move

            var dX = (event.pageX - cardDragEvent.capturedX);
            var dY = (event.pageY - cardDragEvent.capturedY);

            if(!cardDragEvent.raf) {
                cardDragEvent.raf = requestAnimationFrame(() => {
                    cardDragEvent.target.style.transform = "translate(" 
                        + dX + "px," + dY + "px) scale(1.2)";	
                    cardDragEvent.raf = null;
                });
            }
        }

        if(cursorOnMid(event.pageX, event.pageY)) {
            $("#dcard").css("background-color", "rgb(165 165 165)");
        } else {
            $("#dcard").css("background-color", "rgb(195 195 195)");
        }
    }
});

var cnvs = document.getElementById("canvas");
var ctx = cnvs.getContext("2d");
var drawingSurfaceImageData;

function saveDrawingSurface() {
    drawingSurfaceImageData = ctx.getImageData(0, 0, 160, 120);
}
 
function restoreDrawingSurface() {
    ctx.putImageData(drawingSurfaceImageData, 0, 0);
}

function drawPlayerIcon(x, y, fillStyle) {

    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y + 20, 12, 0, Math.PI, 1);
    ctx.fill(); 
}

function initCanvas() {

    drawPlayerIcon(40, 33, "#fdb98c");
    drawPlayerIcon(50, 33, "#ff8f45");
    drawPlayerIcon(40, 73, "#9ed8ff");
    drawPlayerIcon(50, 73, "#41b3ff");

    // cards icon
    ctx.lineWidth = 0.2;
    ctx.fillStyle = "#fff"
    for(let i = 0; i < 3; ++i) {
        ctx.beginPath();
        ctx.rect(72 + 2 * i, 5 + i, 10, 14);
        ctx.fill();
        ctx.stroke();
    }

    // score icon
    ctx.lineWidth = 0.5;
    for(let i = 0; i < 4; ++i) {
        ctx.beginPath();
        ctx.moveTo(110 + 3 * i, 9);
        ctx.lineTo(110 + 3 * i, 20);
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(121, 9);
    ctx.lineTo(107, 20);
    ctx.stroke();

    saveDrawingSurface();
}

function updateScore(redNbCards, redScore, blueNbCards, blueScore) {

    restoreDrawingSurface();
    ctx.font = "14px Verdana";
    ctx.fillStyle = "#ff8f45";
    ctx.fillText(redNbCards, 76, 47);
    ctx.fillText(redScore, 106, 47);
    ctx.fillStyle = "#41b3ff";
    ctx.fillText(blueNbCards, 76, 87);
    ctx.fillText(blueScore, 106, 87);
}

hideAnnoncesPopup();
hideAtoutsPopup();
hideScores();
initCanvas()
