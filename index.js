var express = require("express");
var mysql = require("mysql");
var app = express();
var bodyParser = require('body-parser');

const db_connection = require('./db_connection.json');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());

app.use(express.static("public"));

var connection = mysql.createPool(db_connection);

app.get('/', function(req, res, next) {  
    res.send(JSON.stringify("server is up and running!"));
});

app.get('/patients', function(req, res, next) {  
    var query = "select * from patient natural join user";
    connection.query(query, function(error, results) {
        if (error) { 
            next(error);
        } else {
            res.send(JSON.stringify(results));
        }
    });
});

app.get('/doctors', function(req, res, next) {  
    var query = "select * from doctor natural join user";
    connection.query(query, function(error, results) {
        if (error) { 
            next(error);
        } else {
            res.send(JSON.stringify(results));
        }
    });
});

app.get('/patient/:patient_id', function(req, res, next) {
	var data = Object();
    var query = "select * from patient natural join user where patient_id = ?";
    connection.query(query, [req.params.patient_id], function(error, results) {
    	if (error) {
    		next(error);
    	} else {
        	if (results.length > 0) {
          		data = results[0];
        	}
    		res.send(JSON.stringify(data));
    	}
  	});
});

app.get('/doctor/:doctor_id', function(req, res, next) {
	var data = Object();
    var query = "select * from doctor natural join user where doctor_id = ?";
    connection.query(query, [req.params.doctor_id], function(error, results) {
    	if (error) {
    		next(error);
    	} else {
        	if (results.length > 0) {
          		data = results[0];
        	}
    		res.send(JSON.stringify(data));
    	}
  	});
});

app.get('/auth_patient/:phone_number', function(req, res, next) {
	var data = Object();
    var query = "select * from patient natural join user where phone_number = ?";
    connection.query(query, [req.params.phone_number], function(error, results) {
    	if (error) {
    		next(error);
    	} else {
        	if (results.length > 0) {
          		data = results[0];
        	}
    		res.send(JSON.stringify(data));
    	}
  	});
});

app.get('/auth_doctor/:phone_number', function(req, res, next) {
	var data = Object();
    var query = "select * from doctor natural join user where phone_number = ?";
    connection.query(query, [req.params.phone_number], function(error, results) {
    	if (error) {
    		next(error);
    	} else {
        	if (results.length > 0) {
          		data = results[0];
        	}
    		res.send(JSON.stringify(data));
    	}
  	});
});

app.get('/availabilities/:doctor_id/:date', function(req, res, next) {  
    var query = "select * from availability where doctor_id = ? and date = ?";
    connection.query(query, [req.params.doctor_id, req.params.date], function(error, results) {
        if (error) { 
            next(error);
        } else {
            res.send(JSON.stringify(results));
        }
    });
});

var server = app.listen(8082, function() {
    console.log("server listening on port " + server.address().port);
});