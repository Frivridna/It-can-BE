import mongoose from 'mongoose'
import express from 'express'
import cors from 'cors'
import listEndpoints from 'express-list-endpoints'
import bcrypt from 'bcrypt'
import crypto from 'crypto'

const http = require("http")
const app = express()
const server = http.createServer(app)
const { Server } = require("socket.io")

const port = process.env.PORT || 4001

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET, POST"]
  }
})

// Change name to generateRoomId ? this is NOT a secret - eg. no crypto according to person who works with internet security. Change how we name things :) 
const setSecretCode = (length) => {
  const randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for ( let i = 0; i < length; i++ ) {
      result += randomChars.charAt(Math.floor(Math.random() * randomChars.length))
  }
  return result
}

let userAId
let userBId
let amountOfPerson
let secret

io.on("connection", (socket) => {
  console.log("I am connected", socket.id)

  socket.on('create', () => {
    // new code
    let secretCode = setSecretCode(4)
    io.emit('sendCode', secretCode)
    userAId = socket.id
    console.log("User A joined with id", socket.id)
    socket.join(secretCode)
    console.log('room created')
    
  })
  // User B input 
  socket.on('join-room', (roomId) => {
    console.log(`User A id is still here? ${userAId}`)
    console.log(`User B joined with id: , ${userBId}`)
    socket.join(roomId)
    if (io.sockets.adapter.rooms.get(roomId).size < 2) {
      // use case: user A has closed down the browser, then user B will be assigned role A here: 
      userAId = socket.id
    } else if (io.sockets.adapter.rooms.get(roomId).size === 2) {
      console.log(`Amount of Users in room ${roomId} right now`, io.sockets.adapter.rooms.get(roomId).size)
      userBId = socket.id
      // start session
      io.to(userAId).emit('FromAPI', 'https://testfiles-caroline-fethullah.s3.eu-north-1.amazonaws.com/testuppladdning.mp3')
      // var sockets = io.sockets.sockets;
      // console.log(sockets)
        console.log(`Sending URL to user A: ${userAId}`)
        console.log(`Sending URL to user B: ${userBId}`)
      io.to(userBId).emit('FromSecondAPI', 'https://testfiles-caroline-fethullah.s3.eu-north-1.amazonaws.com/Franz+Edvard+Cedrins+-+ICSLP.mp3')
    } else if (amountOfPerson = io.sockets.adapter.rooms.get(roomId).size >= 2) {
      // room is full - there is no way to prevent more user's to join a room, but we can send this message to FE
      //io.to(socketId).emit('status', "Hello! It's already ${amountOfPerson} persons in the room, please try again")
      //io.emit('GlobalRoom', 'The room is already full')
    }
  })

    // We can emit to the 3rd socket id that is trying to join a room: 
    // 1) Pick out 3rd person's socket.id - HOW to do that? 
    // 2.) Emit to only the socket id:s that is >= 2 and not to the room. 
    // if (io.sockets.adapter.rooms.get(userBInput).size >= 2) {
    // let amountOfPerson = io.sockets.adapter.rooms.get(userBInput).size >= 2  
})

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/sounds"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true })
mongoose.Promise = Promise

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(express.json())

// TODO: Add Caroline and Fethullah as admin
const Admin = mongoose.model('Admin', {
  username: {
    type: String, 
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString('hex')
  }
})

const authenticateAdmin = async (req, res, next) => {
  const accessToken = req.header('Authorization')
  try {
    const admin = await Admin.findOne({ accessToken })
    if (admin) {
      next()
    } else {
      res.status(401).json({ success: false, loggedOut: true, message: "Not authenticated" })
    }
  } catch (error) {
    res.status(400).json({ success: false, message: "Invalid request", error})
  }
}

// Remember to DELETE this endpoint after we have signed up ONCE, and have connected to MongoAtlas *** 
app.post('/signup', async (req, res) => {
  const { username, password } = req.body

  try {
    const salt = bcrypt.genSaltSync();
    const newAdmin = await new Admin ({
      username, 
      password: bcrypt.hashSync(password, salt)
    }).save();
    if (newAdmin) {
      res.json({
        success: true,
        userID: newAdmin._id,
        username: newAdmin.username,
        accessToken: newAdmin.accessToken
      });
    }
  } catch(error) {
    if(error.code===11000){
      res.status(400).json({ success: false, error: 'Username already exists', field: error.keyValue })
    }
    res.status(400).json({ success: false, message: 'Invalid Request', error })
  }
})

app.post('/signin', async (req, res) => {
  const { username, password } = req.body;
  try {
    const admin = await Admin.findOne({ username })
    if (admin && bcrypt.compareSync(password, admin.password)) {
      res.json({
        success: true,
        userID: admin._id,
        username: admin.username,
        accessToken: admin.accessToken
      })
    } else {
      res.status(404).json({ success: false, message: "User not found" })
    }
  } catch (error) {
    res.status(400).json({ success: false, message: "Invalid request", error })
  }
})

// Add sound
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


// Start defining routes
app.get('/', (req, res) => {
  res.send(listEndpoints(app))
})

app.get('/sounds', authenticateAdmin)
app.get('/sounds', async (req,res) => {
  const allSounds = await Sound.find()
  res.json(allSounds)
});

app.post('/sounds', authenticateAdmin)
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

app.delete('/sounds/:id', authenticateAdmin)
app.delete('/sounds/:id', async (req, res) => {
  const { id } = req.params

  try {                          
    const deletedSound = await Sound.findByIdAndDelete(id) 
    if (deletedSound) {
      res.status(200).json(deletedSound)
    } else {
      res.status(404).json({ message: 'Not found' })
    } 
  } catch (error) { 
    res.status(400).json({ message: 'Invalid request', error })
  }
})

app.put('/sounds/:id', authenticateAdmin)
app.put('/sounds/:id', async (req, res) => {
  const {id} = req.params

  try {                                                  
    const updatedSound = await Sound.findOneAndReplace({ _id: id }, req.body, { new: true })
    if (updatedSound) {
      res.status(200).json(updatedSound)
    } else {
      res.status(404).json({ message: 'Not found'})
    }
  } catch(error) {
    res.status(400).json({ message: 'Invalid request', error })
  }
})

// Start the server
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
