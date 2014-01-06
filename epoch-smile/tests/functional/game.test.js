assert = require('assert');
vows = require('vows');
request = require('request');
app = require('../../smileplug');

PORT = 3001;
BASE_URL = "http://localhost:" + PORT;

HEADERS_JSON = {
    'Content-Type': 'application/json'
};

HEADERS_ENCODED = {
    'Content-Type': 'application/x-www-form-urlencoded'
};

var suite = vows.describe('Tests the game main flow');

suite.addBatch({
    "startup": function() {
        app.runServer(PORT);
    }
});

// Send Init Message

var MESSAGE_WAIT_CONNECT = JSON.stringify({
    'TYPE': 'WAIT_CONNECT'
});

suite.addBatch({
    "Connect (send init message)": {
        topic: function() {
            request({
                uri: BASE_URL + '/smile/sendinitmessage',
                method: 'PUT',
                headers: HEADERS_JSON,
                body: JSON.stringify({})
            }, this.callback);
        },
        "should respond with 200": function(err, res, body) {
            assert.equal(res.statusCode, 200);
        },
        "should answer with ok": function(err, res, body) {
            assert.equal(res.body, "OK");
        }
    }
});
suite.addBatch({
    "A GET to /JunctionServerExecution/current/MSG/smsg.txt": {
        topic: function() {
            request({
                uri: BASE_URL + "/JunctionServerExecution/current/MSG/smsg.txt",
                method: 'GET'
            }, this.callback);
        },
        "should return the 'wait connect' message": function(err, res, body) {
            assert.equal(res.body, MESSAGE_WAIT_CONNECT);
        }
    }
});

// Register Students

var encodedStudent1 = "MSG=%7B%22TYPE%22%3A%22HAIL%22%2C%22IP%22%3A%2210.0.2.15%22%2C%22NAME%22%3A%22test%22%7D";
var encodedStudent2 = "MSG=%7B%22TYPE%22%3A%22HAIL%22%2C%22IP%22%3A%2210.0.2.16%22%2C%22NAME%22%3A%22test2%22%7D";

var student1 = {
    name: "test",
    ip: "10.0.2.15",
    status: {
        made: false,
        solved: false
    },
    answers: [],
    ratings: [],
    score: 0
};

var student2 = {
    name: "test2",
    ip: "10.0.2.16",
    status: {
        made: false,
        solved: false
    },
    answers: [],
    ratings: [],
    score: 0
};

var students = {};
students["10.0.2.15"] = student1;
students["10.0.2.16"] = student2;

suite.addBatch({
    "Register Student 1": {
        topic: function() {
            request({
                uri: BASE_URL + "/JunctionServerExecution/pushmsg.php",
                method: 'POST',
                headers: HEADERS_ENCODED,
                body: encodedStudent1,
            }, this.callback);
        },
        "should respond with 200": function(err, res, body) {
            assert.equal(res.statusCode, 200);
        },
        "should answer with ok": function(err, res, body) {
            assert.equal(res.body, "OK");
        },
    }
});

suite.addBatch({
    "Register Student 2": {
        topic: function() {
            request({
                uri: BASE_URL + "/JunctionServerExecution/pushmsg.php",
                method: 'POST',
                headers: HEADERS_ENCODED,
                body: encodedStudent2,
            }, this.callback);
        },
        "should respond with 200": function(err, res, body) {
            assert.equal(res.statusCode, 200);
        },
        "should answer with ok": function(err, res, body) {
            assert.equal(res.body, "OK");
        },
    }
});

suite.addBatch({
    "Make sure the students were registered": {
        topic: function() {
            request({
                uri: BASE_URL + '/smile/student',
                method: 'GET'
            }, this.callback);
        },
        "should have registered the students": function(err, res, body) {
            assert.equal(res.body, JSON.stringify(students));
        },
    }
});

// Start Make Question

