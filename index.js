const express = require("express");
const mysql = require("mysql");
const app = express();
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const admin = require("firebase-admin");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());

app.use(express.static("public"));

const db_connection = require('./db_connection.json');
const connection = mysql.createPool(db_connection);

const serviceAccount = require("./medicana-26077-firebase-adminsdk-xhzy8-625e0d3d9a.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const saltRounds = 10;

const SUCCESS = "success";
const ERROR = "error";
const SEEN = "seen";
const EXISTS = "exists";

app.get('/', function(req, res, next) {  
    res.send(JSON.stringify("server is up and running!"));
});

app.get('/doctors', function(req, res, next) {  
    var query = "select * from doctor";
    connection.query(query, function(error, results) {
        if (error) { 
            next(error);
        } else {
            res.send(JSON.stringify(results));
        }
    });
});

app.get('/patient_doctors/:patient_id', function(req, res, next) {
    var query = "select * from doctor where doctor_id in (select distinct doctor_id from appointment where patient_id = ?)";
    connection.query(query, req.params.patient_id, function(error, results) {
        if (error) {
            next(error);
        } else {
            res.send(JSON.stringify(results));
        }
        
    });
});

app.get('/doctor_patients/:doctor_id', function(req, res, next) {
    var query = "select * from patient where patient_id in (select distinct patient_id from advice where doctor_id = ?)";
    connection.query(query, req.params.doctor_id, function(error, results) {
        if (error) {
            next(error);
        } else {
            res.send(JSON.stringify(results));
        }
        
    });
});

app.get('/auth_patient/:phone_number/:password', function(req, res, next) {
	var data = Object();
    var query = "select * from patient where phone_number = ? limit 1";
    connection.query(query, [req.params.phone_number], function(error, results) {
    	if (error) {
    		next(error);
    	} else {
        	if (results.length > 0) {
                bcrypt.compare(req.params.password, results[0].password, function(err, result) {
                    if (result == true) {
                        data = results[0];
                    }
                    res.send(JSON.stringify(data));
                });
        	} else {
                res.send(JSON.stringify(data));   
            }
    	}
  	});
});

app.get('/auth_doctor/:phone_number/:password', function(req, res, next) {
	var data = Object();
    var query = "select * from doctor where phone_number = ? limit 1";
    connection.query(query, [req.params.phone_number], function(error, results) {
    	if (error) {
    		next(error);
    	} else {
        	if (results.length > 0) {
                bcrypt.compare(req.params.password, results[0].password, function(err, result) {
                    if (result == true) {
                        data = results[0];
                    }
                    res.send(JSON.stringify(data));
                });
            } else {
                res.send(JSON.stringify(data));   
            }
    	}
  	});
});

app.get('/availabilities/:doctor_id/:date/:start_time', function(req, res, next) {
    var query = "select * from appointment " 
                + "where doctor_id = ? and date = ? and start_time > ? and patient_id is null "
                + "order by date, start_time";
    connection.query(query, [req.params.doctor_id, req.params.date, req.params.start_time], function(error, results) {
        if (error) { 
            next(error);
        } else {
            res.send(JSON.stringify(results));
        }
    });
});

app.put('/book_appointment/:appointment_id/:patient_id/:doctor_id', function(req, res, next) {
    var query = "update appointment set patient_id = ? where appointment_id = ?";
    var ret = ERROR;
    connection.query(query, [req.params.patient_id, req.params.appointment_id], function(error, results) {
    	if (error) {
    	    next(error);
    	} else {
    	    ret = SUCCESS;
            send_notif_appointments(req.params.doctor_id);
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

app.get('/doctor_appointments/:doctor_id', function(req, res, next) {
    var query = "select * from appointment where doctor_id = ? and patient_id is not null";
    connection.query(query, [req.params.doctor_id], function(error, results) {
        if (error) {
            next(error);
        } else {
            res.send(JSON.stringify(results));
        }
    });
});

app.get('/doctor_appointment/:doctor_id/:appointment_id', function(req, res, next) {
    var data = Object();
    var query = "select * from appointment natural join patient where appointment.doctor_id = ? and appointment_id = ? limit 1";
    connection.query(query, [req.params.doctor_id, req.params.appointment_id], function(error, results) {
        if (error) {
            next(error);
        } else {
            if (results.length > 0){
                data = results[0];
            }
            res.send(JSON.stringify(data));
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
            var already_sent = [];
            req.body.forEach(e => {
                if (!already_sent.includes(e.doctor_id)) {
                    send_notif_ask_advice(e.doctor_id);
                    already_sent.push(e.doctor_id);    
                }
            });
        }
        res.send(JSON.stringify(ret));
    });
});

app.post('/give_advice', function(req, res, next) {
    var query = "insert into advice (patient_id, doctor_id, reply, date_time) values";
    var data = [];
    if (req.body.length > 0) {
        req.body.forEach(e => {
            query += " (?, ?, ?, ?),";
            data.push(e.patient_id, e.doctor_id, e.reply, e.date_time);
        });
        query = query.slice(0, query.length - 1);
    }
    var ret = ERROR;
    connection.query(query, data, function(error, results) {
        if (error) {
            next(error);
        } else {
            ret = SUCCESS;
            var already_sent = [];
            req.body.forEach(e => {
                if (!already_sent.includes(e.patient_id)) {
                    send_notif_give_advice(e.patient_id);
                    already_sent.push(e.patient_id);    
                }
            });
        }
        res.send(JSON.stringify(ret));
    });
});

app.put('/see_advice/:patient_id/:doctor_id', function(req, res, next) {
    var query = "update advice set state = '" + SEEN + "' where patient_id = ? and doctor_id = ? and reply is not null";
    var ret = ERROR;
    connection.query(query, [req.params.patient_id, req.params.doctor_id], function(error, results) {
        if (error) {
            next(error);
        } else {
            ret = SUCCESS;
        }
        res.send(JSON.stringify(ret));
    });
});

app.put('/see_message/:doctor_id/:patient_id', function(req, res, next) {
    var query = "update advice set state = '" + SEEN + "' where patient_id = ? and doctor_id = ? and message is not null";
    var ret = ERROR;
    connection.query(query, [req.params.patient_id, req.params.doctor_id], function(error, results) {
        if (error) {
            next(error);
        } else {
            ret = SUCCESS;
        }
        res.send(JSON.stringify(ret));
    });
});


app.get('/all_patient_advice/:patient_id', function(req, res, next) {
    var query = "select * from advice where patient_id = ?";
    connection.query(query, [req.params.patient_id], function(error, results) {
        if (error) {
            next(error);
        } else {
            res.send(JSON.stringify(results));
        }
    
    });
});

app.get('/all_doctor_advice/:doctor_id', function(req, res, next) {
    var query = "select * from advice where doctor_id = ?";
    connection.query(query, [req.params.doctor_id], function(error, results) {
        if (error) {
            next(error);
        } else {
            res.send(JSON.stringify(results));
        }
    
    });
});

app.get('/advice_with_patient/:patient_id/:doctor_id', function(req, res, next) {
    var query = "select * from advice where patient_id = ? and doctor_id = ?";
    connection.query(query, [req.params.patient_id, req.params.doctor_id], function(error, results) {
        if (error) {
            next(error);
        } else {
            res.send(JSON.stringify(results));
        }
    
    });
});

app.get('/advice_with_doctor/:doctor_id/:patient_id', function(req, res, next) {
    var query = "select * from advice where doctor_id = ? and patient_id = ?";
    connection.query(query, [req.params.doctor_id, req.params.patient_id], function(error, results) {
        if (error) {
            next(error);
        } else {
            res.send(JSON.stringify(results));
        }
    
    });
});

app.post('/register/:user_type/:user_id/:token', function(req, res, next) {
    var query = "insert into device (user_type, user_id, token) values (?, ?, ?)";
    var ret = ERROR;
    connection.query(query, [req.params.user_type, req.params.user_id, req.params.token], function(error, results) {
        if (error) {
            next(error);
        } else {
            ret = results.insertId;
        }
        res.send(JSON.stringify(ret));
    });
});

app.delete('/unregister/:device_id', function(req, res, next) {
    var query = "delete from device where device_id = ?";
    var ret = ERROR;
    connection.query(query, [req.params.device_id], function(error, results) {
        if (error) {
            next(error);
        } else {
            ret = SUCCESS;
        }
        res.send(JSON.stringify(ret));
    });
});

app.get('/get_tokens/:user_type/:user_id', function(req, res, next) {
    var query = "select distinct token from device where user_type = ? and user_id = ?";
    connection.query(query, [req.params.user_type, req.params.user_id], function(error, results) {
        if (error) {
            next(error);
        } else {
            res.send(JSON.stringify(results));
        }
    
    });
});

app.post('/prescribe_treatment/:start_date/:finish_date/:description/:appointment_id/:patient_id', function(req, res, next) {
    var query = "select treatment_id from appointment where appointment_id = ? limit 1";
    var ret = ERROR;
    connection.query(query, [req.params.appointment_id], function(error, results) {
        if (error) {
            next(error);
        } else {
            if (results[0].treatment_id == null) {
                query = "insert into treatment (start_date, finish_date, description) values (?, ?, ?)";
                connection.query(query, [req.params.start_date, req.params.finish_date, req.params.description], function(error, results) {
                    if (error) {
                        next(error);
                    } else {
                        var treatment_id = results.insertId;
                        query = "update appointment set treatment_id = ? where appointment_id = ?";
                        connection.query(query, [treatment_id, req.params.appointment_id], function(error, results) {
                            if (error) {
                                next(error);
                            } else {
                                ret = treatment_id;
                                send_notif_treatments(req.params.patient_id);
                                res.send(JSON.stringify(ret));
                            }
                        });
                    }
                });
            } else {
                ret = EXISTS;
                res.send(JSON.stringify(ret));
            }
        }
    });
});

app.get('/patient_treatments/:patient_id', function(req, res, next) {
    var query = "select * from treatment where treatment_id in (select distinct treatment_id from appointment where patient_id = ? and treatment_id is not null)";
    connection.query(query, [req.params.patient_id], function(error, results) {
        if (error) {
            next(error);
        } else {
            res.send(JSON.stringify(results));
        }
    
    });
});

app.get('/doctor_treatments/:doctor_id', function(req, res, next) {
    var query = "select * from treatment where treatment_id in (select distinct treatment_id from appointment where doctor_id = ? and treatment_id is not null)";
    connection.query(query, [req.params.doctor_id], function(error, results) {
        if (error) {
            next(error);
        } else {
            res.send(JSON.stringify(results));
        }
    
    });
});

const PORT = process.env.PORT || 8082;
const server = app.listen(PORT, function() {
    console.log("medicana server started");
});

function send_notif_appointments(doctor_id) {
    const condition = '\'appointments-for-'+doctor_id+'\' in topics';
    const message = {
      notification: {
        title: 'New appointment',
        body: 'A patient has booked a new appointment with you'
      },
      condition: condition,
      android: {
        ttl: 2592000000
      }
    };
    admin.messaging().send(message)
      .then((response) => {
        console.log('Successfully sent message:', response);
      })
      .catch((error) => {
        console.log('Error sending message:', error);
      });

}

function send_notif_treatments(patient_id) {
    const condition = '\'treatments-for-'+patient_id+'\' in topics';
    const message = {
      notification: {
        title: 'New treatment',
        body: 'Your doctor has prescribed a new treatment for you'
      },
      condition: condition,
      android: {
        ttl: 2592000000
      }
    };
    admin.messaging().send(message)
      .then((response) => {
        console.log('Successfully sent message:', response);
      })
      .catch((error) => {
        console.log('Error sending message:', error);
      });

}


function send_notif_ask_advice(doctor_id) {
    const condition = '\'ask-advice-from-'+doctor_id+'\' in topics';
    const message = {
      notification: {
        title: 'Advice request',
        body: 'Your patient is asking for advice from you'
      },
      condition: condition,
      android: {
        ttl: 2592000000
      }
    };
    admin.messaging().send(message)
      .then((response) => {
        console.log('Successfully sent message:', response);
      })
      .catch((error) => {
        console.log('Error sending message:', error);
      });

}


function send_notif_give_advice(patient_id) {
    const condition = '\'give-advice-to-'+patient_id+'\' in topics';
    const message = {
      notification: {
        title: 'Advice',
        body: 'Your doctor has responded to your advice request'
      },
      condition: condition,
      android: {
        ttl: 2592000000
      }
    };
    admin.messaging().send(message)
      .then((response) => {
        console.log('Successfully sent message:', response);
      })
      .catch((error) => {
        console.log('Error sending message:', error);
      });

}