require('dotenv').config()

const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const connection = require('./model/connection')
const schema = require('./model/schema')
const geocode = require('./utils/geocode.js')
const GeoPoint = require('geopoint');
const users = schema.users

app.set('view-engine', 'ejs')
app.use(express.urlencoded({ extended: false }))
app.use(flash())
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))

app.get('/', checkAuthenticated, (req, res) => {
  res.render('index.ejs')
})

app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login.ejs')
})

app.post('/login', checkNotAuthenticated, async (req, res, next) => {
  try {
    const emailFromUser = req.body.email
    users.findOne({'Email':emailFromUser}, async (err, userDocs) => {
      if(!err) {
          if(userDocs) {
            try {
              if(await bcrypt.compare(req.body.password, userDocs.Password)) {
                res.send('Success')
              } else {
                res.send('Failure')
              }
            } catch (error) {
              res.status(500).send("Invalid details")
            }
          } else {
              res.send('User not registered. Please register first');
          }
      } else {
          res.status(400).json(err);
      }
  })
  } catch {
    res.redirect('/register')
  }
})

app.get('/login/admin', checkNotAuthenticated, (req, res) => {
  res.render('loginAdmin.ejs')
})

app.post('/login/admin', checkNotAuthenticated, async (req, res, next) => {
  try {
    console.log("Inside admin login")
    const emailFromUser = req.body.email
    users.findOne({'Email':emailFromUser}, async (err, userDocs) => {
      if(!err) {
          if(userDocs) {
            console.log(userDocs.Role)
            if(userDocs.Role != 'Admin') {
              res.send('Not allowed to access')
            } else {
              try {
                if(await bcrypt.compare(req.body.password, userDocs.Password)) {
                  res.send('Success')
                } else {
                  res.send('Failure')
                }
              } catch (error) {
                res.status(500).send("Invalid details")
              }
            }
            
          } else {
              res.send('User not registered. Please register first');
          }
      } else {
          res.status(400).json(err);
      }
  })
  } catch {
    res.redirect('/register')
  }
})

app.get('/register', checkNotAuthenticated, (req, res) => {
  res.render('register.ejs')
})

app.post('/register', checkNotAuthenticated, async (req, res, next) => {
  try {
    const emailFromUser = req.body.email
    const salt = await bcrypt.genSalt()
    const hashedPassword = await bcrypt.hash(req.body.password, salt)
    users.findOne({'Email':emailFromUser}, (err, userDocs) => {
      if(!err) {
          if(userDocs) {
              res.send('User already registered!');
          } else {
              geocode(req.body.location, (error, {latitude, longitude, location} = {}) => {
                if(error) {
                    return console.log(error)
                } else {
                  users.findOne({'Role':'Admin'}, (err, adminUserDocs) => {
                    if(adminUserDocs) {
                      console.log(adminUserDocs)
                      let point1 = new GeoPoint(latitude, longitude)
                      let adminLatitude = adminUserDocs.Latitude
                      let adminLongitude = adminUserDocs.Longitude
                      let point2 = new GeoPoint(adminLatitude, adminLongitude)
                      let distance = point1.distanceTo(point2, true)
                      console.log('Distance: ',distance)
                      if(distance>100) {
                        res.send('Location distance beyond 100 kms')
                      } else {
                          const user = new users({
                            "Id" : Date.now().toString(),
                            "Name" : req.body.name,
                            "Email" : req.body.email,
                            "Password" : hashedPassword,
                            "Location" : location,
                            "Latitude" : latitude,
                            "Longitude" : longitude,
                            "Role" : req.body.role
                        })
                          user.save((err, result) => {
                            if(err) {
                                res.status(400).json("Incorrect field value");
                            } else {
                                res.json("Success");
                            }
                        });
                      }
                      
                      
                    } else {
                      const user = new users({
                        "Id" : Date.now().toString(),
                        "Name" : req.body.name,
                        "Email" : req.body.email,
                        "Password" : hashedPassword,
                        "Location" : location,
                        "Latitude" : latitude,
                        "Longitude" : longitude,
                        "Role" : req.body.role
                    })
                      user.save((err, result) => {
                        if(err) {
                            res.status(400).json("Incorrect field value");
                        } else {
                            res.json("Success");
                        }
                    });
                    }
                  })
                  

                  
                  
                  
                }
              })                
          }
      } else {
          res.status(400).json(err);
      }
  })
  } catch {
    res.redirect('/register')
  }
})

app.delete('/logout', (req, res) => {
  req.logOut()
  res.redirect('/login')
})

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }
  res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/')
  }
  next()
}

app.listen(3000)