var MESSAGE_START_MAKE_QUESTION = JSON.stringify({
    'TYPE': 'START_MAKE'
});

suite.addBatch({
    "Start Make Question": {
        topic: function() {
            request({
                uri: BASE_URL + '/smile/startmakequestion',
                method: 'PUT',
                headers: HEADERS_JSON,
                body: JSON.stringify({})
            }, this.callback);
        },
        "should respond with 200": function(err, res, body) {
            assert.equal(res.statusCode, 200);
        },
        "should answer with ok": function(err, res, body) {
            assert.equal(res.body, "OK");
        }
    }
});

suite.addBatch({
    "A GET to /JunctionServerExecution/current/MSG/smsg.txt": {
        topic: function() {
            request({
                uri: BASE_URL + "/JunctionServerExecution/current/MSG/smsg.txt",
                method: 'GET'
            }, this.callback);
        },
        "should return the 'start make question' message": function(err, res, body) {
            assert.equal(res.body, MESSAGE_START_MAKE_QUESTION);
        }
    }
});

// Register questions

var questionInput1 = {
    "NAME": "test",
    "Q": "qwerty",
    "PIC": "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",
    "A": "3",
    "IP": '10.0.2.15',
    "O4": "r",
    "O3": "e",
    "O2": "w",
    "O1": "q",
    "TYPE": 'QUESTION_PIC'
};

var questionResult1 = {
    "NAME": "test",
    "Q": "qwerty",
    "A": "3",
    "IP": '10.0.2.15',
    "O4": "r",
    "O3": "e",
    "O2": "w",
    "O1": "q",
    "TYPE": 'QUESTION_PIC',
    "PICURL": '/smile/questionview/0.jpg'
};

var question2 = {
    "NAME": "test2",
    "Q": "asdfgh",
    "A": "2",
    "IP": '10.0.2.16',
    "O4": "f",
    "O3": "d",
    "O2": "s",
    "O1": "a",
    "TYPE": 'QUESTION'
};

var encodedQuestion2 = 'MSG=%7B%22NAME%22%3A%22test2%22%2C%22Q%22%3A%22asdfgh%22%2C%22A%22%3A%222%22%2C%22IP%22%3A%2210.0.2.16%22%2C%22O4%22%3A%22f%22%2C%22O3%22%3A%22d%22%2C%22O2%22%3A%22s%22%2C%22O1%22%3A%22a%22%2C%22TYPE%22%3A%22QUESTION%22%7D';

var questionOwner1 = 'test';
var questionOwner2 = 'test2';
var questions = {};
questions[questionOwner1] = [ questionResult1 ];
questions[questionOwner2] = [ question2 ];

suite.addBatch({
    "Insert question 1": {
        topic: function() {
            request({
                uri: BASE_URL + "/smile/question",
                method: 'PUT',
                headers: HEADERS_JSON,
                body: JSON.stringify(questionInput1)
            }, this.callback);
        },
        "should respond with 200": function(err, res, body) {
            assert.equal(res.statusCode, 200);
        },
        "should answer with ok": function(err, res, body) {
            assert.equal(res.body, "OK");
        }
    }
});

suite.addBatch({
    "Insert question 2 via encoded question": {
        topic: function() {
            request({
                uri: BASE_URL + "/JunctionServerExecution/pushmsg.php",
                method: 'POST',
                headers: HEADERS_ENCODED,
                body: encodedQuestion2
            }, this.callback);
        },
        "should respond with 200": function(err, res, body) {
            assert.equal(res.statusCode, 200);
        },
        "should answer with ok": function(err, res, body) {
            assert.equal(res.body, "OK");
        }
    }
});

suite.addBatch({
    "A GET to /smile/question should return a list containing the posted questions": {
        topic: function() {
            request({
                uri: BASE_URL + '/smile/question',
                method: 'GET'
            }, this.callback);
        },
        "should have registered the questions": function(err, res, body) {
            assert.equal(res.body, JSON.stringify(questions));
        },
    }
});

