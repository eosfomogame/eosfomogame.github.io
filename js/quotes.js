var timeOnEachText = 5000; // Milliseconds to spend on each before moving to next

var text = ["The 1st game is over!",
	"Congratulation strangertown! blue win",
    "The reds are defeated",
	"Next special round will start very soon!",
	"Stay tuned on our telegram group: https://t.me/eosfomogame",
	"Thanks for playing",
	
];
var counter = 0;
var elem = document.getElementById("fade");
function change() {
  jQuery(elem).delay(timeOnEachText).fadeTo(1400, 0, function() {
    this.innerHTML = text[counter];
    counter = Math.floor(Math.random()*text.length);
    jQuery(this).fadeTo(1400, 1, change)
  })
}
change()
