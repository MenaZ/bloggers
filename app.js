// Seting up the libraries:
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');
const session= require('express-session');
const bcrypt= require('bcrypt-nodejs');
const fileUpload = require('express-fileupload');

 Setting up the link to the database.
const sequelize= new Sequelize('blogger', process.env.POSTGRES_USER, process.env.POSTGRES_PASSWORD, {
	host: 'localhost',
	dialect: 'postgres',
	define: {
		timestamps: true
	}
})

app.use('/', bodyParser());

app.set('views', './');
app.set('view engine', 'pug');
app.use(express.static("public"));
app.use(fileUpload());

// Setting up the tables
var User = sequelize.define('user', {
	firstname: Sequelize.STRING,
	lastname: Sequelize.STRING,
	email: Sequelize.STRING,
	age: Sequelize.INTEGER,
	gender: Sequelize.STRING,
	password: Sequelize.STRING,
	aboutme: Sequelize.STRING
});

var Event= sequelize.define('event', {
	title: Sequelize.STRING,
	description: Sequelize.STRING,
	address: Sequelize.STRING,
	street_number: Sequelize.STRING,
	city: Sequelize.STRING,
	state: Sequelize.STRING,
	postal: Sequelize.STRING,
	country: Sequelize.STRING,
	date: Sequelize.STRING,
	time: Sequelize.STRING
})

var Comment = sequelize.define('comment', {
	body: Sequelize.STRING
})

var Announce = sequelize.define('announce')

var Participant = sequelize.define('participant')

var Picture = sequelize.define('pictures', {
	picture: Sequelize.STRING
})

// Setting up the model by linking the tables to each other
Event.belongsTo(User);
User.hasMany(Event);
User.hasMany(Comment);
Comment.belongsTo(User);
Event.hasMany(Comment);
Comment.belongsTo(Event);
User.belongsToMany(Event, { as: "participant", through: 'user_event', foreignKey: 'eventId' }); //participants
Event.belongsToMany(User, { through: 'user_event', foreignKey: 'userId' }); //particpants
Event.belongsTo(User, {as: "organizedBy", foreignKey: 'organizedById'}) //created event
User.hasMany(Event,  {foreignKey: 'organizedById'});
/*Announce.belongsTo(User);
*//*Event.hasMany(Announce);
Announce.belongsTo(Event);*/
Picture.belongsTo(User);
User.hasOne(Picture);
Event.hasMany(Participant);
Participant.belongsTo(Event);
User.hasMany(Participant);
Participant.belongsTo(User)

sequelize.sync({force: true}) //Change false to true to wipe clean the whole database.

// Creates session when user logs in
app.use(session({
	secret: `${process.env.SECRET_SESSION}`,
	resave: true,
	saveUninitialized: false
}));

// Goes to the index page, which is the homepage of the blog app
app.get('/',  (req,res)=>{
	res.render('public/views/index', {
		// You can also use req.session.message so message won't show in the browser
		message: req.query.message,
		user: req.session.user
	});
});

app.get('/about', (req,res)=>{
	res.render('public/views/about')
})

app.get('/contact', (req,res)=>{
	res.render('public/views/contact')
})

// go to the register page
app.get('/register', (req, res) => {
    res.render('public/views/register')
});

app.post('/register', bodyParser.urlencoded({extended:true}), (req, res) => {
	// check email im DB
		User.findOne({
			where: {
				email: req.body.email
			}
		})
		.then((user) => {
			if(user !== null && req.body.email=== user.email) {
        		res.redirect('/login?message=' + encodeURIComponent("Email already exists!"));
				return;
			} else {
				bcrypt.hash(req.body.password, null, null, (err, hash) =>{
					if (err) {
						throw err
					}
					User.sync()
					.then(() => {
						User.create({
							firstname: req.body.firstname,
							lastname: req.body.lastname,
							email: req.body.email,
							age: req.body.age,
							gender: req.body.gender,
							password: hash,
							aboutme: req.body.aboutme
						})
					})
					.then(() =>{
						res.redirect('/login')
					})
					.then().catch(error=> console.log(error))
				})
			}
		})
	.then().catch(error => console.log(error))
});