// Start Solve Questions

var MESSAGE_START_SOLVE_QUESTION = JSON.stringify({
    'TYPE': 'START_SOLVE',
    'NUMQ': 2,
    'RANSWER': [ 3, 2 ],
    'TIME_LIMIT': 10
});

suite.addBatch({
    "Start Solve Question": {
        topic: function() {
            request({
                uri: BASE_URL + '/smile/startsolvequestion',
                method: 'PUT',
                headers: HEADERS_JSON,
                body: JSON.stringify({})
            }, this.callback);
        },
        "should respond with 200": function(err, res, body) {
            assert.equal(res.statusCode, 200);
        },
        "should answer with ok": function(err, res, body) {
            assert.equal(res.body, "OK");
        }
    }
});

suite.addBatch({
    "A GET to /JunctionServerExecution/current/MSG/smsg.txt": {
        topic: function() {
            request({
                uri: BASE_URL + "/JunctionServerExecution/current/MSG/smsg.txt",
                method: 'GET'
            }, this.callback);
        },
        "should return the 'start make question' message": function(err, res, body) {
            assert.equal(res.body, MESSAGE_START_SOLVE_QUESTION);
        }
    }
});

suite.addBatch({
    "A GET to /JunctionServerExecution/current/0.html should return a html with the posted question": {
        topic: function() {
            request({
                uri: BASE_URL + '/JunctionServerExecution/current/0.html',
                method: 'GET'
            }, this.callback);
        },
        "should be able to show the registered the question to the user": function(err, res, body) {
            var question = questionInput1;
            var questionNumber = 0;
            var studentName = questionInput1.NAME;
            var html = "";
            html += "<html>\n<head>Question No." + (questionNumber + 1) + " </head>\n<body>\n";
            html += "<p>(Question created by " + studentName + ")</p>\n";
            html += "<P>Question:\n";
            html += question.Q;
            html += "\n</P>\n";

            html += "<img class=\"main\" src=\"" + questionNumber + ".jpg\" width=\"200\" height=\"180\"/>\n";

            html += "<P>\n";
            html += "(1) " + question.O1 + "<br>\n";
            html += "(2) " + question.O2 + "<br>\n";
            html += "(3) " + question.O3 + "<br>\n";
            html += "(4) " + question.O4 + "<br>\n";
            html += "</P>\n</body></html>\n";
            assert.equal(res.body, html);

        },
    }
});

suite
    .addBatch({
        "A GET to /JunctionServerExecution/current/0.jpg should return an image": {
            topic: function() {
                request({
                    uri: BASE_URL + '/JunctionServerExecution/current/0.jpg',
                    method: 'GET'
                }, this.callback);
            },
            "should be able to show the registered the question to the user": function(err, res, body) {
                var picture = "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";
                var dataBuffer = new Buffer(picture, 'base64');
                assert.equal(res.body, dataBuffer);
            },
        }
    });

suite.addBatch({
    "A GET to /JunctionServerExecution/current/1.html should return a html with the posted question": {
        topic: function() {
            request({
                uri: BASE_URL + '/JunctionServerExecution/current/1.html',
                method: 'GET'
            }, this.callback);
        },
        "should be able to show the registered the question to the user": function(err, res, body) {
            var question = question2;
            var questionNumber = 1;
            var studentName = question.NAME;
            var html = "";
            html += "<html>\n<head>Question No." + (questionNumber + 1) + " </head>\n<body>\n";
            html += "<p>(Question created by " + studentName + ")</p>\n";
            html += "<P>Question:\n";
            html += question.Q;
            html += "\n</P>\n";
            html += "<P>\n";
            html += "(1) " + question.O1 + "<br>\n";
            html += "(2) " + question.O2 + "<br>\n";
            html += "(3) " + question.O3 + "<br>\n";
            html += "(4) " + question.O4 + "<br>\n";
            html += "</P>\n</body></html>\n";
            assert.equal(res.body, html);

        },
    }
});

