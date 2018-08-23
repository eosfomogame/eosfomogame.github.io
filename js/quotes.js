var timeOnEachText = 5000; // Milliseconds to spend on each before moving to next

var text = ["The 1st game is over!",
	"Congratulation justforgame1! The blue win",
    "The reds are defeated",
	"Round 2 will start very soon!",
	"Stay tuned on our telegram group: @eosfomogame",
	"If you did not please withdraw your dividends: Go to 'Valut' and select 'Withdraw'",
	"Think different, Think EOS",
	
];
var counter = 0;
var elem = document.getElementById("fade");
function change() {
  jQuery(elem).delay(timeOnEachText).fadeTo(1400, 0, function() {
    this.innerHTML = text[counter];
    counter = ++counter % text.length;
    jQuery(this).fadeTo(1400, 1, change)
  })
}
change()
