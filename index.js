var express = require('express');
var pg = require('pg');
var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// postgres connection
pg.defaults.ssl = true;
pg.connect(process.env.DATABASE_URL, function(err, client) {
  if (err) throw err;
  console.log('Connected to postgres! Getting schemas...');

  client
    .query('SELECT table_schema,table_name FROM information_schema.tables;')
    .on('row', function(row) {
      console.log(JSON.stringify(row));
    });
});

app.get('/', function(request, response) {
  response.render('pages/index');
});

function errHandler(res, reason, message, code) {
	console.log("ERROR: " + reason);
	res.status(code || 500).json({"error": message});
}


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