// Answer questions

var status1 = {
    "NAME": "test",
    "MADE": "Y",
    "SOLVED": "Y",
    "NUMQ": 2,
    "YOUR_ANSWERS": [ 3, 3 ]
};

var status2 = {
    "NAME": "test2",
    "MADE": "Y",
    "SOLVED": "Y",
    "NUMQ": 2,
    "YOUR_ANSWERS": [ 2, 4 ]
};

var encodedAnswer1 = 'MSG=%7B%22MYRATING%22%3A%5B2%2C5%5D%2C%22MYANSWER%22%3A%5B3%2C3%5D%2C%22NAME%22%3A%22test%22%2C%22TYPE%22%3A%22ANSWER%22%2C%22IP%22%3A%2210.0.2.15%22%7D';
var encodedAnswer2 = 'MSG=%7B%22MYRATING%22%3A%5B2%2C2%5D%2C%22MYANSWER%22%3A%5B2%2C4%5D%2C%22NAME%22%3A%22test2%22%2C%22TYPE%22%3A%22ANSWER%22%2C%22IP%22%3A%2210.0.2.16%22%7D';

suite.addBatch({
    "A POST to /JunctionServerExecution/pushmsg.php with an answer": {
        topic: function() {
            request({
                uri: BASE_URL + '/JunctionServerExecution/pushmsg.php',
                method: 'POST',
                headers: HEADERS_ENCODED,
                body: encodedAnswer1,
            }, this.callback);
        },
        "should respond with 200": function(err, res, body) {
            assert.equal(res.statusCode, 200);
        },
        "should answer with ok": function(err, res, body) {
            assert.equal(res.body, "OK");
        },
    }
});

suite.addBatch({
    "A GET to /JunctionServerExecution/current/MSG/10.0.2.15.txt": {
        topic: function() {
            request({
                uri: BASE_URL + '/JunctionServerExecution/current/MSG/10.0.2.15.txt',
                method: 'GET'
            }, this.callback);
        },
        "student should have status": function(err, res, body) {
            assert.equal(res.body, JSON.stringify(status1));
        },
    }
});


suite.addBatch({
    "A POST to /JunctionServerExecution/pushmsg.php with an answer": {
        topic: function() {
            request({
                uri: BASE_URL + '/JunctionServerExecution/pushmsg.php',
                method: 'POST',
                headers: HEADERS_ENCODED,
                body: encodedAnswer2,
            }, this.callback);
        },
        "should respond with 200": function(err, res, body) {
            assert.equal(res.statusCode, 200);
        },
        "should answer with ok": function(err, res, body) {
            assert.equal(res.body, "OK");
        },
    }
});

suite.addBatch({
    "A GET to /JunctionServerExecution/current/MSG/10.0.2.16.txt": {
        topic: function() {
            request({
                uri: BASE_URL + '/JunctionServerExecution/current/MSG/10.0.2.16.txt',
                method: 'GET'
            }, this.callback);
        },
        "student should have status": function(err, res, body) {
            assert.equal(res.body, JSON.stringify(status2));
        },
    }
});

// Results

var MESSAGE_SEND_SHOW_RESULTS = JSON.stringify({
    'TYPE': 'START_SHOW',
    'WINSCORE': [ "test" ],
    'WINRATING': [ "test2" ],
    'HIGHSCORE': 1,
    'HIGHRATING': 3.5,
    'NUMQ': 2,
    'RANSWER': [ 3, 2 ],
    'AVG_RATINGS': [ 2, 3.5 ],
    'RPERCENT': [ 50, 0 ]
});

