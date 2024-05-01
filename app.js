const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require('body-parser');
const session = require('express-session');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
// const db =require('./db')

const app = express();
const server = http.createServer(app);
const io = socketIO(server);    
const port = 8080;


// Set up bodyParser to parse form data
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs'); // Set EJS as the view engine
app.use(express.urlencoded({ extended: true }));

// Socket.io connection handling
server.listen(3000,()=>{
  console.log("server running");
});


io.on('connection', (socket) => {
  console.log('user connected:'+ socket.id);
  // Broadcast to all clients when a new user connects
  io.emit('userConnected', { id: socket.id, userColor: getRandomColor() });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Broadcast to all clients when a user disconnects
    io.emit('userDisconnected', { id: socket.id });
  });

  // Handle document updates
  socket.on('text_update', async (data) => {
    // console.log(content);
    await socket.broadcast.emit('text_update', data );
    
  });

  // Listen for cursor changes
  socket.on('cursorChange',async (data) => {
    // Broadcast the cursor changes to all clients except the sender
   await socket.broadcast.emit('cursorChange', { id: socket.id, cursorPos: data.cursorPos, userColor: data.userColor });
  });

  // socket.on('disconnect', () => {
  //   console.log('user disconnected :'+ socket.id);
  // });
});




// mongoose.connect('mongodb+srv://asaid8806:123@cluster0.uquusc9.mongodb.net/dist?retryWrites=true&w=majority', {
  // mongodb://127.0.0.1:27018,localhost:27019,localhost:27020/admin?authSource=admin&replicaSet=note
// Connect to MongoDB
mongoose.connect('mongodb+srv://asaid8806:123@cluster0.uquusc9.mongodb.net/dist?retryWrites=true&w=majority', {
  // useNewUrlParser: true,
  // useUnifiedTopology: true,
});

const db  = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});
const documentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
});

const Document = mongoose.model('Document', documentSchema);
const User = mongoose.model('User', userSchema);


// Set up express-session
app.use(session({
  secret: 'ahmed', // Change this to a random string
  resave: false,
  saveUninitialized: true,
}));


// Your routes and other Express configuration go here
app.get("/", (req, res) => {
  res.render('login'); 
});
//register
app.get("/register", (req, res) => {
  res.render('register'); 
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // Check if the username already exists
 await User.findOne({ username })
    .then(existingUser => {
      if (existingUser) {
        console.log('Username already exists');
        res.redirect('/login'); // Redirect to login page if the username already exists
      } else {
        // Create a new user and save it to the database
        const newUser = new User({
          username,
          password,
        });

        return newUser.save();
      }
    })
    .then(savedUser => {
      console.log('User saved successfully:', savedUser);
      res.redirect('/login'); // Redirect to login page after successful registration
    })
    .catch(error => {
      console.error('Error:', error);
      res.redirect('/');
    });
});
//login
app.get('/login', (req, res) => {
  res.render('login', { error: req.query.error });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username, password });
    if (user) {
      // Authentication successful, redirect to index or a dashboard
      req.session.username = username;
      res.redirect('/index');
    } else {
      // Authentication failed, redirect back to login with an error message
      res.redirect('/login?error=1');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});
//index
app.get('/index', async (req, res) => {
  const username = req.session.username
  const documents = await Document.find(); // Update with your session implementation

  res.render('index',{username,documents});
});
//documents
app.post('/documents', async (req, res) => {
  
  const title = req.body.title;
  const content=" ";
  try {
    const chosenDocument = await Document.create({ title, content });
    res.render('view-document', { chosenDocument });
    // const documentId= newDocument._id;
    // res.render('view-document', { chosenDocument });
    // res.status(201).json(newDocument);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});
// Route to render the choose document page with a dropdown list of all documents
app.post('/choose-document', async (req, res) => {
  try {
    const documentId = req.body.documentId;
    const chosenDocument = await Document.findById(documentId);

    if (!chosenDocument) {
      return res.status(404).send('Document not found');
    }

    // Render a template to view the chosen document
    res.render('view-document', { chosenDocument });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});
// Route to view the chosen document
app.get('/view-document', async (req, res) => {
  try {
    const documentId = req.query.documentId;
    const chosenDocument = await Document.findById(documentId);

    if (!chosenDocument) {
      return res.status(404).send('Document not found');
    }

    // Render the view-document page with the chosen document
    res.render('view-document', { chosenDocument });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});
// Route to save the document changes
app.post('/save-document', async (req, res) => {
  try {
    const documentId = req.body.documentId;
    const newContent = req.body.content;

    const updatedDocument = await Document.findByIdAndUpdate(
      documentId,
      { $set: { content: newContent } },
      { new: true }
    );

    if (!updatedDocument) {
      return res.status(404).send('Document not found');
    }

    // Redirect back to the view document page with the updated content
    res.redirect(`/view-document?documentId=${documentId}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});
app.post('/update-dataset',async (req, res) => {
  try {
    const documentId = req.body.documentId;
    const newContent = req.body.content;

    const updatedDocument = await Document.findByIdAndUpdate(
      documentId,
      { $set: { content: newContent } },
      { new: true }
    );

    if (!updatedDocument) {
      return res.status(404).send('Document not found');
    }

    // Redirect back to the view document page with the updated content
    res.send('Dataset updated successfully'); // Send a response back to the client
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}