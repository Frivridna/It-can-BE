import mongoose from 'mongoose'
import express from 'express'
import cors from 'cors'

const socketIo = require("socket.io")
const http = require("http"); // new
const server = http.createServer(app); // new

/* const http = require('http').createServer(app)
const socketIo = require('socket.io')(http) */



const port = process.env.PORT || 4001
const app = express()

/* const index = require("./routes/index");
app.use(index);
 */
const io = socketIo(server, {
  cors: {
    origin: "*", 
    methods: ["GET, POST"]
  }
})

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/sounds"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true })
mongoose.Promise = Promise

const urlSchema = new mongoose.Schema({
  name: {
    type: String,
    unique:true,
    required: true
  },
  url: {
    type: String,
    unique: true,
    required: true
  },
  description: {
    type: String,
    trim: true,
    required: true
  }
})

const Sound = mongoose.model('Sound', urlSchema)



// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(express.json())

// Start defining your routes here
app.get('/', (req, res) => {
  res.send('Hello world')
})

app.get('/sounds', async (req,res) => {
  const allSounds = await Sound.find()
  res.json(allSounds)
});

app.post('/sounds', async (req,res) => {
  try {
    const newSound = await new Sound({
      name: req.body.name,
      url: req.body.url,
      description: req.body.description
    }).save(); 
    res.json(newSound);
  } catch (error) {
    if(error.code===11000){
      res.status(400).json({ error: 'Duplicated value', field: error.keyValue })
    }
    res.status(400).json(error)
  }
})

io.on("connection", (socket) => {
  console.log('I am connected')
  const response = "https://testfiles-caroline-fethullah.s3.eu-north-1.amazonaws.com/testuppladdning.mp3"                       
  socket.emit("FromAPI", response);
})

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})