suite.addBatch({
    "Send Show Results": {
        topic: function() {
            request({
                uri: BASE_URL + '/smile/sendshowresults',
                method: 'PUT',
                headers: HEADERS_JSON,
                body: JSON.stringify({})
            }, this.callback);
        },
        "should respond with 200": function(err, res, body) {
            assert.equal(res.statusCode, 200);
        },
        "should answer with ok": function(err, res, body) {
            assert.equal(res.body, "OK");
        }
    }
});

suite.addBatch({
    "A GET to /JunctionServerExecution/current/MSG/smsg.txt": {
        topic: function() {
            request({
                uri: BASE_URL + "/JunctionServerExecution/current/MSG/smsg.txt",
                method: 'GET'
            }, this.callback);
        },
        "should return the 'start make question' message": function(err, res, body) {
            assert.equal(res.body, MESSAGE_SEND_SHOW_RESULTS);
        }
    }
});

var expectedResult = {};
expectedResult["winnerScore"] = 1;
expectedResult["winnerRating"] = 3.5;
expectedResult["bestScoredStudentNames"] = [ "test" ];
expectedResult["bestRatedQuestionStudentNames"] = [ "test2" ];
expectedResult["numberOfQuestions"] = 2;
expectedResult["rightAnswers"] = [ 3, 2 ];
expectedResult["averageRatings"] = [ 2, 3.5 ];
expectedResult["questionsCorrectPercentage"] = [ 50, 0 ];

suite.addBatch({
    "A GET to /smile/results": {
        topic: function() {
            request({
                uri: BASE_URL + '/smile/results',
                method: 'GET'
            }, this.callback);
        },
        "should return the results": function(err, res, body) {
            assert.equal(res.body, JSON.stringify(expectedResult));
        },
    }
});

suite.addBatch({
    "A GET to /JunctionServerExecution/current/1_result.html should return a html with the question results": {
        topic: function() {
            request({
                uri: BASE_URL + '/JunctionServerExecution/current/1_result.html',
                method: 'GET'
            }, this.callback);
        },
        "should be able to show the question result to the user": function(err, res, body) {
            var question = question2;
            var questionNumber = 1;
            var studentName = question.NAME;
            var html = "";
            html += "<html>\n<head>Question No." + (questionNumber + 1) + " </head>\n<body>\n";
            html += "<p>(Question created by " + studentName + ")</p>\n";
            html += "<P>Question:\n";
            html += question.Q;
            html += "\n</P>\n";
            html += "<P>\n";
            html += "(1) " + question.O1 + (parseInt(question.A) === 1 ? "<font color = red>&nbsp; &#10004;</font>" : "") + "<br>\n";
            html += "(2) " + question.O2 + (parseInt(question.A) === 2 ? "<font color = red>&nbsp; &#10004;</font>" : "") + "<br>\n";
            html += "(3) " + question.O3 + (parseInt(question.A) === 3 ? "<font color = red>&nbsp; &#10004;</font>" : "") + "<br>\n";
            html += "(4) " + question.O4 + (parseInt(question.A) === 4 ? "<font color = red>&nbsp; &#10004;</font>" : "") + "<br>\n";
            html += "</P>\n";
            html += "Correct Answer: " + question.A + "<br>\n";
            html += "<P> Num correct people: " + 0 + " / " + 2 + "<br>\n";
            html += "Average rating: " + 3.5 + "<br>\n";
            html += "</body></html>\n";
            assert.equal(res.body, html);
        },
    }
});

// Retake

var MESSAGE_RETAKE = JSON.stringify({
    'TYPE': 'RE_TAKE1',
    'NUMQ': 2,
    'RANSWER': [ 3, 2 ],
    'TIME_LIMIT': 10
});


var encodedRetake = 'MSG=' + encodeURIComponent('{"TYPE":"RE_TAKE1","NUMQ":2,"RANSWER":[3,2],"TIME_LIMIT":10}');


