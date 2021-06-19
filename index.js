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

const SUCCESS = "success";
const ERROR = "error";

app.get('/', function(req, res, next) {  
    res.send(JSON.stringify("server is up and running!"));
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

app.get('/patient_doctors/:patient_id', function(req, res, next) {
    var query = "select * from doctor natural join user where doctor_id in (select distinct doctor_id from appointment where patient_id = ?)";
    connection.query(query, req.params.patient_id, function(error, results) {
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

app.get('/auth_patient/:phone_number/:password', function(req, res, next) {
	var data = Object();
    var query = "select * from patient natural join user where phone_number = ?";
    connection.query(query, [req.params.phone_number], function(error, results) {
    	if (error) {
    		next(error);
    	} else {
        	if ((results.length > 0) && (results[0].password == req.params.password)){
          		data = results[0];
        	}
    		res.send(JSON.stringify(data));
    	}
  	});
});

app.get('/auth_doctor/:phone_number/:password', function(req, res, next) {
	var data = Object();
    var query = "select * from doctor natural join user where phone_number = ?";
    connection.query(query, [req.params.phone_number], function(error, results) {
    	if (error) {
    		next(error);
    	} else {
        	if ((results.length > 0) && (results[0].password == req.params.password)){
          		data = results[0];
        	}
    		res.send(JSON.stringify(data));
    	}
  	});
});

app.get('/availabilities/:doctor_id/:date/:time', function(req, res, next) {
    var query = "select * from appointment " 
                + "where doctor_id = ? and date = ? and time > ? and patient_id is null "
                + "order by date, time";
    connection.query(query, [req.params.doctor_id, req.params.date, req.params.time], function(error, results) {
        if (error) { 
            next(error);
        } else {
            res.send(JSON.stringify(results));
        }
    });
});

app.put('/book_appointment/:appointment_id/:patient_id', function(req, res, next) {
    var query = "update appointment set patient_id = ? where appointment_id = ?";
    var ret = ERROR;
    connection.query(query, [req.params.patient_id, req.params.appointment_id], function(error, results) {
    	if (error) {
    	    next(error);
    	} else {
    	    ret = SUCCESS;	
    	}
	   res.send(JSON.stringify(ret));
    });
}); 

app.put('/cancel_appointment/:appointment_id', function(req, res, next) {
    var query = "update appointment set patient_id = null where appointment_id = ?";
    var ret = ERROR;
    connection.query(query, [req.params.appointment_id], function(error, results) {
        if (error) {
            next(error);
        } else {
            ret = SUCCESS;
        }
        res.send(JSON.stringify(ret));
    });
});

app.get('/patient_appointments/:patient_id', function(req, res, next) {
    var query = "select * from appointment where patient_id = ?";
    connection.query(query, [req.params.patient_id], function(error, results) {
    	if (error) {
    		next(error);
    	} else {
    		res.send(JSON.stringify(results));
    	}
  	});
});

app.post('/ask_advice', function(req, res, next) {
    var query = "insert into advice (patient_id, doctor_id, message, date_time) values";
    var data = [];
    if (req.body.length > 0) {
        req.body.forEach(e => {
            query += " (?, ?, ?, ?),";
            data.push(e.patient_id, e.doctor_id, e.message, e.date_time);
        });
        query = query.slice(0, query.length - 1);
    }
    var ret = ERROR;
    connection.query(query, data, function(error, results) {
        if (error) {
            next(error);
        } else {
            ret = SUCCESS;
        }
        res.send(JSON.stringify(ret));
    });
});


app.get('/all_advice/:patient_id', function(req, res, next) {
    var query = "select * from advice where patient_id = ?";
    connection.query(query, [req.params.patient_id], function(error, results) {
        if (error) {
            next(error);
        } else {
            res.send(JSON.stringify(results));
        }
    
    });
});


const PORT = process.env.PORT || 8082;
var server = app.listen(PORT, function() {
    console.log("server listening on port " + server.address().port);
});