app.get('/login', (req, res)=> {
	res.render('public/views/login', {
		message: req.query.message,
	})
})

app.post('/login', (req, res) => {
	if(req.body.email.length ===0) {
		res.redirect('/login?message=' + encodeURIComponent("Invalid email"));
		return;
	}
	if(req.body.password.length ===0) {
		res.redirect('/login?message=' + encodeURIComponent("Invalid password"));
		return;
	}
	User.findOne({
		where: {
			email:req.body.email
		}
	}).then((user) => { //This part needs fixing, when the email is not in the database it should not pass on, it will yield errors.
		if(user === null) {
        	res.redirect('/login?message=' + encodeURIComponent("Does not exist!"));
			return;
		}
		bcrypt.compare(req.body.password, user.password, (err, data)=>{
			if (err) {
					throw err;
			} else {
				if(user !== null && data === true) {
					loggedInUser= user;
					req.session.user = loggedInUser;
					res.redirect('/profile');
				} else {
					res.redirect('/login?message=' + encodeURIComponent("Invalid email or password."));
				}
			}
		});
	}), (error)=> {
		res.redirect('/login?message=' + encodeURIComponent("Invalid email or password."));
	};
});

app.get('/profile', (req, res)=> {
    var user = req.session.user;
    if (user === undefined) {
        res.redirect('/login?message=' + encodeURIComponent("Please log in to view your profile."));
    } else {
    	Picture.findOne({
    		where: {
    			userId: user.id
    		}
    	}).then((picture)=>{
    		Event.findAll()
    			.then((events)=>{
    				res.render('public/views/profile', {
		            	user: user,
		            	picture: picture,
		            	events: events
		        	});
    			})
    	}).then().catch((error)=> console.log(error))
    }
});

app.post('/picture', (req,res)=>{
	var user= req.session.user;
	if (user===undefined) {
		res.redirect('/login?message=' + encodeURIComponent("Be logged in to upload an image."));
	} else {
		if(!req.files) {
			return res.status(400).send('No files were uploaded.');
		} else {
			let picture= req.files.picture
			let picturelink= `public/img/profile/${user.id}.jpg`
			let databaseLink= `../img/profile/${user.id}.jpg`
			picture.mv(picturelink, (err)=>{
				if (err) {
					throw err
				} else {
					Picture.sync({force:false}) //Now it seems you can upload a picture only once, but the whole database will be reset. This need extension to change the link in the database if there is already a photo uploaded.
						.then(()=>{
							return Picture.create({
								picture: databaseLink,
								userId: user.id
							})
						})
						.then(()=>{
							res.redirect('/profile')
						})
						.then().catch((error)=>console.log(error))
				}
			})
		}
	}
})

app.get('/event', (req,res) =>{
    Event.sync()
    	.then(()=>{
    		User.findAll({include: [{
    			model: Picture,
    			// as: 'pictures'
    		}]})
    			.then((users)=>{
    				Event.findAll({include: [
    						{model: Comment,as: 'comments'}]
		    			// ,
		    			// order: '"updatedAt" DESC'
		    		})
		    		.then((events)=>{
		    			Announce.findAll()
		    				.then((announces)=>{
		    					Participant.findAll()
		    						.then((participants)=>{
		    							res.render('public/views/event', {
				    						events: events,
				    						users: users,
				    						announces: announces,
				    						participants:participants
		    							})
		    						})
		    				})
		    		})
    			})
    	})
    	.then().catch(error=> console.log(error))
});

app.get('/myevent', (req,res) =>{
	var user = req.session.user;
	if (user === undefined) {
        res.redirect('/login?message=' + encodeURIComponent("Please log in to view your events!"));
    }
    else {
	    Event.sync()
	    	.then(()=>{
	    		User.findAll({include: [{
	    			model: Picture,
	    			// as: 'pictures'
	    		}]})
	    			.then((users)=>{
	    				Event.findAll({
	    					where: {
	    						userId: user.id
	    					},
	    					include: [{
			    				model: Comment,
			    				as: 'comments'
			    			}]
			    			// ,
			    			// order: '"updatedAt" DESC'
			    		})
			    		.then((events)=>{
			    			Announce.findAll()
			    				.then((announces)=>{
			    					Participant.findAll()
			    					.then((participants)=>{
		    							res.render('public/views/event', {
				    						events: events,
				    						users: users,
				    						announces: announces,
				    						participants:participants
		    							})
		    						})
			    					
			    				})
			    		})
	    			})
	    	})
	    	.then().catch(error=> console.log(error))
	}
});

