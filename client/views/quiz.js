var Questions = new Meteor.Collection(null)
var question1 = {text: '1. If you make choice 1 and your partner makes choice 1, how much payoff will you receive?',
		 answer: payoffs.R,
		 correct: false,
		 answered: false};
var question2 = {text: '2. If you make choice 1 and your partner makes choice 2, how much payoff will you receive?',
		 answer: payoffs.S,
		 correct: false,
		 answered: false};
var question3 = {text: '3. If you make choice 1 and your partner makes choice 2, how much payoff will your partner receive?',
		 answer: payoffs.T,
		 correct: false,
		 answered: false};
var question4  = {text: '4. If you make choice 2 and your partner makes choice 1, how much payoff will you receive?',
		  answer: payoffs.T,
		  correct: false,
		  answered: false};
var question5  = {text: '5. If you make choice 2 and your partner makes choice 1, how much payoff will your partner?',
		  answer: payoffs.S,
		  correct: false,
		  answered: false};
var question6  = {text: '6. If you make choice 2 and your partner makes choice 2, how much payoff will you receive?',
		  answer: payoffs.P,
		  correct: false,
		  answered: false};
Questions.insert(question1);
Questions.insert(question2);
Questions.insert(question3);
Questions.insert(question4);
Questions.insert(question5);
Questions.insert(question6);

Template.quiz.helpers({
    questions: function() {
	return Questions.find();
    },
    incorrect: function() {
	var obj = Recruiting.findOne();
	return obj && obj.attempts == 1;
    },
});

Template.quiz.events({
    "submit .quiz": _.debounce(function (e) {
	e.preventDefault();
	var form = e.target;
	Questions.find().forEach(function(obj) {
	    var val = form[obj._id].value;
	    var correct = val == obj.answer ? true: false;
	    Questions.update({_id: obj._id},
			     {$set: {correct: correct,
				     answered: true}});
	});
	var correct = Questions.find({correct: true}).count() == Questions.find().count();
	if (correct) {
	    Meteor.call('endQuiz');
	} else {
	    var obj = Recruiting.findOne();
	    Meteor.call('incQuiz');
	    if (obj && obj.attempts == 1) {
		Session.set('failedQuiz', true);
		Meteor.call('endQuiz');
	    }
	}
    }, 1000, true)
});

Template.question.helpers({
    incorrect: function() {
	return this.answered && !this.correct;
    }
});
			  
