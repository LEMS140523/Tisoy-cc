const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const cors = require('cors');
const dotenv = require('dotenv');

const router = express.Router();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({
  origin: ["http://localhost:3000", "https://tisoy-cc-173j.onrender.com"]
}));

// Invoke dotenv to load environment variables
dotenv.config();

// Add these middleware to your app configuration
app.use(cookieParser());
app.use(
  session({
    secret: 'your_secret_key',
    resave: true,
    saveUninitialized: true
  })
);

const url = "mongodb+srv://tisoy-project:tisoy@tisoyproject.ajksfq9.mongodb.net/?retryWrites=true&w=majority";

mongoose
  .connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log('MongoDB Connection Succeeded.');
  })
  .catch((err) => {
    console.log('Error in DB connection: ' + err);
  });

// Rest of your code...



var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {});

var userSchema = new mongoose.Schema({
    unique_id: { type: String, unique: true },
    email: String,
    password: String,
    passwordConf: String,
    usdtBalance: { type: Number, default: 0 }
  });
  
  userSchema.index({ email: 1 }, { unique: true });
  
  var User = mongoose.model('User', userSchema);
  


const userRequestSchema = new mongoose.Schema({
  uniqueId: { type: String, required: true },
  tokenAddress: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  text: { type: String, required: true},
});

const UserRequest = mongoose.model('UserRequest', userRequestSchema);

// Other code and configurations



app.use(express.static(path.join(__dirname, 'views')));

const jwtSecret = 'your-secret-key'; // Replace with your desired secret key

function generateUniqueId(length) {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;

  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}
 
app.post('/signup', async function (req, res) {
  var userData = req.body;

  try {
    // Check if email already exists in the database
    const existingUser = await User.findOne({ email: userData.email });

    if (existingUser) {
      return res.status(409).redirect('/ema');
    }

    // Check if password and confirm password match
    if (userData.password !== userData.passwordConf) {
      return res.status(400).redirect('/new-pass');
    }

    // Generate a unique ID for the user
    var uniqueId = generateUniqueId(8);

    // Create a new user with the provided data and unique ID
    var newUser = new User({
      unique_id: uniqueId,
      email: userData.email,
      password: userData.password,
      passwordConf: userData.passwordConf,
      usdtBalance: 0
    });

    // Save the new user to the database
    const savedUser = await newUser.save();

    // Render the signup success page
    res.render('signup-success');

  } catch (err) {
    console.log(err);
    return res.status(500).send('An error occurred');
  }
});

// ...