app.post('/specificevent', (req,res)=>{
	var user = req.session.user;
	if (user === undefined) {
        res.redirect('/login?message=' + encodeURIComponent("Please log in to view the vent you clicked!"));
    } else {
		Event.findOne({
			where: {
				id: req.body.eventId
			},
			include: [{
				model: Comment,
				as: "comments"
			}]
		})
		.then((events)=>{
			User.findAll({include: [{
				model: Picture
		}]})
		.then((users)=>{
			Announce.findAll()
				.then((announces)=>{
					Participant.findAll()
						.then((participants)=> {
							console.log(events)
							res.render('public/views/event', {
							events: [events],
							users: users,
							announces: announces,
							participants: participants
							})

					})					
				})
				
		})
		})
		.then().catch(error=> console.log(error))
	}
})

app.post('/event', (req,res) => {
	var user = req.session.user;
	if(req.body.description.length===0 || req.body.title.length===0) {
		res.end('You forgot your title or message!');
		return
	} else if (user === undefined) {
        res.redirect('/login?message=' + encodeURIComponent("Please log in to post events!"));
    } else {
		Event.sync()
			.then()
				User.findOne({
					where: {
						email: req.session.user.email
					}
				}).then((user)=>{
					return Event.create({
						title: req.body.title,
						description: req.body.description,
						address: req.body.address,
						street_number: req.body.street_number,
						city: req.body.city,
						state: req.body.state,
						postal: req.body.postal,
						country: req.body.country,
						date: req.body.date,
						time: req.body.time,
						userId: user.id
					})
				}).then().catch(error=> console.log(error))
			.then(function() {
				res.redirect('/event');
			})
			.then().catch(error => console.log(error));
	}
})

app.post('/comment', (req,res)=>{
	if(req.body.comment.length===0) {
		res.end('You forgot your comment!')
	}
	else {
		if(req.body.comment.length===0) {
			res.end('You forgot your comment!')
	} else {
		Comment.sync()
			.then()
				User.findOne({
					where: {
						email: req.session.user.email
					}
				}).then(user => {
					return Comment.create({
						body: req.body.comment,
						eventId: req.body.eventId,
						userId: user.id
					})
				}).then(function(){
					res.redirect('/event')
				}).then().catch(error => console.log(error));
	}

}
});


app.post('/announce', (req, res) => {
	var user = req.session.user;
	if (user===undefined) {
		res.redirect('/login?message=' + encodeURIComponent("Be logged in to sign up to go to an event!"));
		return
	}

	var eventId = req.body.eventId; 
			announce.sync()
			.then(function(){
				announce.findAll()
				.then(announces=> {
					console.log(announces);
					return announce.create({
						eventId: eventId,
						userId: user.id
					})
				}).then(function(){
					res.redirect('/event')
				})
			}).then().catch(error => console.log(error));
	    		

			//.then()
				//User.findOne({
					//where: {
						//email: req.session.user.email
					//}
				
})

app.post('/accept', (req, res) => {
	var user = req.session.user
	console.log(req.body.accept)
	if (req.body.accept !== undefined){
		Participant.sync()
			.then(()=>{
				return Participant.create({
					eventId: req.body.eventId,
					userId: user.id
				})
			})
				.then(()=>{
					res.redirect('/event')
				})
				.then().catch(error=> console.log(error))
	} 
	Announce.destroy({
		where: {userId: req.body.userId,
				eventId: req.body.eventId}
	})
		.then (()=>{
			res.redirect('/event')
		})
})

app.get('/logout', (req, res)=> {
    req.session.destroy(function(error) {
        if(error) {
            throw error;
        }
        res.redirect('/?message=' + encodeURIComponent("Successfully logged out."));
    })
});

var server = app.listen(3000, function() {
  console.log('The server is running at http//:localhost:' + server.address().port)
});