suite.addBatch({
    "A POST to /JunctionServerExecution/pushmsg.php with a retake": {
        topic: function() {
            request({
                uri: BASE_URL + '/JunctionServerExecution/pushmsg.php',
                method: 'POST',
                headers: HEADERS_ENCODED,
                body: encodedRetake,
            }, this.callback);
        },
        "should respond with 200": function(err, res, body) {
            assert.equal(res.statusCode, 200);
        },
        "should answer with ok": function(err, res, body) {
            assert.equal(res.body, "OK");
        },
    }
});

suite.addBatch({
    "A GET to /JunctionServerExecution/current/MSG/smsg.txt": {
        topic: function() {
            request({
                uri: BASE_URL + "/JunctionServerExecution/current/MSG/smsg.txt",
                method: 'GET'
            }, this.callback);
        },
        "should return the 'retake' message": function(err, res, body) {
            assert.equal(res.body, MESSAGE_RETAKE);
        }
    }
});

suite.addBatch({
    "A GET to /smile/results": {
        topic: function() {
            request({
                uri: BASE_URL + '/smile/results',
                method: 'GET'
            }, this.callback);
        },
        "should return raw results": function(err, res, body) {
            var expectedResults = {
                "winnerScore": 0,
                "winnerRating": 0,
                "numberOfQuestions": 2,
                "rightAnswers": [3,2],
                "averageRatings": [],
                "questionsCorrectPercentage": []
            };
            assert.equal(res.body, JSON.stringify(expectedResults));
        },
    }
});

// Reset

suite.addBatch({
    "A PUT to /smile/reset without data": {
        topic: function() {
            request({
                uri: BASE_URL + '/smile/reset',
                method: 'PUT',
                headers: HEADERS_JSON,
                body: JSON.stringify({}),
            }, this.callback);
        },
        "should respond with 200": function(err, res, body) {
            assert.equal(res.statusCode, 200);
        },
        "should answer with ok": function(err, res, body) {
            assert.equal(res.body, "OK");
        },
    }
});

suite.addBatch({
    "A GET to /smile/results": {
        topic: function() {
            request({
                uri: BASE_URL + '/smile/results',
                method: 'GET'
            }, this.callback);
        },
        "should return raw results": function(err, res, body) {
            var expectedResults = {
                "winnerScore": 0,
                "winnerRating": 0,
                "numberOfQuestions": 0,
                "rightAnswers": [],
                "averageRatings": [],
                "questionsCorrectPercentage": []
            };
            assert.equal(res.body, JSON.stringify(expectedResults));
        },
    }
});

suite.addBatch({
    "A GET to /smile/question": {
        topic: function() {
            request({
                uri: BASE_URL + '/smile/question',
                method: 'GET'
            }, this.callback);
        },
        "should return empty json": function(err, res, body) {
            var expectedResults = {};
            assert.equal(res.body, JSON.stringify(expectedResults));
        },
    }
});

suite.addBatch({
    "A GET to /smile/student": {
        topic: function() {
            request({
                uri: BASE_URL + '/smile/student',
                method: 'GET'
            }, this.callback);
        },
        "should return empty json": function(err, res, body) {
            var expectedResults = {};
            assert.equal(res.body, JSON.stringify(expectedResults));
        },
    }
});

suite.addBatch({
    "A GET to /smile/currentmessage": {
        topic: function() {
            request({
                uri: BASE_URL + '/smile/currentmessage',
                method: 'GET'
            }, this.callback);
        },
        "should return empty json": function(err, res, body) {
            var expectedResults = {};
            assert.equal(res.body, JSON.stringify(expectedResults));
        },
    }
});

suite.addBatch({
    "A GET to /smile/all": {
        topic: function() {
            request({
                uri: BASE_URL + '/smile/all',
                method: 'GET'
            }, this.callback);
        },
        "should return empty list": function(err, res, body) {
            var expectedResults = [];
            assert.equal(res.body, JSON.stringify(expectedResults));
        },
    }
});

suite.addBatch({
    "shutdown": function() {
        app.close();
    }
});

suite.run();