app.post('/recovery', async (req, res) => {
  const { email } = req.body;

  try {
    // Check if the email exists in the database
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).redirect('/user-error');
    }

    const token = jwt.sign({ email }, jwtSecret, { expiresIn: '24h' });
    const resetUrl = `https://tisoy.cc/reset-password/${user._id}/${token}`;

    // Send the password reset email
    const transporter = nodemailer.createTransport({
      service: 'SMTP',
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {

        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: email, // Use the submitted email from the forgot password form
      subject: 'Password Reset',
      text: `Click the following link to reset your password: ${resetUrl}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        return res.status(500).send('An error occurred while sending the email');
      }
      console.log('Email sent: ' + info.response);
      res.redirect('/em-re');
    });
  } catch (err) {
    console.log(err);
    return res.status(500).send('An error occurred');
  }
});

// ...

app.get('/reset-password/:id/:token', (req, res) => {
  const { id, token } = req.params;

  User.findById(id, (err, user) => {
    if (err) {
      res.send('An error occurred. Please try again later.');
      return;
    }

    if (!user) {
      res.send('Invalid id...');
      return;
    }

    try {
      jwt.verify(token, jwtSecret);
      res.render('reset-password', { email: user.email });
    } catch (error) {
      console.log(error.message);
      res.send(error.message);
    }
  });
});

app.post('/reset-password/:id/:token', (req, res) => {
  const { id, token } = req.params;
  const { password, password2 } = req.body;

  User.findById(id, (err, user) => {
    if (err) {
      res.redirect('/ser');
      return;
    }

    if (!user) {
      res.send('/inv-pas');
      return;
    }

    try {
      jwt.verify(token, jwtSecret);
      if (password !== password2) {
        res.redirect('/match');
        return;
      }
      user.password = password;
      user.save((err) => {
        if (err) {
          res.send('/ser');
        } else {
          res.redirect('/pass-up');
        }
      });
    } catch (error) {
      console.log(error.message);
      res.send(error.message);
    }
  });
});

// ...
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Check if the user exists in the database
  User.findOne({ email })
    .then((user) => {
      if (!user) {
        // User not registered
        return res.redirect('/user-error');
      }

      // Check if the password is correct
      if (user.password !== password) {
        // Invalid password
        return res.redirect('/inv-pas');
      }

      if (email === 'admin@gmail.com' && password === 'admin1') {
        // Set session variables to track admin login
        req.session.user = user;
        req.session.loggedIn = true;

        // Redirect to the admin page
        return res.redirect('/admin');
      }

      // Set session variables to track regular user login
      req.session.user = user;
      req.session.loggedIn = true;

      res.redirect(`/index?uniqueId=${user.unique_id}`);
    })
    .catch((err) => {
      console.error('Error finding user', err);
      res.redirect('/ser');
    });
});

  
  function requireLogin(req, res, next) {
    if (req.session.loggedIn) {
      next(); // User is logged in, proceed to the next middleware/route handler
    } else {
      res.redirect('/login'); // User is not logged in, redirect to the login page
    }
  }  
  
  app.get('/', (req, res) => {
    // Check if the user is logged in
    if (req.session.loggedIn) {
      // User is logged in, redirect to the index page
      res.redirect(`/index?uniqueId=${req.session.user.unique_id}`);
    } else {
      // User is not logged in, redirect to the login page
      res.redirect('/login');
    }
  });
  app.use(cookieParser());

  app.get('/', (req, res) => {
    // Check if the user has previously logged in
    const user_id = req.cookies.user_id;
    if (user_id) {
      // User has previously logged in, redirect to the index page
      res.redirect(`/index?uniqueId=${user_id}`);
    } else {
      // User has not previously logged in, redirect to the login page
      res.redirect('/login');
    }
  });
    
  app.get('/account', requireLogin, redirectToAuthorizedPage, async (req, res) => {
    const uniqueId = req.query.uniqueId;
  
    try {
      const user = await User.findOne({ unique_id: uniqueId });
  
      if (!user) {
        return res.send('User not found');
      }
  
      res.render('account', { uniqueId, usdtBalance: user.usdtBalance });
    } catch (error) {
      console.error('Error finding user', error);
      res.send('An error occurred');
    }
  });
  app.get('/withdraw', requireLogin, redirectToAuthorizedPage, async (req, res) => {
    const uniqueId = req.query.uniqueId;
  
    try {
      const user = await User.findOne({ unique_id: uniqueId });
  
      if (!user) {
        return res.send('User not found');
      }
  
      res.render('withdraw', { uniqueId, usdtBalance: user.usdtBalance });
    } catch (error) {
      console.error('Error finding user', error);
      res.send('An error occurred');
    }
  });
app.get('/security', redirectToAuthorizedPage, async (req, res) => {
    const uniqueId = req.query.uniqueId;
  
    try {
      const user = await User.findOne({ unique_id: uniqueId });
  
      if (!user) {
        return res.send('User not found');
      }
  
      res.render('security', { uniqueId, usdtBalance: user.usdtBalance });
    } catch (error) {
      console.error('Error finding user', error);
      res.send('An error occurred');
    }
  });
  
  
  // Rest of your code...
  
  


  
// Route for password change
app.post('/security', (req, res) => {
    const uniqueId = req.query.uniqueId;
    const oldPassword = req.body.oldPassword;
    const newPassword = req.body.newPassword;
    const confirmPassword = req.body.confirmPassword;
  
    // Find the user by unique ID
    User.findOne({ unique_id: uniqueId }, (err, user) => {
      if (err) {
        console.error('Error finding user:', err);
        return res.status(500).redirect('/ser');
      }
  
      // Check if the old password matches
      if (user.password !== oldPassword) {
        return res.redirect('/pass-err');
      }
  
      // Check if the new password and confirm password match
      if (newPassword !== confirmPassword) {
        return res.redirect('/new-pass');
      }
  
      // Update the password
      user.password = newPassword;
      user.save((err) => {
        if (err) {
          console.error('Error updating password:', err);
          return res.status(500).redirect('/ser');
        }
  
        return res.redirect('/pass-up');
      });
    });
  });
  function redirectToAuthorizedPage(req, res, next) {
    // Check if the user is logged in
    if (req.session.loggedIn) {
      let uniqueId = req.query.uniqueId || req.session.user.unique_id;
  
      if (!uniqueId) {
        // Redirect to the login page if the uniqueId is missing
        return res.redirect('/login');
      }
  
      // If the uniqueId is missing in the query parameter, redirect with the uniqueId appended
      if (!req.query.uniqueId) {
        return res.redirect(`${req.path}?uniqueId=${uniqueId}`);
      }
  
      // Check if the uniqueId exists in the database
      User.findOne({ unique_id: uniqueId }, (err, user) => {
        if (err) {
          console.error('Error finding user:', err);
          return res.status(500).send('An error occurred');
        }
  
        if (!user || user._id.toString() !== req.session.user._id.toString()) {
          // Redirect to the login page if the uniqueId does not exist or does not match the logged-in user's uniqueId
          return res.redirect('/login');
        }
  
        // Continue to the next middleware/route handler
        next();
      });
    } else {
      res.redirect('/login');
    }
  }
  
 
  app.get('/index', redirectToAuthorizedPage, async (req, res) => {
    const uniqueId = req.query.uniqueId;
  
    try {
      const user = await User.findOne({ unique_id: uniqueId });
  
      if (!user) {
        return res.send('User not found');
      }
  
      res.render('index', { uniqueId, usdtBalance: user.usdtBalance });
    } catch (error) {
      console.error('Error finding user', error);
      res.send('An error occurred');
    }
  });
  
// Add a new route to handle deduction and update balance
app.post('/deduct-amount', (req, res) => {
  const { uniqueId, amount } = req.body;

  // Find the user by uniqueId
  User.findOne({ unique_id: uniqueId })
    .then((user) => {
      if (!user) {
        return res.status(404).send('User not found');
      }

      // Deduct the amount from the user's balance
      user.usdtBalance -= amount;

      // Save the updated user in the database
      user.save()
        .then((updatedUser) => {
          res.status(200).redirect('/amo');
        })
        .catch((error) => {
          console.error('Error updating user balance', error);
          res.status(500).send('An error occurred while updating balance');
        });
    })
    .catch((error) => {
      console.error('Error finding user', error);
      res.status(500).send('An error occurred while finding user');
    });
});

app.post('/user-request', (req, res) => {
    const { uniqueId, tokenAddress, amount, date, time } = req.body;
  
    var userRequest = new UserRequest({
      uniqueId: uniqueId,
      amount: amount,
      tokenAddress: tokenAddress,
      date: date,
      time: time,
    });
  
    userRequest.save((err) => {
      if (err) {
        console.error('Error saving your request to database:', err);
        res.status(500).json({ error: 'Failed to save your request' });
      } else {
        console.log('User request saved successfully');
        res.status(200).json({ message: 'Your request saved successfully' });
      }
    });
  });
  
    
app.get('/signup', function (req, res) {
  res.render('signup');
});

app.get('/recovery', (req, res) => {
  res.render('recovery');
});
app.get('/user-error', (req, res) => {
res.render('user-error');
});
app.get('/index-error', (req, res) => {
res.render('index-error');
});


// ...

// ...
app.get('/admin', requireLogin, (req, res) => {
  if (req.session.user.email === 'admin@gmail.com') {
    User.find()
      .then((users) => {
        console.log('Retrieved users:', users); // Log the retrieved users
        res.render('admin', { users });
      })
      .catch((err) => {
        console.error('Error retrieving users', err);
        res.send('An error occurred');
      });
  } else {
    // If the user is not an admin, redirect to a different page or display an error message
    res.send('Access denied');
  }
});

// Route to handle the update request
app.post('/admin/update/:id', (req, res) => {
    const { id } = req.params;
    const { usdtBalance } = req.body;
  
    User.findByIdAndUpdate(id, { usdtBalance })
      .then(() => {
        console.log('User updated successfully');
        res.redirect('/admin');
      })
      .catch((err) => {
        console.error('Error updating user', err);
        res.send('An error occurred');
      });
  });
  
// ...

app.get('/userRequest', (req, res) => {
    UserRequest.find()
    .then((userRequests) => {
      console.log('Retrieved user requests:', userRequests); // Log the retrieved user requests
      res.render('userRequest', { userRequests });
    })
    .catch((err) => {
      console.error('Error retrieving user requests', err);
      res.send('An error occurred');
    });
});  
  
  // ...
 

  
  
  
  

app.get('/userRequest', (req, res) => {
res.render('userReuest');
});
app.get('/pass-err', (req, res) => {
res.render('pass-err');
});
app.get('/new-pass', (req, res) => {
res.render('new-pass');
});
app.get('/ema', (req, res) => {
res.render('ema');
});
app.get('/em-re', (req, res) => {
res.render('em-re');
});
app.get('/pass-up', (req, res) => {
res.render('pass-up');
});
app.get('/amo', (req, res) => {
res.render('amo');
});
app.get('/inv-pas', (req, res) => {
res.render('inv-pas');
});
app.get('/ser', (req, res) => {
res.render('ser');
});
app.get('/login', (req, res) => {
  res.render('login');
});
app.get('/index', (req, res) => {
    res.render('index');
  });
  
// Serve static files
// Place this middleware before your routes

// Your routes here...

// Your error handling middleware here...

app.get('/login', (req, res) => {
res.render('login'); // Assuming you have a 'login' view/template
});
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log('Server is started on http://127.0.0.1:' + PORT);
});
  