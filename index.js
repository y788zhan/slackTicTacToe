var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('pages/index');
});


// TIC TAC TOE API ENDPOINTS
app.get('/usage', function(req, res) {
	res.status(200).json({"message": "TODO usage details"});
});

app.post('/start', function(req, res) {
	res.status(200).json({"message": "TODO start game"});
});

app.post('/quit', function(req, res) {
	res.status(200).json({"message": "TODO quit game"});
})

app.post('/restart', function(req, res) {
	res.status(200).json({"message": "TODO restart game"});
})

app.post('/move', function(req, res) {
	res.status(200).json({"message": "TODO player move"});
})

app.get('/gamestate', function(req, res) {
	res.status(200).json({"message": "TODO return game state"});
});





app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


